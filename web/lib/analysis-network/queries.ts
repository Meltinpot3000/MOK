import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAnalysisEntriesForCycle(organizationId: string, planningCycleId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("analysis_entries")
    .select(
      "id, organization_id, planning_cycle_id, analysis_type, sub_type, title, description, impact_level, uncertainty_level"
    )
    .eq("organization_id", organizationId)
    .eq("planning_cycle_id", planningCycleId);
  return data ?? [];
}

export async function getApprovedAnalysisLinks(organizationId: string, planningCycleId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("analysis_item_link")
    .select("id, source_analysis_item_id, target_analysis_item_id, link_type, strength, confidence, comment, created_at, updated_at, metadata")
    .eq("organization_id", organizationId)
    .eq("planning_cycle_id", planningCycleId)
    .order("confidence", { ascending: false });
  return data ?? [];
}

export async function getAnalysisLinkDrafts(organizationId: string, planningCycleId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("analysis_item_link_draft")
    .select(
      "id, source_analysis_item_id, target_analysis_item_id, link_type, strength, confidence, comment, origin, provider, model, prompt_version, status, created_at, metadata"
    )
    .eq("organization_id", organizationId)
    .eq("planning_cycle_id", planningCycleId)
    .eq("status", "draft")
    .order("confidence", { ascending: false })
    .limit(120);
  return data ?? [];
}

export async function getAnalysisClusters(organizationId: string, planningCycleId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("analysis_clusters")
    .select("id, label, summary, cluster_score, method, created_at")
    .eq("organization_id", organizationId)
    .eq("planning_cycle_id", planningCycleId)
    .order("cluster_score", { ascending: false })
    .limit(20);
  return data ?? [];
}

export async function getAnalysisClusterMembers(organizationId: string, planningCycleId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("analysis_cluster_members")
    .select("cluster_id, entry_id, membership_strength")
    .eq("organization_id", organizationId)
    .eq("planning_cycle_id", planningCycleId);
  return data ?? [];
}

export async function getAnalysisGapFindings(organizationId: string, planningCycleId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("analysis_gap_findings")
    .select("id, dimension, gap_type, severity, recommendation, status, created_at")
    .eq("organization_id", organizationId)
    .eq("planning_cycle_id", planningCycleId)
    .order("severity", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(40);
  return data ?? [];
}
