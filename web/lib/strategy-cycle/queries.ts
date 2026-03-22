import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Key-Result-Verknuepfung einer Initiative mit OKR-Kontext (PIP-UI). */
export type InitiativeKrLinkContext = {
  key_result_id: string;
  key_result_title: string;
  objective_id: string;
  objective_title: string;
  okr_cycle_label: string | null;
};

/** Auswahloption KR + Objective fuer Initiative-Formular. */
export type PipKeyResultOption = {
  id: string;
  title: string;
  objective_id: string;
  objective_title: string;
  okr_cycle_label: string | null;
};

/** Zeile aus app.v_program_overview (Aggregat je Programm). */
export type ProgramOverviewViewRow = {
  id: string;
  title: string;
  status: string;
  owner_membership_id: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_total: number | null;
  initiative_count: number;
  initiative_active_count: number;
  initiative_done_count: number;
  progress_percent: number | string;
};

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

export async function getStrategyCycleWorkspaceData(
  organizationId: string,
  cycleInstanceId: string,
  legacyPlanningCycleId?: string | null
) {
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
    directionObjectiveLinksResult,
    challengeIndustriesResult,
    challengeBusinessModelsResult,
    directionIndustriesResult,
    directionBusinessModelsResult,
    directionOperatingModelsResult,
    objectiveIndustriesResult,
    objectiveBusinessModelsResult,
    industriesResult,
    businessModelsResult,
    operatingModelsResult,
    strategicDirectionsResult,
    objectivesResult,
    clusterObjectiveRelationsResult,
    correlationOverridesResult,
    programsResult,
    annualTargetsResult,
    initiativesResult,
    initiativeTargetLinksResult,
    challengeCandidatesResult,
    backgroundJobsResult,
    portfolioEvalResult,
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
      .select(
        "id, title, description, source_analysis_entry_id, relevance_level, risk_level, impact_score, urgency_score, scope_score, root_cause_score, challenge_score"
      )
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
      .select("strategic_challenge_id, strategic_direction_id, contribution_level")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId),
    supabase
      .schema("app")
      .from("strategic_direction_objective_links")
      .select("strategic_direction_id, objective_id, contribution_level")
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
      .from("objective_industries")
      .select("objective_id, industry_id")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId),
    supabase
      .schema("app")
      .from("objective_business_models")
      .select("objective_id, business_model_id")
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
      .select(
        "id, title, description, priority, status, grouping, relevance_level, risk_level, strategic_value_score, capability_fit_score, feasibility_score, created_at, updated_at"
      )
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
    (legacyPlanningCycleId
      ? supabase
          .schema("app")
          .from("objectives")
          .select(
            "id, title, description, importance_score, time_horizon, status, created_by_membership_id, created_by_source, ai_clarity_score, ai_strategic_relevance_score, ai_feasibility_score, ai_fit_to_company_score, ai_confidence_score, ai_external_internal_classification, ai_short_long_term_classification, ai_exploit_explore_classification, ai_issues_json, ai_improvement_suggestion, ai_summary, ai_objective_score, ai_evaluation_status, ai_evaluated_at, ai_evaluation_version, ai_manual_override, ai_manual_comment"
          )
          .eq("organization_id", organizationId)
          .or(`cycle_instance_id.eq.${cycleInstanceId},cycle_id.eq.${legacyPlanningCycleId}`)
      : supabase
          .schema("app")
          .from("objectives")
          .select(
            "id, title, description, importance_score, time_horizon, status, created_by_membership_id, created_by_source, ai_clarity_score, ai_strategic_relevance_score, ai_feasibility_score, ai_fit_to_company_score, ai_confidence_score, ai_external_internal_classification, ai_short_long_term_classification, ai_exploit_explore_classification, ai_issues_json, ai_improvement_suggestion, ai_summary, ai_objective_score, ai_evaluation_status, ai_evaluated_at, ai_evaluation_version, ai_manual_override, ai_manual_comment"
          )
          .eq("organization_id", organizationId)
          .eq("cycle_instance_id", cycleInstanceId)),
    supabase
      .schema("app")
      .from("cluster_objective_relations")
      .select("id, cluster_id, objective_id, relation_strength, gap_score")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .order("gap_score", { ascending: false }),
    supabase
      .schema("app")
      .from("strategy_correlation_status_overrides")
      .select("objective_id, challenge_id, strategic_direction_id, status, note, updated_at")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId),
    supabase
      .schema("app")
      .from("strategy_programs")
      .select(
        "id, title, description, strategic_direction_id, owner_membership_id, budget_total, timeline, status, start_date, end_date, strategic_challenge_id, program_origin, matrix_cell_score, supported_objective_ids"
      )
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
      .select(
        "id, title, description, status, priority, program_id, owner_membership_id, linked_okrs, deliverables, progress_percent"
      )
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
    supabase
      .schema("app")
      .from("cycle_instance_portfolio_evaluation")
      .select(
        "balance_score, distribution_internal_external_json, distribution_exploit_explore_json, distribution_short_long_json, portfolio_gaps_json, portfolio_risks_json, portfolio_recommendation, portfolio_evaluated_at"
      )
      .eq("cycle_instance_id", cycleInstanceId)
      .maybeSingle(),
  ]);

  const promotedBySourceId = new Map<string, string>();
  const promotedClusterIds = new Set<string>();
  for (const challenge of promotedResult.data ?? []) {
    if (challenge.source_analysis_entry_id) {
      promotedBySourceId.set(challenge.source_analysis_entry_id, challenge.id);
    }
  }
  const { data: promotedClusters, error: promotedClustersError } = await supabase
    .schema("app")
    .from("strategic_challenges")
    .select("source_cluster_id")
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .not("source_cluster_id", "is", null);
  if (!promotedClustersError && promotedClusters) {
    for (const row of promotedClusters) {
      if (row.source_cluster_id) promotedClusterIds.add(row.source_cluster_id);
    }
  }
  // promotedClustersError occurs when source_cluster_id column does not exist (before migration 0065)

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
  const industryIdsByObjectiveId = new Map<string, string[]>();
  for (const row of objectiveIndustriesResult.data ?? []) {
    const current = industryIdsByObjectiveId.get(row.objective_id) ?? [];
    current.push(row.industry_id);
    industryIdsByObjectiveId.set(row.objective_id, current);
  }
  const businessModelIdsByObjectiveId = new Map<string, string[]>();
  for (const row of objectiveBusinessModelsResult.data ?? []) {
    const current = businessModelIdsByObjectiveId.get(row.objective_id) ?? [];
    current.push(row.business_model_id);
    businessModelIdsByObjectiveId.set(row.objective_id, current);
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
  const objectives = objectivesResult.data ?? [];
  const creatorMembershipIds = [
    ...new Set(
      (objectives as Array<{ created_by_membership_id?: string | null }>)
        .map((o) => o.created_by_membership_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const creatorDisplayNameByMembershipId = new Map<string, string>();
  if (creatorMembershipIds.length > 0) {
    const { data: creatorRows } = await supabase
      .schema("app")
      .from("organization_memberships")
      .select("id, responsibles!organization_memberships_responsible_id_fkey(full_name, email)")
      .in("id", creatorMembershipIds);
    for (const row of creatorRows ?? []) {
      const resp = (row as { responsibles?: { full_name?: string; email?: string } | null }).responsibles;
      const label = resp?.full_name?.trim() || resp?.email?.trim() || null;
      if (label) creatorDisplayNameByMembershipId.set(row.id, label);
    }
  }
  const clusterObjectiveRelations = clusterObjectiveRelationsResult.data ?? [];
  const correlationStatusOverrides = correlationOverridesResult.data ?? [];
  const programs = programsResult.data ?? [];
  let programOverviews: ProgramOverviewViewRow[] = [];
  if (programs.length > 0) {
    const { data: overviewRows, error: overviewError } = await supabase
      .schema("app")
      .from("v_program_overview")
      .select("*")
      .in(
        "id",
        programs.map((p) => (p as { id: string }).id)
      );
    if (overviewError) {
      console.error("[getStrategyCycleWorkspaceData] v_program_overview", overviewError.message);
    } else {
      programOverviews = (overviewRows ?? []) as ProgramOverviewViewRow[];
    }
  }
  const annualTargets = annualTargetsResult.data ?? [];
  type WorkspaceInitiative = {
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: number;
    program_id: string | null;
    owner_membership_id: string | null;
    linked_okrs: string[] | null;
    deliverables: string[] | null;
    progress_percent?: number | null;
    linked_key_result_titles?: string[];
    kr_link_contexts?: InitiativeKrLinkContext[];
  };

  let initiatives: WorkspaceInitiative[] = (initiativesResult.data ?? []) as WorkspaceInitiative[];
  const initiativeKrContextsByInitiativeId: Record<string, InitiativeKrLinkContext[]> = {};
  const initiativeIdsForKr = initiatives.map((i) => i.id);
  if (initiativeIdsForKr.length > 0) {
    const { data: ikrLinks } = await supabase
      .schema("app")
      .from("initiative_key_result_links")
      .select("initiative_id, key_result_id")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .in("initiative_id", initiativeIdsForKr);
    const krIds = [...new Set((ikrLinks ?? []).map((l) => l.key_result_id))];
    const krById = new Map<string, { id: string; title: string; objective_id: string }>();
    if (krIds.length > 0) {
      const { data: krs } = await supabase
        .schema("app")
        .from("key_results")
        .select("id, title, objective_id")
        .eq("organization_id", organizationId)
        .in("id", krIds);
      for (const k of krs ?? []) {
        krById.set(k.id, k as { id: string; title: string; objective_id: string });
      }
    }
    const objectiveIdsForKr = [...new Set([...krById.values()].map((k) => k.objective_id))];
    const objectiveTitleById = new Map<string, string>();
    const objectiveOkrCycleById = new Map<string, string | null>();
    if (objectiveIdsForKr.length > 0) {
      const { data: objRows } = await supabase
        .schema("app")
        .from("objectives")
        .select("id, title, okr_cycle_id")
        .eq("organization_id", organizationId)
        .in("id", objectiveIdsForKr);
      for (const o of objRows ?? []) {
        objectiveTitleById.set(o.id, o.title);
        objectiveOkrCycleById.set(o.id, o.okr_cycle_id ?? null);
      }
    }
    const okrCycleIds = [
      ...new Set(
        [...objectiveOkrCycleById.values()].filter((id): id is string => Boolean(id))
      ),
    ];
    const okrCycleLabelById = new Map<string, string>();
    if (okrCycleIds.length > 0) {
      const { data: cycles } = await supabase
        .schema("app")
        .from("okr_cycles")
        .select("id, name, start_date, end_date")
        .eq("organization_id", organizationId)
        .in("id", okrCycleIds);
      for (const c of cycles ?? []) {
        const sd = c.start_date ? String(c.start_date).slice(0, 10) : "";
        const ed = c.end_date ? String(c.end_date).slice(0, 10) : "";
        okrCycleLabelById.set(c.id, sd && ed ? `${c.name} (${sd} – ${ed})` : c.name);
      }
    }
    function krContextForLink(krId: string): InitiativeKrLinkContext | null {
      const kr = krById.get(krId);
      if (!kr) return null;
      const objId = kr.objective_id;
      const okrId = objectiveOkrCycleById.get(objId) ?? null;
      return {
        key_result_id: kr.id,
        key_result_title: kr.title,
        objective_id: objId,
        objective_title: objectiveTitleById.get(objId) ?? "Objective",
        okr_cycle_label: okrId ? okrCycleLabelById.get(okrId) ?? null : null,
      };
    }
    const titlesByInitiative = new Map<string, string[]>();
    for (const l of ikrLinks ?? []) {
      const ctx = krContextForLink(l.key_result_id);
      if (!ctx) continue;
      const cur = initiativeKrContextsByInitiativeId[l.initiative_id] ?? [];
      cur.push(ctx);
      initiativeKrContextsByInitiativeId[l.initiative_id] = cur;
      const t = ctx.key_result_title;
      const titleCur = titlesByInitiative.get(l.initiative_id) ?? [];
      titleCur.push(t);
      titlesByInitiative.set(l.initiative_id, titleCur);
    }
    initiatives = initiatives.map((i) => ({
      ...i,
      linked_key_result_titles: titlesByInitiative.get(i.id) ?? [],
      kr_link_contexts: initiativeKrContextsByInitiativeId[i.id] ?? [],
    }));
  }
  const challengeDirectionLinks = challengeDirectionLinksResult.data ?? [];
  let directionObjectiveLinks = directionObjectiveLinksResult.data ?? [];
  if (directionObjectiveLinksResult.error && directionObjectiveLinks.length === 0) {
    const { data: fallbackObjectiveLinks } = await supabase
      .schema("app")
      .from("strategic_direction_objective_links")
      .select("strategic_direction_id, objective_id")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId);
    if (fallbackObjectiveLinks?.length) {
      directionObjectiveLinks = fallbackObjectiveLinks.map((row) => ({
        ...row,
        contribution_level: "medium",
      }));
    }
  }
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

  const clustersFiltered = (clustersResult.data ?? []).filter(
    (c) => !promotedClusterIds.has(c.id)
  );

  const { data: ownerMembershipRows, error: ownerMembershipError } = await supabase
    .schema("app")
    .from("organization_memberships")
    .select("id, responsibles!organization_memberships_responsible_id_fkey(full_name, email)")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("id", { ascending: true });
  if (ownerMembershipError) {
    console.error("[getStrategyCycleWorkspaceData] organization_memberships", ownerMembershipError.message);
  }
  const programOwnerOptions = (ownerMembershipRows ?? []).map((row) => {
    const resp = (row as { responsibles?: { full_name?: string; email?: string } | null }).responsibles;
    const label = resp?.full_name?.trim() || resp?.email?.trim() || "Mitglied";
    return { id: row.id, label };
  });

  let pipKeyResultOptions: PipKeyResultOption[] = [];
  const objectiveRowsForPip = objectives as Array<{
    id: string;
    title: string;
    okr_cycle_id?: string | null;
  }>;
  const objectiveIdsForPipKr = objectiveRowsForPip.map((o) => o.id);
  if (objectiveIdsForPipKr.length > 0) {
    const { data: krPickerRows } = await supabase
      .schema("app")
      .from("key_results")
      .select("id, title, objective_id")
      .eq("organization_id", organizationId)
      .in("objective_id", objectiveIdsForPipKr);
    const objByIdForPip = new Map(objectiveRowsForPip.map((o) => [o.id, o]));
    const pipOkrCycleIds = [
      ...new Set(
        objectiveRowsForPip.map((o) => o.okr_cycle_id).filter((id): id is string => Boolean(id))
      ),
    ];
    const pipOkrCycleLabelById = new Map<string, string>();
    if (pipOkrCycleIds.length > 0) {
      const { data: pipCycles } = await supabase
        .schema("app")
        .from("okr_cycles")
        .select("id, name, start_date, end_date")
        .eq("organization_id", organizationId)
        .in("id", pipOkrCycleIds);
      for (const c of pipCycles ?? []) {
        const sd = c.start_date ? String(c.start_date).slice(0, 10) : "";
        const ed = c.end_date ? String(c.end_date).slice(0, 10) : "";
        pipOkrCycleLabelById.set(c.id, sd && ed ? `${c.name} (${sd} – ${ed})` : c.name);
      }
    }
    for (const kr of krPickerRows ?? []) {
      const obj = objByIdForPip.get(kr.objective_id);
      if (!obj) continue;
      const oc = obj.okr_cycle_id ? pipOkrCycleLabelById.get(obj.okr_cycle_id) ?? null : null;
      pipKeyResultOptions.push({
        id: kr.id,
        title: kr.title,
        objective_id: kr.objective_id,
        objective_title: obj.title,
        okr_cycle_label: oc,
      });
    }
    pipKeyResultOptions.sort((a, b) => {
      const ot = a.objective_title.localeCompare(b.objective_title, "de");
      if (ot !== 0) return ot;
      return a.title.localeCompare(b.title, "de");
    });
  }

  return {
    entries,
    grouped,
    promotedBySourceId,
    promotedClusterIds,
    linkDrafts: linkDraftsResult.data ?? [],
    approvedLinks: linksResult.data ?? [],
    clusters: clustersFiltered,
    clusterMembers: clusterMembersResult.data ?? [],
    clusterMembersByClusterId,
    gapFindings: gapFindingsResult.data ?? [],
    entryTitleById,
    existingChallenges: promotedResult.data ?? [],
    strategicDirections,
    objectives,
    clusterObjectiveRelations,
    correlationStatusOverrides,
    programs,
    programOverviews,
    programOwnerOptions,
    pipKeyResultOptions,
    challenges,
    annualTargets,
    initiatives,
    challengeDirectionLinks,
    directionObjectiveLinks,
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
    industryIdsByObjectiveId,
    businessModelIdsByObjectiveId,
    creatorDisplayNameByMembershipId: Object.fromEntries(creatorDisplayNameByMembershipId),
    entryDimensionsByEntryId,
    entryDirectionIdsByEntryId,
    availableDimensions: {
      industries: (industriesResult.data ?? []).map((item) => ({ id: item.id, name: item.name })),
      businessModels: (businessModelsResult.data ?? []).map((item) => ({ id: item.id, name: item.name })),
      operatingModels: (operatingModelsResult.data ?? []).map((item) => ({ id: item.id, name: item.name })),
    },
    portfolioEvaluation: portfolioEvalResult.data ?? null,
  };
}
