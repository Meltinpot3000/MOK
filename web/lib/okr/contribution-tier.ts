import type { OkrContributionTier } from "@/lib/strategy-cycle/coverage-level";

const TIER_ORDER: OkrContributionTier[] = ["insufficient", "low", "medium", "high"];

export function contributionTierIndex(level: OkrContributionTier): number {
  return TIER_ORDER.indexOf(level);
}

/** Konservatives Minimum: insufficient schlägt high. */
export function minContributionTier(
  a: OkrContributionTier,
  b: OkrContributionTier
): OkrContributionTier {
  return contributionTierIndex(a) <= contributionTierIndex(b) ? a : b;
}

export function minContributionTierMany(levels: OkrContributionTier[]): OkrContributionTier | null {
  if (levels.length === 0) return null;
  return levels.reduce((acc, l) => minContributionTier(acc, l));
}

/**
 * Mappt Quartals-Fit auf die Overall-Skala (low/medium/high/insufficient).
 * medium (passend) → high (keine Dämpfung); high (überladen) → low.
 */
export function scopeFitToOverallMinTier(scopeFit: OkrContributionTier): OkrContributionTier {
  if (scopeFit === "insufficient") return "insufficient";
  if (scopeFit === "high") return "low";
  if (scopeFit === "low") return "medium";
  return "high";
}

/** Gesamt-Stoßrichtung: konservatives Minimum aus Alignment, Formulierung und Scope-Fit. */
export function computeStrategicDirectionOverallLevel(input: {
  alignmentLevel: OkrContributionTier;
  formulationLevel: OkrContributionTier;
  scopeFitLevel: OkrContributionTier;
  modelOverallLevel?: OkrContributionTier | null;
}): OkrContributionTier {
  const scopeCap = scopeFitToOverallMinTier(input.scopeFitLevel);
  const computed = minContributionTierMany([
    input.alignmentLevel,
    input.formulationLevel,
    scopeCap,
  ])!;
  if (input.modelOverallLevel == null) return computed;
  return minContributionTier(input.modelOverallLevel, computed);
}
