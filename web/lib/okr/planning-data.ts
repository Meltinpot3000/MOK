import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOkrCycles } from "@/lib/okr/queries";
import {
  resolveStrategicDirectionForInitiative,
  type ReviewCycleAnnualTargetRow,
  type ReviewCycleProgramRow,
  type ReviewCycleInitiativeTargetLinkRow,
} from "@/lib/review/review-cycle-view-model";
import {
  initiativeIdsByKeyResultId,
  initiativeWarningNoKeyResultLink,
  keyResultWarningNoInitiativeLink,
  type InitiativeKrLinkRow,
} from "@/lib/okr/okr-planning-view-model";

const INITIATIVE_SELECT_WITH_REVIEW =
  "id, title, status, program_id, owner_membership_id, start_date, end_date, weight, progress_percent, last_review_update_at";

const INITIATIVE_SELECT_LEGACY =
  "id, title, status, program_id, owner_membership_id, start_date, end_date";

function isMissingReviewRollupColumnsError(message: string): boolean {
  if (!message.includes("does not exist")) return false;
  return (
    message.includes("weight") ||
    message.includes("progress_percent") ||
    message.includes("last_review_update_at")
  );
}

export type OkrPlanningKeyResultRow = {
  id: string;
  objectiveId: string;
  title: string;
  status: string;
  metricType: string;
  startValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
  measurementUnit: string | null;
  dueDate: string | null;
  updatedAt: string | null;
  ownerMembershipId: string | null;
  ownerDisplayName: string | null;
  linkedInitiativeIds: string[];
  linkedInitiativeTitles: string[];
  warningNoInitiativeLink: boolean;
};

export type OkrPlanningObjectiveRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  progressPercent: number;
  ownerMembershipId: string | null;
  ownerDisplayName: string | null;
  leadingStrategicDirectionId: string | null;
  leadingStrategicDirectionTitle: string | null;
  keyResults: OkrPlanningKeyResultRow[];
};

export type OkrPlanningInitiativeRow = {
  id: string;
  title: string;
  status: string;
  weight: number;
  progressPercent: number;
  lastReviewUpdateAt: string | null;
  startDate: string | null;
  endDate: string | null;
  ownerMembershipId: string | null;
  ownerDisplayName: string | null;
  programId: string | null;
  programTitle: string | null;
  strategicDirectionId: string | null;
  strategicDirectionTitle: string | null;
  linkedKeyResultTitles: string[];
  warningNoKeyResultLink: boolean;
};

export type OkrCycleOption = {
  id: string;
  name: string;
  code: string | null;
  start_date: string;
  end_date: string;
  status: string;
};

export type OkrResponsibleOption = {
  membershipId: string;
  fullName: string;
};

export type OkrPlanningWorkspaceData = {
  cycleInstanceId: string;
  okrCycles: OkrCycleOption[];
  selectedOkrCycleId: string | null;
  strategicDirections: Array<{ id: string; title: string }>;
  responsibles: OkrResponsibleOption[];
  initiatives: OkrPlanningInitiativeRow[];
  okrObjectives: OkrPlanningObjectiveRow[];
};

function pickDefaultOkrCycle(cycles: OkrCycleOption[]): string | null {
  if (cycles.length === 0) return null;
  const active = cycles.filter((c) => c.status === "active");
  const pool = active.length > 0 ? active : cycles;
  return [...pool].sort((a, b) => Date.parse(b.start_date) - Date.parse(a.start_date))[0]?.id ?? null;
}

export async function getOkrPlanningWorkspaceData(
  organizationId: string,
  cycleInstanceId: string,
  preferredOkrCycleId?: string | null
): Promise<OkrPlanningWorkspaceData> {
  const supabase = await createSupabaseServerClient();

  const okrCyclesRaw = await getOkrCycles(organizationId, cycleInstanceId);
  const okrCycles = okrCyclesRaw as OkrCycleOption[];
  const selectedOkrCycleId =
    (preferredOkrCycleId && okrCycles.some((c) => c.id === preferredOkrCycleId)
      ? preferredOkrCycleId
      : null) ?? pickDefaultOkrCycle(okrCycles);

  let initiativesFirst = await supabase
    .schema("app")
    .from("initiatives")
    .select(INITIATIVE_SELECT_WITH_REVIEW)
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });

  const initiativesQuery =
    initiativesFirst.error && isMissingReviewRollupColumnsError(initiativesFirst.error.message)
      ? await supabase
          .schema("app")
          .from("initiatives")
          .select(INITIATIVE_SELECT_LEGACY)
          .eq("organization_id", organizationId)
          .eq("cycle_instance_id", cycleInstanceId)
          .order("priority", { ascending: true })
          .order("created_at", { ascending: false })
      : initiativesFirst;

  const [
    directionsResult,
    programsResult,
    ownersResult,
    linksResult,
    targetsResult,
    objectivesResult,
    dirObjLinksResult,
  ] = await Promise.all([
    supabase
      .schema("app")
      .from("strategic_directions")
      .select("id, title")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .order("priority", { ascending: true }),
    supabase
      .schema("app")
      .from("strategy_programs")
      .select("id, title, strategic_direction_id")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId),
    supabase
      .schema("app")
      .from("responsibles")
      .select("membership_id, full_name")
      .eq("organization_id", organizationId),
    supabase
      .schema("app")
      .from("initiative_target_links")
      .select("initiative_id, annual_target_id")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId),
    supabase
      .schema("app")
      .from("annual_targets")
      .select("id, strategic_direction_id")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId),
    selectedOkrCycleId
      ? supabase
          .schema("app")
          .from("objectives")
          .select("id, title, description, status, progress_percent, okr_cycle_id, owner_membership_id")
          .eq("organization_id", organizationId)
          .eq("cycle_instance_id", cycleInstanceId)
          .eq("okr_cycle_id", selectedOkrCycleId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as const, error: null }),
    selectedOkrCycleId
      ? supabase
          .schema("app")
          .from("strategic_direction_objective_links")
          .select("objective_id, strategic_direction_id")
          .eq("organization_id", organizationId)
          .eq("cycle_instance_id", cycleInstanceId)
      : Promise.resolve({ data: [] as const, error: null }),
  ]);

  const directions = (directionsResult.data ?? []) as Array<{ id: string; title: string }>;
  const directionTitleById = new Map(directions.map((d) => [d.id, d.title]));
  const programs = (programsResult.data ?? []) as Array<{
    id: string;
    title: string;
    strategic_direction_id: string | null;
  }>;
  const programById = new Map<string, ReviewCycleProgramRow>(
    programs.map((p) => [p.id, { id: p.id, strategic_direction_id: p.strategic_direction_id }])
  );
  const programTitleById = new Map(programs.map((p) => [p.id, p.title]));
  const ownerByMembership = new Map(
    ((ownersResult.data ?? []) as Array<{ membership_id: string; full_name: string }>).map((o) => [
      o.membership_id,
      o.full_name,
    ])
  );
  const targetLinks = (linksResult.data ?? []) as ReviewCycleInitiativeTargetLinkRow[];
  const annualTargets = (targetsResult.data ?? []) as Array<{ id: string; strategic_direction_id: string }>;
  const annualTargetById = new Map<string, ReviewCycleAnnualTargetRow>(
    annualTargets.map((t) => [t.id, { id: t.id, strategic_direction_id: t.strategic_direction_id }])
  );

  type InitiativeRaw = {
    id: string;
    title: string;
    status: string;
    program_id: string | null;
    owner_membership_id: string | null;
    start_date: string | null;
    end_date: string | null;
    weight?: number | null;
    progress_percent?: number | null;
    last_review_update_at?: string | null;
  };

  const initiativesRaw = (initiativesQuery.data ?? []) as InitiativeRaw[];

  const objectives = (objectivesResult.data ?? []) as Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    progress_percent: number | null;
    okr_cycle_id: string | null;
    owner_membership_id: string | null;
  }>;
  const objectiveIds = objectives.map((o) => o.id);

  const dirLinks = (dirObjLinksResult.data ?? []) as Array<{
    objective_id: string;
    strategic_direction_id: string;
  }>;
  const leadingDirectionByObjectiveId = new Map<string, string>();
  for (const l of dirLinks) {
    if (!leadingDirectionByObjectiveId.has(l.objective_id)) {
      leadingDirectionByObjectiveId.set(l.objective_id, l.strategic_direction_id);
    }
  }

  let keyResults: Array<{
    id: string;
    objective_id: string;
    title: string;
    status: string;
    metric_type: string;
    start_value: number | null;
    target_value: number | null;
    current_value: number | null;
    measurement_unit: string | null;
    due_date: string | null;
    updated_at: string | null;
    owner_membership_id: string | null;
  }> = [];

  if (objectiveIds.length > 0) {
    const krRes = await supabase
      .schema("app")
      .from("key_results")
      .select(
        "id, objective_id, title, status, metric_type, start_value, target_value, current_value, measurement_unit, due_date, updated_at, owner_membership_id"
      )
      .eq("organization_id", organizationId)
      .in("objective_id", objectiveIds);
    keyResults = (krRes.data ?? []) as typeof keyResults;
  }

  const keyResultIds = keyResults.map((k) => k.id);
  let initiativeKrLinks: InitiativeKrLinkRow[] = [];
  if (keyResultIds.length > 0) {
    const linkRes = await supabase
      .schema("app")
      .from("initiative_key_result_links")
      .select("initiative_id, key_result_id")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .in("key_result_id", keyResultIds);
    initiativeKrLinks = (linkRes.data ?? []) as InitiativeKrLinkRow[];
  }

  const krTitleById = new Map(keyResults.map((k) => [k.id, k.title]));
  const initiativeTitleById = new Map(initiativesRaw.map((i) => [i.id, i.title]));
  const krToInitiatives = initiativeIdsByKeyResultId(initiativeKrLinks);

  const initiatives: OkrPlanningInitiativeRow[] = initiativesRaw.map((row) => {
    const resolution = resolveStrategicDirectionForInitiative(
      { id: row.id, program_id: row.program_id },
      programById,
      targetLinks,
      annualTargetById
    );
    const directionId = resolution.directionId;
    const linkedKrTitles = initiativeKrLinks
      .filter((l) => l.initiative_id === row.id)
      .map((l) => krTitleById.get(l.key_result_id))
      .filter((t): t is string => Boolean(t));

    return {
      id: row.id,
      title: row.title,
      status: row.status,
      weight: row.weight ?? 3,
      progressPercent: row.progress_percent ?? 0,
      lastReviewUpdateAt: row.last_review_update_at ?? null,
      startDate: row.start_date,
      endDate: row.end_date,
      ownerMembershipId: row.owner_membership_id,
      ownerDisplayName: row.owner_membership_id
        ? ownerByMembership.get(row.owner_membership_id) ?? null
        : null,
      programId: row.program_id,
      programTitle: row.program_id ? programTitleById.get(row.program_id) ?? null : null,
      strategicDirectionId: directionId,
      strategicDirectionTitle: directionId ? directionTitleById.get(directionId) ?? null : null,
      linkedKeyResultTitles: linkedKrTitles,
      warningNoKeyResultLink: initiativeWarningNoKeyResultLink(row.id, initiativeKrLinks),
    };
  });

  const keyResultsByObjective = new Map<string, typeof keyResults>();
  for (const kr of keyResults) {
    const list = keyResultsByObjective.get(kr.objective_id) ?? [];
    list.push(kr);
    keyResultsByObjective.set(kr.objective_id, list);
  }

  const okrObjectives: OkrPlanningObjectiveRow[] = objectives.map((obj) => {
    const dirId = leadingDirectionByObjectiveId.get(obj.id) ?? null;
    const krs = (keyResultsByObjective.get(obj.id) ?? []).map((kr) => {
      const iids = krToInitiatives.get(kr.id) ?? [];
      const krOwner = kr.owner_membership_id;
      return {
        id: kr.id,
        objectiveId: kr.objective_id,
        title: kr.title,
        status: kr.status,
        metricType: kr.metric_type,
        startValue: kr.start_value,
        targetValue: kr.target_value,
        currentValue: kr.current_value,
        measurementUnit: kr.measurement_unit,
        dueDate: kr.due_date,
        updatedAt: kr.updated_at,
        ownerMembershipId: krOwner,
        ownerDisplayName: krOwner ? ownerByMembership.get(krOwner) ?? null : null,
        linkedInitiativeIds: iids,
        linkedInitiativeTitles: iids.map((id) => initiativeTitleById.get(id) ?? id),
        warningNoInitiativeLink: keyResultWarningNoInitiativeLink(kr.id, initiativeKrLinks),
      };
    });
    return {
      id: obj.id,
      title: obj.title,
      description: obj.description,
      status: obj.status,
      progressPercent: Number(obj.progress_percent ?? 0),
      ownerMembershipId: obj.owner_membership_id,
      ownerDisplayName: obj.owner_membership_id
        ? ownerByMembership.get(obj.owner_membership_id) ?? null
        : null,
      leadingStrategicDirectionId: dirId,
      leadingStrategicDirectionTitle: dirId ? directionTitleById.get(dirId) ?? null : null,
      keyResults: krs,
    };
  });

  const responsibles: OkrResponsibleOption[] = (
    (ownersResult.data ?? []) as Array<{ membership_id: string; full_name: string }>
  ).map((r) => ({
    membershipId: r.membership_id,
    fullName: r.full_name,
  }));

  return {
    cycleInstanceId,
    okrCycles,
    selectedOkrCycleId,
    strategicDirections: directions,
    responsibles,
    initiatives,
    okrObjectives,
  };
}
