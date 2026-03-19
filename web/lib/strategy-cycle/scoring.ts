export function clampScore1to5(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.max(1, Math.min(5, Math.round(value)));
}

export function roundScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/** Challenge Score = Impact × 0.4 + Urgency × 0.25 + Scope × 0.2 + Steuerbarkeit × 0.2 */
export function computeChallengeScore(input: {
  impactScore: number;
  urgencyScore: number;
  scopeScore: number;
  rootCauseScore: number; // Steuerbarkeit (controllability), DB-Spalte bleibt root_cause_score
}): number {
  const impact = clampScore1to5(input.impactScore);
  const urgency = clampScore1to5(input.urgencyScore);
  const scope = clampScore1to5(input.scopeScore);
  const steuerbarkeit = clampScore1to5(input.rootCauseScore);
  return roundScore(impact * 0.4 + urgency * 0.25 + scope * 0.2 + steuerbarkeit * 0.2);
}

export function computeDirectionScore(input: {
  strategicValueScore: number;
  capabilityFitScore: number;
  feasibilityScore: number;
  riskScore: number;
}): number {
  const strategicValue = clampScore1to5(input.strategicValueScore);
  const capabilityFit = clampScore1to5(input.capabilityFitScore);
  const feasibility = clampScore1to5(input.feasibilityScore);
  const risk = clampScore1to5(input.riskScore);
  return roundScore(
    strategicValue * 0.3 + capabilityFit * 0.25 + feasibility * 0.25 + (6 - risk) * 0.2
  );
}

export function computeGapScore(input: {
  clusterAverageChallengeScore: number;
  objectiveImportanceScore: number;
  relationStrength: number;
}): number {
  const clusterScore = Math.max(0, Number(input.clusterAverageChallengeScore) || 0);
  const objectiveImportance = clampScore1to5(input.objectiveImportanceScore);
  const relationStrength = Math.max(0, Math.min(3, Math.round(Number(input.relationStrength) || 0)));
  return roundScore(clusterScore * objectiveImportance * relationStrength);
}
