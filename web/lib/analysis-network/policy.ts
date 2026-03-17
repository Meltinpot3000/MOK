type LlmFeatureKey =
  | "quality_scoring"
  | "link_draft_generation"
  | "cluster_assessment"
  | "gap_assessment"
  | "challenge_recommendation"
  | "model_health_checks";

export type AnalysisNetworkLlmPolicy = {
  llmEnabled: boolean;
  featureFlags: Record<LlmFeatureKey, boolean>;
  defaultMaxOutputTokens: number;
  maxOutputTokensByFeature: Record<LlmFeatureKey, number>;
  dailySoftTokenLimit: number;
  monthlyHardTokenLimit: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function readNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(clamp(parsed, min, max));
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  }
  return fallback;
}

function readAnalysisNetworkObject(brandingConfig: unknown): Record<string, unknown> {
  if (!brandingConfig || typeof brandingConfig !== "object") return {};
  const root = brandingConfig as Record<string, unknown>;
  if (!root.analysis_network || typeof root.analysis_network !== "object") return {};
  return root.analysis_network as Record<string, unknown>;
}

export function readAnalysisNetworkLlmPolicy(brandingConfig: unknown): AnalysisNetworkLlmPolicy {
  const analysisNetwork = readAnalysisNetworkObject(brandingConfig);
  const featureFlagsRaw =
    analysisNetwork.llm_feature_flags && typeof analysisNetwork.llm_feature_flags === "object"
      ? (analysisNetwork.llm_feature_flags as Record<string, unknown>)
      : {};
  const outputByFeatureRaw =
    analysisNetwork.llm_max_output_tokens_by_feature &&
    typeof analysisNetwork.llm_max_output_tokens_by_feature === "object"
      ? (analysisNetwork.llm_max_output_tokens_by_feature as Record<string, unknown>)
      : {};
  const defaultMaxOutputTokens = readNumber(analysisNetwork.llm_max_output_tokens_default, 700, 64, 4096);

  const featureFlags: Record<LlmFeatureKey, boolean> = {
    quality_scoring: readBoolean(featureFlagsRaw.quality_scoring, false),
    link_draft_generation: readBoolean(featureFlagsRaw.link_draft_generation, true),
    cluster_assessment: readBoolean(featureFlagsRaw.cluster_assessment, true),
    gap_assessment: readBoolean(featureFlagsRaw.gap_assessment, true),
    challenge_recommendation: readBoolean(featureFlagsRaw.challenge_recommendation, true),
    model_health_checks: readBoolean(featureFlagsRaw.model_health_checks, true),
  };

  const maxOutputTokensByFeature: Record<LlmFeatureKey, number> = {
    quality_scoring: readNumber(outputByFeatureRaw.quality_scoring, 500, 64, 4096),
    link_draft_generation: readNumber(outputByFeatureRaw.link_draft_generation, 420, 64, 4096),
    cluster_assessment: readNumber(outputByFeatureRaw.cluster_assessment, 380, 64, 4096),
    gap_assessment: readNumber(outputByFeatureRaw.gap_assessment, 380, 64, 4096),
    challenge_recommendation: readNumber(outputByFeatureRaw.challenge_recommendation, 900, 64, 4096),
    model_health_checks: readNumber(outputByFeatureRaw.model_health_checks, 128, 64, 4096),
  };

  return {
    llmEnabled: readBoolean(analysisNetwork.llm_enabled, true),
    featureFlags,
    defaultMaxOutputTokens,
    maxOutputTokensByFeature,
    dailySoftTokenLimit: readNumber(analysisNetwork.llm_daily_soft_token_limit, 150000, 0, 100000000),
    monthlyHardTokenLimit: readNumber(analysisNetwork.llm_monthly_hard_token_limit, 3000000, 0, 1000000000),
  };
}

export function isLlmFeatureEnabled(
  policy: AnalysisNetworkLlmPolicy,
  feature: LlmFeatureKey
): boolean {
  if (!policy.llmEnabled) return false;
  return Boolean(policy.featureFlags[feature]);
}

export function resolveLlmMaxOutputTokens(
  policy: AnalysisNetworkLlmPolicy,
  feature: LlmFeatureKey
): number {
  return readNumber(
    policy.maxOutputTokensByFeature[feature],
    policy.defaultMaxOutputTokens,
    64,
    4096
  );
}

