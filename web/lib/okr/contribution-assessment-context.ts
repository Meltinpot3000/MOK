import type { SupabaseClient } from "@supabase/supabase-js";
import { getOkrCycleInstanceScopeIds } from "@/lib/okr/queries";

type Supabase = SupabaseClient;

export type OkrContributionAssessmentContext = {
  okrObjectiveId: string;
  okrTitle: string;
  okrDescription: string | null;
  strategicDirection: { id: string; title: string; description: string | null } | null;
  strategyObjectives: Array<{ id: string; title: string; description: string | null }>;
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
    .select("id, title, description")
    .eq("id", okrObjectiveId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!okr?.id) return null;

  const { data: junctionRows } = await supabase
    .schema("app")
    .from("okr_objective_strategy_objectives")
    .select("strategy_objective_id")
    .eq("okr_objective_id", okrObjectiveId);
  const strategyObjectiveIds = [...new Set((junctionRows ?? []).map((j) => j.strategy_objective_id))];

  let strategyObjectives: OkrContributionAssessmentContext["strategyObjectives"] = [];
  if (strategyObjectiveIds.length > 0) {
    const { data: soRows } = await supabase
      .schema("app")
      .from("strategy_objectives")
      .select("id, title, description")
      .eq("organization_id", organizationId)
      .in("id", strategyObjectiveIds);
    strategyObjectives = (soRows ?? []) as OkrContributionAssessmentContext["strategyObjectives"];
  }

  let strategicDirection: OkrContributionAssessmentContext["strategicDirection"] = null;
  const scopeIds = await getOkrCycleInstanceScopeIds(organizationId, cycleInstanceId);
  const primaryStrategyId = strategyObjectiveIds[0];
  if (primaryStrategyId) {
    const { data: dirLink } = await supabase
      .schema("app")
      .from("strategic_direction_objective_links")
      .select("strategic_direction_id")
      .eq("organization_id", organizationId)
      .eq("strategy_objective_id", primaryStrategyId)
      .in("cycle_instance_id", scopeIds)
      .limit(1)
      .maybeSingle();
    const dirId = dirLink?.strategic_direction_id;
    if (dirId) {
      const { data: drow } = await supabase
        .schema("app")
        .from("strategic_directions")
        .select("id, title, description")
        .eq("id", dirId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (drow?.id) {
        strategicDirection = {
          id: drow.id,
          title: drow.title,
          description: drow.description ?? null,
        };
      }
    }
  }

  const { data: krRows } = await supabase
    .schema("app")
    .from("key_results")
    .select(
      "id, title, status, metric_type, start_value, target_value, measurement_unit"
    )
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
    strategicDirection,
    strategyObjectives,
    keyResults,
  };
}

export function contextToPromptJson(ctx: OkrContributionAssessmentContext): string {
  return JSON.stringify(
    {
      okr: {
        id: ctx.okrObjectiveId,
        title: ctx.okrTitle,
        description: ctx.okrDescription,
      },
      strategic_direction: ctx.strategicDirection,
      strategy_objectives: ctx.strategyObjectives,
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
