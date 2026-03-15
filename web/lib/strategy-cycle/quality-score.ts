export type QualityScoreWeights = {
  impact: number;
  certainty: number;
  evidence: number;
  structure: number;
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
