import { scoreEntryQualityWithLlm, type LlmUsage } from "@/lib/analysis-network/providers";
type QualityScoringInput = {
  id: string;
  analysis_type: string;
  sub_type: string | null;
  title: string;
  description: string | null;
  impact_level: number | null;
  uncertainty_level: number | null;
};

export type QualityScoreWeights = {
  impact: number;
  certainty: number;
  evidence: number;
  structure: number;
};

export type QualityScoreResult = {
  score: number;
  source: "rule" | "llm";
  fallbackReason: "llm_not_requested" | "llm_no_result" | null;
  explanation: string | null;
  provider: string | null;
  model: string | null;
  promptVersion: string | null;
  usage: LlmUsage | null;
};

export const DEFAULT_QUALITY_WEIGHTS: QualityScoreWeights = {
  impact: 0.35,
  certainty: 0.25,
  evidence: 0.3,
  structure: 0.1,
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function getQualityWeightsFromBrandingConfig(
  brandingConfig: Record<string, unknown> | null | undefined
): QualityScoreWeights {
  const root = brandingConfig ?? {};
  const quality = (root.analysis_quality_weights ?? {}) as Record<string, unknown>;

  const rawImpact = toFiniteNumber(quality.impact);
  const rawCertainty = toFiniteNumber(quality.certainty);
  const rawEvidence = toFiniteNumber(quality.evidence);
  const rawStructure = toFiniteNumber(quality.structure);

  if (
    rawImpact == null ||
    rawCertainty == null ||
    rawEvidence == null ||
    rawStructure == null ||
    rawImpact < 0 ||
    rawCertainty < 0 ||
    rawEvidence < 0 ||
    rawStructure < 0
  ) {
    return DEFAULT_QUALITY_WEIGHTS;
  }

  const sum = rawImpact + rawCertainty + rawEvidence + rawStructure;
  if (!Number.isFinite(sum) || sum <= 0) {
    return DEFAULT_QUALITY_WEIGHTS;
  }

  return {
    impact: rawImpact / sum,
    certainty: rawCertainty / sum,
    evidence: rawEvidence / sum,
    structure: rawStructure / sum,
  };
}

export function calculateQualityScore(
  impact: number | null,
  uncertainty: number | null,
  description: string | null,
  subType: string | null,
  weights: QualityScoreWeights
) {
  const i = Math.max(1, Math.min(5, impact ?? 3));
  const u = Math.max(1, Math.min(5, uncertainty ?? 3));
  const descriptionLength = (description ?? "").trim().length;

  const impactNorm = (i - 1) / 4;
  const certaintyNorm = 1 - (u - 1) / 4;
  const evidenceNorm = Math.min(descriptionLength / 140, 1);
  const structureNorm = subType ? 1 : 0.75;

  const score = Math.round(
    (impactNorm * weights.impact +
      certaintyNorm * weights.certainty +
      evidenceNorm * weights.evidence +
      structureNorm * weights.structure) *
      100
  );

  return Math.max(0, Math.min(100, score));
}

export async function calculateQualityScoreWithFallback(
  entry: QualityScoringInput,
  weights: QualityScoreWeights,
  options?: { llmEnabled?: boolean; strategyReferenceText?: string | null; maxOutputTokens?: number }
): Promise<QualityScoreResult> {
  const fallbackScore = calculateQualityScore(
    entry.impact_level,
    entry.uncertainty_level,
    entry.description,
    entry.sub_type,
    weights
  );
  if (!options?.llmEnabled) {
    return {
      score: fallbackScore,
      source: "rule",
      fallbackReason: "llm_not_requested",
      explanation: null,
      provider: null,
      model: null,
      promptVersion: null,
      usage: null,
    };
  }
  const llmResponse = await scoreEntryQualityWithLlm(entry, {
    strategyReferenceText: options?.strategyReferenceText,
    maxOutputTokens: options?.maxOutputTokens,
  });
  if (!llmResponse.result) {
    return {
      score: fallbackScore,
      source: "rule",
      fallbackReason: "llm_no_result",
      explanation: null,
      provider: null,
      model: null,
      promptVersion: null,
      usage: llmResponse.usage,
    };
  }
  return {
    score: llmResponse.result.qualityScore,
    source: "llm",
    fallbackReason: null,
    explanation: llmResponse.result.explanation,
    provider: llmResponse.result.provider,
    model: llmResponse.result.model,
    promptVersion: llmResponse.result.promptVersion,
    usage: llmResponse.usage,
  };
}
