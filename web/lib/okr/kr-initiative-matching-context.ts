import type { SupabaseClient } from "@supabase/supabase-js";

type Supabase = SupabaseClient;

export type KrInitiativeMatchingContext = {
  keyResult: {
    id: string;
    title: string;
    metricType: string;
    startValue: number | null;
    targetValue: number | null;
    measurementUnit: string | null;
  };
  objective: {
    id: string;
    title: string;
    description: string | null;
  } | null;
  strategicDirection: {
    id: string;
    title: string;
    description: string | null;
  } | null;
  initiatives: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    programId: string | null;
    programTitle: string | null;
  }>;
};

export async function buildKrInitiativeMatchingContext(input: {
  supabase: Supabase;
  organizationId: string;
  cycleInstanceId: string;
  keyResultId: string;
}): Promise<KrInitiativeMatchingContext | null> {
  const { supabase, organizationId, cycleInstanceId, keyResultId } = input;
  const { data: kr } = await supabase
    .schema("app")
    .from("key_results")
    .select(
      "id, title, metric_type, start_value, target_value, measurement_unit, okr_objective_id"
    )
    .eq("organization_id", organizationId)
    .eq("id", keyResultId)
    .maybeSingle();
  if (!kr?.id) return null;

  const { data: objective } = kr.okr_objective_id
    ? await supabase
        .schema("app")
        .from("okr_objectives")
        .select("id, title, description")
        .eq("organization_id", organizationId)
        .eq("id", kr.okr_objective_id)
        .eq("cycle_instance_id", cycleInstanceId)
        .maybeSingle()
    : { data: null };

  let strategicDirection: KrInitiativeMatchingContext["strategicDirection"] = null;
  if (objective?.id) {
    const { data: join } = await supabase
      .schema("app")
      .from("okr_objective_strategy_objectives")
      .select("strategy_objective_id")
      .eq("okr_objective_id", objective.id)
      .limit(1)
      .maybeSingle();
    if (join?.strategy_objective_id) {
      const { data: dirLink } = await supabase
        .schema("app")
        .from("strategic_direction_objective_links")
        .select("strategic_direction_id")
        .eq("organization_id", organizationId)
        .eq("cycle_instance_id", cycleInstanceId)
        .eq("strategy_objective_id", join.strategy_objective_id)
        .limit(1)
        .maybeSingle();
      if (dirLink?.strategic_direction_id) {
        const { data: dir } = await supabase
          .schema("app")
          .from("strategic_directions")
          .select("id, title, description")
          .eq("organization_id", organizationId)
          .eq("cycle_instance_id", cycleInstanceId)
          .eq("id", dirLink.strategic_direction_id)
          .maybeSingle();
        if (dir?.id) {
          strategicDirection = {
            id: dir.id,
            title: dir.title,
            description: dir.description ?? null,
          };
        }
      }
    }
  }

  const [{ data: initiativesRaw }, { data: programsRaw }] = await Promise.all([
    supabase
      .schema("app")
      .from("initiatives")
      .select("id, title, description, status, program_id")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .schema("app")
      .from("strategy_programs")
      .select("id, title")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId),
  ]);

  const programTitleById = new Map<string, string>(
    (programsRaw ?? []).map((p) => [p.id as string, p.title as string])
  );
  const initiatives = (initiativesRaw ?? []).map((i) => ({
    id: i.id as string,
    title: i.title as string,
    description: (i.description as string | null) ?? null,
    status: i.status as string,
    programId: (i.program_id as string | null) ?? null,
    programTitle:
      i.program_id && typeof i.program_id === "string" ? programTitleById.get(i.program_id) ?? null : null,
  }));

  return {
    keyResult: {
      id: kr.id,
      title: kr.title,
      metricType: kr.metric_type,
      startValue: kr.start_value,
      targetValue: kr.target_value,
      measurementUnit: kr.measurement_unit ?? null,
    },
    objective: objective?.id
      ? {
          id: objective.id,
          title: objective.title,
          description: objective.description ?? null,
        }
      : null,
    strategicDirection,
    initiatives,
  };
}

export function contextToKrInitiativeMatchingPromptJson(ctx: KrInitiativeMatchingContext): string {
  return JSON.stringify(
    {
      key_result: {
        id: ctx.keyResult.id,
        title: ctx.keyResult.title,
        metric_type: ctx.keyResult.metricType,
        start_value: ctx.keyResult.startValue,
        target_value: ctx.keyResult.targetValue,
        measurement_unit: ctx.keyResult.measurementUnit,
      },
      okr_objective: ctx.objective,
      strategic_direction: ctx.strategicDirection,
      initiatives: ctx.initiatives.map((i) => ({
        id: i.id,
        title: i.title,
        description: i.description,
        status: i.status,
        program_id: i.programId,
        program_title: i.programTitle,
      })),
    },
    null,
    2
  );
}
