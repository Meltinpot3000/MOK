import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  computeKeyResultProgress,
  computeKeyResultTrend,
  deriveKeyResultReviewStatus,
  type ReviewStatus,
  type Trend,
} from "./key-result-progress";
import { computeObjectiveHealth } from "./objective-health";
import { deriveInitiativeHealth } from "./initiative-health";
import { aggregateProgramHealth, aggregateDirectionPerformance } from "./aggregation";

export type ReviewKeyResult = {
  id: string;
  objective_id: string;
  title: string;
  metric_type: string;
  start_value: number | null;
  target_value: number | null;
  current_value: number | null;
  due_date: string | null;
  status: string;
  progress: number;
  trend: Trend;
  reviewStatus: ReviewStatus;
};

export type ReviewObjective = {
  id: string;
  title: string;
  status: string;
  healthStatus: ReviewStatus;
  healthScore: number;
  trend: Trend;
  isOverride: boolean;
  reviewComment: string | null;
  keyResults: ReviewKeyResult[];
};

export type ReviewInitiative = {
  id: string;
  title: string;
  status: string;
  program_id: string | null;
  healthStatus: ReviewStatus;
  reviewComment: string | null;
};

export type ReviewProgram = {
  id: string;
  title: string;
  status: string;
  strategic_direction_id: string | null;
  healthStatus: ReviewStatus;
  initiativeCount: number;
};

export type ReviewDirection = {
  id: string;
  title: string;
  status: string;
  performanceStatus: ReviewStatus;
  objectiveCount: number;
  programCount: number;
};

export type ReviewDashboardData = {
  objectives: ReviewObjective[];
  directions: ReviewDirection[];
  programs: ReviewProgram[];
  initiatives: ReviewInitiative[];
  summary: {
    onTrack: number;
    atRisk: number;
    offTrack: number;
  };
};

/** Holt die Liste der Cycle-IDs inkl. Vorgaenger und Nachkommen (fuer verschachtelte Zyklen). */
async function getCycleInstanceIdsForReview(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  cycleInstanceId: string
): Promise<string[]> {
  const ids = new Set<string>([cycleInstanceId]);
  let currentId: string | null = cycleInstanceId;

  // Vorgaenger (Eltern) hinzufuegen
  while (currentId) {
    const parentRow = await supabase
      .schema("app")
      .from("cycle_instances")
      .select("parent_instance_id")
      .eq("id", currentId)
      .maybeSingle();
    const data = parentRow.data as { parent_instance_id: string | null } | null;
    const parentId = data?.parent_instance_id ?? null;
    if (!parentId) break;
    ids.add(parentId);
    currentId = parentId;
  }

  // Nachkommen (Kinder) hinzufuegen
  let frontier: string[] = [cycleInstanceId];
  while (frontier.length > 0) {
    const { data: children } = await supabase
      .schema("app")
      .from("cycle_instances")
      .select("id")
      .in("parent_instance_id", frontier);
    const childIds = ((children ?? []) as Array<{ id: string }>).map((c) => c.id);
    if (childIds.length === 0) break;
    childIds.forEach((id) => ids.add(id));
    frontier = childIds;
  }

  return [...ids];
}

export async function getReviewDashboardData(
  organizationId: string,
  cycleInstanceId: string
): Promise<ReviewDashboardData> {
  const supabase = await createSupabaseServerClient();
  const cycleIdsForReview = await getCycleInstanceIdsForReview(supabase, cycleInstanceId);

  const [objectivesResult, directionsResult, programsAllResult] = await Promise.all([
    supabase
      .schema("app")
      .from("objectives")
      .select("id, title, status")
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", cycleIdsForReview)
      .order("created_at", { ascending: false }),
    supabase
      .schema("app")
      .from("strategic_directions")
      .select("id, title, status")
      .eq("organization_id", organizationId),
    supabase
      .schema("app")
      .from("strategy_programs")
      .select("id, title, strategic_direction_id")
      .eq("organization_id", organizationId),
  ]);

  if (objectivesResult.error) {
    console.error("[getReviewDashboardData] objectives", objectivesResult.error.message);
  }
  if (directionsResult.error) {
    console.error("[getReviewDashboardData] strategic_directions", directionsResult.error.message);
  }
  if (programsAllResult.error) {
    console.error("[getReviewDashboardData] strategy_programs", programsAllResult.error.message);
  }

  const objectives = (objectivesResult.data ?? []) as Array<{
    id: string;
    title: string;
    status: string;
  }>;
  const objectiveIds = new Set(objectives.map((o) => o.id));
  const directions = (directionsResult.data ?? []) as Array<{ id: string; title: string; status: string }>;
  const programs = (programsAllResult.data ?? []) as Array<{
    id: string;
    title: string;
    strategic_direction_id: string | null;
  }>;

  const [
    keyResultsResult,
    okrUpdatesResult,
    initiativesByCycleResult,
    initiativesByProgramResult,
    directionObjectiveLinksResult,
  ] = await Promise.all([
    objectiveIds.size > 0
      ? supabase
          .schema("app")
          .from("key_results")
          .select(
            "id, objective_id, title, metric_type, start_value, target_value, current_value, due_date, status"
          )
          .eq("organization_id", organizationId)
          .in("objective_id", [...objectiveIds])
      : Promise.resolve({ data: [] }),
    supabase
      .schema("app")
      .from("okr_updates")
      .select("key_result_id, progress_value, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .schema("app")
      .from("initiatives")
      .select("id, title, status, program_id, start_date, end_date")
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", cycleIdsForReview),
    programs.length > 0
      ? supabase
          .schema("app")
          .from("initiatives")
          .select("id, title, status, program_id, start_date, end_date")
          .eq("organization_id", organizationId)
          .in("program_id", programs.map((p) => p.id))
      : Promise.resolve({ data: [] }),
    (objectiveIds.size > 0 && directions.length > 0)
      ? supabase
          .schema("app")
          .from("strategic_direction_objective_links")
          .select("strategic_direction_id, objective_id")
          .eq("organization_id", organizationId)
          .in("strategic_direction_id", directions.map((d) => d.id))
          .in("objective_id", [...objectiveIds])
      : Promise.resolve({ data: [] }),
  ]);

  const keyResultsRaw = (keyResultsResult.data ?? []) as Array<{
    id: string;
    objective_id: string;
    title: string;
    metric_type: string;
    start_value: number | null;
    target_value: number | null;
    current_value: number | null;
    due_date: string | null;
    status: string;
  }>;
  const keyResultsByObjective = keyResultsRaw.filter((kr) => objectiveIds.has(kr.objective_id));

  const okrUpdates = (okrUpdatesResult.data ?? []) as Array<{
    key_result_id: string;
    progress_value: number | null;
    created_at: string;
  }>;
  const updatesByKeyResultId = okrUpdates.reduce<Record<string, Array<{ progress_value: number | null; created_at: string }>>>(
    (acc, u) => {
      if (!acc[u.key_result_id]) acc[u.key_result_id] = [];
      acc[u.key_result_id].push({ progress_value: u.progress_value, created_at: u.created_at });
      return acc;
    },
    {}
  );

  const initiativesByCycle = (initiativesByCycleResult.data ?? []) as Array<{
    id: string;
    title: string;
    status: string;
    program_id: string | null;
    start_date: string | null;
    end_date: string | null;
  }>;
  const initiativesByProgram = (initiativesByProgramResult.data ?? []) as Array<{
    id: string;
    title: string;
    status: string;
    program_id: string | null;
    start_date: string | null;
    end_date: string | null;
  }>;
  const initiativesById = new Map(initiativesByCycle.map((i) => [i.id, i]));
  for (const i of initiativesByProgram) {
    if (!initiativesById.has(i.id)) initiativesById.set(i.id, i);
  }
  const initiatives = [...initiativesById.values()];

  const directionObjectiveLinks = (directionObjectiveLinksResult.data ?? []) as Array<{
    strategic_direction_id: string;
    objective_id: string;
  }>;

  const objectivesByDirectionId = directionObjectiveLinks.reduce<Map<string, string[]>>(
    (acc, l) => {
      const list = acc.get(l.strategic_direction_id) ?? [];
      list.push(l.objective_id);
      acc.set(l.strategic_direction_id, list);
      return acc;
    },
    new Map()
  );
  const programsByDirectionId = programs.reduce<Map<string, string[]>>((acc, p) => {
    if (!p.strategic_direction_id) return acc;
    const list = acc.get(p.strategic_direction_id) ?? [];
    list.push(p.id);
    acc.set(p.strategic_direction_id, list);
    return acc;
  }, new Map());
  const initiativesByProgramId = initiatives.reduce<Map<string, typeof initiatives>>(
    (acc, i) => {
      if (!i.program_id) return acc;
      const list = acc.get(i.program_id) ?? [];
      list.push(i);
      acc.set(i.program_id, list);
      return acc;
    },
    new Map()
  );

  const reviewObjectives: ReviewObjective[] = objectives.map((obj) => {
    const krs = keyResultsByObjective.filter((kr) => kr.objective_id === obj.id);
    const health = computeObjectiveHealth(
      { id: obj.id },
      krs,
      updatesByKeyResultId
    );
    const reviewKeyResults: ReviewKeyResult[] = krs.map((kr) => {
      const progress = computeKeyResultProgress(kr);
      const updates = updatesByKeyResultId[kr.id] ?? [];
      const trend = computeKeyResultTrend(kr, updates);
      const reviewStatus = deriveKeyResultReviewStatus(progress, trend, kr.due_date, null);
      return {
        ...kr,
        progress,
        trend,
        reviewStatus,
      };
    });
    return {
      id: obj.id,
      title: obj.title,
      status: obj.status,
      healthStatus: health.status,
      healthScore: health.score,
      trend: health.trend,
      isOverride: health.isOverride,
      reviewComment: null,
      keyResults: reviewKeyResults,
    };
  });

  const reviewInitiatives: ReviewInitiative[] = initiatives.map((i) => ({
    id: i.id,
    title: i.title,
    status: i.status,
    program_id: i.program_id,
    healthStatus: deriveInitiativeHealth(i),
    reviewComment: null,
  }));

  const reviewPrograms: ReviewProgram[] = programs.map((p) => {
    const progInitiatives = initiativesByProgramId.get(p.id) ?? [];
    return {
      id: p.id,
      title: p.title,
      status: "draft",
      strategic_direction_id: p.strategic_direction_id,
      healthStatus: aggregateProgramHealth(progInitiatives),
      initiativeCount: progInitiatives.length,
    };
  });

  const reviewDirections: ReviewDirection[] = directions.map((d) => {
    const objIds = objectivesByDirectionId.get(d.id) ?? [];
    const progIds = programsByDirectionId.get(d.id) ?? [];
    const objHealths = objIds
      .map((oid) => reviewObjectives.find((o) => o.id === oid)?.healthStatus)
      .filter((s): s is ReviewStatus => Boolean(s));
    const progHealths = progIds
      .map((pid) => reviewPrograms.find((p) => p.id === pid)?.healthStatus)
      .filter((s): s is ReviewStatus => Boolean(s));
    const performanceStatus = aggregateDirectionPerformance(objHealths, progHealths);
    return {
      id: d.id,
      title: d.title,
      status: d.status,
      performanceStatus,
      objectiveCount: objIds.length,
      programCount: progIds.length,
    };
  });

  const allStatuses = [
    ...reviewObjectives.map((o) => o.healthStatus),
    ...reviewDirections.map((d) => d.performanceStatus),
    ...reviewPrograms.map((p) => p.healthStatus),
    ...reviewInitiatives.map((i) => i.healthStatus),
  ];
  const summary = {
    onTrack: allStatuses.filter((s) => s === "on_track").length,
    atRisk: allStatuses.filter((s) => s === "at_risk").length,
    offTrack: allStatuses.filter((s) => s === "off_track").length,
  };

  return {
    objectives: reviewObjectives,
    directions: reviewDirections,
    programs: reviewPrograms,
    initiatives: reviewInitiatives,
    summary,
  };
}

export async function getReviewSnapshots(
  organizationId: string,
  cycleInstanceId: string,
  limit = 10
) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("review_snapshots")
    .select("id, snapshot_type, snapshot_at, summary_json, comment, created_by_membership_id")
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .order("snapshot_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getReviewFeedback(
  organizationId: string,
  cycleInstanceId: string,
  objectType?: string,
  objectId?: string
) {
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .schema("app")
    .from("review_feedback")
    .select("id, feedback_type, object_type, object_id, comment, created_at, created_by_membership_id")
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .order("created_at", { ascending: false });
  if (objectType && objectId) {
    q = q.eq("object_type", objectType).eq("object_id", objectId);
  }
  const { data } = await q;
  return data ?? [];
}
