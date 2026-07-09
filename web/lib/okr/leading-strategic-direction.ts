import type { SupabaseClient } from "@supabase/supabase-js";

type Supabase = SupabaseClient;

/** Führende Stoßrichtung eines OKR-Objectives (direktes Feld, Legacy-Fallback über Junction). */
export async function fetchLeadingStrategicDirectionIdForOkr(
  supabase: Supabase,
  organizationId: string,
  cycleInstanceId: string,
  okrObjectiveId: string
): Promise<string | null> {
  const { data: obj } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("leading_strategic_direction_id")
    .eq("id", okrObjectiveId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  const direct = obj?.leading_strategic_direction_id as string | null | undefined;
  if (direct) return direct;

  const { data: junctionRows } = await supabase
    .schema("app")
    .from("okr_objective_strategy_objectives")
    .select("strategy_objective_id")
    .eq("okr_objective_id", okrObjectiveId)
    .limit(1);
  const strategyObjectiveId = junctionRows?.[0]?.strategy_objective_id;
  if (!strategyObjectiveId) return null;

  const { data: link } = await supabase
    .schema("app")
    .from("strategic_direction_objective_links")
    .select("strategic_direction_id")
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .eq("strategy_objective_id", strategyObjectiveId)
    .limit(1)
    .maybeSingle();

  return (link?.strategic_direction_id as string | undefined) ?? null;
}
