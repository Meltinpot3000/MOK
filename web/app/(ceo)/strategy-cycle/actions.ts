"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { computeClusters } from "@/lib/analysis-network/cluster";
import { computeGapFindings } from "@/lib/analysis-network/gaps";
import { generateHybridLinkCandidates } from "@/lib/analysis-network/link-scorer";
import {
  evaluateLlmBudgetStatus,
  type BudgetSupabaseClientLike,
} from "@/lib/analysis-network/budget";
import {
  isLlmFeatureEnabled,
  readAnalysisNetworkLlmPolicy,
  resolveLlmMaxOutputTokens,
} from "@/lib/analysis-network/policy";
import {
  assessClusterWithLlm,
  assessGapWithLlm,
  proposeGraphLayoutWithLlm,
  proposeChallengeCandidatesWithLlm,
  GROQ_MODEL,
  GEMINI_MODEL_ASSIST,
} from "@/lib/analysis-network/providers";
import {
  computeEntryEmbedding,
  parseVectorLiteral,
  toVectorLiteral,
} from "@/lib/analysis-network/embeddings";
import { recordLlmUsageEvents } from "@/lib/analysis-network/usage";
import { writeAiStorageActionLog, type AiStorageProviderModel } from "@/lib/analysis-network/storage-log";
import { getActivePlanningCycle, getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import {
  calculateQualityScoreWithFallback,
  getQualityWeightsFromBrandingConfig,
} from "@/lib/strategy-cycle/quality-score";
import {
  buildStrategyReferenceText,
  readStrategyReferenceFieldsFromBrandingConfig,
} from "@/lib/strategy-cycle/strategy-reference";
import {
  clampScore1to5,
  computeChallengeScore,
  computeDirectionScore,
} from "@/lib/strategy-cycle/scoring";
import {
  proposeMatrixProgramWithGemini,
  type MatrixProgramProposalResult,
} from "@/lib/strategy-cycle/matrix-program-ai";
import {
  invalidateStrategicContextCache,
  validateCompanyProfileForEvaluation,
  buildCompanyProfileInput,
  getOrBuildStrategicContext,
} from "@/lib/strategy-cycle/objective-evaluation";
import { readCompanyKennzahlenFromBrandingConfig } from "@/lib/strategy-cycle/company-info";
import {
  OBJECTIVE_EVAL_PROMPT_VERSION,
  PORTFOLIO_EVAL_PROMPT_VERSION,
  evaluateObjectiveWithLlm,
  evaluateObjectivePortfolioWithLlm,
} from "@/lib/analysis-network/objective-evaluation-providers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type WorkspaceContext = {
  organizationId: string;
  membershipId: string;
  cycleId: string;
};

type PersistedQualityResult = {
  score: number;
  band: "high" | "medium" | "low";
  source: "llm" | "rule";
  explanation: string | null;
  fallbackReason: "llm_not_requested" | "llm_no_result" | null;
  provider: string | null;
  model: string | null;
  promptVersion: string | null;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    billableCost: number | null;
    usageMissing: boolean;
  } | null;
};

type GraphLayoutPoint = {
  id: string;
  x: number;
  y: number;
  z: number;
  confidence: number;
  reason: string;
};

type EmbeddingUpdateResult = {
  attempted: boolean;
  status: "ready" | "failed";
  model: string;
  version: string;
  dimensions: number;
  httpStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
};

type GraphLayoutRunSummary = {
  usedLlm: boolean;
  status: "success" | "partial";
  fallbackReason: "llm_no_result" | "llm_not_requested" | null;
  providerModel: AiStorageProviderModel | null;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    billableCost: number | null;
    usageMissing: boolean;
  } | null;
  nodeCount: number;
  llmNodeCount: number;
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
const QUALITY_BACKFILL_BATCH_SIZE = Number(process.env.ANALYSIS_QUALITY_BACKFILL_BATCH_SIZE ?? 6);
const QUALITY_BACKFILL_BATCH_PAUSE_MS = Number(process.env.ANALYSIS_QUALITY_BACKFILL_BATCH_PAUSE_MS ?? 2500);
const JOB_WORKER_BATCH_SIZE = Number(process.env.ANALYSIS_JOB_WORKER_BATCH_SIZE ?? 1);

function toProviderModels(events: Array<{ provider: string; model: string; promptVersion?: string | null }>): AiStorageProviderModel[] {
  const seen = new Set<string>();
  const out: AiStorageProviderModel[] = [];
  for (const event of events) {
    const key = `${event.provider}::${event.model}::${event.promptVersion ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      provider: event.provider,
      model: event.model,
      promptVersion: event.promptVersion ?? null,
    });
  }
  return out;
}

function summarizeUsage(events: Array<{
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  billableCost?: number | null;
}>): {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  billableCost: number | null;
} {
  if (events.length === 0) {
    return {
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      billableCost: null,
    };
  }
  let prompt = 0;
  let completion = 0;
  let total = 0;
  let cost = 0;
  let hasPrompt = false;
  let hasCompletion = false;
  let hasTotal = false;
  let hasCost = false;
  for (const event of events) {
    if (event.promptTokens != null) {
      hasPrompt = true;
      prompt += Number(event.promptTokens);
    }
    if (event.completionTokens != null) {
      hasCompletion = true;
      completion += Number(event.completionTokens);
    }
    if (event.totalTokens != null) {
      hasTotal = true;
      total += Number(event.totalTokens);
    }
    if (event.billableCost != null) {
      hasCost = true;
      cost += Number(event.billableCost);
    }
  }
  return {
    promptTokens: hasPrompt ? prompt : null,
    completionTokens: hasCompletion ? completion : null,
    totalTokens: hasTotal ? total : null,
    billableCost: hasCost ? Number(cost.toFixed(6)) : null,
  };
}

async function writeAiActionLogSafe(input: Parameters<typeof writeAiStorageActionLog>[0]): Promise<void> {
  const result = await writeAiStorageActionLog(input);
  if (!result.ok) {
    console.warn("[ai-storage-log] write failed", {
      organizationId: input.organizationId,
      feature: input.feature,
      action: input.action,
      triggerType: input.triggerType,
      error: result.error,
    });
  }
}

type BackgroundJobType =
  | "quality_backfill"
  | "graph_layout_recompute"
  | "entry_embedding_backfill"
  | "objective_evaluation_backfill"
  | "link_draft_generation"
  | "cluster_recompute"
  | "gaps_recompute";
type BackgroundJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

type AnalysisNetworkConfig = {
  maxLlmPairs: number;
  minRuleConfidence: number;
  fusionWeights: { rule: number; llm: number };
  llmEnabled: boolean;
  maxGapLlmItems: number;
  maxClusterLlmItems: number;
  maxChallengeCandidates: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.round(ms))));
}

function getQualityBand(score: number): "high" | "medium" | "low" {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function clampUnit(value: number): number {
  return Number(clamp(value, -1, 1).toFixed(4));
}

function readRuleGraphLayoutPoint(entry: {
  id: string;
  analysis_type: string;
  impact_level: number | null;
  uncertainty_level: number | null;
  quality_score: number | null;
}): GraphLayoutPoint {
  const impact = Math.max(1, Math.min(5, entry.impact_level ?? 3));
  const uncertainty = Math.max(1, Math.min(5, entry.uncertainty_level ?? 3));
  const quality = Math.max(0, Math.min(100, entry.quality_score ?? 50));
  const externalBias =
    entry.analysis_type === "environment" || entry.analysis_type === "competitor"
      ? -0.7
      : entry.analysis_type === "company" || entry.analysis_type === "swot"
        ? 0.7
        : 0;
  const yPriority = ((impact - 1) / 4) * 0.9 - ((uncertainty - 1) / 4) * 0.4;
  const zDepth = (quality / 100) * 0.8 - 0.4;
  return {
    id: entry.id,
    x: clampUnit(externalBias),
    y: clampUnit(yPriority),
    z: clampUnit(zDepth),
    confidence: 0.35,
    reason: "Regelbasiertes Fallback-Layout",
  };
}

function readTriScoresFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const tri = (metadata as Record<string, unknown>).triScores;
  if (!tri || typeof tri !== "object") return null;
  const row = tri as Record<string, unknown>;
  const proximityScore = Number(row.proximityScore ?? 0);
  const supportScore = Number(row.supportScore ?? 0);
  const repulsionScore = Number(row.repulsionScore ?? 0);
  if (!Number.isFinite(proximityScore) || !Number.isFinite(supportScore) || !Number.isFinite(repulsionScore)) {
    return null;
  }
  return {
    proximityScore: Number(clamp(proximityScore, 0, 1).toFixed(4)),
    supportScore: Number(clamp(supportScore, 0, 1).toFixed(4)),
    repulsionScore: Number(clamp(repulsionScore, 0, 1).toFixed(4)),
  };
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
  const maxLlmPairs = clamp(Number(network.max_llm_pairs ?? 10), 0, 40);
  const minRuleConfidence = clamp(Number(network.min_rule_confidence ?? 0.22), 0.05, 0.9);
  const llmWeight = clamp(Number(fusion.llm ?? 0.45), 0.2, 0.8);
  const ruleWeight = clamp(Number(fusion.rule ?? 0.55), 0.2, 0.8);
  const llmEnabled = Boolean(network.llm_enabled ?? true);
  const maxGapLlmItems = clamp(Number(network.max_gap_llm_items ?? 8), 0, 20);
  const maxClusterLlmItems = clamp(Number(network.max_cluster_llm_items ?? 8), 0, 20);
  const maxChallengeCandidates = clamp(Number(network.max_challenge_candidates ?? 10), 1, 20);
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
    maxChallengeCandidates: Math.round(maxChallengeCandidates),
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

async function updateEntryEmbedding(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  organizationId: string;
  cycleId: string;
  entry: {
    id: string;
    title: string;
    analysis_type: string;
    sub_type: string | null;
    description: string | null;
  };
}): Promise<EmbeddingUpdateResult> {
  const embedding = await computeEntryEmbedding(params.entry);
  const now = new Date().toISOString();
  await params.supabase
    .schema("app")
    .from("analysis_entries")
    .update({
      semantic_embedding: embedding.embedding ? toVectorLiteral(embedding.embedding) : null,
      semantic_embedding_model: embedding.model,
      semantic_embedding_version: embedding.version,
      semantic_embedding_calculated_at: now,
      semantic_embedding_status: embedding.embedding ? "ready" : "failed",
    })
    .eq("id", params.entry.id)
    .eq("organization_id", params.organizationId)
    .eq("cycle_instance_id", params.cycleId);
  return {
    attempted: embedding.attempted,
    status: embedding.embedding ? "ready" : "failed",
    model: embedding.model,
    version: embedding.version,
    dimensions: embedding.embedding?.length ?? 0,
    httpStatus: embedding.httpStatus,
    errorCode: embedding.errorCode,
    errorMessage: embedding.errorMessage,
  };
}

function strategyCycleWorkerBaseUrl(): string {
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

async function postStrategyCycleWorkerKick(): Promise<void> {
  const url = `${strategyCycleWorkerBaseUrl()}/api/internal/strategy-cycle-jobs`;
  const secret = process.env.STRATEGY_CYCLE_JOBS_CRON_SECRET ?? process.env.CRON_SECRET ?? "";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (secret) headers.Authorization = `Bearer ${secret}`;
  const res = await fetch(url, { method: "POST", headers, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn("[strategy-cycle-worker] kick failed", res.status, body.slice(0, 300));
  }
}

/** Nach Enqueue den gleichen Worker wie Cron aufrufen (lokal + Vercel). Läuft per `after()` auch nach redirect(). */
function scheduleStrategyCycleWorkerKick(): void {
  const raw = process.env.ANALYSIS_JOB_WORKER_KICK_BURST ?? "4";
  const burst = Math.max(1, Math.min(12, Math.round(Number(raw)) || 4));
  after(async () => {
    try {
      for (let i = 0; i < burst; i += 1) {
        await postStrategyCycleWorkerKick();
        if (i + 1 < burst) {
          await new Promise((r) => setTimeout(r, 250));
        }
      }
    } catch (e) {
      console.warn("[strategy-cycle-worker] kick error", e);
    }
  });
}

async function enqueueBackgroundJob(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  organizationId: string;
  cycleId: string;
  membershipId: string;
  jobType: BackgroundJobType;
  payload?: Record<string, unknown>;
}) {
  const { error } = await params.supabase.schema("app").from("analysis_background_jobs").insert({
    organization_id: params.organizationId,
    cycle_instance_id: params.cycleId,
    job_type: params.jobType,
    status: "pending",
    payload: params.payload ?? {},
    created_by_membership_id: params.membershipId,
  });
  if (error) {
    console.error("[enqueueBackgroundJob]", error);
    throw new Error(`Hintergrund-Job konnte nicht eingestellt werden: ${error.message}`);
  }
  scheduleStrategyCycleWorkerKick();
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

async function computePersistedQuality(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  organizationId: string;
  entry: {
    id: string;
    analysis_type: string;
    sub_type: string | null;
    title: string;
    description: string | null;
    impact_level: number | null;
    uncertainty_level: number | null;
  };
}): Promise<PersistedQualityResult> {
  const brandingConfig = await readBrandingConfig(params.supabase, params.organizationId);
  const llmPolicy = readAnalysisNetworkLlmPolicy(brandingConfig);
  const budgetStatus = await evaluateLlmBudgetStatus({
    supabase: params.supabase as unknown as BudgetSupabaseClientLike,
    organizationId: params.organizationId,
    policy: llmPolicy,
  });
  const canUseQualityLlm = budgetStatus.allowed && isLlmFeatureEnabled(llmPolicy, "quality_scoring");
  const strategyReferenceText = buildStrategyReferenceText(
    readStrategyReferenceFieldsFromBrandingConfig(brandingConfig)
  );
  const weights = getQualityWeightsFromBrandingConfig(brandingConfig);
  const qualityResult = await calculateQualityScoreWithFallback(params.entry, weights, {
    llmEnabled: canUseQualityLlm,
    strategyReferenceText,
    maxOutputTokens: resolveLlmMaxOutputTokens(llmPolicy, "quality_scoring"),
  });
  return {
    score: qualityResult.score,
    band: getQualityBand(qualityResult.score),
    source: qualityResult.source,
    explanation: qualityResult.explanation,
    fallbackReason: qualityResult.fallbackReason,
    provider: qualityResult.provider,
    model: qualityResult.model,
    promptVersion: qualityResult.promptVersion,
    usage: qualityResult.usage,
  };
}

async function recomputeAndPersistGraphLayout(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  organizationId: string;
  cycleId: string;
  trigger: string;
}): Promise<GraphLayoutRunSummary> {
  const [{ data: entries }, { data: approvedLinks }, { data: draftLinks }] = await Promise.all([
    params.supabase
      .schema("app")
      .from("analysis_entries")
      .select("id, title, analysis_type, sub_type, description, impact_level, uncertainty_level, quality_score")
      .eq("organization_id", params.organizationId)
      .eq("cycle_instance_id", params.cycleId),
    params.supabase
      .schema("app")
      .from("analysis_item_link")
      .select("source_analysis_item_id, target_analysis_item_id, link_type, confidence, strength, metadata")
      .eq("organization_id", params.organizationId)
      .eq("cycle_instance_id", params.cycleId),
    params.supabase
      .schema("app")
      .from("analysis_item_link_draft")
      .select("source_analysis_item_id, target_analysis_item_id, link_type, confidence, strength, metadata, status")
      .eq("organization_id", params.organizationId)
      .eq("cycle_instance_id", params.cycleId)
      .eq("status", "draft"),
  ]);
  const allEntries = entries ?? [];
  if (allEntries.length === 0) {
    return {
      usedLlm: false,
      status: "success",
      fallbackReason: "llm_not_requested",
      providerModel: null,
      usage: null,
      nodeCount: 0,
      llmNodeCount: 0,
    };
  }
  const brandingConfig = await readBrandingConfig(params.supabase, params.organizationId);
  const llmPolicy = readAnalysisNetworkLlmPolicy(brandingConfig);
  const budgetStatus = await evaluateLlmBudgetStatus({
    supabase: params.supabase as unknown as BudgetSupabaseClientLike,
    organizationId: params.organizationId,
    policy: llmPolicy,
  });
  const canUseGraphLayoutLlm = budgetStatus.allowed && isLlmFeatureEnabled(llmPolicy, "graph_layout");
  const strategyReferenceText = buildStrategyReferenceText(
    readStrategyReferenceFieldsFromBrandingConfig(brandingConfig)
  );
  const mergedEdges = [...(approvedLinks ?? []), ...(draftLinks ?? [])].map((edge) => ({
    source: edge.source_analysis_item_id,
    target: edge.target_analysis_item_id,
    linkType: edge.link_type,
    confidence: Number(edge.confidence ?? 0),
    strength: Number(edge.strength ?? 3),
    triScores: readTriScoresFromMetadata(edge.metadata),
  }));
  const fallbackPoints = allEntries.map((entry) => readRuleGraphLayoutPoint(entry));
  const llmResponse = canUseGraphLayoutLlm
    ? await proposeGraphLayoutWithLlm({
        nodes: allEntries.map((entry) => ({
          id: entry.id,
          title: entry.title,
          analysisType: entry.analysis_type,
          subType: entry.sub_type,
          impact: entry.impact_level ?? 3,
          uncertainty: entry.uncertainty_level ?? 3,
          description: entry.description,
          qualityScore: Number(entry.quality_score ?? 50),
        })),
        edges: mergedEdges,
        strategyReferenceText,
        maxOutputTokens: resolveLlmMaxOutputTokens(llmPolicy, "graph_layout"),
      })
    : { result: null, usage: null };
  const fallbackReason = llmResponse.result ? null : canUseGraphLayoutLlm ? "llm_no_result" : "llm_not_requested";
  const pointsById = new Map<string, GraphLayoutPoint>(
    (llmResponse.result?.nodes ?? fallbackPoints).map((point) => [
      point.id,
      { ...point, reason: point.reason ?? "" } as GraphLayoutPoint,
    ])
  );
  const llmNodeIds = new Set((llmResponse.result?.nodes ?? []).map((node) => node.id));
  const calculatedAt = new Date().toISOString();
  await Promise.all(
    allEntries.map((entry) => {
      const point = pointsById.get(entry.id) ?? readRuleGraphLayoutPoint(entry);
      const isLlmNode = llmNodeIds.has(entry.id);
      return params.supabase
        .schema("app")
        .from("analysis_entries")
        .update({
          graph_layout_x: point.x,
          graph_layout_y: point.y,
          graph_layout_z: point.z,
          graph_layout_confidence: point.confidence,
          graph_layout_reason: point.reason || null,
          graph_layout_source: isLlmNode ? "llm" : "rule",
          graph_layout_fallback_reason:
            isLlmNode || !llmResponse.result
              ? fallbackReason
              : canUseGraphLayoutLlm
                ? "llm_no_result"
                : "llm_not_requested",
          graph_layout_provider: isLlmNode ? llmResponse.result?.provider ?? null : null,
          graph_layout_model: isLlmNode ? llmResponse.result?.model ?? null : null,
          graph_layout_prompt_version: isLlmNode ? llmResponse.result?.promptVersion ?? null : null,
          graph_layout_calculated_at: calculatedAt,
        })
        .eq("id", entry.id)
        .eq("organization_id", params.organizationId)
        .eq("cycle_instance_id", params.cycleId);
    })
  );
  if (llmResponse.result && llmResponse.usage) {
    await recordLlmUsageEvents(params.supabase, [
      {
        organizationId: params.organizationId,
        cycleInstanceId: params.cycleId,
        feature: "graph_layout",
        provider: llmResponse.result.provider,
        model: llmResponse.result.model,
        promptVersion: llmResponse.result.promptVersion,
        promptTokens: llmResponse.usage.promptTokens,
        completionTokens: llmResponse.usage.completionTokens,
        totalTokens: llmResponse.usage.totalTokens,
        billableCost: llmResponse.usage.billableCost,
        usageMissing: llmResponse.usage.usageMissing,
        metadata: { trigger: params.trigger },
      },
    ]);
  }
  return {
    usedLlm: Boolean(llmResponse.result),
    status: llmResponse.result || !canUseGraphLayoutLlm ? "success" : "partial",
    fallbackReason,
    providerModel: llmResponse.result
      ? {
          provider: llmResponse.result.provider,
          model: llmResponse.result.model,
          promptVersion: llmResponse.result.promptVersion,
        }
      : null,
    usage: llmResponse.usage
      ? {
          promptTokens: llmResponse.usage.promptTokens,
          completionTokens: llmResponse.usage.completionTokens,
          totalTokens: llmResponse.usage.totalTokens,
          billableCost: llmResponse.usage.billableCost,
          usageMissing: llmResponse.usage.usageMissing,
        }
      : null,
    nodeCount: allEntries.length,
    llmNodeCount: llmNodeIds.size,
  };
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

/** Wenn _noRedirect=1 im FormData: nur revalidieren, kein Redirect. Fuer sanfte UX (z.B. Pill-Klicks). */
function finishOrRedirect(formData: FormData, path: string): void {
  revalidatePath("/strategy-cycle");
  revalidatePath("/strategy-matrix");
  if (formData.get("_noRedirect") === "1") return;
  redirect(path);
}

function readSmallIntField(formData: FormData, key: string, fallback = 3): number {
  const parsed = Number(formData.get(key) ?? fallback);
  return clampScore1to5(parsed);
}

function readSafeReturnTo(formData: FormData, fallbackPath: string): string {
  const raw = String(formData.get("return_to") ?? "").trim();
  if (!raw.startsWith("/strategy-cycle")) return fallbackPath;
  return raw;
}

function withSuccess(path: string, success: string): string {
  const delimiter = path.includes("?") ? "&" : "?";
  return `${path}${delimiter}success=${encodeURIComponent(success)}`;
}

function readCorrelationStatusField(formData: FormData, key: string): "green" | "yellow" | "red" | "unknown" {
  const raw = String(formData.get(key) ?? "unknown").trim().toLowerCase();
  if (raw === "green" || raw === "yellow" || raw === "red" || raw === "unknown") return raw;
  return "unknown";
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
  const startedAt = new Date().toISOString();
  const context = await getWorkspaceContextOrRedirect();
  const input = readAndValidateInput(formData);

  const supabase = await createSupabaseServerClient();
  const entryId = crypto.randomUUID();
  const quality = await computePersistedQuality({
    supabase,
    organizationId: context.organizationId,
    entry: {
      id: entryId,
      analysis_type: input.analysisType,
      sub_type: input.subType,
      title: input.title,
      description: input.description,
      impact_level: input.impactLevel,
      uncertainty_level: input.uncertaintyLevel,
    },
  });
  await supabase.schema("app").from("analysis_entries").insert({
    id: entryId,
    organization_id: context.organizationId,
    cycle_instance_id: context.cycleId,
    analysis_type: input.analysisType,
    sub_type: input.subType,
    title: input.title,
    description: input.description,
    impact_level: input.impactLevel,
    uncertainty_level: input.uncertaintyLevel,
    quality_score: quality.score,
    quality_band: quality.band,
    quality_source: quality.source,
    quality_explanation: quality.explanation,
    quality_calculated_at: new Date().toISOString(),
    quality_fallback_reason: quality.fallbackReason,
    quality_provider: quality.provider,
    quality_model: quality.model,
    quality_prompt_version: quality.promptVersion,
    semantic_embedding_status: "pending",
    created_by_membership_id: context.membershipId,
    created_by_source: "user",
  });
  const embeddingResult = await updateEntryEmbedding({
    supabase,
    organizationId: context.organizationId,
    cycleId: context.cycleId,
    entry: {
      id: entryId,
      title: input.title,
      analysis_type: input.analysisType,
      sub_type: input.subType,
      description: input.description,
    },
  });

  if (quality.source === "llm" && quality.usage && quality.provider && quality.model && quality.promptVersion) {
    await recordLlmUsageEvents(supabase, [
      {
        organizationId: context.organizationId,
        cycleInstanceId: context.cycleId,
        feature: "quality_scoring",
        provider: quality.provider,
        model: quality.model,
        promptVersion: quality.promptVersion,
        promptTokens: quality.usage.promptTokens,
        completionTokens: quality.usage.completionTokens,
        totalTokens: quality.usage.totalTokens,
        billableCost: quality.usage.billableCost,
        usageMissing: quality.usage.usageMissing,
        metadata: { analysisType: input.analysisType, trigger: "create_analysis_entry" },
      },
    ]);
  }
  const graphLayoutSummary = await recomputeAndPersistGraphLayout({
    supabase,
    organizationId: context.organizationId,
    cycleId: context.cycleId,
    trigger: "create_analysis_entry",
  });
  const providerModels: AiStorageProviderModel[] = [];
  if (quality.source === "llm" && quality.provider && quality.model) {
    providerModels.push({
      provider: quality.provider,
      model: quality.model,
      promptVersion: quality.promptVersion,
    });
  }
  if (embeddingResult.attempted) {
    providerModels.push({
      provider: "gemini",
      model: embeddingResult.model,
      promptVersion: embeddingResult.version,
    });
  }
  if (graphLayoutSummary.providerModel) {
    providerModels.push(graphLayoutSummary.providerModel);
  }
  await writeAiActionLogSafe({
    supabase,
    organizationId: context.organizationId,
    cycleInstanceId: context.cycleId,
    feature: "strategy_cycle",
    action: "create_analysis_entry",
    triggerType: "click",
    status: graphLayoutSummary.status === "partial" ? "partial" : "success",
    startedAt,
    finishedAt: new Date().toISOString(),
    providerModels: toProviderModels(providerModels),
    tokens: summarizeUsage(
      [
        quality.usage
          ? {
              promptTokens: quality.usage.promptTokens,
              completionTokens: quality.usage.completionTokens,
              totalTokens: quality.usage.totalTokens,
              billableCost: quality.usage.billableCost,
            }
          : null,
        graphLayoutSummary.usage
          ? {
              promptTokens: graphLayoutSummary.usage.promptTokens,
              completionTokens: graphLayoutSummary.usage.completionTokens,
              totalTokens: graphLayoutSummary.usage.totalTokens,
              billableCost: graphLayoutSummary.usage.billableCost,
            }
          : null,
      ].filter(Boolean) as Array<{
        promptTokens: number | null;
        completionTokens: number | null;
        totalTokens: number | null;
        billableCost?: number | null;
      }>
    ),
    billableCost: summarizeUsage(
      [
        quality.usage
          ? {
              promptTokens: quality.usage.promptTokens,
              completionTokens: quality.usage.completionTokens,
              totalTokens: quality.usage.totalTokens,
              billableCost: quality.usage.billableCost,
            }
          : null,
        graphLayoutSummary.usage
          ? {
              promptTokens: graphLayoutSummary.usage.promptTokens,
              completionTokens: graphLayoutSummary.usage.completionTokens,
              totalTokens: graphLayoutSummary.usage.totalTokens,
              billableCost: graphLayoutSummary.usage.billableCost,
            }
          : null,
      ].filter(Boolean) as Array<{
        promptTokens: number | null;
        completionTokens: number | null;
        totalTokens: number | null;
        billableCost?: number | null;
      }>
    ).billableCost,
    counts: {
      entriesProcessed: 1,
      qualityLlmUsed: quality.source === "llm" ? 1 : 0,
      embeddingAttempted: embeddingResult.attempted ? 1 : 0,
      embeddingReady: embeddingResult.status === "ready" ? 1 : 0,
      graphLayoutNodes: graphLayoutSummary.nodeCount,
      graphLayoutLlmNodes: graphLayoutSummary.llmNodeCount,
    },
    items: [
      {
        type: "quality_scoring",
        source: quality.source,
        score: quality.score,
        fallbackReason: quality.fallbackReason,
      },
      {
        type: "embedding",
        attempted: embeddingResult.attempted,
        status: embeddingResult.status,
        model: embeddingResult.model,
        version: embeddingResult.version,
        dimensions: embeddingResult.dimensions,
        httpStatus: embeddingResult.httpStatus,
      },
      {
        type: "graph_layout",
        usedLlm: graphLayoutSummary.usedLlm,
        status: graphLayoutSummary.status,
        fallbackReason: graphLayoutSummary.fallbackReason,
        nodeCount: graphLayoutSummary.nodeCount,
        llmNodeCount: graphLayoutSummary.llmNodeCount,
      },
    ],
    errors: [
      embeddingResult.errorCode || embeddingResult.errorMessage
        ? {
            phase: "embedding",
            code: embeddingResult.errorCode,
            message: embeddingResult.errorMessage,
          }
        : null,
    ].filter(Boolean) as unknown[],
    metadata: { analysisType: input.analysisType, entryId },
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

  await invalidateStrategicContextCache(supabase, context.organizationId);
  done("/strategy-cycle?l1=unternehmensinfo&success=strategy-reference-saved");
}

export async function saveCompanyKennzahlen(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const supabase = await createSupabaseServerClient();
  const brandingConfig = await readBrandingConfig(supabase, context.organizationId);
  const regionenRaw = formData.getAll("company_info_marktregionen");
  const marktregionen = Array.isArray(regionenRaw) ? regionenRaw.map(String).filter(Boolean).slice(0, 20) : [];
  const nextBrandingConfig = {
    ...brandingConfig,
    company_info_organizationsform: String(formData.get("company_info_organizationsform") ?? "").trim().slice(0, 80),
    company_info_organizationsform_other: String(formData.get("company_info_organizationsform_other") ?? "").trim().slice(0, 200),
    company_info_unternehmensgroesse: String(formData.get("company_info_unternehmensgroesse") ?? "").trim().slice(0, 50),
    company_info_industriekontext: String(formData.get("company_info_industriekontext") ?? "").trim().slice(0, 80),
    company_info_industriekontext_other: String(formData.get("company_info_industriekontext_other") ?? "").trim().slice(0, 200),
    company_info_kern_wertschoepfung: String(formData.get("company_info_kern_wertschoepfung") ?? "").trim().slice(0, 50),
    company_info_wichtigstes_produkt_oder_dienstleistung: String(formData.get("company_info_wichtigstes_produkt_oder_dienstleistung") ?? "").trim().slice(0, 500),
    company_info_transformation_status: String(formData.get("company_info_transformation_status") ?? "").trim().slice(0, 50),
    company_info_marktregionen: marktregionen,
    company_info_umsatz_heute: String(formData.get("company_info_umsatz_heute") ?? "").trim().slice(0, 100),
    company_info_umsatz_ziel: String(formData.get("company_info_umsatz_ziel") ?? "").trim().slice(0, 100),
  };
  await supabase
    .schema("app")
    .from("tenant_branding")
    .update({ branding_config: nextBrandingConfig })
    .eq("organization_id", context.organizationId);

  await invalidateStrategicContextCache(supabase, context.organizationId);
  done("/strategy-cycle?l1=unternehmensinfo&l2=kennwerte&success=company-kennzahlen-saved");
}

export async function updateAnalysisEntry(formData: FormData) {
  const startedAt = new Date().toISOString();
  const context = await getWorkspaceContextOrRedirect();
  const id = String(formData.get("analysis_entry_id") ?? "");
  if (!id) done();
  const input = readAndValidateInput(formData);

  const supabase = await createSupabaseServerClient();
  const quality = await computePersistedQuality({
    supabase,
    organizationId: context.organizationId,
    entry: {
      id,
      analysis_type: input.analysisType,
      sub_type: input.subType,
      title: input.title,
      description: input.description,
      impact_level: input.impactLevel,
      uncertainty_level: input.uncertaintyLevel,
    },
  });
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
      quality_score: quality.score,
      quality_band: quality.band,
      quality_source: quality.source,
      quality_explanation: quality.explanation,
      quality_calculated_at: new Date().toISOString(),
      quality_fallback_reason: quality.fallbackReason,
      quality_provider: quality.provider,
      quality_model: quality.model,
      quality_prompt_version: quality.promptVersion,
      semantic_embedding_status: "pending",
    })
    .eq("id", id)
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId);
  const embeddingResult = await updateEntryEmbedding({
    supabase,
    organizationId: context.organizationId,
    cycleId: context.cycleId,
    entry: {
      id,
      title: input.title,
      analysis_type: input.analysisType,
      sub_type: input.subType,
      description: input.description,
    },
  });

  if (quality.source === "llm" && quality.usage && quality.provider && quality.model && quality.promptVersion) {
    await recordLlmUsageEvents(supabase, [
      {
        organizationId: context.organizationId,
        cycleInstanceId: context.cycleId,
        feature: "quality_scoring",
        provider: quality.provider,
        model: quality.model,
        promptVersion: quality.promptVersion,
        promptTokens: quality.usage.promptTokens,
        completionTokens: quality.usage.completionTokens,
        totalTokens: quality.usage.totalTokens,
        billableCost: quality.usage.billableCost,
        usageMissing: quality.usage.usageMissing,
        metadata: { analysisType: input.analysisType, trigger: "update_analysis_entry" },
      },
    ]);
  }
  const graphLayoutSummary = await recomputeAndPersistGraphLayout({
    supabase,
    organizationId: context.organizationId,
    cycleId: context.cycleId,
    trigger: "update_analysis_entry",
  });
  const usageSummary = summarizeUsage(
    [
      quality.usage
        ? {
            promptTokens: quality.usage.promptTokens,
            completionTokens: quality.usage.completionTokens,
            totalTokens: quality.usage.totalTokens,
            billableCost: quality.usage.billableCost,
          }
        : null,
      graphLayoutSummary.usage
        ? {
            promptTokens: graphLayoutSummary.usage.promptTokens,
            completionTokens: graphLayoutSummary.usage.completionTokens,
            totalTokens: graphLayoutSummary.usage.totalTokens,
            billableCost: graphLayoutSummary.usage.billableCost,
          }
        : null,
    ].filter(Boolean) as Array<{
      promptTokens: number | null;
      completionTokens: number | null;
      totalTokens: number | null;
      billableCost?: number | null;
    }>
  );
  const providerModels: AiStorageProviderModel[] = [];
  if (quality.source === "llm" && quality.provider && quality.model) {
    providerModels.push({
      provider: quality.provider,
      model: quality.model,
      promptVersion: quality.promptVersion,
    });
  }
  if (embeddingResult.attempted) {
    providerModels.push({
      provider: "gemini",
      model: embeddingResult.model,
      promptVersion: embeddingResult.version,
    });
  }
  if (graphLayoutSummary.providerModel) {
    providerModels.push(graphLayoutSummary.providerModel);
  }
  await writeAiActionLogSafe({
    supabase,
    organizationId: context.organizationId,
    cycleInstanceId: context.cycleId,
    feature: "strategy_cycle",
    action: "update_analysis_entry",
    triggerType: "click",
    status: graphLayoutSummary.status === "partial" ? "partial" : "success",
    startedAt,
    finishedAt: new Date().toISOString(),
    providerModels: toProviderModels(providerModels),
    tokens: {
      promptTokens: usageSummary.promptTokens,
      completionTokens: usageSummary.completionTokens,
      totalTokens: usageSummary.totalTokens,
    },
    billableCost: usageSummary.billableCost,
    counts: {
      entriesProcessed: 1,
      qualityLlmUsed: quality.source === "llm" ? 1 : 0,
      embeddingAttempted: embeddingResult.attempted ? 1 : 0,
      embeddingReady: embeddingResult.status === "ready" ? 1 : 0,
      graphLayoutNodes: graphLayoutSummary.nodeCount,
      graphLayoutLlmNodes: graphLayoutSummary.llmNodeCount,
    },
    items: [
      {
        type: "quality_scoring",
        source: quality.source,
        score: quality.score,
        fallbackReason: quality.fallbackReason,
      },
      {
        type: "embedding",
        attempted: embeddingResult.attempted,
        status: embeddingResult.status,
        model: embeddingResult.model,
        version: embeddingResult.version,
        dimensions: embeddingResult.dimensions,
        httpStatus: embeddingResult.httpStatus,
      },
      {
        type: "graph_layout",
        usedLlm: graphLayoutSummary.usedLlm,
        status: graphLayoutSummary.status,
        fallbackReason: graphLayoutSummary.fallbackReason,
        nodeCount: graphLayoutSummary.nodeCount,
        llmNodeCount: graphLayoutSummary.llmNodeCount,
      },
    ],
    errors: [
      embeddingResult.errorCode || embeddingResult.errorMessage
        ? {
            phase: "embedding",
            code: embeddingResult.errorCode,
            message: embeddingResult.errorMessage,
          }
        : null,
    ].filter(Boolean) as unknown[],
    metadata: { analysisType: input.analysisType, entryId: id },
  });

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
        relevance_level: entry.impact_level ?? 3,
        risk_level: 3,
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
  const returnTo = readSafeReturnTo(formData, `/strategy-cycle?tab=${tab}`);
  const supabase = await createSupabaseServerClient();
  await enqueueBackgroundJob({
    supabase,
    organizationId: context.organizationId,
    cycleId: context.cycleId,
    membershipId: context.membershipId,
    jobType: "link_draft_generation",
    payload: { tab, trigger: "manual_generate_link_drafts" },
  });
  done(withSuccess(returnTo, "links-queued"));
}

export async function approveLinkDraft(formData: FormData) {
  const startedAt = new Date().toISOString();
  const context = await getWorkspaceContextOrRedirect();
  const tab = String(formData.get("analysis_type") ?? "environment");
  const draftId = String(formData.get("draft_id") ?? "");
  if (!draftId) done(`/strategy-cycle?tab=${tab}`);

  const supabase = await createSupabaseServerClient();
  const { data: draft } = await supabase
    .schema("app")
    .from("analysis_item_link_draft")
    .select(
      "id, source_analysis_item_id, target_analysis_item_id, link_type, strength, confidence, comment, origin, provider, metadata, created_by_source, created_by_membership_id"
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
        created_by_source: draft.created_by_source ?? "user",
        created_by_membership_id: draft.created_by_membership_id ?? context.membershipId,
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
  const graphLayoutSummary = await recomputeAndPersistGraphLayout({
    supabase,
    organizationId: context.organizationId,
    cycleId: context.cycleId,
    trigger: "approve_link_draft",
  });
  await writeAiActionLogSafe({
    supabase,
    organizationId: context.organizationId,
    cycleInstanceId: context.cycleId,
    feature: "strategy_cycle",
    action: "approve_link_draft",
    triggerType: "click",
    status: graphLayoutSummary.status === "partial" ? "partial" : "success",
    startedAt,
    finishedAt: new Date().toISOString(),
    providerModels: graphLayoutSummary.providerModel ? [graphLayoutSummary.providerModel] : [],
    tokens: graphLayoutSummary.usage
      ? {
          promptTokens: graphLayoutSummary.usage.promptTokens,
          completionTokens: graphLayoutSummary.usage.completionTokens,
          totalTokens: graphLayoutSummary.usage.totalTokens,
        }
      : undefined,
    billableCost: graphLayoutSummary.usage?.billableCost ?? null,
    counts: {
      graphLayoutNodes: graphLayoutSummary.nodeCount,
      graphLayoutLlmNodes: graphLayoutSummary.llmNodeCount,
    },
    items: [
      {
        type: "graph_layout",
        usedLlm: graphLayoutSummary.usedLlm,
        fallbackReason: graphLayoutSummary.fallbackReason,
      },
    ],
    metadata: { tab, draftId, trigger: "approve_link_draft" },
  });

  done(`/strategy-cycle?tab=${tab}&success=link-approved`);
}

export async function rejectLinkDraft(formData: FormData) {
  const startedAt = new Date().toISOString();
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
  const graphLayoutSummary = await recomputeAndPersistGraphLayout({
    supabase,
    organizationId: context.organizationId,
    cycleId: context.cycleId,
    trigger: "reject_link_draft",
  });
  await writeAiActionLogSafe({
    supabase,
    organizationId: context.organizationId,
    cycleInstanceId: context.cycleId,
    feature: "strategy_cycle",
    action: "reject_link_draft",
    triggerType: "click",
    status: graphLayoutSummary.status === "partial" ? "partial" : "success",
    startedAt,
    finishedAt: new Date().toISOString(),
    providerModels: graphLayoutSummary.providerModel ? [graphLayoutSummary.providerModel] : [],
    tokens: graphLayoutSummary.usage
      ? {
          promptTokens: graphLayoutSummary.usage.promptTokens,
          completionTokens: graphLayoutSummary.usage.completionTokens,
          totalTokens: graphLayoutSummary.usage.totalTokens,
        }
      : undefined,
    billableCost: graphLayoutSummary.usage?.billableCost ?? null,
    counts: {
      graphLayoutNodes: graphLayoutSummary.nodeCount,
      graphLayoutLlmNodes: graphLayoutSummary.llmNodeCount,
    },
    items: [
      {
        type: "graph_layout",
        usedLlm: graphLayoutSummary.usedLlm,
        fallbackReason: graphLayoutSummary.fallbackReason,
      },
    ],
    metadata: { tab, draftId, trigger: "reject_link_draft" },
  });

  done(`/strategy-cycle?tab=${tab}&success=link-rejected`);
}

export async function recomputeClusters(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const tab = String(formData.get("analysis_type") ?? "environment");
  const returnTo = readSafeReturnTo(formData, `/strategy-cycle?tab=${tab}`);
  const supabase = await createSupabaseServerClient();
  await enqueueBackgroundJob({
    supabase,
    organizationId: context.organizationId,
    cycleId: context.cycleId,
    membershipId: context.membershipId,
    jobType: "cluster_recompute",
    payload: { tab, trigger: "manual_recompute_clusters" },
  });
  done(withSuccess(returnTo, "clusters-queued"));
}

export async function recomputeGaps(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const tab = String(formData.get("analysis_type") ?? "environment");
  const returnTo = readSafeReturnTo(formData, `/strategy-cycle?tab=${tab}`);
  const supabase = await createSupabaseServerClient();
  await enqueueBackgroundJob({
    supabase,
    organizationId: context.organizationId,
    cycleId: context.cycleId,
    membershipId: context.membershipId,
    jobType: "gaps_recompute",
    payload: { tab, trigger: "manual_recompute_gaps" },
  });
  done(withSuccess(returnTo, "gaps-queued"));
}

export async function recomputeGraphLayout(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const tab = String(formData.get("analysis_type") ?? "environment");
  const returnTo = readSafeReturnTo(formData, `/strategy-cycle?tab=${tab}`);
  const supabase = await createSupabaseServerClient();
  await enqueueBackgroundJob({
    supabase,
    organizationId: context.organizationId,
    cycleId: context.cycleId,
    membershipId: context.membershipId,
    jobType: "graph_layout_recompute",
    payload: { tab, trigger: "manual_recompute_graph_layout" },
  });
  done(withSuccess(returnTo, "graph-layout-queued"));
}

export async function backfillEntryQuality(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const tab = String(formData.get("analysis_type") ?? "environment");
  const returnTo = readSafeReturnTo(formData, `/strategy-cycle?tab=${tab}`);
  const supabase = await createSupabaseServerClient();
  await enqueueBackgroundJob({
    supabase,
    organizationId: context.organizationId,
    cycleId: context.cycleId,
    membershipId: context.membershipId,
    jobType: "quality_backfill",
    payload: { tab, trigger: "manual_quality_backfill" },
  });
  done(withSuccess(returnTo, "quality-backfill-queued"));
}

export async function queueObjectiveEvaluationBackfill(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const supabase = await createSupabaseServerClient();

  const { data: brandingQueue } = await supabase
    .schema("app")
    .from("tenant_branding")
    .select("branding_config")
    .eq("organization_id", context.organizationId)
    .maybeSingle();
  const policyQueue = readAnalysisNetworkLlmPolicy(brandingQueue?.branding_config ?? null);
  if (!policyQueue.llmEnabled || !isLlmFeatureEnabled(policyQueue, "objective_evaluation")) {
    done("/strategy-cycle?l1=objectives&error=ai-evaluation-disabled");
  }

  await enqueueBackgroundJob({
    supabase,
    organizationId: context.organizationId,
    cycleId: context.cycleId,
    membershipId: context.membershipId,
    jobType: "objective_evaluation_backfill",
    payload: { trigger: "manual_objective_evaluation_backfill" },
  });
  done("/strategy-cycle?l1=objectives&success=objective-evaluation-backfill-queued");
}

export async function executeQualityBackfill(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  organizationId: string;
  cycleId: string;
  trigger: string;
  tab?: string;
}) {
  const startedAt = new Date().toISOString();
  const { data: entries } = await params.supabase
    .schema("app")
    .from("analysis_entries")
    .select(
      "id, analysis_type, sub_type, title, description, impact_level, uncertainty_level"
    )
    .eq("organization_id", params.organizationId)
    .eq("cycle_instance_id", params.cycleId);
  const usageEvents: Array<{
    organizationId: string;
    cycleInstanceId: string;
    feature: string;
    provider: string;
    model: string;
    promptVersion: string;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    billableCost: number | null;
    usageMissing: boolean;
    metadata: Record<string, unknown>;
  }> = [];
  let embeddingAttempted = 0;
  let embeddingReady = 0;
  const embeddingErrors: Array<{ entryId: string; code: string | null; message: string | null }> = [];
  const allEntries = entries ?? [];
  const batchSize = Math.max(1, Math.min(20, Math.round(QUALITY_BACKFILL_BATCH_SIZE)));
  for (let i = 0; i < allEntries.length; i += batchSize) {
    const batch = allEntries.slice(i, i + batchSize);
    for (const entry of batch) {
      const quality = await computePersistedQuality({
        supabase: params.supabase,
        organizationId: params.organizationId,
        entry: {
          id: entry.id,
          analysis_type: entry.analysis_type,
          sub_type: entry.sub_type,
          title: entry.title,
          description: entry.description,
          impact_level: entry.impact_level,
          uncertainty_level: entry.uncertainty_level,
        },
      });
      await params.supabase
        .schema("app")
        .from("analysis_entries")
        .update({
          quality_score: quality.score,
          quality_band: quality.band,
          quality_source: quality.source,
          quality_explanation: quality.explanation,
          quality_calculated_at: new Date().toISOString(),
          quality_fallback_reason: quality.fallbackReason,
          quality_provider: quality.provider,
          quality_model: quality.model,
          quality_prompt_version: quality.promptVersion,
          semantic_embedding_status: "pending",
        })
        .eq("id", entry.id)
        .eq("organization_id", params.organizationId)
        .eq("cycle_instance_id", params.cycleId);
      const embeddingResult = await updateEntryEmbedding({
        supabase: params.supabase,
        organizationId: params.organizationId,
        cycleId: params.cycleId,
        entry: {
          id: entry.id,
          title: entry.title,
          analysis_type: entry.analysis_type,
          sub_type: entry.sub_type,
          description: entry.description,
        },
      });
      if (embeddingResult.attempted) embeddingAttempted += 1;
      if (embeddingResult.status === "ready") embeddingReady += 1;
      if (embeddingResult.errorCode || embeddingResult.errorMessage) {
        embeddingErrors.push({
          entryId: entry.id,
          code: embeddingResult.errorCode,
          message: embeddingResult.errorMessage,
        });
      }
      if (quality.source === "llm" && quality.usage && quality.provider && quality.model && quality.promptVersion) {
        usageEvents.push({
          organizationId: params.organizationId,
          cycleInstanceId: params.cycleId,
          feature: "quality_scoring",
          provider: quality.provider,
          model: quality.model,
          promptVersion: quality.promptVersion,
          promptTokens: quality.usage.promptTokens,
          completionTokens: quality.usage.completionTokens,
          totalTokens: quality.usage.totalTokens,
          billableCost: quality.usage.billableCost,
          usageMissing: quality.usage.usageMissing,
          metadata: { trigger: params.trigger, entryId: entry.id, tab: params.tab ?? "environment" },
        });
      }
    }
    if (i + batchSize < allEntries.length && QUALITY_BACKFILL_BATCH_PAUSE_MS > 0) {
      await sleep(QUALITY_BACKFILL_BATCH_PAUSE_MS);
    }
  }
  await recordLlmUsageEvents(params.supabase, usageEvents);
  const graphLayoutSummary = await recomputeAndPersistGraphLayout({
    supabase: params.supabase,
    organizationId: params.organizationId,
    cycleId: params.cycleId,
    trigger: params.trigger,
  });
  const usageSummary = summarizeUsage(
    usageEvents.map((event) => ({
      promptTokens: event.promptTokens,
      completionTokens: event.completionTokens,
      totalTokens: event.totalTokens,
      billableCost: event.billableCost,
    }))
  );
  await writeAiActionLogSafe({
    supabase: params.supabase,
    organizationId: params.organizationId,
    cycleInstanceId: params.cycleId,
    feature: "strategy_cycle",
    action: "quality_backfill",
    triggerType: "job",
    status: graphLayoutSummary.status === "partial" ? "partial" : "success",
    startedAt,
    finishedAt: new Date().toISOString(),
    providerModels: toProviderModels([
      ...usageEvents.map((event) => ({
        provider: event.provider,
        model: event.model,
        promptVersion: event.promptVersion,
      })),
      ...(graphLayoutSummary.providerModel ? [graphLayoutSummary.providerModel] : []),
    ]),
    tokens: {
      promptTokens:
        usageSummary.promptTokens != null || graphLayoutSummary.usage?.promptTokens != null
          ? (usageSummary.promptTokens ?? 0) + (graphLayoutSummary.usage?.promptTokens ?? 0)
          : null,
      completionTokens:
        usageSummary.completionTokens != null || graphLayoutSummary.usage?.completionTokens != null
          ? (usageSummary.completionTokens ?? 0) + (graphLayoutSummary.usage?.completionTokens ?? 0)
          : null,
      totalTokens:
        usageSummary.totalTokens != null || graphLayoutSummary.usage?.totalTokens != null
          ? (usageSummary.totalTokens ?? 0) + (graphLayoutSummary.usage?.totalTokens ?? 0)
          : null,
    },
    billableCost: Number(
      ((usageSummary.billableCost ?? 0) + (graphLayoutSummary.usage?.billableCost ?? 0)).toFixed(6)
    ),
    counts: {
      entriesProcessed: allEntries.length,
      qualityLlmEvents: usageEvents.length,
      embeddingAttempted,
      embeddingReady,
      graphLayoutNodes: graphLayoutSummary.nodeCount,
      graphLayoutLlmNodes: graphLayoutSummary.llmNodeCount,
      batchSize,
    },
    items: [
      {
        type: "quality_backfill",
        trigger: params.trigger,
        tab: params.tab ?? "environment",
        entriesProcessed: allEntries.length,
        llmEvents: usageEvents.length,
      },
      {
        type: "graph_layout",
        usedLlm: graphLayoutSummary.usedLlm,
        status: graphLayoutSummary.status,
        fallbackReason: graphLayoutSummary.fallbackReason,
      },
    ],
    errors: embeddingErrors.slice(0, 50),
    metadata: { trigger: params.trigger, tab: params.tab ?? "environment", chunked: true },
  });
}

export async function executeGraphLayoutRecompute(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  organizationId: string;
  cycleId: string;
  trigger: string;
}) {
  const startedAt = new Date().toISOString();
  const summary = await recomputeAndPersistGraphLayout({
    supabase: params.supabase,
    organizationId: params.organizationId,
    cycleId: params.cycleId,
    trigger: params.trigger,
  });
  await writeAiActionLogSafe({
    supabase: params.supabase,
    organizationId: params.organizationId,
    cycleInstanceId: params.cycleId,
    feature: "strategy_cycle",
    action: "graph_layout_recompute",
    triggerType: "job",
    status: summary.status === "partial" ? "partial" : "success",
    startedAt,
    finishedAt: new Date().toISOString(),
    providerModels: summary.providerModel ? [summary.providerModel] : [],
    tokens: summary.usage
      ? {
          promptTokens: summary.usage.promptTokens,
          completionTokens: summary.usage.completionTokens,
          totalTokens: summary.usage.totalTokens,
        }
      : undefined,
    billableCost: summary.usage?.billableCost ?? null,
    counts: {
      graphLayoutNodes: summary.nodeCount,
      graphLayoutLlmNodes: summary.llmNodeCount,
    },
    items: [
      {
        type: "graph_layout",
        usedLlm: summary.usedLlm,
        fallbackReason: summary.fallbackReason,
      },
    ],
    metadata: { trigger: params.trigger },
  });
}

/** Delay between objective LLM calls (ms) to avoid free-tier rate limits (e.g. Gemini 15 RPM). */
/** Pause zwischen Objective-LLM-Aufrufen; Groq-first: niedriger Default; bei 429 `GROQ_MIN_INTERVAL`/`ANALYSIS_LLM_MIN_INTERVAL_MS_GROQ` erhoehen. */
const OBJECTIVE_EVALUATION_DELAY_MS = Number(process.env.ANALYSIS_LLM_OBJECTIVE_EVAL_DELAY_MS ?? 1200);

export async function executeObjectiveEvaluationBackfill(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  organizationId: string;
  cycleId: string;
  trigger: string;
}): Promise<{ evaluated: number; failed: number; skipped: number }> {
  const startedAt = new Date().toISOString();
  let evaluated = 0;
  let failed = 0;
  let skipped = 0;

  const { data: branding } = await params.supabase
    .schema("app")
    .from("tenant_branding")
    .select("branding_config")
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  const policy = readAnalysisNetworkLlmPolicy(branding?.branding_config ?? null);
  if (!policy.llmEnabled || !isLlmFeatureEnabled(policy, "objective_evaluation")) {
    throw new Error(
      "Objective-Bewertung in der Systemkonfiguration (LLM-Nutzung) nicht aktiviert: «LLM global aktivieren» oder «Objectives-Bewertung» ist aus."
    );
  }

  const kennzahlen = readCompanyKennzahlenFromBrandingConfig(branding?.branding_config ?? null);
  const strategyRef = readStrategyReferenceFieldsFromBrandingConfig(branding?.branding_config ?? null);
  const missing = validateCompanyProfileForEvaluation(kennzahlen);
  if (missing.length > 0) {
    throw new Error(`Company profile incomplete: ${missing.join(", ")}`);
  }

  const budgetStatus = await evaluateLlmBudgetStatus({
    supabase: params.supabase as unknown as BudgetSupabaseClientLike,
    organizationId: params.organizationId,
    policy,
  });
  if (!budgetStatus.allowed) {
    throw new Error("LLM budget exceeded");
  }

  const companyProfile = buildCompanyProfileInput(kennzahlen, strategyRef);
  const maxTokens = resolveLlmMaxOutputTokens(policy, "objective_evaluation");

  const { contextJson } = await getOrBuildStrategicContext({
    supabase: params.supabase,
    organizationId: params.organizationId,
    companyProfile,
    maxOutputTokens: maxTokens,
  });

  const { data: objectives } = await params.supabase
    .schema("app")
    .from("objectives")
    .select("id, title, description, importance_score")
    .eq("organization_id", params.organizationId)
    .eq("cycle_instance_id", params.cycleId);

  const objectivesList = objectives ?? [];
  const usageEvents: Array<{
    organizationId: string;
    cycleInstanceId: string | null;
    feature: string;
    provider: string;
    model: string;
    promptVersion: string;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    usageMissing?: boolean;
  }> = [];

  const objectivesWithClassifications: Array<{
    id: string;
    title: string;
    classification: { external_internal: string; short_long_term: string; exploit_explore: string };
  }> = [];

  for (let i = 0; i < objectivesList.length; i++) {
    const obj = objectivesList[i];
    if (i > 0) {
      await sleep(OBJECTIVE_EVALUATION_DELAY_MS);
    }
    try {
      const response = await evaluateObjectiveWithLlm(
        contextJson,
        { title: obj.title, description: obj.description },
        maxTokens
      );
      if (response.usage) {
        usageEvents.push({
          organizationId: params.organizationId,
          cycleInstanceId: params.cycleId,
          feature: "objective_evaluation",
          provider: (response as { provider?: string }).provider ?? "groq",
          model: (response as { model?: string }).model ?? GROQ_MODEL,
          promptVersion: OBJECTIVE_EVAL_PROMPT_VERSION,
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens,
          usageMissing: response.usage.usageMissing,
        });
      }
      if (response.result) {
        const r = response.result;
        const aiObjectiveScore =
          0.3 * r.strategic_relevance_score +
          0.25 * r.fit_to_company_score +
          0.2 * r.feasibility_score +
          0.25 * r.clarity_score;
        const rowUpd = await params.supabase
          .schema("app")
          .from("objectives")
          .update({
            ai_clarity_score: r.clarity_score,
            ai_strategic_relevance_score: r.strategic_relevance_score,
            ai_feasibility_score: r.feasibility_score,
            ai_fit_to_company_score: r.fit_to_company_score,
            ai_confidence_score: r.confidence,
            ai_external_internal_classification: r.dimension_classification.external_internal,
            ai_short_long_term_classification: r.dimension_classification.short_long_term,
            ai_exploit_explore_classification: r.dimension_classification.exploit_explore,
            ai_issues_json: r.issues,
            ai_improvement_suggestion: r.improvement_suggestion,
            ai_objective_score: Math.round(aiObjectiveScore * 100) / 100,
            ai_evaluation_status: "valid",
            ai_evaluated_at: new Date().toISOString(),
            ai_evaluation_version: OBJECTIVE_EVAL_PROMPT_VERSION,
          })
          .eq("id", obj.id)
          .eq("organization_id", params.organizationId)
          .eq("cycle_instance_id", params.cycleId)
          .select("id");
        if (rowUpd.error) {
          throw new Error(`Objective ${obj.id}: Speichern fehlgeschlagen (${rowUpd.error.message})`);
        }
        if (!rowUpd.data?.length) {
          throw new Error(`Objective ${obj.id}: Update hat keine Zeile getroffen`);
        }
        objectivesWithClassifications.push({
          id: obj.id,
          title: obj.title,
          classification: r.dimension_classification,
        });
        evaluated += 1;
      } else {
        const failUpd = await params.supabase
          .schema("app")
          .from("objectives")
          .update({ ai_evaluation_status: "failed" })
          .eq("id", obj.id)
          .eq("organization_id", params.organizationId)
          .eq("cycle_instance_id", params.cycleId)
          .select("id");
        if (failUpd.error || !failUpd.data?.length) {
          console.error("[objective_evaluation_backfill] failed-status update", obj.id, failUpd.error);
        }
        failed += 1;
      }
    } catch (err) {
      const exUpd = await params.supabase
        .schema("app")
        .from("objectives")
        .update({ ai_evaluation_status: "failed" })
        .eq("id", obj.id)
        .eq("organization_id", params.organizationId)
        .eq("cycle_instance_id", params.cycleId)
        .select("id");
      if (exUpd.error || !exUpd.data?.length) {
        console.error("[objective_evaluation_backfill] catch-status update", obj.id, exUpd.error, err);
      }
      failed += 1;
    }
  }

  if (objectivesWithClassifications.length > 0) {
    await sleep(OBJECTIVE_EVALUATION_DELAY_MS);
    const objectivesForPortfolio = objectivesWithClassifications
      .map(
        (o) =>
          `- ${o.title} | internal/external: ${o.classification.external_internal} | short/mid/long: ${o.classification.short_long_term} | exploit/explore: ${o.classification.exploit_explore}`
      )
      .join("\n");
    const portfolioResponse = await evaluateObjectivePortfolioWithLlm(objectivesForPortfolio, maxTokens);
    if (portfolioResponse.usage) {
      usageEvents.push({
        organizationId: params.organizationId,
        cycleInstanceId: params.cycleId,
        feature: "objective_evaluation",
        provider: (portfolioResponse as { provider?: string }).provider ?? "groq",
        model: (portfolioResponse as { model?: string }).model ?? GROQ_MODEL,
        promptVersion: PORTFOLIO_EVAL_PROMPT_VERSION,
        promptTokens: portfolioResponse.usage.promptTokens,
        completionTokens: portfolioResponse.usage.completionTokens,
        totalTokens: portfolioResponse.usage.totalTokens,
        usageMissing: portfolioResponse.usage.usageMissing,
      });
    }
    if (portfolioResponse.result) {
      const pr = portfolioResponse.result;
      await params.supabase
        .schema("app")
        .from("cycle_instance_portfolio_evaluation")
        .upsert(
          {
            organization_id: params.organizationId,
            cycle_instance_id: params.cycleId,
            balance_score: pr.balance_score,
            distribution_internal_external_json: pr.distribution,
            distribution_exploit_explore_json: pr.distribution,
            distribution_short_long_json: pr.distribution,
            portfolio_gaps_json: pr.gaps,
            portfolio_risks_json: pr.risks,
            portfolio_recommendation: pr.recommendation,
            portfolio_evaluated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "cycle_instance_id" }
        );
    }
  }

  if (usageEvents.length > 0) {
    await recordLlmUsageEvents(params.supabase, usageEvents);
  }

  await writeAiActionLogSafe({
    supabase: params.supabase,
    organizationId: params.organizationId,
    cycleInstanceId: params.cycleId,
    feature: "strategy_cycle",
    action: "objective_evaluation_backfill",
    triggerType: "job",
    status: failed > 0 ? "partial" : "success",
    startedAt,
    finishedAt: new Date().toISOString(),
    counts: { evaluated, failed, skipped, total: objectivesList.length },
    metadata: { trigger: params.trigger },
  });

  return { evaluated, failed, skipped };
}

async function executeLinkDraftGeneration(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  organizationId: string;
  cycleId: string;
  membershipId: string | null;
  trigger: string;
  tab: string;
}) {
  const startedAt = new Date().toISOString();
  const { data: entries } = await params.supabase
    .schema("app")
    .from("analysis_entries")
    .select(
      "id, organization_id, cycle_instance_id, analysis_type, sub_type, title, description, impact_level, uncertainty_level, semantic_embedding, semantic_embedding_status"
    )
    .eq("organization_id", params.organizationId)
    .eq("cycle_instance_id", params.cycleId);

  const brandingConfig = await readBrandingConfig(params.supabase, params.organizationId);
  const networkConfig = parseAnalysisNetworkConfig(brandingConfig);
  const llmPolicy = readAnalysisNetworkLlmPolicy(brandingConfig);
  const budgetStatus = await evaluateLlmBudgetStatus({
    supabase: params.supabase as unknown as BudgetSupabaseClientLike,
    organizationId: params.organizationId,
    policy: llmPolicy,
  });
  const canUseLinkLlm =
    budgetStatus.allowed &&
    networkConfig.llmEnabled &&
    isLlmFeatureEnabled(llmPolicy, "link_draft_generation");
  const strategyReferenceText = buildStrategyReferenceText(
    readStrategyReferenceFieldsFromBrandingConfig(brandingConfig)
  );
  const entriesWithEmbedding = (entries ?? []).map((entry) => ({
    ...entry,
    semantic_embedding: parseVectorLiteral((entry as { semantic_embedding?: unknown }).semantic_embedding),
  }));
  const { candidates, usageEvents } = await generateHybridLinkCandidates(entriesWithEmbedding, {
    maxLlmPairs: canUseLinkLlm ? networkConfig.maxLlmPairs : 0,
    minRuleConfidence: networkConfig.minRuleConfidence,
    fusionWeights: networkConfig.fusionWeights,
    strategyReferenceText,
    maxOutputTokens: resolveLlmMaxOutputTokens(llmPolicy, "link_draft_generation"),
  });

  await params.supabase
    .schema("app")
    .from("analysis_item_link_draft")
    .delete()
    .eq("organization_id", params.organizationId)
    .eq("cycle_instance_id", params.cycleId)
    .eq("status", "draft");

  if (candidates.length > 0) {
    const payload = candidates.map((candidate) => ({
      organization_id: params.organizationId,
      cycle_instance_id: params.cycleId,
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
      created_by_membership_id: params.membershipId,
      created_by_source: "sentinel",
      metadata: candidate.metadata ?? {},
    }));
    await params.supabase.schema("app").from("analysis_item_link_draft").upsert(payload, {
      onConflict: "cycle_instance_id,source_analysis_item_id,target_analysis_item_id,link_type",
    });
  }

  await recordLlmUsageEvents(
    params.supabase,
    usageEvents.map((event) => ({
      organizationId: params.organizationId,
      cycleInstanceId: params.cycleId,
      feature: "link_draft_generation",
      provider: event.provider,
      model: event.model,
      promptVersion: event.promptVersion,
      promptTokens: event.usage.promptTokens,
      completionTokens: event.usage.completionTokens,
      totalTokens: event.usage.totalTokens,
      billableCost: event.usage.billableCost,
      usageMissing: event.usage.usageMissing,
      metadata: { tab: params.tab },
    }))
  );
  const graphLayoutSummary = await recomputeAndPersistGraphLayout({
    supabase: params.supabase,
    organizationId: params.organizationId,
    cycleId: params.cycleId,
    trigger: params.trigger,
  });
  const usageSummary = summarizeUsage(
    usageEvents.map((event) => ({
      promptTokens: event.usage.promptTokens,
      completionTokens: event.usage.completionTokens,
      totalTokens: event.usage.totalTokens,
      billableCost: event.usage.billableCost,
    }))
  );
  await writeAiActionLogSafe({
    supabase: params.supabase,
    organizationId: params.organizationId,
    cycleInstanceId: params.cycleId,
    feature: "strategy_cycle",
    action: "link_draft_generation",
    triggerType: "job",
    status: graphLayoutSummary.status === "partial" ? "partial" : "success",
    startedAt,
    finishedAt: new Date().toISOString(),
    providerModels: toProviderModels([
      ...usageEvents.map((event) => ({
        provider: event.provider,
        model: event.model,
        promptVersion: event.promptVersion,
      })),
      ...(graphLayoutSummary.providerModel ? [graphLayoutSummary.providerModel] : []),
    ]),
    tokens: {
      promptTokens:
        usageSummary.promptTokens != null || graphLayoutSummary.usage?.promptTokens != null
          ? (usageSummary.promptTokens ?? 0) + (graphLayoutSummary.usage?.promptTokens ?? 0)
          : null,
      completionTokens:
        usageSummary.completionTokens != null || graphLayoutSummary.usage?.completionTokens != null
          ? (usageSummary.completionTokens ?? 0) + (graphLayoutSummary.usage?.completionTokens ?? 0)
          : null,
      totalTokens:
        usageSummary.totalTokens != null || graphLayoutSummary.usage?.totalTokens != null
          ? (usageSummary.totalTokens ?? 0) + (graphLayoutSummary.usage?.totalTokens ?? 0)
          : null,
    },
    billableCost: Number(
      ((usageSummary.billableCost ?? 0) + (graphLayoutSummary.usage?.billableCost ?? 0)).toFixed(6)
    ),
    counts: {
      entriesConsidered: entriesWithEmbedding.length,
      draftedLinks: candidates.length,
      llmEvents: usageEvents.length,
      graphLayoutNodes: graphLayoutSummary.nodeCount,
      graphLayoutLlmNodes: graphLayoutSummary.llmNodeCount,
    },
    items: [
      { type: "link_draft_generation", candidateCount: candidates.length, llmEventCount: usageEvents.length, llmEnabled: canUseLinkLlm },
      { type: "graph_layout", usedLlm: graphLayoutSummary.usedLlm, status: graphLayoutSummary.status, fallbackReason: graphLayoutSummary.fallbackReason },
    ],
    metadata: { tab: params.tab, trigger: params.trigger, maxLlmPairs: canUseLinkLlm ? networkConfig.maxLlmPairs : 0 },
  });
}

async function executeClusterRecompute(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  organizationId: string;
  cycleId: string;
  membershipId: string | null;
  trigger: string;
  tab: string;
}) {
  const startedAt = new Date().toISOString();
  const [{ data: entries }, { data: links }] = await Promise.all([
    params.supabase
      .schema("app")
      .from("analysis_entries")
      .select(
        "id, organization_id, cycle_instance_id, analysis_type, sub_type, title, description, impact_level, uncertainty_level, semantic_embedding, semantic_embedding_status"
      )
      .eq("organization_id", params.organizationId)
      .eq("cycle_instance_id", params.cycleId),
    params.supabase
      .schema("app")
      .from("analysis_item_link")
      .select("source_analysis_item_id, target_analysis_item_id, confidence, strength")
      .eq("organization_id", params.organizationId)
      .eq("cycle_instance_id", params.cycleId),
  ]);

  const [{ data: existingChallenges }, brandingConfig] = await Promise.all([
    params.supabase
      .schema("app")
      .from("strategic_challenges")
      .select("title")
      .eq("organization_id", params.organizationId)
      .eq("cycle_instance_id", params.cycleId),
    readBrandingConfig(params.supabase, params.organizationId),
  ]);
  const existingChallengeTitles = (existingChallenges ?? []).map((c) => c.title).filter(Boolean);

  const networkConfig = parseAnalysisNetworkConfig(brandingConfig);
  const llmPolicy = readAnalysisNetworkLlmPolicy(brandingConfig);
  const budgetStatus = await evaluateLlmBudgetStatus({
    supabase: params.supabase as unknown as BudgetSupabaseClientLike,
    organizationId: params.organizationId,
    policy: llmPolicy,
  });
  const canUseClusterLlm =
    budgetStatus.allowed &&
    networkConfig.llmEnabled &&
    isLlmFeatureEnabled(llmPolicy, "cluster_assessment");
  const strategyReferenceText = buildStrategyReferenceText(
    readStrategyReferenceFieldsFromBrandingConfig(brandingConfig)
  );
  const entriesWithEmbedding = (entries ?? []).map((entry) => ({
    ...entry,
    semantic_embedding: parseVectorLiteral((entry as { semantic_embedding?: unknown }).semantic_embedding),
  }));
  const computed = computeClusters(entriesWithEmbedding, links ?? []);
  const llmUsageEvents: Array<{
    provider: string;
    model: string;
    promptVersion: string;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    usageMissing: boolean;
  }> = [];

  const clusterEntriesById = new Map(entriesWithEmbedding.map((entry) => [entry.id, entry.title]));
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
      existingChallengeTitles,
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

  await params.supabase
    .schema("app")
    .from("analysis_cluster_members")
    .delete()
    .eq("organization_id", params.organizationId)
    .eq("cycle_instance_id", params.cycleId);
  await params.supabase
    .schema("app")
    .from("analysis_clusters")
    .delete()
    .eq("organization_id", params.organizationId)
    .eq("cycle_instance_id", params.cycleId);

  for (const cluster of llmEnhanced) {
    const { data: createdCluster } = await params.supabase
      .schema("app")
      .from("analysis_clusters")
      .insert({
        organization_id: params.organizationId,
        cycle_instance_id: params.cycleId,
        label: cluster.label,
        summary: cluster.summary,
        cluster_score: cluster.score,
        method: "graph-v1",
        created_by_membership_id: params.membershipId,
        created_by_source: "sentinel",
        metadata: {},
      })
      .select("id")
      .single();

    if (!createdCluster) continue;
    if (cluster.memberEntryIds.length === 0) continue;
    await params.supabase.schema("app").from("analysis_cluster_members").insert(
      cluster.memberEntryIds.map((entryId) => ({
        organization_id: params.organizationId,
        cycle_instance_id: params.cycleId,
        cluster_id: createdCluster.id,
        entry_id: entryId,
        membership_strength: 0.7,
      }))
    );
  }

  await recordLlmUsageEvents(
    params.supabase,
    llmUsageEvents.map((event) => ({
      organizationId: params.organizationId,
      cycleInstanceId: params.cycleId,
      feature: "cluster_assessment",
      provider: event.provider,
      model: event.model,
      promptVersion: event.promptVersion,
      promptTokens: event.promptTokens,
      completionTokens: event.completionTokens,
      totalTokens: event.totalTokens,
      usageMissing: event.usageMissing,
      metadata: { tab: params.tab },
    }))
  );
  const graphLayoutSummary = await recomputeAndPersistGraphLayout({
    supabase: params.supabase,
    organizationId: params.organizationId,
    cycleId: params.cycleId,
    trigger: params.trigger,
  });
  const usageSummary = summarizeUsage(
    llmUsageEvents.map((event) => ({
      promptTokens: event.promptTokens,
      completionTokens: event.completionTokens,
      totalTokens: event.totalTokens,
      billableCost: null,
    }))
  );
  await writeAiActionLogSafe({
    supabase: params.supabase,
    organizationId: params.organizationId,
    cycleInstanceId: params.cycleId,
    feature: "strategy_cycle",
    action: "cluster_recompute",
    triggerType: "job",
    status: graphLayoutSummary.status === "partial" ? "partial" : "success",
    startedAt,
    finishedAt: new Date().toISOString(),
    providerModels: toProviderModels([
      ...llmUsageEvents.map((event) => ({
        provider: event.provider,
        model: event.model,
        promptVersion: event.promptVersion,
      })),
      ...(graphLayoutSummary.providerModel ? [graphLayoutSummary.providerModel] : []),
    ]),
    tokens: {
      promptTokens:
        usageSummary.promptTokens != null || graphLayoutSummary.usage?.promptTokens != null
          ? (usageSummary.promptTokens ?? 0) + (graphLayoutSummary.usage?.promptTokens ?? 0)
          : null,
      completionTokens:
        usageSummary.completionTokens != null || graphLayoutSummary.usage?.completionTokens != null
          ? (usageSummary.completionTokens ?? 0) + (graphLayoutSummary.usage?.completionTokens ?? 0)
          : null,
      totalTokens:
        usageSummary.totalTokens != null || graphLayoutSummary.usage?.totalTokens != null
          ? (usageSummary.totalTokens ?? 0) + (graphLayoutSummary.usage?.totalTokens ?? 0)
          : null,
    },
    billableCost: graphLayoutSummary.usage?.billableCost ?? null,
    counts: {
      entriesConsidered: entriesWithEmbedding.length,
      clusterCount: computed.length,
      clusterLlmEvents: llmUsageEvents.length,
      graphLayoutNodes: graphLayoutSummary.nodeCount,
      graphLayoutLlmNodes: graphLayoutSummary.llmNodeCount,
    },
    items: [
      { type: "cluster_assessment", llmEnabled: canUseClusterLlm, llmEventCount: llmUsageEvents.length, computedClusterCount: computed.length },
      { type: "graph_layout", usedLlm: graphLayoutSummary.usedLlm, status: graphLayoutSummary.status, fallbackReason: graphLayoutSummary.fallbackReason },
    ],
    metadata: { tab: params.tab, trigger: params.trigger },
  });
}

async function executeGapsRecompute(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  organizationId: string;
  cycleId: string;
  membershipId: string | null;
  trigger: string;
  tab: string;
}) {
  const startedAt = new Date().toISOString();
  const [{ data: entries }, { data: links }, { data: challenges }] = await Promise.all([
    params.supabase
      .schema("app")
      .from("analysis_entries")
      .select(
        "id, organization_id, cycle_instance_id, analysis_type, sub_type, title, description, impact_level, uncertainty_level, semantic_embedding, semantic_embedding_status"
      )
      .eq("organization_id", params.organizationId)
      .eq("cycle_instance_id", params.cycleId),
    params.supabase
      .schema("app")
      .from("analysis_item_link")
      .select("source_analysis_item_id, target_analysis_item_id")
      .eq("organization_id", params.organizationId)
      .eq("cycle_instance_id", params.cycleId),
    params.supabase
      .schema("app")
      .from("strategic_challenges")
      .select("source_analysis_entry_id, title")
      .eq("organization_id", params.organizationId)
      .eq("cycle_instance_id", params.cycleId),
  ]);

  const existingChallengeTitles = (challenges ?? []).map((c) => c.title).filter(Boolean);
  let promotedClusterIds = new Set<string>();
  const { data: promotedClusters, error: promotedClustersError } = await params.supabase
    .schema("app")
    .from("strategic_challenges")
    .select("source_cluster_id")
    .eq("organization_id", params.organizationId)
    .eq("cycle_instance_id", params.cycleId)
    .not("source_cluster_id", "is", null);
  if (!promotedClustersError && promotedClusters) {
    for (const row of promotedClusters) {
      if (row.source_cluster_id) promotedClusterIds.add(row.source_cluster_id);
    }
  }

  const brandingConfig = await readBrandingConfig(params.supabase, params.organizationId);
  const networkConfig = parseAnalysisNetworkConfig(brandingConfig);
  const llmPolicy = readAnalysisNetworkLlmPolicy(brandingConfig);
  const budgetStatus = await evaluateLlmBudgetStatus({
    supabase: params.supabase as unknown as BudgetSupabaseClientLike,
    organizationId: params.organizationId,
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
  const entriesWithEmbedding = (entries ?? []).map((entry) => ({
    ...entry,
    semantic_embedding: parseVectorLiteral((entry as { semantic_embedding?: unknown }).semantic_embedding),
  }));
  const baseGapFindings = computeGapFindings(
    entriesWithEmbedding,
    links ?? [],
    (challenges ?? []).map((c) => c.source_analysis_entry_id).filter((id): id is string => Boolean(id))
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

  await params.supabase
    .schema("app")
    .from("analysis_gap_findings")
    .delete()
    .eq("organization_id", params.organizationId)
    .eq("cycle_instance_id", params.cycleId);

  if (gapFindings.length > 0) {
    await params.supabase.schema("app").from("analysis_gap_findings").insert(
      gapFindings.map((gap) => ({
        organization_id: params.organizationId,
        cycle_instance_id: params.cycleId,
        dimension: gap.dimension,
        gap_type: gap.gapType,
        severity: gap.severity,
        recommendation: gap.recommendation,
        status: "open",
        created_by_membership_id: params.membershipId,
        created_by_source: "sentinel",
        metadata: gap.metadata ?? {},
      }))
    );
  }

  await params.supabase
    .schema("app")
    .from("analysis_challenge_candidates")
    .delete()
    .eq("organization_id", params.organizationId)
    .eq("cycle_instance_id", params.cycleId);

  const maxChallenge = networkConfig.maxChallengeCandidates;
  const { data: clustersRaw } = await params.supabase
    .schema("app")
    .from("analysis_clusters")
    .select("id, label, summary, cluster_score")
    .eq("organization_id", params.organizationId)
    .eq("cycle_instance_id", params.cycleId)
    .order("cluster_score", { ascending: false })
    .limit(maxChallenge);

  const clusters = (clustersRaw ?? []).filter((c) => !promotedClusterIds.has(c.id));

  const challengeCandidatesResponse = canUseChallengeLlm
    ? await proposeChallengeCandidatesWithLlm({
        clusters: clusters.map((cluster) => ({
          id: cluster.id,
          label: cluster.label,
          summary: cluster.summary ?? "",
          score: Number(cluster.cluster_score ?? 0),
        })),
        gaps: gapFindings.slice(0, maxChallenge).map((gap, idx) => ({
          id: `gap-${idx}-${gap.dimension}`,
          dimension: gap.dimension,
          gapType: gap.gapType,
          severity: gap.severity,
          recommendation: gap.recommendation,
        })),
        strategyReferenceText,
        existingChallengeTitles,
        maxOutputTokens: resolveLlmMaxOutputTokens(llmPolicy, "challenge_recommendation"),
      })
    : { result: null, usage: null };

  const fallbackCandidates = [
    ...clusters.slice(0, 4).map((cluster) => ({
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
    await params.supabase.schema("app").from("analysis_challenge_candidates").insert(
      challengeCandidates.map((candidate) => ({
        organization_id: params.organizationId,
        cycle_instance_id: params.cycleId,
        title: candidate.title,
        description: candidate.description || null,
        priority: candidate.priority,
        source_type: candidate.source,
        source_ref: candidate.sourceRef,
        status: "draft",
        created_by_membership_id: params.membershipId,
        created_by_source: "sentinel",
        metadata: {},
      }))
    );
  }

  if (challengeCandidatesResponse.result && challengeCandidatesResponse.usage) {
    const ccProv = challengeCandidatesResponse.resolvedProvider ?? "groq";
    const ccModel =
      ccProv === "gemini"
        ? process.env.ANALYSIS_LLM_MODEL_GEMINI_ASSIST ?? process.env.ANALYSIS_LLM_MODEL_GEMINI ?? "gemini-2.5-pro"
        : process.env.ANALYSIS_LLM_MODEL_GROQ ?? "llama-3.3-70b-versatile";
    llmUsageEvents.push({
      provider: ccProv,
      model: ccModel,
      promptVersion: "analysis-challenge-candidates-v1",
      promptTokens: challengeCandidatesResponse.usage.promptTokens,
      completionTokens: challengeCandidatesResponse.usage.completionTokens,
      totalTokens: challengeCandidatesResponse.usage.totalTokens,
      usageMissing: challengeCandidatesResponse.usage.usageMissing,
    });
  }

  await recordLlmUsageEvents(
    params.supabase,
    llmUsageEvents.map((event) => ({
      organizationId: params.organizationId,
      cycleInstanceId: params.cycleId,
      feature: "gap_and_challenge_assessment",
      provider: event.provider,
      model: event.model,
      promptVersion: event.promptVersion,
      promptTokens: event.promptTokens,
      completionTokens: event.completionTokens,
      totalTokens: event.totalTokens,
      usageMissing: event.usageMissing,
      metadata: { tab: params.tab },
    }))
  );
  const graphLayoutSummary = await recomputeAndPersistGraphLayout({
    supabase: params.supabase,
    organizationId: params.organizationId,
    cycleId: params.cycleId,
    trigger: params.trigger,
  });
  const usageSummary = summarizeUsage(
    llmUsageEvents.map((event) => ({
      promptTokens: event.promptTokens,
      completionTokens: event.completionTokens,
      totalTokens: event.totalTokens,
      billableCost: null,
    }))
  );
  await writeAiActionLogSafe({
    supabase: params.supabase,
    organizationId: params.organizationId,
    cycleInstanceId: params.cycleId,
    feature: "strategy_cycle",
    action: "gaps_recompute",
    triggerType: "job",
    status: graphLayoutSummary.status === "partial" ? "partial" : "success",
    startedAt,
    finishedAt: new Date().toISOString(),
    providerModels: toProviderModels([
      ...llmUsageEvents.map((event) => ({
        provider: event.provider,
        model: event.model,
        promptVersion: event.promptVersion,
      })),
      ...(graphLayoutSummary.providerModel ? [graphLayoutSummary.providerModel] : []),
    ]),
    tokens: {
      promptTokens:
        usageSummary.promptTokens != null || graphLayoutSummary.usage?.promptTokens != null
          ? (usageSummary.promptTokens ?? 0) + (graphLayoutSummary.usage?.promptTokens ?? 0)
          : null,
      completionTokens:
        usageSummary.completionTokens != null || graphLayoutSummary.usage?.completionTokens != null
          ? (usageSummary.completionTokens ?? 0) + (graphLayoutSummary.usage?.completionTokens ?? 0)
          : null,
      totalTokens:
        usageSummary.totalTokens != null || graphLayoutSummary.usage?.totalTokens != null
          ? (usageSummary.totalTokens ?? 0) + (graphLayoutSummary.usage?.totalTokens ?? 0)
          : null,
    },
    billableCost: graphLayoutSummary.usage?.billableCost ?? null,
    counts: {
      entriesConsidered: entriesWithEmbedding.length,
      gapCount: gapFindings.length,
      challengeCandidateCount: challengeCandidates.length,
      llmEvents: llmUsageEvents.length,
      graphLayoutNodes: graphLayoutSummary.nodeCount,
      graphLayoutLlmNodes: graphLayoutSummary.llmNodeCount,
    },
    items: [
      { type: "gap_assessment", llmEnabled: canUseGapLlm, gapCount: gapFindings.length },
      { type: "challenge_recommendation", llmEnabled: canUseChallengeLlm, candidateCount: challengeCandidates.length, usedLlm: Boolean(challengeCandidatesResponse.result) },
      { type: "graph_layout", usedLlm: graphLayoutSummary.usedLlm, status: graphLayoutSummary.status, fallbackReason: graphLayoutSummary.fallbackReason },
    ],
    metadata: { tab: params.tab, trigger: params.trigger },
  });
}

export async function processPendingBackgroundJobs(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;
  for (let i = 0; i < Math.max(1, JOB_WORKER_BATCH_SIZE); i += 1) {
    const { data: pending } = await supabase
      .schema("app")
      .from("analysis_background_jobs")
      .select("id, organization_id, cycle_instance_id, job_type, payload, attempt_count, max_attempts, created_by_membership_id")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!pending?.id) break;

    const claim = await supabase
      .schema("app")
      .from("analysis_background_jobs")
      .update({
        status: "running" as BackgroundJobStatus,
        started_at: new Date().toISOString(),
        locked_at: new Date().toISOString(),
        locked_by: "strategy-cycle-worker",
        attempt_count: Number(pending.attempt_count ?? 0) + 1,
      })
      .eq("id", pending.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!claim.data?.id) {
      continue;
    }

    const jobStartedAt = new Date().toISOString();
    try {
      const payload = (pending.payload && typeof pending.payload === "object"
        ? (pending.payload as Record<string, unknown>)
        : {}) as Record<string, unknown>;
      const trigger = String(payload.trigger ?? pending.job_type ?? "worker");
      if (pending.job_type === "quality_backfill") {
        await executeQualityBackfill({
          supabase,
          organizationId: pending.organization_id,
          cycleId: pending.cycle_instance_id,
          trigger,
          tab: String(payload.tab ?? "environment"),
        });
      } else if (pending.job_type === "graph_layout_recompute") {
        await executeGraphLayoutRecompute({
          supabase,
          organizationId: pending.organization_id,
          cycleId: pending.cycle_instance_id,
          trigger,
        });
      } else if (pending.job_type === "objective_evaluation_backfill") {
        await executeObjectiveEvaluationBackfill({
          supabase,
          organizationId: pending.organization_id,
          cycleId: pending.cycle_instance_id,
          trigger,
        });
      } else if (pending.job_type === "link_draft_generation") {
        await executeLinkDraftGeneration({
          supabase,
          organizationId: pending.organization_id,
          cycleId: pending.cycle_instance_id,
          membershipId: (pending as { created_by_membership_id?: string | null }).created_by_membership_id ?? null,
          trigger,
          tab: String(payload.tab ?? "environment"),
        });
      } else if (pending.job_type === "cluster_recompute") {
        await executeClusterRecompute({
          supabase,
          organizationId: pending.organization_id,
          cycleId: pending.cycle_instance_id,
          membershipId: (pending as { created_by_membership_id?: string | null }).created_by_membership_id ?? null,
          trigger,
          tab: String(payload.tab ?? "environment"),
        });
      } else if (pending.job_type === "gaps_recompute") {
        await executeGapsRecompute({
          supabase,
          organizationId: pending.organization_id,
          cycleId: pending.cycle_instance_id,
          membershipId: (pending as { created_by_membership_id?: string | null }).created_by_membership_id ?? null,
          trigger,
          tab: String(payload.tab ?? "environment"),
        });
      }
      await supabase
        .schema("app")
        .from("analysis_background_jobs")
        .update({
          status: "completed" as BackgroundJobStatus,
          finished_at: new Date().toISOString(),
          progress_done: 1,
          progress_total: 1,
          last_error: null,
        })
        .eq("id", pending.id);
      processed += 1;
    } catch (error) {
      const attemptCount = Number(pending.attempt_count ?? 0) + 1;
      const maxAttempts = Number(pending.max_attempts ?? 3);
      await supabase
        .schema("app")
        .from("analysis_background_jobs")
        .update({
          status: attemptCount >= maxAttempts ? ("failed" as BackgroundJobStatus) : ("pending" as BackgroundJobStatus),
          last_error: String(error instanceof Error ? error.message : error).slice(0, 1000),
          locked_at: null,
          locked_by: null,
          finished_at: attemptCount >= maxAttempts ? new Date().toISOString() : null,
        })
        .eq("id", pending.id);
      failed += 1;
      await writeAiActionLogSafe({
        supabase,
        organizationId: pending.organization_id,
        cycleInstanceId: pending.cycle_instance_id,
        feature: "strategy_cycle",
        action: pending.job_type,
        triggerType: "job",
        status: "failed",
        startedAt: jobStartedAt,
        finishedAt: new Date().toISOString(),
        counts: {
          attemptCount: Number(pending.attempt_count ?? 0) + 1,
          maxAttempts: Number(pending.max_attempts ?? 3),
        },
        errors: [
          {
            phase: "background_job",
            code: "JOB_FAILED",
            message: String(error instanceof Error ? error.message : error).slice(0, 1000),
          },
        ],
        metadata: {
          trigger: String(
            (pending.payload &&
            typeof pending.payload === "object" &&
            (pending.payload as Record<string, unknown>).trigger
              ? (pending.payload as Record<string, unknown>).trigger
              : pending.job_type) ?? "worker"
          ),
        },
      });
    }
  }
  return { processed, failed };
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
      relevance_level: Math.max(1, Math.min(5, Math.round(Number(cluster.cluster_score ?? 0.5) * 5))),
      risk_level: 3,
      visibility: "internal",
      created_by_membership_id: context.membershipId,
      source_cluster_id: clusterId,
    })
    .select("id")
    .single();

  await supabase
    .schema("app")
    .from("analysis_challenge_candidates")
    .update({ status: "promoted" })
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("source_type", "cluster")
    .eq("source_ref", clusterId);

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
    relevance_level: candidate.priority,
    risk_level: 3,
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

  const priority = readSmallIntField(formData, "priority", 3);
  const strategicValueScore = readSmallIntField(formData, "strategic_value_score", 3);
  const capabilityFitScore = readSmallIntField(formData, "capability_fit_score", 3);
  const feasibilityScore = readSmallIntField(formData, "feasibility_score", 3);
  const riskLevel = readSmallIntField(formData, "risk_score", 3);
  const relevanceLevel = strategicValueScore;
  const directionScore = computeDirectionScore({
    strategicValueScore,
    capabilityFitScore,
    feasibilityScore,
    riskScore: riskLevel,
  });
  const status = String(formData.get("status") ?? "draft");
  const description = String(formData.get("description") ?? "").trim() || null;
  const supabase = await createSupabaseServerClient();
  const { data: direction } = await supabase
    .schema("app")
    .from("strategic_directions")
    .insert({
    organization_id: context.organizationId,
    cycle_instance_id: context.cycleId,
    title,
    description,
    priority,
    relevance_level: relevanceLevel,
    risk_level: riskLevel,
    strategic_value_score: strategicValueScore,
    capability_fit_score: capabilityFitScore,
    feasibility_score: feasibilityScore,
    direction_score: directionScore,
    status,
    created_by_membership_id: context.membershipId,
    })
    .select("id")
    .single();

  const objectiveId = String(formData.get("objective_id") ?? "").trim();
  if (direction?.id && objectiveId) {
    await supabase.schema("app").from("strategic_direction_objective_links").upsert(
      {
        organization_id: context.organizationId,
        cycle_instance_id: context.cycleId,
        strategic_direction_id: direction.id,
        objective_id: objectiveId,
        created_by_membership_id: context.membershipId,
      },
      { onConflict: "cycle_instance_id,strategic_direction_id,objective_id" }
    );
  }
  done("/strategy-cycle?l1=strategic-directions&l2=design&success=direction-created");
}

async function evaluateSingleObjectiveIfEnabled(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  organizationId: string;
  cycleId: string;
  objectiveId: string;
  title: string;
  description: string | null;
}): Promise<void> {
  const { data: branding } = await params.supabase
    .schema("app")
    .from("tenant_branding")
    .select("branding_config")
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  const policy = readAnalysisNetworkLlmPolicy(branding?.branding_config ?? null);
  if (!policy.llmEnabled || !isLlmFeatureEnabled(policy, "objective_evaluation")) return;

  const kennzahlen = readCompanyKennzahlenFromBrandingConfig(branding?.branding_config ?? null);
  const missing = validateCompanyProfileForEvaluation(kennzahlen);
  if (missing.length > 0) return;

  const budgetStatus = await evaluateLlmBudgetStatus({
    supabase: params.supabase as unknown as BudgetSupabaseClientLike,
    organizationId: params.organizationId,
    policy,
  });
  if (!budgetStatus.allowed) return;

  const strategyRef = readStrategyReferenceFieldsFromBrandingConfig(branding?.branding_config ?? null);
  const companyProfile = buildCompanyProfileInput(kennzahlen, strategyRef);
  const maxTokens = resolveLlmMaxOutputTokens(policy, "objective_evaluation");

  const { contextJson } = await getOrBuildStrategicContext({
    supabase: params.supabase,
    organizationId: params.organizationId,
    companyProfile,
    maxOutputTokens: maxTokens,
  });

  const response = await evaluateObjectiveWithLlm(
    contextJson,
    { title: params.title, description: params.description },
    maxTokens
  );

  if (response.usage) {
    await recordLlmUsageEvents(params.supabase, [
      {
        organizationId: params.organizationId,
        cycleInstanceId: params.cycleId,
        feature: "objective_evaluation",
        provider: (response as { provider?: string }).provider ?? "groq",
        model: (response as { model?: string }).model ?? GROQ_MODEL,
        promptVersion: OBJECTIVE_EVAL_PROMPT_VERSION,
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens,
        usageMissing: response.usage.usageMissing,
      },
    ]);
  }

  if (response.result) {
    const r = response.result;
    const aiObjectiveScore =
      0.3 * r.strategic_relevance_score +
      0.25 * r.fit_to_company_score +
      0.2 * r.feasibility_score +
      0.25 * r.clarity_score;
    await params.supabase
      .schema("app")
      .from("objectives")
      .update({
        ai_clarity_score: r.clarity_score,
        ai_strategic_relevance_score: r.strategic_relevance_score,
        ai_feasibility_score: r.feasibility_score,
        ai_fit_to_company_score: r.fit_to_company_score,
        ai_confidence_score: r.confidence,
        ai_external_internal_classification: r.dimension_classification.external_internal,
        ai_short_long_term_classification: r.dimension_classification.short_long_term,
        ai_exploit_explore_classification: r.dimension_classification.exploit_explore,
        ai_issues_json: r.issues,
        ai_improvement_suggestion: r.improvement_suggestion,
        ai_objective_score: Math.round(aiObjectiveScore * 100) / 100,
        ai_evaluation_status: "valid",
        ai_evaluated_at: new Date().toISOString(),
        ai_evaluation_version: OBJECTIVE_EVAL_PROMPT_VERSION,
      })
      .eq("id", params.objectiveId)
      .eq("organization_id", params.organizationId)
      .eq("cycle_instance_id", params.cycleId);
  } else {
    await params.supabase
      .schema("app")
      .from("objectives")
      .update({ ai_evaluation_status: "failed" })
      .eq("id", params.objectiveId)
      .eq("organization_id", params.organizationId)
      .eq("cycle_instance_id", params.cycleId);
  }
}

export async function createObjectiveInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    done("/strategy-cycle?l1=objectives&error=missing-title");
  }
  const description = String(formData.get("description") ?? "").trim() || null;
  const timeHorizon = String(formData.get("time_horizon") ?? "").trim() || null;
  const importanceScore = readSmallIntField(formData, "importance_score", 3);
  const status = String(formData.get("status") ?? "draft");
  const supabase = await createSupabaseServerClient();
  const { data: inserted, error } = await supabase
    .schema("app")
    .from("objectives")
    .insert({
      organization_id: context.organizationId,
      cycle_instance_id: context.cycleId,
      title,
      description,
      time_horizon: timeHorizon,
      importance_score: importanceScore,
      status,
      created_by_membership_id: context.membershipId,
      created_by_source: "user",
    })
    .select("id")
    .single();
  if (error || !inserted?.id) {
    done("/strategy-cycle?l1=objectives&error=objective-insert-failed");
  }
  await evaluateSingleObjectiveIfEnabled({
    supabase,
    organizationId: context.organizationId,
    cycleId: context.cycleId,
    objectiveId: inserted.id,
    title,
    description,
  });
  done("/strategy-cycle?l1=objectives&success=objective-created");
}

export async function updateObjectiveInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const objectiveId = String(formData.get("objective_id") ?? "").trim();
  if (!objectiveId) {
    done("/strategy-cycle?l1=objectives");
  }
  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    done("/strategy-cycle?l1=objectives&error=missing-title");
  }
  const description = String(formData.get("description") ?? "").trim() || null;
  const timeHorizon = String(formData.get("time_horizon") ?? "").trim() || null;
  const importanceScore = readSmallIntField(formData, "importance_score", 3);
  const status = String(formData.get("status") ?? "draft");
  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("objectives")
    .update({
      title,
      description,
      time_horizon: timeHorizon,
      importance_score: importanceScore,
      status,
      ai_evaluation_status: "outdated",
    })
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("id", objectiveId);
  await evaluateSingleObjectiveIfEnabled({
    supabase,
    organizationId: context.organizationId,
    cycleId: context.cycleId,
    objectiveId,
    title,
    description,
  });
  done("/strategy-cycle?l1=objectives&success=objective-updated");
}

export async function runObjectiveEvaluation(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const supabase = await createSupabaseServerClient();

  const { data: branding } = await supabase
    .schema("app")
    .from("tenant_branding")
    .select("branding_config")
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  const policy = readAnalysisNetworkLlmPolicy(branding?.branding_config ?? null);
  if (!policy.llmEnabled || !isLlmFeatureEnabled(policy, "objective_evaluation")) {
    done("/strategy-cycle?l1=objectives&error=ai-evaluation-disabled");
  }

  const kennzahlen = readCompanyKennzahlenFromBrandingConfig(branding?.branding_config ?? null);
  const strategyRef = readStrategyReferenceFieldsFromBrandingConfig(branding?.branding_config ?? null);
  const missing = validateCompanyProfileForEvaluation(kennzahlen);
  if (missing.length > 0) {
    done(`/strategy-cycle?l1=objectives&error=company-profile-incomplete&missing=${encodeURIComponent(missing.join(","))}`);
  }

  const budgetStatus = await evaluateLlmBudgetStatus({
    supabase: supabase as unknown as BudgetSupabaseClientLike,
    organizationId: context.organizationId,
    policy,
  });
  if (!budgetStatus.allowed) {
    done("/strategy-cycle?l1=objectives&error=llm-budget-exceeded");
  }

  const companyProfile = buildCompanyProfileInput(kennzahlen, strategyRef);
  const maxTokens = resolveLlmMaxOutputTokens(policy, "objective_evaluation");

  const { contextJson } = await getOrBuildStrategicContext({
    supabase,
    organizationId: context.organizationId,
    companyProfile,
    maxOutputTokens: maxTokens,
  });

  const { data: objectives } = await supabase
    .schema("app")
    .from("objectives")
    .select("id, title, description, importance_score")
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId);

  const objectivesList = objectives ?? [];
  const usageEvents: Array<{
    organizationId: string;
    cycleInstanceId: string | null;
    feature: string;
    provider: string;
    model: string;
    promptVersion: string;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    usageMissing?: boolean;
  }> = [];

  const objectivesWithClassifications: Array<{
    id: string;
    title: string;
    classification: { external_internal: string; short_long_term: string; exploit_explore: string };
  }> = [];

  for (const obj of objectivesList) {
    const response = await evaluateObjectiveWithLlm(
      contextJson,
      { title: obj.title, description: obj.description },
      maxTokens
    );
    if (response.usage) {
      usageEvents.push({
        organizationId: context.organizationId,
        cycleInstanceId: context.cycleId,
        feature: "objective_evaluation",
        provider: (response as { provider?: string }).provider ?? "groq",
        model: (response as { model?: string }).model ?? GROQ_MODEL,
        promptVersion: OBJECTIVE_EVAL_PROMPT_VERSION,
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens,
        usageMissing: response.usage.usageMissing,
      });
    }
    if (response.result) {
      const r = response.result;
      const aiObjectiveScore =
        0.3 * r.strategic_relevance_score +
        0.25 * r.fit_to_company_score +
        0.2 * r.feasibility_score +
        0.25 * r.clarity_score;
      await supabase
        .schema("app")
        .from("objectives")
        .update({
          ai_clarity_score: r.clarity_score,
          ai_strategic_relevance_score: r.strategic_relevance_score,
          ai_feasibility_score: r.feasibility_score,
          ai_fit_to_company_score: r.fit_to_company_score,
          ai_confidence_score: r.confidence,
          ai_external_internal_classification: r.dimension_classification.external_internal,
          ai_short_long_term_classification: r.dimension_classification.short_long_term,
          ai_exploit_explore_classification: r.dimension_classification.exploit_explore,
          ai_issues_json: r.issues,
          ai_improvement_suggestion: r.improvement_suggestion,
          ai_objective_score: Math.round(aiObjectiveScore * 100) / 100,
          ai_evaluation_status: "valid",
          ai_evaluated_at: new Date().toISOString(),
          ai_evaluation_version: OBJECTIVE_EVAL_PROMPT_VERSION,
        })
        .eq("id", obj.id)
        .eq("organization_id", context.organizationId)
        .eq("cycle_instance_id", context.cycleId);
      objectivesWithClassifications.push({
        id: obj.id,
        title: obj.title,
        classification: r.dimension_classification,
      });
    } else {
      await supabase
        .schema("app")
        .from("objectives")
        .update({
          ai_evaluation_status: "failed",
        })
        .eq("id", obj.id)
        .eq("organization_id", context.organizationId)
        .eq("cycle_instance_id", context.cycleId);
    }
  }

  const objectivesForPortfolio = objectivesWithClassifications
    .map(
      (o) =>
        `- ${o.title} | internal/external: ${o.classification.external_internal} | short/mid/long: ${o.classification.short_long_term} | exploit/explore: ${o.classification.exploit_explore}`
    )
    .join("\n");

  const portfolioResponse = await evaluateObjectivePortfolioWithLlm(objectivesForPortfolio, maxTokens);
  if (portfolioResponse.usage) {
    usageEvents.push({
      organizationId: context.organizationId,
      cycleInstanceId: context.cycleId,
      feature: "objective_evaluation",
      provider: (portfolioResponse as { provider?: string }).provider ?? "groq",
      model: (portfolioResponse as { model?: string }).model ?? GROQ_MODEL,
      promptVersion: PORTFOLIO_EVAL_PROMPT_VERSION,
      promptTokens: portfolioResponse.usage.promptTokens,
      completionTokens: portfolioResponse.usage.completionTokens,
      totalTokens: portfolioResponse.usage.totalTokens,
      usageMissing: portfolioResponse.usage.usageMissing,
    });
  }
  if (portfolioResponse.result) {
    const pr = portfolioResponse.result;
    await supabase
      .schema("app")
      .from("cycle_instance_portfolio_evaluation")
      .upsert(
        {
          organization_id: context.organizationId,
          cycle_instance_id: context.cycleId,
          balance_score: pr.balance_score,
          distribution_internal_external_json: pr.distribution,
          distribution_exploit_explore_json: pr.distribution,
          distribution_short_long_json: pr.distribution,
          portfolio_gaps_json: pr.gaps,
          portfolio_risks_json: pr.risks,
          portfolio_recommendation: pr.recommendation,
          portfolio_evaluated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "cycle_instance_id" }
      );
  }

  if (usageEvents.length > 0) {
    await recordLlmUsageEvents(supabase, usageEvents);
  }

  done("/strategy-cycle?l1=objectives&success=objective-evaluation-complete");
}

export async function createStrategicChallengeInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    done("/strategy-cycle?l1=strategic-directions&l2=challenges&error=missing-title");
  }
  const impactScore = readSmallIntField(formData, "impact_score", 3);
  const urgencyScore = readSmallIntField(formData, "urgency_score", 3);
  const scopeScore = readSmallIntField(formData, "scope_score", 3);
  const rootCauseScore = readSmallIntField(formData, "root_cause_score", 3);
  const challengeScore = computeChallengeScore({
    impactScore,
    urgencyScore,
    scopeScore,
    rootCauseScore,
  });
  const relevanceLevel = impactScore;
  const riskLevel = urgencyScore;
  const description = String(formData.get("description") ?? "").trim() || null;
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("strategic_challenges").insert({
    organization_id: context.organizationId,
    cycle_instance_id: context.cycleId,
    title,
    description,
    priority: 3,
    impact_score: impactScore,
    urgency_score: urgencyScore,
    scope_score: scopeScore,
    root_cause_score: rootCauseScore,
    challenge_score: challengeScore,
    relevance_level: relevanceLevel,
    risk_level: riskLevel,
    visibility: "internal",
    created_by_membership_id: context.membershipId,
  });
  done("/strategy-cycle?l1=strategic-directions&l2=challenges&success=challenge-created");
}

export async function updateStrategicChallengeAssessment(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const strategicChallengeId = String(formData.get("strategic_challenge_id") ?? "").trim();
  if (!strategicChallengeId) {
    done("/strategy-cycle?l1=strategic-directions&l2=challenges");
  }
  const impactScore = readSmallIntField(formData, "impact_score", 3);
  const urgencyScore = readSmallIntField(formData, "urgency_score", 3);
  const scopeScore = readSmallIntField(formData, "scope_score", 3);
  const rootCauseScore = readSmallIntField(formData, "root_cause_score", 3);
  const challengeScore = computeChallengeScore({
    impactScore,
    urgencyScore,
    scopeScore,
    rootCauseScore,
  });
  const description = String(formData.get("description") ?? "").trim() || null;
  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("strategic_challenges")
    .update({
      description,
      impact_score: impactScore,
      urgency_score: urgencyScore,
      scope_score: scopeScore,
      root_cause_score: rootCauseScore,
      challenge_score: challengeScore,
      relevance_level: impactScore,
      risk_level: urgencyScore,
    })
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("id", strategicChallengeId);
  done("/strategy-cycle?l1=strategic-directions&l2=challenges&success=assessment-updated");
}

export async function updateStrategicDirectionAssessment(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const strategicDirectionId = String(formData.get("strategic_direction_id") ?? "").trim();
  if (!strategicDirectionId) {
    done("/strategy-cycle?l1=strategic-directions&l2=design");
  }
  const title = String(formData.get("title") ?? "").trim();
  const strategicValueScore = readSmallIntField(formData, "strategic_value_score", 3);
  const capabilityFitScore = readSmallIntField(formData, "capability_fit_score", 3);
  const feasibilityScore = readSmallIntField(formData, "feasibility_score", 3);
  const riskLevel = readSmallIntField(formData, "risk_score", 3);
  const directionScore = computeDirectionScore({
    strategicValueScore,
    capabilityFitScore,
    feasibilityScore,
    riskScore: riskLevel,
  });
  const description = String(formData.get("description") ?? "").trim() || null;
  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("strategic_directions")
    .update({
      ...(title ? { title } : {}),
      description,
      strategic_value_score: strategicValueScore,
      capability_fit_score: capabilityFitScore,
      feasibility_score: feasibilityScore,
      direction_score: directionScore,
      relevance_level: strategicValueScore,
      risk_level: riskLevel,
    })
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("id", strategicDirectionId);
  done("/strategy-cycle?l1=strategic-directions&l2=design&success=assessment-updated");
}

export async function linkDirectionToChallengePredecessor(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const directionId = String(formData.get("strategic_direction_id") ?? "").trim();
  const challengeId = String(formData.get("strategic_challenge_id") ?? "").trim();
  if (!directionId || !challengeId) {
    done("/strategy-cycle?l1=strategic-directions&l2=design&error=missing-link");
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
  finishOrRedirect(formData, "/strategy-cycle?l1=strategic-directions&l2=design&success=linked");
}

export async function unlinkDirectionChallengePredecessor(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const directionId = String(formData.get("strategic_direction_id") ?? "").trim();
  const challengeId = String(formData.get("strategic_challenge_id") ?? "").trim();
  if (!directionId || !challengeId) {
    done("/strategy-cycle?l1=strategic-directions&l2=design");
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
  finishOrRedirect(formData, "/strategy-cycle?l1=strategic-directions&l2=design&success=unlinked");
}

export async function linkDirectionToObjectiveInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const directionId = String(formData.get("strategic_direction_id") ?? "").trim();
  const objectiveId = String(formData.get("objective_id") ?? "").trim();
  if (!directionId || !objectiveId) {
    done("/strategy-cycle?l1=strategic-directions&l2=design&error=missing-link");
  }
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("strategic_direction_objective_links").upsert(
    {
      organization_id: context.organizationId,
      cycle_instance_id: context.cycleId,
      strategic_direction_id: directionId,
      objective_id: objectiveId,
      created_by_membership_id: context.membershipId,
    },
    { onConflict: "cycle_instance_id,strategic_direction_id,objective_id" }
  );
  finishOrRedirect(formData, "/strategy-cycle?l1=strategic-directions&l2=design&success=linked");
}

export async function unlinkDirectionFromObjectiveInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const directionId = String(formData.get("strategic_direction_id") ?? "").trim();
  const objectiveId = String(formData.get("objective_id") ?? "").trim();
  if (!directionId || !objectiveId) {
    done("/strategy-cycle?l1=strategic-directions&l2=design");
  }
  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("strategic_direction_objective_links")
    .delete()
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("strategic_direction_id", directionId)
    .eq("objective_id", objectiveId);
  finishOrRedirect(formData, "/strategy-cycle?l1=strategic-directions&l2=design&success=unlinked");
}

export async function saveCorrelationStatusOverride(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const challengeId = String(formData.get("challenge_id") ?? "").trim();
  const objectiveId = String(formData.get("objective_id") ?? "").trim();
  const directionId = String(formData.get("strategic_direction_id") ?? "").trim();
  if (!challengeId || !objectiveId || !directionId) {
    done("/strategy-cycle?l1=strategic-directions&l2=summary&error=missing-link");
  }
  const status = readCorrelationStatusField(formData, "status");
  const note = String(formData.get("note") ?? "").trim() || null;
  const returnTo = readSafeReturnTo(formData, "/strategy-cycle?l1=strategic-directions&l2=summary");
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("strategy_correlation_status_overrides").upsert(
    {
      organization_id: context.organizationId,
      cycle_instance_id: context.cycleId,
      objective_id: objectiveId,
      challenge_id: challengeId,
      strategic_direction_id: directionId,
      status,
      note,
      updated_by_membership_id: context.membershipId,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict:
        "cycle_instance_id,objective_id,challenge_id,strategic_direction_id",
    }
  );
  done(withSuccess(returnTo, "correlation-override-saved"));
}

export async function clearCorrelationStatusOverride(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const challengeId = String(formData.get("challenge_id") ?? "").trim();
  const objectiveId = String(formData.get("objective_id") ?? "").trim();
  const directionId = String(formData.get("strategic_direction_id") ?? "").trim();
  if (!challengeId || !objectiveId || !directionId) {
    done("/strategy-cycle?l1=strategic-directions&l2=summary");
  }
  const returnTo = readSafeReturnTo(formData, "/strategy-cycle?l1=strategic-directions&l2=summary");
  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("strategy_correlation_status_overrides")
    .delete()
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("objective_id", objectiveId)
    .eq("challenge_id", challengeId)
    .eq("strategic_direction_id", directionId);
  done(withSuccess(returnTo, "correlation-override-cleared"));
}

export type MatrixProgramProposalActionResult =
  | { ok: true; proposal: MatrixProgramProposalResult }
  | { ok: false; error: string };

/** KI: Programmvorschlag aus Matrix-Zelle (kein Target/Jahresziel). */
export async function generateMatrixProgramProposalAction(input: {
  challengeId: string;
  directionId: string;
  objectives: Array<{ id: string; title: string }>;
  cellScore: number;
  scoreExplanation: string;
}): Promise<MatrixProgramProposalActionResult> {
  const context = await getWorkspaceContextOrRedirect();
  const supabase = await createSupabaseServerClient();

  const [{ data: chRow, error: chErr }, { data: dirRow, error: dirErr }] = await Promise.all([
    supabase
      .schema("app")
      .from("strategic_challenges")
      .select("id,title,description")
      .eq("organization_id", context.organizationId)
      .eq("cycle_instance_id", context.cycleId)
      .eq("id", input.challengeId)
      .maybeSingle(),
    supabase
      .schema("app")
      .from("strategic_directions")
      .select("id,title,description")
      .eq("organization_id", context.organizationId)
      .eq("cycle_instance_id", context.cycleId)
      .eq("id", input.directionId)
      .maybeSingle(),
  ]);
  if (chErr || !chRow) return { ok: false, error: "Herausforderung nicht gefunden." };
  if (dirErr || !dirRow) return { ok: false, error: "Stossrichtung nicht gefunden." };

  const { data: branding } = await supabase
    .schema("app")
    .from("tenant_branding")
    .select("branding_config")
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  const llmPolicy = readAnalysisNetworkLlmPolicy(branding?.branding_config ?? null);
  if (!llmPolicy.llmEnabled || !isLlmFeatureEnabled(llmPolicy, "matrix_program_proposal")) {
    return { ok: false, error: "KI-Vorschlag fuer Programme ist deaktiviert." };
  }

  const budgetStatus = await evaluateLlmBudgetStatus({
    supabase: supabase as unknown as BudgetSupabaseClientLike,
    organizationId: context.organizationId,
    policy: llmPolicy,
  });
  if (!budgetStatus.allowed) {
    return { ok: false, error: "LLM-Budget ausgeschoepft oder gesperrt." };
  }

  const kennzahlen = readCompanyKennzahlenFromBrandingConfig(branding?.branding_config ?? null);
  const strategyRef = readStrategyReferenceFieldsFromBrandingConfig(branding?.branding_config ?? null);
  const companyContextJson = JSON.stringify({ companyKennzahlen: kennzahlen, strategyReference: strategyRef });

  const maxTokens = resolveLlmMaxOutputTokens(llmPolicy, "matrix_program_proposal");

  const result = await proposeMatrixProgramWithGemini(
    {
      challengeTitle: chRow.title,
      challengeDescription: chRow.description ?? null,
      directionTitle: dirRow.title,
      directionDescription: dirRow.description ?? null,
      objectives: input.objectives,
      cellScore: input.cellScore,
      scoreExplanation: input.scoreExplanation,
      companyContextJson,
    },
    maxTokens
  );

  if (!result.proposal) {
    return {
      ok: false,
      error:
        "KI konnte keinen Vorschlag erzeugen. Bitte GEMINI_API_KEY pruefen oder spaeter erneut versuchen.",
    };
  }

  await recordLlmUsageEvents(supabase, [
    {
      organizationId: context.organizationId,
      cycleInstanceId: context.cycleId,
      feature: "matrix_program_proposal",
      provider: "gemini",
      model: GEMINI_MODEL_ASSIST,
      promptVersion: "matrix-program-v1",
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      totalTokens: result.usage.totalTokens,
      billableCost: result.usage.billableCost,
      usageMissing: result.usage.usageMissing,
      metadata: { challengeId: input.challengeId, directionId: input.directionId },
    },
  ]);

  return { ok: true, proposal: result.proposal };
}

export async function createStrategyProgramInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const title = String(formData.get("title") ?? "").trim();
  const directionId = String(formData.get("strategic_direction_id") ?? "").trim();
  if (!title || !directionId) {
    done("/strategy-cycle?l1=pips&l2=programme&error=missing-link");
  }
  const strategicChallengeId = String(formData.get("strategic_challenge_id") ?? "").trim();
  const programOriginRaw = String(formData.get("program_origin") ?? "manual").trim().toLowerCase();
  const programOrigin = programOriginRaw === "matrix" ? "matrix" : "manual";
  const matrixCellScoreRaw = formData.get("matrix_cell_score");
  const matrixCellScore =
    matrixCellScoreRaw != null && String(matrixCellScoreRaw).trim() !== ""
      ? Number(matrixCellScoreRaw)
      : null;
  const supportedObjectiveIds = String(formData.get("supported_objective_ids") ?? "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const budgetRaw = Number(formData.get("budget") ?? 0);
  const budget = Number.isFinite(budgetRaw) && budgetRaw > 0 ? Number(budgetRaw.toFixed(2)) : null;
  const supabase = createSupabaseAdminClient();
  if (!supabase) done("/strategy-cycle?l1=pips&l2=programme&error=program-insert-failed");
  const { error } = await supabase.schema("app").from("strategy_programs").insert({
    organization_id: context.organizationId,
    cycle_instance_id: context.cycleId,
    strategic_direction_id: directionId,
    strategic_challenge_id: strategicChallengeId || null,
    program_origin: programOrigin,
    matrix_cell_score:
      Number.isFinite(matrixCellScore) && matrixCellScore != null ? matrixCellScore : null,
    supported_objective_ids: supportedObjectiveIds.length > 0 ? supportedObjectiveIds : [],
    title,
    description: String(formData.get("description") ?? "").trim() || null,
    timeline: String(formData.get("timeline") ?? "").trim() || null,
    budget,
    created_by_membership_id: context.membershipId,
  });
  if (error) {
    if (error.code === "23505") {
      done("/strategy-cycle?l1=pips&l2=programme&error=program-duplicate-title");
    } else {
      console.error("[createStrategyProgramInCycle]", error.code, error.message);
      done("/strategy-cycle?l1=pips&l2=programme&error=program-insert-failed");
    }
  }
  done("/strategy-cycle?l1=pips&l2=programme&success=program-created");
}

export async function linkStrategicChallengeToIndustryInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const challengeId = String(formData.get("strategic_challenge_id") ?? "").trim();
  const industryId = String(formData.get("industry_id") ?? "").trim();
  if (!challengeId || !industryId) {
    done("/strategy-cycle?l1=strategic-directions&error=missing-link");
  }
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("strategic_challenge_industries").upsert(
    {
      organization_id: context.organizationId,
      cycle_instance_id: context.cycleId,
      strategic_challenge_id: challengeId,
      industry_id: industryId,
    },
    { onConflict: "cycle_instance_id,strategic_challenge_id,industry_id" }
  );
  finishOrRedirect(formData, "/strategy-cycle?l1=strategic-directions&l2=challenges&success=linked");
}

export async function unlinkStrategicChallengeFromIndustryInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const challengeId = String(formData.get("strategic_challenge_id") ?? "").trim();
  const industryId = String(formData.get("industry_id") ?? "").trim();
  if (!challengeId || !industryId) {
    done("/strategy-cycle?l1=strategic-directions");
  }
  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("strategic_challenge_industries")
    .delete()
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("strategic_challenge_id", challengeId)
    .eq("industry_id", industryId);
  finishOrRedirect(formData, "/strategy-cycle?l1=strategic-directions&l2=challenges&success=unlinked");
}

export async function linkStrategicChallengeToBusinessModelInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const challengeId = String(formData.get("strategic_challenge_id") ?? "").trim();
  const businessModelId = String(formData.get("business_model_id") ?? "").trim();
  if (!challengeId || !businessModelId) {
    done("/strategy-cycle?l1=strategic-directions&error=missing-link");
  }
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("strategic_challenge_business_models").upsert(
    {
      organization_id: context.organizationId,
      cycle_instance_id: context.cycleId,
      strategic_challenge_id: challengeId,
      business_model_id: businessModelId,
    },
    { onConflict: "cycle_instance_id,strategic_challenge_id,business_model_id" }
  );
  finishOrRedirect(formData, "/strategy-cycle?l1=strategic-directions&l2=challenges&success=linked");
}

export async function unlinkStrategicChallengeFromBusinessModelInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const challengeId = String(formData.get("strategic_challenge_id") ?? "").trim();
  const businessModelId = String(formData.get("business_model_id") ?? "").trim();
  if (!challengeId || !businessModelId) {
    done("/strategy-cycle?l1=strategic-directions");
  }
  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("strategic_challenge_business_models")
    .delete()
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("strategic_challenge_id", challengeId)
    .eq("business_model_id", businessModelId);
  finishOrRedirect(formData, "/strategy-cycle?l1=strategic-directions&l2=challenges&success=unlinked");
}

export async function linkStrategicDirectionToIndustryInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const directionId = String(formData.get("strategic_direction_id") ?? "").trim();
  const industryId = String(formData.get("industry_id") ?? "").trim();
  if (!directionId || !industryId) {
    done("/strategy-cycle?l1=strategic-directions&l2=design&error=missing-link");
  }
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("strategic_direction_industries").upsert(
    {
      organization_id: context.organizationId,
      cycle_instance_id: context.cycleId,
      strategic_direction_id: directionId,
      industry_id: industryId,
    },
    { onConflict: "cycle_instance_id,strategic_direction_id,industry_id" }
  );
  finishOrRedirect(formData, "/strategy-cycle?l1=strategic-directions&l2=design&success=linked");
}

export async function unlinkStrategicDirectionFromIndustryInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const directionId = String(formData.get("strategic_direction_id") ?? "").trim();
  const industryId = String(formData.get("industry_id") ?? "").trim();
  if (!directionId || !industryId) {
    done("/strategy-cycle?l1=strategic-directions&l2=design");
  }
  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("strategic_direction_industries")
    .delete()
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("strategic_direction_id", directionId)
    .eq("industry_id", industryId);
  finishOrRedirect(formData, "/strategy-cycle?l1=strategic-directions&l2=design&success=unlinked");
}

export async function linkStrategicDirectionToBusinessModelInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const directionId = String(formData.get("strategic_direction_id") ?? "").trim();
  const businessModelId = String(formData.get("business_model_id") ?? "").trim();
  if (!directionId || !businessModelId) {
    done("/strategy-cycle?l1=strategic-directions&l2=design&error=missing-link");
  }
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("strategic_direction_business_models").upsert(
    {
      organization_id: context.organizationId,
      cycle_instance_id: context.cycleId,
      strategic_direction_id: directionId,
      business_model_id: businessModelId,
    },
    { onConflict: "cycle_instance_id,strategic_direction_id,business_model_id" }
  );
  finishOrRedirect(formData, "/strategy-cycle?l1=strategic-directions&l2=design&success=linked");
}

export async function unlinkStrategicDirectionFromBusinessModelInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const directionId = String(formData.get("strategic_direction_id") ?? "").trim();
  const businessModelId = String(formData.get("business_model_id") ?? "").trim();
  if (!directionId || !businessModelId) {
    done("/strategy-cycle?l1=strategic-directions&l2=design");
  }
  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("strategic_direction_business_models")
    .delete()
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("strategic_direction_id", directionId)
    .eq("business_model_id", businessModelId);
  finishOrRedirect(formData, "/strategy-cycle?l1=strategic-directions&l2=design&success=unlinked");
}

export async function createPipInitiativeInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    done("/strategy-cycle?l1=pips&l2=initiativen&error=missing-title");
  }
  const programId = String(formData.get("program_id") ?? "").trim();
  if (!programId) {
    done("/strategy-cycle?l1=pips&l2=initiativen&error=missing-link");
  }

  const priority = readSmallIntField(formData, "priority", 3);
  const status = String(formData.get("status") ?? "planned");
  const linkedOkrs = String(formData.get("linked_okrs") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const deliverables = String(formData.get("deliverables") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("initiatives").insert({
    organization_id: context.organizationId,
    cycle_instance_id: context.cycleId,
    program_id: programId,
    title,
    priority,
    status,
    linked_okrs: linkedOkrs,
    deliverables,
    created_by_membership_id: context.membershipId,
  });
  done("/strategy-cycle?l1=pips&l2=initiativen&success=initiative-created");
}

export async function linkInitiativeToTargetPredecessor(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const initiativeId = String(formData.get("initiative_id") ?? "").trim();
  const annualTargetId = String(formData.get("annual_target_id") ?? "").trim();
  if (!initiativeId || !annualTargetId) {
    done("/strategy-cycle?l1=pips&l2=initiativen&error=missing-link");
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
  done("/strategy-cycle?l1=pips&l2=initiativen&success=linked");
}

export async function unlinkInitiativeTargetPredecessor(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const initiativeId = String(formData.get("initiative_id") ?? "").trim();
  const annualTargetId = String(formData.get("annual_target_id") ?? "").trim();
  if (!initiativeId || !annualTargetId) {
    done("/strategy-cycle?l1=pips&l2=initiativen");
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
  finishOrRedirect(formData, "/strategy-cycle?l1=pips&l2=initiativen&success=unlinked");
}

export async function linkObjectiveToIndustryInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const objectiveId = String(formData.get("objective_id") ?? "").trim();
  const industryId = String(formData.get("industry_id") ?? "").trim();
  if (!objectiveId || !industryId) {
    done("/strategy-cycle?l1=objectives&error=missing-link");
  }
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("objective_industries").upsert(
    {
      organization_id: context.organizationId,
      cycle_instance_id: context.cycleId,
      objective_id: objectiveId,
      industry_id: industryId,
    },
    { onConflict: "planning_cycle_id,objective_id,industry_id" }
  );
  finishOrRedirect(formData, "/strategy-cycle?l1=objectives&success=linked");
}

export async function unlinkObjectiveFromIndustryInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const objectiveId = String(formData.get("objective_id") ?? "").trim();
  const industryId = String(formData.get("industry_id") ?? "").trim();
  if (!objectiveId || !industryId) {
    done("/strategy-cycle?l1=objectives");
  }
  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("objective_industries")
    .delete()
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("objective_id", objectiveId)
    .eq("industry_id", industryId);
  finishOrRedirect(formData, "/strategy-cycle?l1=objectives&success=unlinked");
}

export async function linkObjectiveToBusinessModelInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const objectiveId = String(formData.get("objective_id") ?? "").trim();
  const businessModelId = String(formData.get("business_model_id") ?? "").trim();
  if (!objectiveId || !businessModelId) {
    done("/strategy-cycle?l1=objectives&error=missing-link");
  }
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("objective_business_models").upsert(
    {
      organization_id: context.organizationId,
      cycle_instance_id: context.cycleId,
      objective_id: objectiveId,
      business_model_id: businessModelId,
    },
    { onConflict: "planning_cycle_id,objective_id,business_model_id" }
  );
  finishOrRedirect(formData, "/strategy-cycle?l1=objectives&success=linked");
}

export async function unlinkObjectiveFromBusinessModelInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const objectiveId = String(formData.get("objective_id") ?? "").trim();
  const businessModelId = String(formData.get("business_model_id") ?? "").trim();
  if (!objectiveId || !businessModelId) {
    done("/strategy-cycle?l1=objectives");
  }
  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("objective_business_models")
    .delete()
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("objective_id", objectiveId)
    .eq("business_model_id", businessModelId);
  finishOrRedirect(formData, "/strategy-cycle?l1=objectives&success=unlinked");
}

export async function deleteObjectiveInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const objectiveId = String(formData.get("objective_id") ?? "").trim();
  if (!objectiveId) {
    done("/strategy-cycle?l1=objectives");
  }
  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("objectives")
    .delete()
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("id", objectiveId);
  done("/strategy-cycle?l1=objectives&success=objective-deleted");
}

export async function deleteStrategicChallengeInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const challengeId = String(formData.get("strategic_challenge_id") ?? "").trim();
  if (!challengeId) {
    done("/strategy-cycle?l1=strategic-directions&l2=challenges");
  }
  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("strategic_challenges")
    .delete()
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("id", challengeId);
  done("/strategy-cycle?l1=strategic-directions&l2=challenges&success=challenge-deleted");
}

export async function deleteStrategicDirectionInCycle(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect();
  const directionId = String(formData.get("strategic_direction_id") ?? "").trim();
  if (!directionId) {
    done("/strategy-cycle?l1=strategic-directions&l2=design");
  }
  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("strategic_directions")
    .delete()
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("id", directionId);
  done("/strategy-cycle?l1=strategic-directions&l2=design&success=direction-deleted");
}
