import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AnalysisEntry = {
  id: string;
  analysis_type: "environment" | "company" | "competitor" | "swot" | "pestel" | "workshop" | "other";
  sub_type: string | null;
  title: string;
  description: string | null;
  impact_level: number | null;
  uncertainty_level: number | null;
  quality_score: number | null;
  quality_band: "high" | "medium" | "low" | null;
  quality_source: "llm" | "rule" | null;
  quality_explanation: string | null;
  quality_calculated_at: string | null;
  quality_fallback_reason: "llm_not_requested" | "llm_no_result" | null;
  quality_provider: string | null;
  quality_model: string | null;
  quality_prompt_version: string | null;
  graph_layout_x: number | null;
  graph_layout_y: number | null;
  graph_layout_z: number | null;
  graph_layout_confidence: number | null;
  graph_layout_reason: string | null;
  graph_layout_source: "llm" | "rule" | null;
  graph_layout_fallback_reason: "llm_not_requested" | "llm_no_result" | null;
  graph_layout_provider: string | null;
  graph_layout_model: string | null;
  graph_layout_prompt_version: string | null;
  graph_layout_calculated_at: string | null;
  semantic_embedding_model: string | null;
  semantic_embedding_version: string | null;
  semantic_embedding_calculated_at: string | null;
  semantic_embedding_status: "pending" | "ready" | "failed" | null;
  created_at: string;
  updated_at: string;
};

export async function getStrategyCycleWorkspaceData(organizationId: string, cycleInstanceId: string) {
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
    challengeIndustriesResult,
    challengeBusinessModelsResult,
    directionIndustriesResult,
    directionBusinessModelsResult,
    directionOperatingModelsResult,
    industriesResult,
    businessModelsResult,
    operatingModelsResult,
    strategicDirectionsResult,
    annualTargetsResult,
    initiativesResult,
    initiativeTargetLinksResult,
    challengeCandidatesResult,
    backgroundJobsResult,
  ] = await Promise.all([
    supabase
      .schema("app")
      .from("analysis_entries")
      .select(
        "id, analysis_type, sub_type, title, description, impact_level, uncertainty_level, quality_score, quality_band, quality_source, quality_explanation, quality_calculated_at, quality_fallback_reason, quality_provider, quality_model, quality_prompt_version, graph_layout_x, graph_layout_y, graph_layout_z, graph_layout_confidence, graph_layout_reason, graph_layout_source, graph_layout_fallback_reason, graph_layout_provider, graph_layout_model, graph_layout_prompt_version, graph_layout_calculated_at, semantic_embedding_model, semantic_embedding_version, semantic_embedding_calculated_at, semantic_embedding_status, created_at, updated_at"
      )
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .order("updated_at", { ascending: false }),
    supabase
      .schema("app")
      .from("strategic_challenges")
      .select("id, title, source_analysis_entry_id, relevance_level, risk_level")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .order("created_at", { ascending: false }),
    supabase
      .schema("app")
      .from("analysis_item_link_draft")
      .select(
        "id, source_analysis_item_id, target_analysis_item_id, link_type, strength, confidence, comment, origin, provider, model, prompt_version, status, created_at, metadata"
      )
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .eq("status", "draft")
      .order("confidence", { ascending: false })
      .limit(120),
    supabase
      .schema("app")
      .from("analysis_item_link")
      .select("id, source_analysis_item_id, target_analysis_item_id, link_type, strength, confidence, comment, created_at, updated_at, metadata")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .order("confidence", { ascending: false })
      .limit(200),
    supabase
      .schema("app")
      .from("analysis_clusters")
      .select("id, label, summary, cluster_score, method, created_at")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .order("cluster_score", { ascending: false })
      .limit(30),
    supabase
      .schema("app")
      .from("analysis_cluster_members")
      .select("cluster_id, entry_id, membership_strength")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId),
    supabase
      .schema("app")
      .from("analysis_gap_findings")
      .select("id, dimension, gap_type, severity, recommendation, status, created_at")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .order("severity", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .schema("app")
      .from("challenge_direction_links")
      .select("strategic_challenge_id, strategic_direction_id")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId),
    supabase
      .schema("app")
      .from("strategic_challenge_industries")
      .select("strategic_challenge_id, industry_id")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId),
    supabase
      .schema("app")
      .from("strategic_challenge_business_models")
      .select("strategic_challenge_id, business_model_id")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId),
    supabase
      .schema("app")
      .from("strategic_direction_industries")
      .select("strategic_direction_id, industry_id")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId),
    supabase
      .schema("app")
      .from("strategic_direction_business_models")
      .select("strategic_direction_id, business_model_id")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId),
    supabase
      .schema("app")
      .from("strategic_direction_operating_models")
      .select("strategic_direction_id, operating_model_id")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId),
    supabase
      .schema("app")
      .from("industries")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId),
    supabase
      .schema("app")
      .from("business_models")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId),
    supabase
      .schema("app")
      .from("operating_models")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId),
    supabase
      .schema("app")
      .from("strategic_directions")
      .select("id, title, relevance_level, risk_level")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId),
    supabase
      .schema("app")
      .from("annual_targets")
      .select("id, title, strategic_direction_id")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId),
    supabase
      .schema("app")
      .from("initiatives")
      .select("id, title, status, priority")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .schema("app")
      .from("initiative_target_links")
      .select("id, initiative_id, annual_target_id, contribution_level, comment")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId),
    supabase
      .schema("app")
      .from("analysis_challenge_candidates")
      .select("id, title, description, priority, source_type, source_ref, status")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .schema("app")
      .from("analysis_background_jobs")
      .select("id, job_type, status, progress_done, progress_total, last_error, created_at, started_at, finished_at")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .in("status", ["pending", "running", "failed"])
      .order("created_at", { ascending: false })
      .limit(12),
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
  const industryIdsByChallengeId = new Map<string, string[]>();
  for (const row of challengeIndustriesResult.data ?? []) {
    const current = industryIdsByChallengeId.get(row.strategic_challenge_id) ?? [];
    current.push(row.industry_id);
    industryIdsByChallengeId.set(row.strategic_challenge_id, current);
  }
  const businessModelIdsByChallengeId = new Map<string, string[]>();
  for (const row of challengeBusinessModelsResult.data ?? []) {
    const current = businessModelIdsByChallengeId.get(row.strategic_challenge_id) ?? [];
    current.push(row.business_model_id);
    businessModelIdsByChallengeId.set(row.strategic_challenge_id, current);
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

  const challenges = (promotedResult.data ?? []).map((challenge) => ({
    ...challenge,
    relevance_level:
      Number.isFinite(Number(challenge.relevance_level)) ? Math.max(1, Math.min(5, Number(challenge.relevance_level))) : 3,
    risk_level: Number.isFinite(Number(challenge.risk_level)) ? Math.max(1, Math.min(5, Number(challenge.risk_level))) : 3,
  }));
  const strategicDirections = strategicDirectionsResult.data ?? [];
  const annualTargets = annualTargetsResult.data ?? [];
  const initiatives = initiativesResult.data ?? [];
  const challengeDirectionLinks = challengeDirectionLinksResult.data ?? [];
  const initiativeTargetLinks = initiativeTargetLinksResult.data ?? [];

  const challengeIdsByDirectionId = new Map<string, Set<string>>();
  for (const link of challengeDirectionLinks) {
    const current = challengeIdsByDirectionId.get(link.strategic_direction_id) ?? new Set<string>();
    current.add(link.strategic_challenge_id);
    challengeIdsByDirectionId.set(link.strategic_direction_id, current);
  }

  const targetIdsByInitiativeId = new Map<string, Set<string>>();
  for (const link of initiativeTargetLinks) {
    const current = targetIdsByInitiativeId.get(link.initiative_id) ?? new Set<string>();
    current.add(link.annual_target_id);
    targetIdsByInitiativeId.set(link.initiative_id, current);
  }

  const directionCoverageById = new Map<string, { linked: number; total: number; percent: number }>();
  const totalChallenges = challenges.length;
  for (const direction of strategicDirections) {
    const linked = challengeIdsByDirectionId.get(direction.id)?.size ?? 0;
    const percent = totalChallenges === 0 ? 0 : Math.round((linked / totalChallenges) * 100);
    directionCoverageById.set(direction.id, { linked, total: totalChallenges, percent });
  }

  const initiativeCoverageById = new Map<string, { linked: number; total: number; percent: number }>();
  const totalTargets = annualTargets.length;
  for (const initiative of initiatives) {
    const linked = targetIdsByInitiativeId.get(initiative.id)?.size ?? 0;
    const percent = totalTargets === 0 ? 0 : Math.round((linked / totalTargets) * 100);
    initiativeCoverageById.set(initiative.id, { linked, total: totalTargets, percent });
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
    strategicDirections,
    challenges,
    annualTargets,
    initiatives,
    challengeDirectionLinks,
    directionIndustries: directionIndustriesResult.data ?? [],
    directionBusinessModels: directionBusinessModelsResult.data ?? [],
    challengeIndustries: challengeIndustriesResult.data ?? [],
    challengeBusinessModels: challengeBusinessModelsResult.data ?? [],
    initiativeTargetLinks,
    challengeCandidates: challengeCandidatesResult.data ?? [],
    backgroundJobs: backgroundJobsResult.data ?? [],
    directionCoverageById,
    initiativeCoverageById,
    industryIdsByChallengeId,
    businessModelIdsByChallengeId,
    entryDimensionsByEntryId,
    entryDirectionIdsByEntryId,
    availableDimensions: {
      industries: (industriesResult.data ?? []).map((item) => ({ id: item.id, name: item.name })),
      businessModels: (businessModelsResult.data ?? []).map((item) => ({ id: item.id, name: item.name })),
      operatingModels: (operatingModelsResult.data ?? []).map((item) => ({ id: item.id, name: item.name })),
    },
  };
}
