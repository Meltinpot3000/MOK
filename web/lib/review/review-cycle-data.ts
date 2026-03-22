import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_INITIATIVE_WEIGHT } from "./initiative-review-fields";
import { buildAttentionItems, type ReviewAttentionItem } from "./review-attention-rules";
import {
  buildReviewCycleInitiativeRows,
  buildReviewCycleKpis,
  buildStrategicDirectionReviewSummaries,
  type ReviewCycleInitiativeInput,
  type ReviewCycleKpis,
  type ReviewCycleProgramRow,
  type StrategicDirectionReviewSummary,
} from "./review-cycle-view-model";

const INITIATIVE_SELECT_WITH_REVIEW_ROLLUP =
  "id, title, status, program_id, owner_membership_id, start_date, end_date, execution_health_override, execution_health_override_by_membership_id, execution_health_override_at, review_comment, weight, progress_percent, last_review_update_at";

const INITIATIVE_SELECT_LEGACY =
  "id, title, status, program_id, owner_membership_id, start_date, end_date, execution_health_override, execution_health_override_by_membership_id, execution_health_override_at, review_comment";

function isMissingReviewRollupColumnsError(message: string): boolean {
  if (!message.includes("does not exist")) return false;
  return (
    message.includes("weight") ||
    message.includes("progress_percent") ||
    message.includes("last_review_update_at")
  );
}

async function fetchInitiativesForReviewCycle(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  cycleIds: string[]
) {
  const first = await supabase
    .schema("app")
    .from("initiatives")
    .select(INITIATIVE_SELECT_WITH_REVIEW_ROLLUP)
    .eq("organization_id", organizationId)
    .in("cycle_instance_id", cycleIds);

  if (!first.error) return first;

  if (isMissingReviewRollupColumnsError(first.error.message)) {
    console.warn(
      "[getReviewCycleData] initiatives: Spalten weight/progress_percent/last_review_update_at fehlen — Fallback ohne Roll-up. Bitte Migration 0073_review_initiative_rollup.sql auf dieser Datenbank ausfuehren (gleiche DB wie NEXT_PUBLIC_SUPABASE / Service-Role)."
    );
    return supabase
      .schema("app")
      .from("initiatives")
      .select(INITIATIVE_SELECT_LEGACY)
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", cycleIds);
  }

  return first;
}

async function getCycleInstanceIdsForReview(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  cycleInstanceId: string
): Promise<string[]> {
  const ids = new Set<string>([cycleInstanceId]);
  let currentId: string | null = cycleInstanceId;

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

export type ReviewCycleAnnualTargetBrief = {
  id: string;
  strategic_direction_id: string;
  title: string;
  progress_percent: number;
};

export type ReviewCycleData = {
  initiativeRows: ReviewCycleInitiativeInput[];
  directionSummaries: StrategicDirectionReviewSummary[];
  attentionItems: ReviewAttentionItem[];
  kpis: ReviewCycleKpis;
  directions: Array<{ id: string; title: string; status: string; priority: number }>;
  ownerOptions: Array<{ membership_id: string; full_name: string }>;
  annualTargetsByDirectionId: Record<string, ReviewCycleAnnualTargetBrief[]>;
  cycleInstanceId: string;
};

export async function getReviewCycleData(
  organizationId: string,
  cycleInstanceId: string
): Promise<ReviewCycleData> {
  const supabase = await createSupabaseServerClient();
  const cycleIds = await getCycleInstanceIdsForReview(supabase, cycleInstanceId);

  const [
    directionsResult,
    programsResult,
    initiativesResult,
    linksResult,
    targetsResult,
    ownersResult,
    objectivesResult,
    dirObjLinksResult,
  ] = await Promise.all([
    supabase
      .schema("app")
      .from("strategic_directions")
      .select("id, title, status, priority")
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", cycleIds)
      .order("priority", { ascending: true }),
    supabase
      .schema("app")
      .from("strategy_programs")
      .select("id, title, strategic_direction_id")
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", cycleIds),
    supabase
      .schema("app")
      .from("initiatives")
      .select(
        "id, title, status, program_id, owner_membership_id, start_date, end_date, execution_health_override, execution_health_override_by_membership_id, execution_health_override_at, review_comment, weight, progress_percent, last_review_update_at"
      )
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", cycleIds),
    supabase
      .schema("app")
      .from("initiative_target_links")
      .select("initiative_id, annual_target_id")
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", cycleIds),
    supabase
      .schema("app")
      .from("annual_targets")
      .select("id, strategic_direction_id, title, progress_percent")
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", cycleIds),
    supabase
      .schema("app")
      .from("responsibles")
      .select("membership_id, full_name")
      .eq("organization_id", organizationId),
    supabase
      .schema("app")
      .from("objectives")
      .select("id, title")
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", cycleIds),
    supabase
      .schema("app")
      .from("strategic_direction_objective_links")
      .select("strategic_direction_id, objective_id")
      .eq("organization_id", organizationId),
  ]);

  for (const label of ["directions", "programs", "initiatives", "links", "targets", "owners", "objectives", "dirObjLinks"] as const) {
    const err =
      label === "directions"
        ? directionsResult.error
        : label === "programs"
          ? programsResult.error
          : label === "initiatives"
            ? initiativesResult.error
            : label === "links"
              ? linksResult.error
              : label === "targets"
                ? targetsResult.error
                : label === "owners"
                  ? ownersResult.error
                  : label === "objectives"
                    ? objectivesResult.error
                    : dirObjLinksResult.error;
    if (err) console.error(`[getReviewCycleData] ${label}`, err.message);
  }

  const directions = (directionsResult.data ?? []) as Array<{
    id: string;
    title: string;
    status: string;
    priority: number;
  }>;
  const programs = (programsResult.data ?? []) as Array<{
    id: string;
    title: string;
    strategic_direction_id: string | null;
  }>;
  const initiativesRaw = (initiativesResult.data ?? []) as Array<{
    id: string;
    title: string;
    status: string;
    program_id: string | null;
    owner_membership_id: string | null;
    start_date: string | null;
    end_date: string | null;
    execution_health_override: string | null;
    execution_health_override_by_membership_id: string | null;
    execution_health_override_at: string | null;
    review_comment: string | null;
    weight: number | null;
    progress_percent: number | null;
    last_review_update_at: string | null;
  }>;
  const targetLinks = (linksResult.data ?? []) as Array<{
    initiative_id: string;
    annual_target_id: string;
  }>;
  const annualTargets = (targetsResult.data ?? []) as Array<{
    id: string;
    strategic_direction_id: string;
    title: string;
    progress_percent: number;
  }>;
  const ownerRows = (ownersResult.data ?? []) as Array<{ membership_id: string; full_name: string }>;
  const objectives = (objectivesResult.data ?? []) as Array<{ id: string; title: string }>;
  const directionObjectiveLinks = (dirObjLinksResult.data ?? []) as Array<{
    strategic_direction_id: string;
    objective_id: string;
  }>;

  const objectiveIds = new Set(objectives.map((o) => o.id));
  const directionIds = new Set(directions.map((d) => d.id));

  const filteredDirObjLinks = directionObjectiveLinks.filter(
    (l) => directionIds.has(l.strategic_direction_id) && objectiveIds.has(l.objective_id)
  );

  const keyResultsQuery =
    objectiveIds.size > 0
      ? await supabase
          .schema("app")
          .from("key_results")
          .select("id, objective_id, title, due_date, status")
          .eq("organization_id", organizationId)
          .in("objective_id", [...objectiveIds])
      : { data: [] as unknown[], error: null };

  if (keyResultsQuery.error) {
    console.error("[getReviewCycleData] key_results", keyResultsQuery.error.message);
  }

  const keyResults = (keyResultsQuery.data ?? []) as Array<{
    id: string;
    objective_id: string;
    title: string;
    due_date: string | null;
    status: string;
  }>;

  const programById = new Map<string, ReviewCycleProgramRow>(
    programs.map((p) => [p.id, { id: p.id, strategic_direction_id: p.strategic_direction_id }])
  );
  const programTitleById = new Map(programs.map((p) => [p.id, p.title]));
  const annualTargetById = new Map(annualTargets.map((t) => [t.id, t]));
  const ownerNameByMembership = new Map(ownerRows.map((r) => [r.membership_id, r.full_name]));

  const now = new Date();
  let overdueKeyResultCount = 0;
  for (const kr of keyResults) {
    if (!kr.due_date) continue;
    if (new Date(kr.due_date) >= now) continue;
    if (kr.status === "completed" || kr.status === "archived") continue;
    overdueKeyResultCount += 1;
  }

  const initiatives = initiativesRaw.map((row) => ({
    ...row,
    weight: row.weight ?? DEFAULT_INITIATIVE_WEIGHT,
    progress_percent: row.progress_percent ?? 0,
    program_title: row.program_id ? programTitleById.get(row.program_id) ?? null : null,
    owner_display_name: row.owner_membership_id
      ? ownerNameByMembership.get(row.owner_membership_id) ?? null
      : null,
  }));

  const initiativeRows = buildReviewCycleInitiativeRows(
    initiatives,
    programById,
    programTitleById,
    targetLinks,
    annualTargetById
  );

  const directionSummaries = buildStrategicDirectionReviewSummaries(directions, initiativeRows);
  const attentionItems = buildAttentionItems(initiativeRows, directionSummaries, directions);
  const kpis = buildReviewCycleKpis(directionSummaries, initiativeRows, overdueKeyResultCount);

  const annualTargetsByDirectionId: Record<string, ReviewCycleAnnualTargetBrief[]> = {};
  for (const t of annualTargets) {
    const list = annualTargetsByDirectionId[t.strategic_direction_id] ?? [];
    list.push({
      id: t.id,
      strategic_direction_id: t.strategic_direction_id,
      title: t.title,
      progress_percent: Number(t.progress_percent),
    });
    annualTargetsByDirectionId[t.strategic_direction_id] = list;
  }

  return {
    initiativeRows,
    directionSummaries,
    attentionItems,
    kpis,
    directions,
    ownerOptions: ownerRows,
    annualTargetsByDirectionId,
    cycleInstanceId,
  };
}
