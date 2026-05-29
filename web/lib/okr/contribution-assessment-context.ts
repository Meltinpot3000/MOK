import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchLeadingStrategicDirectionIdForOkr } from "@/lib/okr/contribution-assessment-triggers";
import { getOkrCycleInstanceScopeIds } from "@/lib/okr/queries";

type Supabase = SupabaseClient;

export const STRATEGY_OBJECTIVES_UNDER_DIRECTION_LIMIT = 20;

export type OkrContributionAssessmentContext = {
  okrObjectiveId: string;
  okrTitle: string;
  okrDescription: string | null;
  okrCycle: { name: string; startDate: string; endDate: string } | null;
  strategicDirection: { id: string; title: string; description: string | null };
  strategyObjectivesUnderDirection: Array<{
    id: string;
    title: string;
    description: string | null;
  }>;
  strategyObjectivesUnderDirectionTruncated: boolean;
  keyResults: Array<{
    id: string;
    title: string;
    status: string;
    metricType: string;
    startValue: number | null;
    targetValue: number | null;
    measurementUnit: string | null;
    initiatives: Array<{ id: string; title: string; description: string | null; status: string }>;
  }>;
};

export async function buildOkrContributionAssessmentContext(params: {
  supabase: Supabase;
  organizationId: string;
  cycleInstanceId: string;
  okrObjectiveId: string;
}): Promise<OkrContributionAssessmentContext | null> {
  const { supabase, organizationId, cycleInstanceId, okrObjectiveId } = params;

  const { data: okr } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id, title, description, okr_cycle_id")
    .eq("id", okrObjectiveId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!okr?.id) return null;

  let okrCycle: OkrContributionAssessmentContext["okrCycle"] = null;
  const okrCycleId = okr.okr_cycle_id as string | null;
  if (okrCycleId) {
    const { data: cycleRow } = await supabase
      .schema("app")
      .from("okr_cycles")
      .select("name, start_date, end_date")
      .eq("id", okrCycleId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (cycleRow?.start_date && cycleRow?.end_date) {
      okrCycle = {
        name: String(cycleRow.name ?? "OKR-Zyklus"),
        startDate: String(cycleRow.start_date),
        endDate: String(cycleRow.end_date),
      };
    }
  }

  const directionId = await fetchLeadingStrategicDirectionIdForOkr(
    supabase,
    organizationId,
    cycleInstanceId,
    okrObjectiveId
  );
  if (!directionId) return null;

  const { data: drow } = await supabase
    .schema("app")
    .from("strategic_directions")
    .select("id, title, description")
    .eq("id", directionId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!drow?.id) return null;

  const strategicDirection = {
    id: drow.id,
    title: drow.title,
    description: drow.description ?? null,
  };

  const scopeIds = await getOkrCycleInstanceScopeIds(organizationId, cycleInstanceId);
  const { data: dirLinks } = await supabase
    .schema("app")
    .from("strategic_direction_objective_links")
    .select("strategy_objective_id")
    .eq("organization_id", organizationId)
    .eq("strategic_direction_id", directionId)
    .in("cycle_instance_id", scopeIds);

  const soIdsOrdered = [...new Set((dirLinks ?? []).map((l) => l.strategy_objective_id as string))].sort(
    (a, b) => a.localeCompare(b)
  );
  const truncated = soIdsOrdered.length > STRATEGY_OBJECTIVES_UNDER_DIRECTION_LIMIT;
  const soIds = soIdsOrdered.slice(0, STRATEGY_OBJECTIVES_UNDER_DIRECTION_LIMIT);

  let strategyObjectivesUnderDirection: OkrContributionAssessmentContext["strategyObjectivesUnderDirection"] =
    [];
  if (soIds.length > 0) {
    const { data: soRows } = await supabase
      .schema("app")
      .from("strategy_objectives")
      .select("id, title, description")
      .eq("organization_id", organizationId)
      .in("id", soIds);
    const byId = new Map((soRows ?? []).map((r) => [r.id as string, r]));
    strategyObjectivesUnderDirection = soIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((r) => ({
        id: r!.id as string,
        title: r!.title as string,
        description: (r!.description as string | null) ?? null,
      }));
  }

  const { data: krRows } = await supabase
    .schema("app")
    .from("key_results")
    .select("id, title, status, metric_type, start_value, target_value, measurement_unit")
    .eq("organization_id", organizationId)
    .eq("okr_objective_id", okrObjectiveId)
    .order("created_at", { ascending: true });

  const keyResultsRaw = (krRows ?? []) as Array<{
    id: string;
    title: string;
    status: string;
    metric_type: string;
    start_value: number | null;
    target_value: number | null;
    measurement_unit: string | null;
  }>;

  const krIds = keyResultsRaw.map((k) => k.id);
  let links: Array<{ key_result_id: string; initiative_id: string }> = [];
  if (krIds.length > 0) {
    const { data: linkRows } = await supabase
      .schema("app")
      .from("initiative_key_result_links")
      .select("key_result_id, initiative_id")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .in("key_result_id", krIds);
    links = (linkRows ?? []) as typeof links;
  }

  const initiativeIds = [...new Set(links.map((l) => l.initiative_id))];
  let initiativeRows: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
  }> = [];
  if (initiativeIds.length > 0) {
    const { data: ir } = await supabase
      .schema("app")
      .from("initiatives")
      .select("id, title, description, status")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .in("id", initiativeIds);
    initiativeRows = (ir ?? []) as typeof initiativeRows;
  }
  const initiativeById = new Map(initiativeRows.map((i) => [i.id, i]));

  const initsByKr = new Map<string, string[]>();
  for (const l of links) {
    const arr = initsByKr.get(l.key_result_id) ?? [];
    arr.push(l.initiative_id);
    initsByKr.set(l.key_result_id, arr);
  }

  const keyResults: OkrContributionAssessmentContext["keyResults"] = keyResultsRaw.map((kr) => {
    const iids = [...new Set(initsByKr.get(kr.id) ?? [])];
    const initiatives = iids
      .map((id) => initiativeById.get(id))
      .filter(Boolean)
      .map((i) => ({
        id: i!.id,
        title: i!.title,
        description: i!.description ?? null,
        status: i!.status,
      }));
    return {
      id: kr.id,
      title: kr.title,
      status: kr.status,
      metricType: kr.metric_type,
      startValue: kr.start_value,
      targetValue: kr.target_value,
      measurementUnit: kr.measurement_unit,
      initiatives,
    };
  });

  return {
    okrObjectiveId: okr.id,
    okrTitle: okr.title,
    okrDescription: okr.description ?? null,
    okrCycle,
    strategicDirection,
    strategyObjectivesUnderDirection,
    strategyObjectivesUnderDirectionTruncated: truncated,
    keyResults,
  };
}

export function contextToPromptJson(ctx: OkrContributionAssessmentContext): string {
  return JSON.stringify(
    {
      evaluation_priorities: [
        "strategic_direction",
        "strategy_objectives_under_direction",
        "initiatives_via_key_results",
      ],
      leading_strategic_direction: ctx.strategicDirection,
      strategy_objectives_under_direction: ctx.strategyObjectivesUnderDirection,
      strategy_objectives_under_direction_truncated: ctx.strategyObjectivesUnderDirectionTruncated,
      okr: {
        id: ctx.okrObjectiveId,
        title: ctx.okrTitle,
        description: ctx.okrDescription,
      },
      okr_cycle: ctx.okrCycle
        ? {
            name: ctx.okrCycle.name,
            start_date: ctx.okrCycle.startDate,
            end_date: ctx.okrCycle.endDate,
          }
        : null,
      key_results: ctx.keyResults.map((kr) => ({
        id: kr.id,
        title: kr.title,
        status: kr.status,
        metric_type: kr.metricType,
        start_value: kr.startValue,
        target_value: kr.targetValue,
        measurement_unit: kr.measurementUnit,
        linked_initiatives: kr.initiatives,
      })),
    },
    null,
    2
  );
}
