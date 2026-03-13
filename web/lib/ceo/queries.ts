import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildCeoKpis, type KpiCard } from "@/lib/ceo/kpis";

export type PlanningCycle = {
  id: string;
  code: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
};

export type StrategicGoal = {
  id: string;
  title: string;
  status: string;
  priority: number | null;
};

export type FunctionalStrategy = {
  id: string;
  title: string;
  function_name: string;
  status: string;
};

export type Objective = {
  id: string;
  title: string;
  status: string;
  progress_percent: number;
};

export type KeyResult = {
  id: string;
  title: string;
  status: string;
  objective_id: string;
};

export type CeoAccessContext = {
  userId: string;
  organizationId: string;
  membershipId: string;
  roleCodes: string[];
};

export type CeoDashboardData = {
  cycles: PlanningCycle[];
  selectedCycle: PlanningCycle | null;
  previousCycle: PlanningCycle | null;
  strategicGoals: StrategicGoal[];
  functionalStrategies: FunctionalStrategy[];
  objectives: Objective[];
  keyResults: KeyResult[];
  kpis: KpiCard[];
};

function isCeoRole(roleCode: string): boolean {
  return roleCode === "org_admin" || roleCode === "executive";
}

export async function getAuthenticatedUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return user.id;
}

export async function getCeoAccessContext(
  userId?: string
): Promise<CeoAccessContext | null> {
  const supabase = await createSupabaseServerClient();
  const resolvedUserId = userId ?? (await getAuthenticatedUserId());

  if (!resolvedUserId) {
    return null;
  }

  const { data: memberships } = await supabase
    .schema("app")
    .from("organization_memberships")
    .select("id, organization_id")
    .eq("user_id", resolvedUserId)
    .eq("status", "active");

  if (!memberships || memberships.length === 0) {
    return null;
  }

  const membershipIds = memberships.map((membership) => membership.id);
  const { data: memberRoles } = await supabase
    .schema("rbac")
    .from("member_roles")
    .select("membership_id, role_id")
    .in("membership_id", membershipIds);

  if (!memberRoles || memberRoles.length === 0) {
    return null;
  }

  const roleIds = [...new Set(memberRoles.map((memberRole) => memberRole.role_id))];
  const { data: roles } = await supabase
    .schema("rbac")
    .from("roles")
    .select("id, code")
    .in("id", roleIds);

  const roleById = new Map((roles ?? []).map((role) => [role.id, role.code]));

  for (const membership of memberships) {
    const roleCodes = memberRoles
      .filter((memberRole) => memberRole.membership_id === membership.id)
      .map((memberRole) => roleById.get(memberRole.role_id))
      .filter((roleCode): roleCode is string => Boolean(roleCode));

    if (roleCodes.some(isCeoRole)) {
      return {
        userId: resolvedUserId,
        organizationId: membership.organization_id,
        membershipId: membership.id,
        roleCodes,
      };
    }
  }

  return null;
}

export async function getPlanningCyclesForOrganization(
  organizationId: string
): Promise<PlanningCycle[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("planning_cycles")
    .select("id, code, name, start_date, end_date, status")
    .eq("organization_id", organizationId)
    .order("start_date", { ascending: false });

  return data ?? [];
}

export async function getCeoDashboardData(
  organizationId: string,
  cycleId?: string
): Promise<CeoDashboardData> {
  const supabase = await createSupabaseServerClient();
  const cycles = await getPlanningCyclesForOrganization(organizationId);
  const selectedCycle = cycleId
    ? cycles.find((cycle) => cycle.id === cycleId) ?? null
    : cycles[0] ?? null;

  if (!selectedCycle) {
    return {
      cycles,
      selectedCycle: null,
      previousCycle: null,
      strategicGoals: [],
      functionalStrategies: [],
      objectives: [],
      keyResults: [],
      kpis: buildCeoKpis({
        objectives: [],
        keyResults: [],
        functionDistribution: {},
        trendDeltaPercent: null,
      }),
    };
  }

  const selectedIndex = cycles.findIndex((cycle) => cycle.id === selectedCycle.id);
  const previousCycle = selectedIndex >= 0 ? cycles[selectedIndex + 1] ?? null : null;

  const [strategicGoalsResult, functionalStrategiesResult, objectivesResult] = await Promise.all([
    supabase
      .schema("app")
      .from("strategic_goals")
      .select("id, title, status, priority")
      .eq("organization_id", organizationId)
      .eq("cycle_id", selectedCycle.id)
      .order("priority", { ascending: true }),
    supabase
      .schema("app")
      .from("functional_strategies")
      .select("id, title, function_name, status")
      .eq("organization_id", organizationId)
      .eq("cycle_id", selectedCycle.id)
      .order("function_name", { ascending: true }),
    supabase
      .schema("app")
      .from("objectives")
      .select("id, title, status, progress_percent")
      .eq("organization_id", organizationId)
      .eq("cycle_id", selectedCycle.id)
      .order("created_at", { ascending: false }),
  ]);

  const objectives = (objectivesResult.data ?? []) as Objective[];
  const objectiveIds = objectives.map((objective) => objective.id);

  const { data: keyResultsData } =
    objectiveIds.length > 0
      ? await supabase
          .schema("app")
          .from("key_results")
          .select("id, title, status, objective_id")
          .eq("organization_id", organizationId)
          .in("objective_id", objectiveIds)
      : { data: [] as KeyResult[] };

  let trendDeltaPercent: number | null = null;

  if (previousCycle) {
    const { data: previousObjectives } = await supabase
      .schema("app")
      .from("objectives")
      .select("progress_percent")
      .eq("organization_id", organizationId)
      .eq("cycle_id", previousCycle.id);

    const currentAvg =
      objectives.length > 0
        ? objectives.reduce((sum, objective) => sum + Number(objective.progress_percent || 0), 0) /
          objectives.length
        : 0;

    const prevAvg =
      (previousObjectives ?? []).length > 0
        ? (previousObjectives ?? []).reduce(
            (sum, objective) => sum + Number(objective.progress_percent || 0),
            0
          ) / (previousObjectives ?? []).length
        : 0;

    trendDeltaPercent = currentAvg - prevAvg;
  }

  const functionDistribution = (functionalStrategiesResult.data ?? []).reduce<Record<string, number>>(
    (acc, row) => {
      const functionName = row.function_name || "Unbekannt";
      acc[functionName] = (acc[functionName] ?? 0) + 1;
      return acc;
    },
    {}
  );

  const kpis = buildCeoKpis({
    objectives,
    keyResults: (keyResultsData ?? []) as KeyResult[],
    functionDistribution,
    trendDeltaPercent,
  });

  return {
    cycles,
    selectedCycle,
    previousCycle,
    strategicGoals: (strategicGoalsResult.data ?? []) as StrategicGoal[],
    functionalStrategies: (functionalStrategiesResult.data ?? []) as FunctionalStrategy[],
    objectives,
    keyResults: (keyResultsData ?? []) as KeyResult[],
    kpis,
  };
}
