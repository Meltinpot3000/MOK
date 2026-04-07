import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildCeoKpis, type KpiCard } from "@/lib/ceo/kpis";

export type PlanningCycle = {
  id: string;
  code: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  level_no?: number;
  cycle_scheme_id?: string;
  cycle_scheme_name?: string;
  is_active_scheme?: boolean;
  legacy_planning_cycle_id?: string | null;
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
  organizationName: string;
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

export type TenantBranding = {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  logo_url: string | null;
  status: "draft" | "published";
  branding_config?: Record<string, unknown> | null;
};

function pickDefaultCycle(cycles: PlanningCycle[]): PlanningCycle | null {
  if (cycles.length === 0) return null;

  const scope = cycles.some((cycle) => cycle.is_active_scheme)
    ? cycles.filter((cycle) => cycle.is_active_scheme)
    : cycles;

  const nowMs = Date.now();
  const byDeepestThenLatestStart = (a: PlanningCycle, b: PlanningCycle) =>
    (b.level_no ?? 1) - (a.level_no ?? 1) || Date.parse(b.start_date) - Date.parse(a.start_date);
  const byEarliestStartThenDeepest = (a: PlanningCycle, b: PlanningCycle) =>
    Date.parse(a.start_date) - Date.parse(b.start_date) || (b.level_no ?? 1) - (a.level_no ?? 1);
  const byLatestEndThenDeepest = (a: PlanningCycle, b: PlanningCycle) =>
    Date.parse(b.end_date) - Date.parse(a.end_date) || (b.level_no ?? 1) - (a.level_no ?? 1);

  const current = scope
    .filter((cycle) => Date.parse(cycle.start_date) <= nowMs && nowMs < Date.parse(cycle.end_date))
    .sort(byDeepestThenLatestStart);
  if (current.length > 0) return current[0];

  const upcoming = scope.filter((cycle) => Date.parse(cycle.start_date) > nowMs).sort(byEarliestStartThenDeepest);
  if (upcoming.length > 0) return upcoming[0];

  const past = scope.filter((cycle) => Date.parse(cycle.end_date) <= nowMs).sort(byLatestEndThenDeepest);
  if (past.length > 0) return past[0];

  return scope[0] ?? null;
}

const KNOWN_ORG_ROLE_LABELS_DE: Record<string, string> = {
  org_admin: "Organisations-Administration",
  executive: "Geschaeftsleitung",
  department_lead: "Bereichsleitung",
  team_member: "Teammitglied",
};

function orgRoleRankForSidebar(code: string): number {
  if (code === "org_admin") return 3;
  if (code === "executive") return 2;
  if (code === "department_lead") return 1;
  return 0;
}

/** Hoechste Rolle: org_admin > executive > department_lead > uebrige (alphabetisch). */
export function highestOrgRoleCode(roleCodes: string[]): string | null {
  const unique = [...new Set(roleCodes.map((c) => String(c).trim()).filter(Boolean))];
  if (!unique.length) return null;
  unique.sort(
    (a, b) => orgRoleRankForSidebar(b) - orgRoleRankForSidebar(a) || a.localeCompare(b)
  );
  return unique[0] ?? null;
}

/** Deutsche Kurzbezeichnung; unbekannte Codes werden als Code angezeigt. */
export function labelForOrgRoleCodeDe(code: string): string {
  return KNOWN_ORG_ROLE_LABELS_DE[code] ?? code;
}

/** Anzeige unter CITADEL: Name aus Metadaten bevorzugt, sonst E-Mail. */
export async function getAuthUserSidebarIdentity(): Promise<{
  displayLine: string;
  email: string | null;
}> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { displayLine: "", email: null };
  }
  const email = user.email?.toLowerCase() ?? null;
  const metadata =
    user.user_metadata && typeof user.user_metadata === "object"
      ? (user.user_metadata as Record<string, unknown>)
      : null;
  const fullNameRaw = metadata?.full_name ?? metadata?.name ?? metadata?.display_name;
  const fullName =
    typeof fullNameRaw === "string" && fullNameRaw.trim().length > 0 ? fullNameRaw.trim() : null;
  return { displayLine: fullName ?? email ?? "Benutzer", email };
}

/** Hoehere Zahl = bevorzugt bei Wahl der Arbeits-Membership (Sidebar + Phase0). */
function orgMembershipPreferenceRank(roleCodes: string[]): number {
  if (roleCodes.includes("org_admin")) return 3;
  if (roleCodes.includes("executive")) return 2;
  if (roleCodes.includes("department_lead")) return 1;
  return 0;
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

/**
 * Alle aktiven Organisations-Mitgliedschaften des Nutzers (jede Rolle, z. B. auch team_member),
 * sortiert nach Rollen-Prioritaet, dann aelteste Mitgliedschaft.
 */
export async function getRankedCeoAccessContexts(userId: string): Promise<CeoAccessContext[]> {
  const supabase = await createSupabaseServerClient();

  const { data: memberships } = await supabase
    .schema("app")
    .from("organization_memberships")
    .select("id, organization_id, created_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (!memberships || memberships.length === 0) {
    return [];
  }

  const membershipIds = memberships.map((membership) => membership.id);
  const organizationIds = [...new Set(memberships.map((membership) => membership.organization_id))];
  const { data: organizations } = await supabase
    .schema("app")
    .from("organizations")
    .select("id, name")
    .in("id", organizationIds);

  const organizationNameById = new Map(
    (organizations ?? []).map((organization) => [organization.id, organization.name])
  );

  const { data: memberRoles } = await supabase
    .schema("rbac")
    .from("member_roles")
    .select("membership_id, role_id")
    .in("membership_id", membershipIds);

  const memberRoleRows = memberRoles ?? [];
  const roleIds = [...new Set(memberRoleRows.map((memberRole) => memberRole.role_id))];

  const roleById = new Map<string, string>();
  if (roleIds.length > 0) {
    const { data: roles } = await supabase
      .schema("rbac")
      .from("roles")
      .select("id, code")
      .in("id", roleIds);
    for (const role of roles ?? []) {
      roleById.set(role.id, role.code);
    }
  }

  type MembershipRow = (typeof memberships)[number];
  const candidates: Array<{ membership: MembershipRow; roleCodes: string[] }> = [];
  for (const membership of memberships) {
    const roleCodes = memberRoleRows
      .filter((memberRole) => memberRole.membership_id === membership.id)
      .map((memberRole) => roleById.get(memberRole.role_id))
      .filter((roleCode): roleCode is string => Boolean(roleCode));

    candidates.push({ membership, roleCodes });
  }

  if (candidates.length === 0) {
    return [];
  }

  candidates.sort((a, b) => {
    const byRank = orgMembershipPreferenceRank(b.roleCodes) - orgMembershipPreferenceRank(a.roleCodes);
    if (byRank !== 0) return byRank;
    const ta = a.membership.created_at ? Date.parse(String(a.membership.created_at)) : 0;
    const tb = b.membership.created_at ? Date.parse(String(b.membership.created_at)) : 0;
    if (ta !== tb) return ta - tb;
    return a.membership.id.localeCompare(b.membership.id);
  });

  return candidates.map(
    (c) =>
      ({
        userId,
        organizationId: c.membership.organization_id,
        organizationName: organizationNameById.get(c.membership.organization_id) ?? "Tenant",
        membershipId: c.membership.id,
        roleCodes: c.roleCodes,
      }) satisfies CeoAccessContext
  );
}

export async function getCeoAccessContext(
  userId?: string
): Promise<CeoAccessContext | null> {
  const resolvedUserId = userId ?? (await getAuthenticatedUserId());

  if (!resolvedUserId) {
    return null;
  }

  const ranked = await getRankedCeoAccessContexts(resolvedUserId);
  return ranked[0] ?? null;
}

export async function getPlanningCyclesForOrganization(
  organizationId: string
): Promise<PlanningCycle[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("cycle_instances")
    .select(
      "id, code, name, starts_on, ends_on, status, level_no, cycle_scheme_id, legacy_planning_cycle_id, scheme:cycle_scheme_id(name, is_active)"
    )
    .eq("organization_id", organizationId)
    .order("starts_on", { ascending: false });

  const rows = (data ?? []) as Array<{
    id: string;
    code: string;
    name: string;
    starts_on: string;
    ends_on: string;
    status: string;
    level_no: number;
    cycle_scheme_id: string;
    legacy_planning_cycle_id: string | null;
    scheme:
      | { name: string; is_active: boolean }
      | Array<{ name: string; is_active: boolean }>
      | null;
  }>;

  return rows.map((row) => {
    const scheme = Array.isArray(row.scheme) ? row.scheme[0] ?? null : row.scheme ?? null;
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      start_date: row.starts_on,
      end_date: row.ends_on,
      status: row.status,
      level_no: row.level_no,
      cycle_scheme_id: row.cycle_scheme_id,
      cycle_scheme_name: scheme?.name ?? "Cycle Scheme",
      is_active_scheme: Boolean(scheme?.is_active),
      legacy_planning_cycle_id: row.legacy_planning_cycle_id,
    };
  });
}

export async function getTenantBranding(
  organizationId: string
): Promise<TenantBranding | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("tenant_branding")
    .select("primary_color, secondary_color, accent_color, logo_url, status, branding_config")
    .eq("organization_id", organizationId)
    .maybeSingle();

  return (data ?? null) as TenantBranding | null;
}

export async function getCeoDashboardData(
  organizationId: string,
  cycleId?: string
): Promise<CeoDashboardData> {
  const supabase = await createSupabaseServerClient();
  const cycles = await getPlanningCyclesForOrganization(organizationId);
  const selectedCycle = cycleId
    ? cycles.find((cycle) => cycle.id === cycleId) ?? null
    : pickDefaultCycle(cycles);

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
      .eq("cycle_instance_id", selectedCycle.id)
      .order("priority", { ascending: true }),
    supabase
      .schema("app")
      .from("functional_strategies")
      .select("id, title, function_name, status")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", selectedCycle.id)
      .order("function_name", { ascending: true }),
    supabase
      .schema("app")
      .from("strategy_objectives")
      .select("id, title, status, progress_percent")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", selectedCycle.id)
      .order("created_at", { ascending: false }),
  ]);

  const objectives = (objectivesResult.data ?? []) as Objective[];
  const { data: okrRowsForKr } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", selectedCycle.id);
  const okrIdsForKeyResults = (okrRowsForKr ?? []).map((r) => r.id);

  const { data: keyResultsData } =
    okrIdsForKeyResults.length > 0
      ? await supabase
          .schema("app")
          .from("key_results")
          .select("id, title, status, okr_objective_id")
          .eq("organization_id", organizationId)
          .in("okr_objective_id", okrIdsForKeyResults)
      : { data: [] as KeyResult[] };

  const keyResults: KeyResult[] = (keyResultsData ?? []).map((kr) => {
    const r = kr as { id: string; title: string; status: string; okr_objective_id: string };
    return {
      id: r.id,
      title: r.title,
      status: r.status,
      objective_id: r.okr_objective_id,
    };
  });

  let trendDeltaPercent: number | null = null;

  if (previousCycle) {
    const { data: previousObjectives } = await supabase
      .schema("app")
      .from("strategy_objectives")
      .select("progress_percent")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", previousCycle.id);

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
    keyResults,
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
    keyResults,
    kpis,
  };
}
