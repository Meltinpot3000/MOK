import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getPlanningCyclesForOrganization(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("planning_cycles")
    .select(
      "id, code, name, start_date, end_date, status, rolling_window_months, source_cycle_id, clone_type, cloned_at, created_at"
    )
    .eq("organization_id", organizationId)
    .order("start_date", { ascending: false });

  return data ?? [];
}

export async function getCurrentPlanningCycle(organizationId: string) {
  const cycles = await getPlanningCyclesForOrganization(organizationId);
  return cycles[0] ?? null;
}

export async function getPlanningCycleById(organizationId: string, cycleId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("planning_cycles")
    .select(
      "id, code, name, start_date, end_date, status, rolling_window_months, source_cycle_id, clone_type, cloned_at, created_at"
    )
    .eq("organization_id", organizationId)
    .eq("id", cycleId)
    .maybeSingle();

  return data ?? null;
}
