import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getOkrCycles(organizationId: string, planningCycleId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("okr_cycles")
    .select("id, name, code, start_date, end_date, status")
    .eq("organization_id", organizationId)
    .eq("planning_cycle_id", planningCycleId)
    .order("start_date", { ascending: false });

  return data ?? [];
}

export async function getObjectivesForCycle(organizationId: string, planningCycleId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("objectives")
    .select("id, title, description, status, progress_percent, confidence_level, okr_cycle_id, created_at")
    .eq("organization_id", organizationId)
    .eq("cycle_id", planningCycleId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getKeyResultsForObjectives(organizationId: string, objectiveIds: string[]) {
  if (objectiveIds.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("key_results")
    .select(
      "id, objective_id, title, status, metric_type, start_value, target_value, current_value, measurement_unit"
    )
    .eq("organization_id", organizationId)
    .in("objective_id", objectiveIds);

  return data ?? [];
}

export async function getOkrUpdatesForKeyResult(organizationId: string, keyResultId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("okr_updates")
    .select("id, progress_value, confidence_level, comment, created_at")
    .eq("organization_id", organizationId)
    .eq("key_result_id", keyResultId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function getOkrReviews(organizationId: string, planningCycleId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("okr_reviews")
    .select(
      "id, okr_cycle_id, review_type, summary, successes, problems, lessons_learned, next_actions, updated_at"
    )
    .eq("organization_id", organizationId)
    .eq("planning_cycle_id", planningCycleId)
    .order("updated_at", { ascending: false });

  return data ?? [];
}
