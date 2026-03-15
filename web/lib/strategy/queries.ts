import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getStrategicMetrics(organizationId: string, planningCycleId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("strategic_metrics")
    .select(
      "id, name, category, description, current_state, desired_state, importance_level, owner_membership_id"
    )
    .eq("organization_id", organizationId)
    .eq("planning_cycle_id", planningCycleId)
    .order("importance_level", { ascending: false })
    .order("name", { ascending: true });

  return data ?? [];
}

export async function getStrategicChallenges(organizationId: string, planningCycleId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("strategic_challenges")
    .select("id, title, priority, visibility, source_analysis_entry_id, created_at, updated_at")
    .eq("organization_id", organizationId)
    .eq("planning_cycle_id", planningCycleId)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  return data ?? [];
}

export async function getStrategicDirections(organizationId: string, planningCycleId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("strategic_directions")
    .select(
      "id, title, description, owner_membership_id, priority, status, grouping, created_at, updated_at"
    )
    .eq("organization_id", organizationId)
    .eq("planning_cycle_id", planningCycleId)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  return data ?? [];
}

export async function getAnnualTargets(organizationId: string, planningCycleId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("annual_targets")
    .select(
      "id, strategic_direction_id, title, baseline, current_measure, progress_percent, comment, is_primary, updated_at"
    )
    .eq("organization_id", organizationId)
    .eq("planning_cycle_id", planningCycleId)
    .order("updated_at", { ascending: false });

  return data ?? [];
}

export async function getAnalysisEntries(organizationId: string, planningCycleId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("analysis_entries")
    .select("id, analysis_type, sub_type, title, description, impact_level, created_at")
    .eq("organization_id", organizationId)
    .eq("planning_cycle_id", planningCycleId)
    .order("created_at", { ascending: false });

  return data ?? [];
}
