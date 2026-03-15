import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getDirectionTraceability(organizationId: string, planningCycleId: string) {
  const supabase = await createSupabaseServerClient();
  const [challengeLinksResult, annualTargetsResult, initiativeLinksResult] = await Promise.all([
    supabase
      .schema("app")
      .from("challenge_direction_links")
      .select("id, strategic_direction_id, strategic_challenge_id, contribution_level, note")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("annual_targets")
      .select("id, strategic_direction_id, title, progress_percent, is_primary")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("initiative_target_links")
      .select("id, initiative_id, annual_target_id, contribution_level")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
  ]);

  return {
    challengeLinks: challengeLinksResult.data ?? [],
    annualTargets: annualTargetsResult.data ?? [],
    initiativeTargetLinks: initiativeLinksResult.data ?? [],
  };
}

export async function getObjectiveTraceability(organizationId: string, planningCycleId: string) {
  const supabase = await createSupabaseServerClient();
  const [objectiveTargetResult, objectiveDirectionResult, keyResultTargetResult] = await Promise.all([
    supabase
      .schema("app")
      .from("objective_target_links")
      .select("id, objective_id, annual_target_id, contribution_level")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("objective_direction_links")
      .select("id, objective_id, strategic_direction_id, contribution_level")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("key_result_target_links")
      .select("id, key_result_id, annual_target_id, contribution_level")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
  ]);

  return {
    objectiveTargetLinks: objectiveTargetResult.data ?? [],
    objectiveDirectionLinks: objectiveDirectionResult.data ?? [],
    keyResultTargetLinks: keyResultTargetResult.data ?? [],
  };
}
