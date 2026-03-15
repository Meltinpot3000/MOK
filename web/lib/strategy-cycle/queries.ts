import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AnalysisEntry = {
  id: string;
  analysis_type: "environment" | "company" | "competitor" | "swot" | "pestel" | "workshop" | "other";
  sub_type: string | null;
  title: string;
  description: string | null;
  impact_level: number | null;
  uncertainty_level: number | null;
  created_at: string;
  updated_at: string;
};

export async function getStrategyCycleWorkspaceData(organizationId: string, planningCycleId: string) {
  const supabase = await createSupabaseServerClient();
  const [
    entriesResult,
    promotedResult,
    linkDraftsResult,
    linksResult,
    clustersResult,
    clusterMembersResult,
    gapFindingsResult,
    challengeDirectionLinksResult,
    directionIndustriesResult,
    directionBusinessModelsResult,
    directionOperatingModelsResult,
    industriesResult,
    businessModelsResult,
    operatingModelsResult,
    strategicDirectionsResult,
  ] = await Promise.all([
    supabase
      .schema("app")
      .from("analysis_entries")
      .select(
        "id, analysis_type, sub_type, title, description, impact_level, uncertainty_level, created_at, updated_at"
      )
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId)
      .order("updated_at", { ascending: false }),
    supabase
      .schema("app")
      .from("strategic_challenges")
      .select("id, title, source_analysis_entry_id")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId)
      .order("created_at", { ascending: false }),
    supabase
      .schema("app")
      .from("analysis_item_link_draft")
      .select(
        "id, source_analysis_item_id, target_analysis_item_id, link_type, strength, confidence, comment, origin, provider, model, prompt_version, status, created_at, metadata"
      )
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId)
      .eq("status", "draft")
      .order("confidence", { ascending: false })
      .limit(120),
    supabase
      .schema("app")
      .from("analysis_item_link")
      .select("id, source_analysis_item_id, target_analysis_item_id, link_type, strength, confidence, comment, created_at, updated_at, metadata")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId)
      .order("confidence", { ascending: false })
      .limit(200),
    supabase
      .schema("app")
      .from("analysis_clusters")
      .select("id, label, summary, cluster_score, method, created_at")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId)
      .order("cluster_score", { ascending: false })
      .limit(30),
    supabase
      .schema("app")
      .from("analysis_cluster_members")
      .select("cluster_id, entry_id, membership_strength")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("analysis_gap_findings")
      .select("id, dimension, gap_type, severity, recommendation, status, created_at")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId)
      .order("severity", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .schema("app")
      .from("challenge_direction_links")
      .select("strategic_challenge_id, strategic_direction_id")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("strategic_direction_industries")
      .select("strategic_direction_id, industry_id")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("strategic_direction_business_models")
      .select("strategic_direction_id, business_model_id")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("strategic_direction_operating_models")
      .select("strategic_direction_id, operating_model_id")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("industries")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("business_models")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("operating_models")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("strategic_directions")
      .select("id, title")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
  ]);

  const promotedBySourceId = new Map<string, string>();
  for (const challenge of promotedResult.data ?? []) {
    if (challenge.source_analysis_entry_id) {
      promotedBySourceId.set(challenge.source_analysis_entry_id, challenge.id);
    }
  }

  const entries = (entriesResult.data ?? []) as AnalysisEntry[];
  const grouped = {
    environment: entries.filter(
      (entry) => entry.analysis_type === "environment" || entry.analysis_type === "pestel"
    ),
    company: entries.filter((entry) => entry.analysis_type === "company"),
    competitor: entries.filter((entry) => entry.analysis_type === "competitor"),
    swot: entries.filter((entry) => entry.analysis_type === "swot"),
    workshop: entries.filter((entry) => entry.analysis_type === "workshop"),
    other: entries.filter((entry) => entry.analysis_type === "other"),
  };

  const entryTitleById = new Map(entries.map((entry) => [entry.id, entry.title]));
  const industryNameById = new Map((industriesResult.data ?? []).map((item) => [item.id, item.name]));
  const businessModelNameById = new Map((businessModelsResult.data ?? []).map((item) => [item.id, item.name]));
  const operatingModelNameById = new Map((operatingModelsResult.data ?? []).map((item) => [item.id, item.name]));

  const challengeIdsBySourceEntryId = new Map<string, string[]>();
  for (const challenge of promotedResult.data ?? []) {
    if (!challenge.source_analysis_entry_id) continue;
    const current = challengeIdsBySourceEntryId.get(challenge.source_analysis_entry_id) ?? [];
    current.push(challenge.id);
    challengeIdsBySourceEntryId.set(challenge.source_analysis_entry_id, current);
  }
  const directionIdsByChallengeId = new Map<string, string[]>();
  for (const link of challengeDirectionLinksResult.data ?? []) {
    const current = directionIdsByChallengeId.get(link.strategic_challenge_id) ?? [];
    current.push(link.strategic_direction_id);
    directionIdsByChallengeId.set(link.strategic_challenge_id, current);
  }
  const industryIdsByDirectionId = new Map<string, string[]>();
  for (const row of directionIndustriesResult.data ?? []) {
    const current = industryIdsByDirectionId.get(row.strategic_direction_id) ?? [];
    current.push(row.industry_id);
    industryIdsByDirectionId.set(row.strategic_direction_id, current);
  }
  const businessModelIdsByDirectionId = new Map<string, string[]>();
  for (const row of directionBusinessModelsResult.data ?? []) {
    const current = businessModelIdsByDirectionId.get(row.strategic_direction_id) ?? [];
    current.push(row.business_model_id);
    businessModelIdsByDirectionId.set(row.strategic_direction_id, current);
  }
  const operatingModelIdsByDirectionId = new Map<string, string[]>();
  for (const row of directionOperatingModelsResult.data ?? []) {
    const current = operatingModelIdsByDirectionId.get(row.strategic_direction_id) ?? [];
    current.push(row.operating_model_id);
    operatingModelIdsByDirectionId.set(row.strategic_direction_id, current);
  }

  const entryDimensionsByEntryId = new Map<
    string,
    {
      industries: Array<{ id: string; name: string }>;
      businessModels: Array<{ id: string; name: string }>;
      operatingModels: Array<{ id: string; name: string }>;
    }
  >();
  for (const entry of entries) {
    const challengeIds = challengeIdsBySourceEntryId.get(entry.id) ?? [];
    const directionIds = new Set<string>();
    for (const challengeId of challengeIds) {
      for (const directionId of directionIdsByChallengeId.get(challengeId) ?? []) {
        directionIds.add(directionId);
      }
    }
    const industryIds = new Set<string>();
    const businessModelIds = new Set<string>();
    const operatingModelIds = new Set<string>();
    for (const directionId of directionIds) {
      for (const id of industryIdsByDirectionId.get(directionId) ?? []) industryIds.add(id);
      for (const id of businessModelIdsByDirectionId.get(directionId) ?? []) businessModelIds.add(id);
      for (const id of operatingModelIdsByDirectionId.get(directionId) ?? []) operatingModelIds.add(id);
    }
    entryDimensionsByEntryId.set(entry.id, {
      industries: [...industryIds].map((id) => ({ id, name: industryNameById.get(id) ?? id })),
      businessModels: [...businessModelIds].map((id) => ({ id, name: businessModelNameById.get(id) ?? id })),
      operatingModels: [...operatingModelIds].map((id) => ({ id, name: operatingModelNameById.get(id) ?? id })),
    });
  }
  const clusterMembersByClusterId = new Map<
    string,
    Array<{ entry_id: string; membership_strength: number }>
  >();
  for (const member of clusterMembersResult.data ?? []) {
    const current = clusterMembersByClusterId.get(member.cluster_id) ?? [];
    current.push({
      entry_id: member.entry_id,
      membership_strength: member.membership_strength,
    });
    clusterMembersByClusterId.set(member.cluster_id, current);
  }

  const entryDirectionIdsByEntryId = new Map<string, string[]>();
  for (const entry of entries) {
    const challengeIds = challengeIdsBySourceEntryId.get(entry.id) ?? [];
    const directionIds = new Set<string>();
    for (const challengeId of challengeIds) {
      for (const directionId of directionIdsByChallengeId.get(challengeId) ?? []) {
        directionIds.add(directionId);
      }
    }
    entryDirectionIdsByEntryId.set(entry.id, [...directionIds]);
  }

  return {
    entries,
    grouped,
    promotedBySourceId,
    linkDrafts: linkDraftsResult.data ?? [],
    approvedLinks: linksResult.data ?? [],
    clusters: clustersResult.data ?? [],
    clusterMembers: clusterMembersResult.data ?? [],
    clusterMembersByClusterId,
    gapFindings: gapFindingsResult.data ?? [],
    entryTitleById,
    existingChallenges: promotedResult.data ?? [],
    strategicDirections: strategicDirectionsResult.data ?? [],
    entryDimensionsByEntryId,
    entryDirectionIdsByEntryId,
    availableDimensions: {
      industries: (industriesResult.data ?? []).map((item) => ({ id: item.id, name: item.name })),
      businessModels: (businessModelsResult.data ?? []).map((item) => ({ id: item.id, name: item.name })),
      operatingModels: (operatingModelsResult.data ?? []).map((item) => ({ id: item.id, name: item.name })),
    },
  };
}
