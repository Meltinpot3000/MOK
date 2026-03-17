"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { computeClusters } from "@/lib/analysis-network/cluster";
import { computeGapFindings } from "@/lib/analysis-network/gaps";
import { generateHybridLinkCandidates } from "@/lib/analysis-network/link-scorer";
import { evaluateLlmBudgetStatus } from "@/lib/analysis-network/budget";
import {
  isLlmFeatureEnabled,
  readAnalysisNetworkLlmPolicy,
  resolveLlmMaxOutputTokens,
} from "@/lib/analysis-network/policy";
import {
  assessClusterWithLlm,
  assessGapWithLlm,
  proposeChallengeCandidatesWithLlm,
} from "@/lib/analysis-network/providers";
import { recordLlmUsageEvents } from "@/lib/analysis-network/usage";
import { getActivePlanningCycle, getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import {
  buildStrategyReferenceText,
  readStrategyReferenceFieldsFromBrandingConfig,
} from "@/lib/strategy-cycle/strategy-reference";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type WorkspaceContext = {
  organizationId: string;
  membershipId: string;
  cycleId: string;
};

const ANALYSIS_TYPES = new Set([
  "environment",
  "company",
  "competitor",
  "swot",
  "workshop",
  "other",
]);
const SWOT_SUB_TYPES = new Set(["strength", "weakness", "opportunity", "threat"]);
const HIGH_IMPACT_THRESHOLD = 4;
const MIN_HIGH_IMPACT_JUSTIFICATION_LENGTH = 40;

type AnalysisNetworkConfig = {
  maxLlmPairs: number;
  minRuleConfidence: number;
  fusionWeights: { rule: number; llm: number };
  llmEnabled: boolean;
  maxGapLlmItems: number;
  maxClusterLlmItems: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function parseAnalysisNetworkConfig(brandingConfig: unknown): AnalysisNetworkConfig {
  const root = brandingConfig && typeof brandingConfig === "object" ? (brandingConfig as Record<string, unknown>) : {};
  const network =
    root.analysis_network && typeof root.analysis_network === "object"
      ? (root.analysis_network as Record<string, unknown>)
      : {};
  const fusion =
    network.fusion_weights && typeof network.fusion_weights === "object"
      ? (network.fusion_weights as Record<string, unknown>)
      : {};
  const maxLlmPairs = clamp(Number(network.max_llm_pairs ?? 22), 0, 40);
  const minRuleConfidence = clamp(Number(network.min_rule_confidence ?? 0.22), 0.05, 0.9);
  const llmWeight = clamp(Number(fusion.llm ?? 0.45), 0.2, 0.8);
  const ruleWeight = clamp(Number(fusion.rule ?? 0.55), 0.2, 0.8);
  const llmEnabled = Boolean(network.llm_enabled ?? true);
  const maxGapLlmItems = clamp(Number(network.max_gap_llm_items ?? 8), 0, 20);
  const maxClusterLlmItems = clamp(Number(network.max_cluster_llm_items ?? 8), 0, 20);
  return {
    maxLlmPairs: Math.round(maxLlmPairs),
    minRuleConfidence: Number(minRuleConfidence.toFixed(4)),
    fusionWeights: {
      rule: Number(ruleWeight.toFixed(4)),
      llm: Number(llmWeight.toFixed(4)),
    },
    llmEnabled,
    maxGapLlmItems: Math.round(maxGapLlmItems),
    maxClusterLlmItems: Math.round(maxClusterLlmItems),
  };
}

async function readBrandingConfig(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string
) {
  const { data } = await supabase
    .schema("app")
    .from("tenant_branding")
    .select("branding_config")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!data?.branding_config || typeof data.branding_config !== "object") return {};
  return data.branding_config as Record<string, unknown>;
}

async function writeAnalysisFeedbackCalibration(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  organizationId: string;
  accepted: boolean;
  origin: string | null;
  provider: string | null;
}) {
  const brandingConfig = await readBrandingConfig(params.supabase, params.organizationId);
  const analysisNetwork =
    brandingConfig.analysis_network && typeof brandingConfig.analysis_network === "object"
      ? (brandingConfig.analysis_network as Record<string, unknown>)
      : {};
  const feedbackStats =
    analysisNetwork.feedback_stats && typeof analysisNetwork.feedback_stats === "object"
      ? (analysisNetwork.feedback_stats as Record<string, unknown>)
      : {};
  const byOrigin =
    feedbackStats.by_origin && typeof feedbackStats.by_origin === "object"
      ? (feedbackStats.by_origin as Record<string, unknown>)
      : {};
  const byProvider =
    feedbackStats.by_provider && typeof feedbackStats.by_provider === "object"
      ? (feedbackStats.by_provider as Record<string, unknown>)
      : {};

  const originKey = params.origin ?? "unknown";
  const providerKey = params.provider ?? "none";
  const originStats =
    byOrigin[originKey] && typeof byOrigin[originKey] === "object"
      ? (byOrigin[originKey] as Record<string, unknown>)
      : {};
  const providerStats =
    byProvider[providerKey] && typeof byProvider[providerKey] === "object"
      ? (byProvider[providerKey] as Record<string, unknown>)
      : {};

  const reviewed = Number(feedbackStats.reviewed ?? 0) + 1;
  const approved = Number(feedbackStats.approved ?? 0) + (params.accepted ? 1 : 0);
  const rejected = Number(feedbackStats.rejected ?? 0) + (params.accepted ? 0 : 1);
  const originReviewed = Number(originStats.reviewed ?? 0) + 1;
  const originApproved = Number(originStats.approved ?? 0) + (params.accepted ? 1 : 0);
  const providerReviewed = Number(providerStats.reviewed ?? 0) + 1;
  const providerApproved = Number(providerStats.approved ?? 0) + (params.accepted ? 1 : 0);

  byOrigin[originKey] = { reviewed: originReviewed, approved: originApproved };
  byProvider[providerKey] = { reviewed: providerReviewed, approved: providerApproved };

  const llmStats = (byOrigin.hybrid as Record<string, unknown> | undefined) ?? {};
  const ruleStats = (byOrigin.rule as Record<string, unknown> | undefined) ?? {};
  const llmPrecision = Number(llmStats.approved ?? 0) / Math.max(1, Number(llmStats.reviewed ?? 0));
  const rulePrecision = Number(ruleStats.approved ?? 0) / Math.max(1, Number(ruleStats.reviewed ?? 0));

  const currentConfig = parseAnalysisNetworkConfig(brandingConfig);
  const targetLlmWeight = clamp(0.45 + (llmPrecision - rulePrecision) * 0.25, 0.25, 0.75);
  const nextLlmWeight = Number((currentConfig.fusionWeights.llm * 0.8 + targetLlmWeight * 0.2).toFixed(4));
  const nextRuleWeight = Number((1 - nextLlmWeight).toFixed(4));

  const nextBrandingConfig = {
    ...brandingConfig,
    analysis_network: {
      ...analysisNetwork,
      fusion_weights: { llm: nextLlmWeight, rule: nextRuleWeight },
      feedback_stats: {
        ...feedbackStats,
        reviewed,
        approved,
        rejected,
        by_origin: byOrigin,
        by_provider: byProvider,
        updated_at: new Date().toISOString(),
      },
    },
  };

  await params.supabase
    .schema("app")
    .from("tenant_branding")
    .update({ branding_config: nextBrandingConfig })
    .eq("organization_id", params.organizationId);
}

async function getWorkspaceContextOrRedirect(): Promise<WorkspaceContext> {
  const context = await getPhase0Context();
  if (!context) redirect("/no-access");

  const access = await getSidebarAccessContext("strategy-cycle");
  if (access.state !== "ok" || !access.canWrite) redirect("/no-access");

  const cycle = await getActivePlanningCycle(context.organizationId);
  if (!cycle) redirect("/strategy-cycle");

  return {
    organizationId: context.organizationId,
    membershipId: context.membershipId,
    cycleId: cycle.id,
  };
}

function done(path = "/strategy-cycle"): never {
  revalidatePath("/strategy-cycle");
  revalidatePath("/strategy-matrix");
  redirect(path);
}

function readAndValidateInput(formData: FormData) {
  const analysisTypeRaw = String(formData.get("analysis_type") ?? "other").trim();
  const normalizedAnalysisType = analysisTypeRaw === "pestel" ? "environment" : analysisTypeRaw;
  const analysisType = ANALYSIS_TYPES.has(normalizedAnalysisType) ? normalizedAnalysisType : "other";
  const subTypeRaw = String(formData.get("sub_type") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const impactLevel = Number(formData.get("impact_level") ?? 3);
  const uncertaintyLevel = Number(formData.get("uncertainty_level") ?? 3);

  if (!title) {
    done(`/strategy-cycle?tab=${analysisType}&error=missing-title`);
  }

  if (!Number.isFinite(impactLevel) || impactLevel < 1 || impactLevel > 5) {
    done(`/strategy-cycle?tab=${analysisType}&error=invalid-impact`);
  }

  if (!Number.isFinite(uncertaintyLevel) || uncertaintyLevel < 1 || uncertaintyLevel > 5) {
    done(`/strategy-cycle?tab=${analysisType}&error=invalid-uncertainty`);
  }

  if (impactLevel >= HIGH_IMPACT_THRESHOLD && description.length < MIN_HIGH_IMPACT_JUSTIFICATION_LENGTH) {
    done(`/strategy-cycle?tab=${analysisType}&error=high-impact-justification`);
  }

  if (analysisType === "swot" && subTypeRaw && !SWOT_SUB_TYPES.has(subTypeRaw)) {
    done(`/strategy-cycle?tab=${analysisType}&error=invalid-subtype`);
  }
  return {
    analysisType,
    subType: subTypeRaw || null,
    title,
    description: description || null,
    impactLevel,
    uncertaintyLevel,
  };
}

export async function createAnalysisEntry(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const input = readAndValidateInput(formData);

  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("analysis_entries").insert({
    organization_id: context.organizationId,
    cycle_instance_id: context.cycleId,
    analysis_type: input.analysisType,
    sub_type: input.subType,
    title: input.title,
    description: input.description,
    impact_level: input.impactLevel,
    uncertainty_level: input.uncertaintyLevel,
    created_by_membership_id: context.membershipId,
  });

  done(`/strategy-cycle?tab=${input.analysisType}&success=saved`);
}

export async function saveStrategyReferenceText(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const supabase = await createSupabaseServerClient();
  const brandingConfig = await readBrandingConfig(supabase, context.organizationId);
  const fields = {
    mission: String(formData.get("strategy_reference_mission") ?? "").trim().slice(0, 3000),
    vision: String(formData.get("strategy_reference_vision") ?? "").trim().slice(0, 3000),
    culture: String(formData.get("strategy_reference_culture") ?? "").trim().slice(0, 3000),
    values: String(formData.get("strategy_reference_values") ?? "").trim().slice(0, 3000),
    leadership: String(formData.get("strategy_reference_leadership") ?? "").trim().slice(0, 3000),
  };
  const combinedText = buildStrategyReferenceText(fields);
  const nextBrandingConfig = {
    ...brandingConfig,
    strategy_reference_mission: fields.mission,
    strategy_reference_vision: fields.vision,
    strategy_reference_culture: fields.culture,
    strategy_reference_values: fields.values,
    strategy_reference_leadership: fields.leadership,
    strategy_reference_text: combinedText ?? "",
    strategy_reference_updated_at: new Date().toISOString(),
  };

  await supabase
    .schema("app")
    .from("tenant_branding")
    .update({ branding_config: nextBrandingConfig })
    .eq("organization_id", context.organizationId);

  done("/strategy-cycle?l1=mission-vision-culture-values&success=strategy-reference-saved");
}

export async function updateAnalysisEntry(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const id = String(formData.get("analysis_entry_id") ?? "");
  if (!id) done();
  const input = readAndValidateInput(formData);

  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("analysis_entries")
    .update({
      analysis_type: input.analysisType,
      sub_type: input.subType,
      title: input.title,
      description: input.description,
      impact_level: input.impactLevel,
      uncertainty_level: input.uncertaintyLevel,
    })
    .eq("id", id)
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId);

  done(`/strategy-cycle?tab=${input.analysisType}&success=updated`);
}

export async function deleteAnalysisEntry(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const id = String(formData.get("analysis_entry_id") ?? "");
  const tab = String(formData.get("analysis_type") ?? "other");
  if (!id) done();

  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("analysis_entries")
    .delete()
    .eq("id", id)
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId);

  done(`/strategy-cycle?tab=${tab}&success=deleted`);
}

export async function promoteToStrategicChallenge(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const entryId = String(formData.get("analysis_entry_id") ?? "");
  const tab = String(formData.get("analysis_type") ?? "other");
  if (!entryId) done();

  const supabase = await createSupabaseServerClient();
  const { data: entry } = await supabase
    .schema("app")
    .from("analysis_entries")
    .select("id, title, impact_level, description")
    .eq("id", entryId)
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .single();

  if (!entry) done(`/strategy-cycle?tab=${tab}&error=not-found`);
  if (
    (entry.impact_level ?? 3) >= HIGH_IMPACT_THRESHOLD &&
    (entry.description ?? "").trim().length < MIN_HIGH_IMPACT_JUSTIFICATION_LENGTH
  ) {
    done(`/strategy-cycle?tab=${tab}&error=high-impact-justification`);
  }

  const { data: existingChallenge } = await supabase
    .schema("app")
    .from("strategic_challenges")
    .select("id")
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("source_analysis_entry_id", entry.id)
    .maybeSingle();

  if (!existingChallenge) {
    const { data: challenge } = await supabase
      .schema("app")
      .from("strategic_challenges")
      .insert({
        organization_id: context.organizationId,
        cycle_instance_id: context.cycleId,
        title: entry.title,
        priority: entry.impact_level ?? 3,
        visibility: "internal",
        source_analysis_entry_id: entry.id,
        created_by_membership_id: context.membershipId,
      })
      .select("id")
      .single();

    if (challenge) {
      const { count } = await supabase
        .schema("app")
        .from("dashboard_column_config")
        .select("challenge_id", { count: "exact", head: true })
        .eq("organization_id", context.organizationId)
        .eq("cycle_instance_id", context.cycleId);

      await supabase.schema("app").from("dashboard_column_config").upsert(
        {
          organization_id: context.organizationId,
          cycle_instance_id: context.cycleId,
          challenge_id: challenge.id,
          display_order: (count ?? 0) + 1,
        },
        { onConflict: "cycle_instance_id,challenge_id" }
      );
    }
  }

  done(`/strategy-cycle?tab=${tab}&success=promoted`);
}

export async function generateLinkDrafts(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const tab = String(formData.get("analysis_type") ?? "environment");
  const supabase = await createSupabaseServerClient();

  const { data: entries } = await supabase
    .schema("app")
    .from("analysis_entries")
    .select(
      "id, organization_id, cycle_instance_id, analysis_type, sub_type, title, description, impact_level, uncertainty_level"
    )
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId);

  const brandingConfig = await readBrandingConfig(supabase, context.organizationId);
  const networkConfig = parseAnalysisNetworkConfig(brandingConfig);
  const llmPolicy = readAnalysisNetworkLlmPolicy(brandingConfig);
  const budgetStatus = await evaluateLlmBudgetStatus({
    supabase,
    organizationId: context.organizationId,
    policy: llmPolicy,
  });
  const canUseLinkLlm =
    budgetStatus.allowed &&
    networkConfig.llmEnabled &&
    isLlmFeatureEnabled(llmPolicy, "link_draft_generation");
  const strategyReferenceText = buildStrategyReferenceText(
    readStrategyReferenceFieldsFromBrandingConfig(brandingConfig)
  );
  const { candidates, usageEvents } = await generateHybridLinkCandidates(entries ?? [], {
    maxLlmPairs: canUseLinkLlm ? networkConfig.maxLlmPairs : 0,
    minRuleConfidence: networkConfig.minRuleConfidence,
    fusionWeights: networkConfig.fusionWeights,
    strategyReferenceText,
    maxOutputTokens: resolveLlmMaxOutputTokens(llmPolicy, "link_draft_generation"),
  });

  await supabase
    .schema("app")
    .from("analysis_item_link_draft")
    .delete()
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("status", "draft");

  if (candidates.length > 0) {
    const payload = candidates.map((candidate) => ({
      organization_id: context.organizationId,
      cycle_instance_id: context.cycleId,
      source_analysis_item_id: candidate.sourceEntryId,
      target_analysis_item_id: candidate.targetEntryId,
      link_type: candidate.linkType,
      strength: candidate.strength,
      confidence: candidate.confidence,
      comment: candidate.comment,
      origin: candidate.origin,
      provider: candidate.provider ?? null,
      model: candidate.model ?? null,
      prompt_version: candidate.promptVersion ?? null,
      status: "draft",
      created_by_membership_id: context.membershipId,
      metadata: candidate.metadata ?? {},
    }));
    await supabase.schema("app").from("analysis_item_link_draft").upsert(payload, {
      onConflict: "cycle_instance_id,source_analysis_item_id,target_analysis_item_id,link_type",
    });
  }

  await recordLlmUsageEvents(
    supabase,
    usageEvents.map((event) => ({
      organizationId: context.organizationId,
      cycleInstanceId: context.cycleId,
      feature: "link_draft_generation",
      provider: event.provider,
      model: event.model,
      promptVersion: event.promptVersion,
      promptTokens: event.usage.promptTokens,
      completionTokens: event.usage.completionTokens,
      totalTokens: event.usage.totalTokens,
      billableCost: event.usage.billableCost,
      usageMissing: event.usage.usageMissing,
      metadata: { tab },
    }))
  );

  done(`/strategy-cycle?tab=${tab}&success=links-generated`);
}

export async function approveLinkDraft(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const tab = String(formData.get("analysis_type") ?? "environment");
  const draftId = String(formData.get("draft_id") ?? "");
  if (!draftId) done(`/strategy-cycle?tab=${tab}`);

  const supabase = await createSupabaseServerClient();
  const { data: draft } = await supabase
    .schema("app")
    .from("analysis_item_link_draft")
    .select(
      "id, source_analysis_item_id, target_analysis_item_id, link_type, strength, confidence, comment, origin, provider, metadata"
    )
    .eq("id", draftId)
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .single();

  if (draft) {
    await supabase.schema("app").from("analysis_item_link").upsert(
      {
        organization_id: context.organizationId,
        cycle_instance_id: context.cycleId,
        source_analysis_item_id: draft.source_analysis_item_id,
        target_analysis_item_id: draft.target_analysis_item_id,
        link_type: draft.link_type,
        strength: draft.strength,
        confidence: draft.confidence,
        comment: draft.comment,
        source_draft_id: draft.id,
        activated_by_membership_id: context.membershipId,
        metadata: draft.metadata ?? {},
      },
      { onConflict: "cycle_instance_id,source_analysis_item_id,target_analysis_item_id,link_type" }
    );
  }

  await writeAnalysisFeedbackCalibration({
    supabase,
    organizationId: context.organizationId,
    accepted: true,
    origin: draft?.origin ?? null,
    provider: draft?.provider ?? null,
  });

  await supabase
    .schema("app")
    .from("analysis_item_link_draft")
    .update({
      status: "approved",
      reviewed_by_membership_id: context.membershipId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", draftId)
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId);

  done(`/strategy-cycle?tab=${tab}&success=link-approved`);
}

export async function rejectLinkDraft(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const tab = String(formData.get("analysis_type") ?? "environment");
  const draftId = String(formData.get("draft_id") ?? "");
  if (!draftId) done(`/strategy-cycle?tab=${tab}`);

  const supabase = await createSupabaseServerClient();
  const { data: draft } = await supabase
    .schema("app")
    .from("analysis_item_link_draft")
    .select("id, origin, provider")
    .eq("id", draftId)
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .single();

  await supabase
    .schema("app")
    .from("analysis_item_link_draft")
    .update({
      status: "rejected",
      reviewed_by_membership_id: context.membershipId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", draftId)
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId);

  await writeAnalysisFeedbackCalibration({
    supabase,
    organizationId: context.organizationId,
    accepted: false,
    origin: draft?.origin ?? null,
    provider: draft?.provider ?? null,
  });

  done(`/strategy-cycle?tab=${tab}&success=link-rejected`);
}

export async function recomputeClusters(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const tab = String(formData.get("analysis_type") ?? "environment");
  const supabase = await createSupabaseServerClient();

  const [{ data: entries }, { data: links }] = await Promise.all([
    supabase
      .schema("app")
      .from("analysis_entries")
      .select(
      "id, organization_id, cycle_instance_id, analysis_type, sub_type, title, description, impact_level, uncertainty_level"
      )
      .eq("organization_id", context.organizationId)
      .eq("cycle_instance_id", context.cycleId),
    supabase
      .schema("app")
      .from("analysis_item_link")
      .select("source_analysis_item_id, target_analysis_item_id, confidence, strength")
      .eq("organization_id", context.organizationId)
      .eq("cycle_instance_id", context.cycleId),
  ]);

  const brandingConfig = await readBrandingConfig(supabase, context.organizationId);
  const networkConfig = parseAnalysisNetworkConfig(brandingConfig);
  const llmPolicy = readAnalysisNetworkLlmPolicy(brandingConfig);
  const budgetStatus = await evaluateLlmBudgetStatus({
    supabase,
    organizationId: context.organizationId,
    policy: llmPolicy,
  });
  const canUseClusterLlm =
    budgetStatus.allowed &&
    networkConfig.llmEnabled &&
    isLlmFeatureEnabled(llmPolicy, "cluster_assessment");
  const strategyReferenceText = buildStrategyReferenceText(
    readStrategyReferenceFieldsFromBrandingConfig(brandingConfig)
  );
  const computed = computeClusters(entries ?? [], links ?? []);
  const llmUsageEvents: Array<{
    provider: string;
    model: string;
    promptVersion: string;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    usageMissing: boolean;
  }> = [];

  const clusterEntriesById = new Map((entries ?? []).map((entry) => [entry.id, entry.title]));
  const llmEnhanced = [];
  for (const [idx, cluster] of computed.entries()) {
    if (!canUseClusterLlm || idx >= networkConfig.maxClusterLlmItems) {
      llmEnhanced.push(cluster);
      continue;
    }
    const response = await assessClusterWithLlm({
      currentLabel: cluster.label,
      currentSummary: cluster.summary,
      score: cluster.score,
      members: cluster.memberEntryIds.map((id) => clusterEntriesById.get(id) ?? id).slice(0, 8),
      strategyReferenceText,
      maxOutputTokens: resolveLlmMaxOutputTokens(llmPolicy, "cluster_assessment"),
    });
    if (response.result) {
      llmEnhanced.push({
        ...cluster,
        label: response.result.label || cluster.label,
        summary: response.result.summary || cluster.summary,
        score: clamp(cluster.score + response.result.scoreAdjustment, 0, 1),
      });
      if (response.usage) {
        llmUsageEvents.push({
          provider: response.result.provider,
          model: response.result.model,
          promptVersion: response.result.promptVersion,
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens,
          usageMissing: response.usage.usageMissing,
        });
      }
    } else {
      llmEnhanced.push(cluster);
    }
  }

  await supabase
    .schema("app")
    .from("analysis_cluster_members")
    .delete()
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId);
  await supabase
    .schema("app")
    .from("analysis_clusters")
    .delete()
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId);

  for (const cluster of llmEnhanced) {
    const { data: createdCluster } = await supabase
      .schema("app")
      .from("analysis_clusters")
      .insert({
        organization_id: context.organizationId,
        cycle_instance_id: context.cycleId,
        label: cluster.label,
        summary: cluster.summary,
        cluster_score: cluster.score,
        method: "graph-v1",
        created_by_membership_id: context.membershipId,
        metadata: {},
      })
      .select("id")
      .single();

    if (!createdCluster) continue;
    if (cluster.memberEntryIds.length === 0) continue;
    await supabase.schema("app").from("analysis_cluster_members").insert(
      cluster.memberEntryIds.map((entryId) => ({
        organization_id: context.organizationId,
        cycle_instance_id: context.cycleId,
        cluster_id: createdCluster.id,
        entry_id: entryId,
        membership_strength: 0.7,
      }))
    );
  }

  await recordLlmUsageEvents(
    supabase,
    llmUsageEvents.map((event) => ({
      organizationId: context.organizationId,
      cycleInstanceId: context.cycleId,
      feature: "cluster_assessment",
      provider: event.provider,
      model: event.model,
      promptVersion: event.promptVersion,
      promptTokens: event.promptTokens,
      completionTokens: event.completionTokens,
      totalTokens: event.totalTokens,
      usageMissing: event.usageMissing,
      metadata: { tab },
    }))
  );

  done(`/strategy-cycle?tab=${tab}&success=clusters-recomputed`);
}

export async function recomputeGaps(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const tab = String(formData.get("analysis_type") ?? "environment");
  const supabase = await createSupabaseServerClient();

  const [{ data: entries }, { data: links }, { data: challenges }] = await Promise.all([
    supabase
      .schema("app")
      .from("analysis_entries")
      .select(
      "id, organization_id, cycle_instance_id, analysis_type, sub_type, title, description, impact_level, uncertainty_level"
      )
      .eq("organization_id", context.organizationId)
      .eq("cycle_instance_id", context.cycleId),
    supabase
      .schema("app")
      .from("analysis_item_link")
      .select("source_analysis_item_id, target_analysis_item_id")
      .eq("organization_id", context.organizationId)
      .eq("cycle_instance_id", context.cycleId),
    supabase
      .schema("app")
      .from("strategic_challenges")
      .select("source_analysis_entry_id")
      .eq("organization_id", context.organizationId)
      .eq("cycle_instance_id", context.cycleId)
      .not("source_analysis_entry_id", "is", null),
  ]);

  const brandingConfig = await readBrandingConfig(supabase, context.organizationId);
  const networkConfig = parseAnalysisNetworkConfig(brandingConfig);
  const llmPolicy = readAnalysisNetworkLlmPolicy(brandingConfig);
  const budgetStatus = await evaluateLlmBudgetStatus({
    supabase,
    organizationId: context.organizationId,
    policy: llmPolicy,
  });
  const canUseGapLlm =
    budgetStatus.allowed &&
    networkConfig.llmEnabled &&
    isLlmFeatureEnabled(llmPolicy, "gap_assessment");
  const canUseChallengeLlm =
    budgetStatus.allowed &&
    networkConfig.llmEnabled &&
    isLlmFeatureEnabled(llmPolicy, "challenge_recommendation");
  const strategyReferenceText = buildStrategyReferenceText(
    readStrategyReferenceFieldsFromBrandingConfig(brandingConfig)
  );
  const baseGapFindings = computeGapFindings(
    entries ?? [],
    links ?? [],
    (challenges ?? [])
      .map((challenge) => challenge.source_analysis_entry_id)
      .filter((id): id is string => Boolean(id))
  );
  const llmUsageEvents: Array<{
    provider: string;
    model: string;
    promptVersion: string;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    usageMissing: boolean;
  }> = [];
  const gapFindings = [];
  for (const [idx, gap] of baseGapFindings.entries()) {
    if (!canUseGapLlm || idx >= networkConfig.maxGapLlmItems) {
      gapFindings.push(gap);
      continue;
    }
    const assessed = await assessGapWithLlm({
      dimension: gap.dimension,
      gapType: gap.gapType,
      severity: gap.severity,
      recommendation: gap.recommendation,
      contextLines: [(gap.metadata ? JSON.stringify(gap.metadata) : "")].filter(Boolean),
      strategyReferenceText,
      maxOutputTokens: resolveLlmMaxOutputTokens(llmPolicy, "gap_assessment"),
    });
    if (!assessed.result) {
      gapFindings.push(gap);
      continue;
    }
    gapFindings.push({
      ...gap,
      severity: assessed.result.severity,
      recommendation: assessed.result.recommendation || gap.recommendation,
      metadata: {
        ...(gap.metadata ?? {}),
        llm_rationale: assessed.result.rationale,
      },
    });
    if (assessed.usage) {
      llmUsageEvents.push({
        provider: assessed.result.provider,
        model: assessed.result.model,
        promptVersion: assessed.result.promptVersion,
        promptTokens: assessed.usage.promptTokens,
        completionTokens: assessed.usage.completionTokens,
        totalTokens: assessed.usage.totalTokens,
        usageMissing: assessed.usage.usageMissing,
      });
    }
  }

  await supabase
    .schema("app")
    .from("analysis_gap_findings")
    .delete()
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId);

  if (gapFindings.length > 0) {
    await supabase.schema("app").from("analysis_gap_findings").insert(
      gapFindings.map((gap) => ({
        organization_id: context.organizationId,
        cycle_instance_id: context.cycleId,
        dimension: gap.dimension,
        gap_type: gap.gapType,
        severity: gap.severity,
        recommendation: gap.recommendation,
        status: "open",
        created_by_membership_id: context.membershipId,
        metadata: gap.metadata ?? {},
      }))
    );
  }

  await supabase
    .schema("app")
    .from("analysis_challenge_candidates")
    .delete()
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId);

  const { data: clusters } = await supabase
    .schema("app")
    .from("analysis_clusters")
    .select("id, label, summary, cluster_score")
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .order("cluster_score", { ascending: false })
    .limit(12);

  const challengeCandidatesResponse = canUseChallengeLlm
    ? await proposeChallengeCandidatesWithLlm({
        clusters: (clusters ?? []).map((cluster) => ({
          id: cluster.id,
          label: cluster.label,
          summary: cluster.summary ?? "",
          score: Number(cluster.cluster_score ?? 0),
        })),
        gaps: gapFindings.slice(0, 12).map((gap, idx) => ({
          id: `gap-${idx}-${gap.dimension}`,
          dimension: gap.dimension,
          gapType: gap.gapType,
          severity: gap.severity,
          recommendation: gap.recommendation,
        })),
        strategyReferenceText,
        maxOutputTokens: resolveLlmMaxOutputTokens(llmPolicy, "challenge_recommendation"),
      })
    : { result: null, usage: null };

  const fallbackCandidates = [
    ...(clusters ?? []).slice(0, 4).map((cluster) => ({
      title: cluster.label,
      description: cluster.summary ?? "",
      priority: Math.max(1, Math.min(5, Math.round(Number(cluster.cluster_score ?? 0.5) * 5))),
      source: "cluster" as const,
      sourceRef: cluster.id,
    })),
    ...gapFindings
      .filter((gap) => gap.severity >= 4)
      .slice(0, 4)
      .map((gap, idx) => ({
        title: `Gap: ${gap.gapType} ${gap.dimension}`,
        description: gap.recommendation,
        priority: gap.severity,
        source: "gap" as const,
        sourceRef: `gap-${idx}-${gap.dimension}`,
      })),
  ];
  const challengeCandidates = challengeCandidatesResponse.result?.length
    ? challengeCandidatesResponse.result
    : fallbackCandidates;

  if (challengeCandidates.length > 0) {
    await supabase.schema("app").from("analysis_challenge_candidates").insert(
      challengeCandidates.map((candidate) => ({
        organization_id: context.organizationId,
        cycle_instance_id: context.cycleId,
        title: candidate.title,
        description: candidate.description || null,
        priority: candidate.priority,
        source_type: candidate.source,
        source_ref: candidate.sourceRef,
        status: "draft",
        created_by_membership_id: context.membershipId,
        metadata: {},
      }))
    );
  }

  if (challengeCandidatesResponse.result && challengeCandidatesResponse.usage) {
    llmUsageEvents.push({
      provider: "gemini",
      model: process.env.ANALYSIS_LLM_MODEL_GEMINI_ASSIST ?? process.env.ANALYSIS_LLM_MODEL_GEMINI ?? "gemini-2.5-pro",
      promptVersion: "analysis-challenge-candidates-v1",
      promptTokens: challengeCandidatesResponse.usage.promptTokens,
      completionTokens: challengeCandidatesResponse.usage.completionTokens,
      totalTokens: challengeCandidatesResponse.usage.totalTokens,
      usageMissing: challengeCandidatesResponse.usage.usageMissing,
    });
  }

  await recordLlmUsageEvents(
    supabase,
    llmUsageEvents.map((event) => ({
      organizationId: context.organizationId,
      cycleInstanceId: context.cycleId,
      feature: "gap_and_challenge_assessment",
      provider: event.provider,
      model: event.model,
      promptVersion: event.promptVersion,
      promptTokens: event.promptTokens,
      completionTokens: event.completionTokens,
      totalTokens: event.totalTokens,
      usageMissing: event.usageMissing,
      metadata: { tab },
    }))
  );

  done(`/strategy-cycle?tab=${tab}&success=gaps-recomputed`);
}

export async function promoteClusterToStrategicChallenge(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const tab = String(formData.get("analysis_type") ?? "environment");
  const clusterId = String(formData.get("cluster_id") ?? "");
  if (!clusterId) done(`/strategy-cycle?tab=${tab}`);

  const supabase = await createSupabaseServerClient();
  const { data: cluster } = await supabase
    .schema("app")
    .from("analysis_clusters")
    .select("id, label, summary, cluster_score")
    .eq("id", clusterId)
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .single();
  if (!cluster) done(`/strategy-cycle?tab=${tab}&error=not-found`);

  const { data: members } = await supabase
    .schema("app")
    .from("analysis_cluster_members")
    .select("entry_id")
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("cluster_id", cluster.id)
    .limit(6);

  const entryIds = (members ?? []).map((member) => member.entry_id);
  const { data: entries } =
    entryIds.length > 0
      ? await supabase
          .schema("app")
          .from("analysis_entries")
          .select("title")
          .in("id", entryIds)
      : { data: [] as Array<{ title: string }> };

  const descriptionLines = [
    cluster.summary ?? "",
    entries && entries.length > 0
      ? `Cluster-Findings: ${entries.map((entry) => entry.title).join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const { data: challenge } = await supabase
    .schema("app")
    .from("strategic_challenges")
    .insert({
      organization_id: context.organizationId,
      cycle_instance_id: context.cycleId,
      title: cluster.label,
      description: descriptionLines || null,
      priority: Math.max(1, Math.min(5, Math.round(Number(cluster.cluster_score ?? 0.5) * 5))),
      visibility: "internal",
      created_by_membership_id: context.membershipId,
    })
    .select("id")
    .single();

  if (challenge) {
    const { count } = await supabase
      .schema("app")
      .from("dashboard_column_config")
      .select("challenge_id", { count: "exact", head: true })
      .eq("organization_id", context.organizationId)
      .eq("cycle_instance_id", context.cycleId);
    await supabase.schema("app").from("dashboard_column_config").upsert(
      {
        organization_id: context.organizationId,
        cycle_instance_id: context.cycleId,
        challenge_id: challenge.id,
        display_order: (count ?? 0) + 1,
      },
      { onConflict: "cycle_instance_id,challenge_id" }
    );
  }

  done(`/strategy-cycle?tab=${tab}&success=cluster-promoted`);
}

export async function promoteChallengeCandidate(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const candidateId = String(formData.get("candidate_id") ?? "").trim();
  if (!candidateId) {
    done("/strategy-cycle?l1=corporate-strategy&l2=summary");
  }
  const supabase = await createSupabaseServerClient();
  const { data: candidate } = await supabase
    .schema("app")
    .from("analysis_challenge_candidates")
    .select("id, title, description, priority, status")
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("id", candidateId)
    .maybeSingle();
  if (!candidate || candidate.status !== "draft") {
    done("/strategy-cycle?l1=corporate-strategy&l2=summary");
  }

  await supabase.schema("app").from("strategic_challenges").insert({
    organization_id: context.organizationId,
    cycle_instance_id: context.cycleId,
    title: candidate.title,
    description: candidate.description,
    priority: candidate.priority,
    visibility: "internal",
    created_by_membership_id: context.membershipId,
  });
  await supabase
    .schema("app")
    .from("analysis_challenge_candidates")
    .update({ status: "promoted" })
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("id", candidateId);

  done("/strategy-cycle?l1=corporate-strategy&l2=summary&success=promoted");
}

export async function dismissChallengeCandidate(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const candidateId = String(formData.get("candidate_id") ?? "").trim();
  if (!candidateId) {
    done("/strategy-cycle?l1=corporate-strategy&l2=summary");
  }
  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("analysis_challenge_candidates")
    .update({ status: "dismissed" })
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("id", candidateId);
  done("/strategy-cycle?l1=corporate-strategy&l2=summary");
}

export async function attachFindingToChallenge(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const tab = String(formData.get("analysis_type") ?? "environment");
  const entryId = String(formData.get("analysis_entry_id") ?? "");
  const challengeId = String(formData.get("challenge_id") ?? "");
  if (!entryId || !challengeId) done(`/strategy-cycle?tab=${tab}`);

  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("strategic_challenges")
    .update({ source_analysis_entry_id: entryId })
    .eq("id", challengeId)
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId);

  done(`/strategy-cycle?tab=${tab}&success=finding-linked`);
}

export async function createStrategicDirectionInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    done("/strategy-cycle?l1=strategic-directions&error=missing-title");
  }

  const priority = Number(formData.get("priority") ?? 3);
  const status = String(formData.get("status") ?? "draft");
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("strategic_directions").insert({
    organization_id: context.organizationId,
    cycle_instance_id: context.cycleId,
    title,
    priority: Number.isFinite(priority) ? Math.max(1, Math.min(5, priority)) : 3,
    status,
    created_by_membership_id: context.membershipId,
  });
  done("/strategy-cycle?l1=strategic-directions&success=direction-created");
}

export async function linkDirectionToChallengePredecessor(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const directionId = String(formData.get("strategic_direction_id") ?? "").trim();
  const challengeId = String(formData.get("strategic_challenge_id") ?? "").trim();
  if (!directionId || !challengeId) {
    done("/strategy-cycle?l1=strategic-directions&error=missing-link");
  }
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("challenge_direction_links").upsert(
    {
      organization_id: context.organizationId,
      cycle_instance_id: context.cycleId,
      strategic_direction_id: directionId,
      strategic_challenge_id: challengeId,
      contribution_level: String(formData.get("contribution_level") ?? "medium"),
      note: String(formData.get("note") ?? "").trim() || null,
      created_by_membership_id: context.membershipId,
    },
    { onConflict: "cycle_instance_id,strategic_direction_id,strategic_challenge_id" }
  );
  done("/strategy-cycle?l1=strategic-directions&success=linked");
}

export async function unlinkDirectionChallengePredecessor(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const directionId = String(formData.get("strategic_direction_id") ?? "").trim();
  const challengeId = String(formData.get("strategic_challenge_id") ?? "").trim();
  if (!directionId || !challengeId) {
    done("/strategy-cycle?l1=strategic-directions");
  }
  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("challenge_direction_links")
    .delete()
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("strategic_direction_id", directionId)
    .eq("strategic_challenge_id", challengeId);
  done("/strategy-cycle?l1=strategic-directions&success=unlinked");
}

export async function createPipInitiativeInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    done("/strategy-cycle?l1=pips&error=missing-title");
  }

  const priority = Number(formData.get("priority") ?? 3);
  const status = String(formData.get("status") ?? "planned");
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("initiatives").insert({
    organization_id: context.organizationId,
    cycle_instance_id: context.cycleId,
    title,
    priority: Number.isFinite(priority) ? Math.max(1, Math.min(5, priority)) : 3,
    status,
    created_by_membership_id: context.membershipId,
  });
  done("/strategy-cycle?l1=pips&success=initiative-created");
}

export async function linkInitiativeToTargetPredecessor(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const initiativeId = String(formData.get("initiative_id") ?? "").trim();
  const annualTargetId = String(formData.get("annual_target_id") ?? "").trim();
  if (!initiativeId || !annualTargetId) {
    done("/strategy-cycle?l1=pips&error=missing-link");
  }
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("initiative_target_links").upsert(
    {
      organization_id: context.organizationId,
      cycle_instance_id: context.cycleId,
      initiative_id: initiativeId,
      annual_target_id: annualTargetId,
      contribution_level: String(formData.get("contribution_level") ?? "medium"),
      comment: String(formData.get("comment") ?? "").trim() || null,
    },
    { onConflict: "cycle_instance_id,initiative_id,annual_target_id" }
  );
  done("/strategy-cycle?l1=pips&success=linked");
}

export async function unlinkInitiativeTargetPredecessor(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const initiativeId = String(formData.get("initiative_id") ?? "").trim();
  const annualTargetId = String(formData.get("annual_target_id") ?? "").trim();
  if (!initiativeId || !annualTargetId) {
    done("/strategy-cycle?l1=pips");
  }
  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("initiative_target_links")
    .delete()
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("initiative_id", initiativeId)
    .eq("annual_target_id", annualTargetId);
  done("/strategy-cycle?l1=pips&success=unlinked");
}
