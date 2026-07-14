import type { CorrelationStatus } from "@/lib/strategy-cycle/correlation";

export function clampUiScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scoreToImpactPathStatus(score: number): CorrelationStatus {
  const s = clampUiScore(score);
  if (s <= 0) return "unknown";
  if (s >= 70) return "green";
  if (s >= 45) return "yellow";
  return "red";
}

/** Normiert einen Rohwert relativ zum besten Fit im jeweiligen Kontext (0–100). */
export function normalizeRelativeToBest(raw: number, bestRaw: number): number {
  const r = Number(raw);
  const best = Number(bestRaw);
  if (!Number.isFinite(r) || r <= 0) return 0;
  if (!Number.isFinite(best) || best <= 0) return 0;
  return clampUiScore((r / best) * 100);
}

export function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/\W+/)
      .filter((t) => t.length > 3)
  );
}

export function keywordSimilarity01(a: string, b: string): number {
  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let overlap = 0;
  for (const t of ta) {
    if (tb.has(t)) overlap += 1;
  }
  return overlap / Math.max(ta.size, tb.size);
}

export function normalizeQualityScore01(raw: number | string | null | undefined): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n <= 5) return Math.min(1, n / 5);
  return Math.min(1, n / 100);
}

export type AnalysisToChallengeRawInput = {
  clusterProximity01: number;
  keywordSimilarity01: number;
  evidenceProximity01: number;
  candidatePriority01: number;
};

const ANALYSIS_RAW_WEIGHTS = {
  cluster: 0.35,
  keyword: 0.25,
  evidence: 0.2,
  candidate: 0.2,
} as const;

export function computeAnalysisToChallengeRaw(input: AnalysisToChallengeRawInput): number {
  const cluster = Math.max(0, Math.min(1, input.clusterProximity01));
  const keyword = Math.max(0, Math.min(1, input.keywordSimilarity01));
  const evidence = Math.max(0, Math.min(1, input.evidenceProximity01));
  const candidate = Math.max(0, Math.min(1, input.candidatePriority01));
  return (
    cluster * ANALYSIS_RAW_WEIGHTS.cluster +
    keyword * ANALYSIS_RAW_WEIGHTS.keyword +
    evidence * ANALYSIS_RAW_WEIGHTS.evidence +
    candidate * ANALYSIS_RAW_WEIGHTS.candidate
  );
}

/** Inhaltliche Passung Analyse→Herausforderung (ohne Evidenzqualität allein). */
export function computeAnalysisToChallengePassungRaw(
  keywordSimilarity01: number,
  clusterProximity01: number
): number {
  const keyword = Math.max(0, Math.min(1, keywordSimilarity01));
  const cluster = Math.max(0, Math.min(1, clusterProximity01));
  if (keyword < 0.08 && cluster < 0.08) return 0;
  return Math.max(0, Math.min(1, keyword * 0.65 + cluster * 0.35));
}

export function analysisToChallengePassungExplanationDe(
  keywordSimilarity01: number,
  clusterProximity01: number
): string {
  if (keywordSimilarity01 < 0.08 && clusterProximity01 < 0.08) {
    return "Wenig inhaltliche Nähe zwischen Analyse-Eintrag und Herausforderung.";
  }
  if (clusterProximity01 > keywordSimilarity01 && clusterProximity01 >= 0.08) {
    return "Gemeinsamer Cluster- und Evidenzkontext stützt den Bezug.";
  }
  return "Ähnliche Begriffe in Titel oder Beschreibung von Analyse und Herausforderung.";
}

export function normalizeAnalysisSuggestions(
  candidates: Array<{ key: string; raw: number }>
): Map<string, number> {
  const best = candidates.reduce((max, c) => Math.max(max, c.raw), 0);
  const out = new Map<string, number>();
  for (const c of candidates) {
    out.set(c.key, normalizeRelativeToBest(c.raw, best));
  }
  return out;
}

export function normalizeGroupRelativeToBest(
  items: Array<{ key: string; raw: number }>
): Map<string, number> {
  const best = items.reduce((max, item) => Math.max(max, item.raw), 0);
  const out = new Map<string, number>();
  for (const item of items) {
    out.set(item.key, normalizeRelativeToBest(item.raw, best));
  }
  return out;
}

export function pathScoreFromEdgeScores(scores: number[]): number {
  const valid = scores.filter((s) => Number.isFinite(s) && s > 0);
  if (valid.length === 0) return 0;
  return clampUiScore(Math.min(...valid));
}
