import { scorePairWithLlm } from "@/lib/analysis-network/providers";
import { buildRuleCandidates } from "@/lib/analysis-network/rules";
import type { AnalysisEntryRecord, LinkCandidate } from "@/lib/analysis-network/types";

type PairIndex = {
  [key: string]: { left: AnalysisEntryRecord; right: AnalysisEntryRecord };
};

function pairKey(a: string, b: string) {
  return [a, b].sort().join("__");
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

type TriScores = {
  proximityScore: number;
  supportScore: number;
  repulsionScore: number;
};

type FusionWeights = {
  rule: number;
  llm: number;
};

type LinkDecision = {
  linkType: LinkCandidate["linkType"];
  strength: number;
  confidence: number;
};

function readRuleTri(candidate: LinkCandidate): TriScores {
  const metadata = candidate.metadata ?? {};
  const tri = metadata.triScores as Record<string, unknown> | undefined;
  return {
    proximityScore: clamp(Number(tri?.proximityScore ?? candidate.confidence), 0, 1),
    supportScore: clamp(
      Number(tri?.supportScore ?? (candidate.linkType === "supports" || candidate.linkType === "amplifies" ? candidate.confidence : 0.3)),
      0,
      1
    ),
    repulsionScore: clamp(Number(tri?.repulsionScore ?? (candidate.linkType === "contradicts" ? candidate.confidence : 0.2)), 0, 1),
  };
}

function deriveLinkType(
  tri: TriScores,
  directional: { causeEvidence: number; dependencyEvidence: number; llmDirectionHint: "none" | "causes" | "depends_on" },
  suggested: LinkCandidate["linkType"]
): LinkCandidate["linkType"] {
  if (tri.repulsionScore >= 0.64) return "contradicts";
  if (directional.llmDirectionHint === "depends_on" || directional.dependencyEvidence >= 0.62) return "depends_on";
  if (directional.llmDirectionHint === "causes" || directional.causeEvidence >= 0.62) return "causes";
  if (tri.proximityScore >= 0.9 && tri.repulsionScore <= 0.22) return "duplicates";
  if (tri.supportScore >= 0.76 && tri.proximityScore >= 0.45 && tri.repulsionScore <= 0.42) return "amplifies";
  if (tri.supportScore >= 0.5 && tri.repulsionScore < 0.58) return "supports";
  if (tri.proximityScore >= 0.34) return "related_to";
  return suggested === "related_to" ? "related_to" : suggested;
}

function computeDecision(
  tri: TriScores,
  linkType: LinkCandidate["linkType"],
  evidenceQuality: number,
  consistency: number
): LinkDecision {
  const dominance = Math.max(tri.proximityScore, tri.supportScore, tri.repulsionScore);
  const confidence = clamp(
    dominance * 0.46 + evidenceQuality * 0.24 + consistency * 0.18 + tri.proximityScore * 0.12,
    0.08,
    0.99
  );
  let baseStrength = 1 + dominance * 4;
  if (linkType === "amplifies" || linkType === "contradicts") baseStrength += 0.3;
  if (linkType === "causes" || linkType === "depends_on") baseStrength += 0.15;
  return {
    linkType,
    strength: clamp(Math.round(baseStrength), 1, 5),
    confidence: Number(confidence.toFixed(4)),
  };
}

export async function generateHybridLinkCandidates(
  entries: AnalysisEntryRecord[],
  opts?: {
    maxLlmPairs?: number;
    minRuleConfidence?: number;
    fusionWeights?: FusionWeights;
  }
): Promise<LinkCandidate[]> {
  const maxLlmPairs = opts?.maxLlmPairs ?? 22;
  const minRuleConfidence = opts?.minRuleConfidence ?? 0.22;
  const fusionWeights = opts?.fusionWeights ?? { rule: 0.55, llm: 0.45 };
  const weightSum = Math.max(0.001, fusionWeights.rule + fusionWeights.llm);
  const wr = fusionWeights.rule / weightSum;
  const wl = fusionWeights.llm / weightSum;
  const ruleCandidates = buildRuleCandidates(entries).filter(
    (candidate) => candidate.confidence >= minRuleConfidence
  );

  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const pairs: PairIndex = {};
  for (const candidate of ruleCandidates) {
    const left = entryById.get(candidate.sourceEntryId);
    const right = entryById.get(candidate.targetEntryId);
    if (!left || !right) continue;
    pairs[pairKey(left.id, right.id)] = { left, right };
  }

  const topRulePairs = [...ruleCandidates]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxLlmPairs);

  const llmCandidatesByPair = new Map<string, LinkCandidate>();
  for (const candidate of topRulePairs) {
    const key = pairKey(candidate.sourceEntryId, candidate.targetEntryId);
    const pair = pairs[key];
    if (!pair) continue;
    const ruleTri = readRuleTri(candidate);
    const llmResult = await scorePairWithLlm(pair.left, pair.right);
    const mergedTri: TriScores = llmResult
      ? {
          proximityScore: clamp(ruleTri.proximityScore * wr + llmResult.proximityScore * wl, 0, 1),
          supportScore: clamp(ruleTri.supportScore * wr + llmResult.supportScore * wl, 0, 1),
          repulsionScore: clamp(ruleTri.repulsionScore * wr + llmResult.repulsionScore * wl, 0, 1),
        }
      : ruleTri;

    const meta = candidate.metadata ?? {};
    const causeEvidence = clamp(Number((meta.causeEvidence as number | undefined) ?? 0), 0, 1);
    const dependencyEvidence = clamp(Number((meta.dependencyEvidence as number | undefined) ?? 0), 0, 1);
    const evidenceQuality = clamp(Number((meta.evidenceQuality as number | undefined) ?? 0.5), 0, 1);
    const consistency =
      mergedTri.supportScore >= 0.45 && mergedTri.repulsionScore >= 0.45
        ? 0.35
        : 1 - Math.min(0.45, Math.abs(mergedTri.supportScore - mergedTri.repulsionScore) * 0.35);
    const derivedType = deriveLinkType(
      mergedTri,
      {
        causeEvidence,
        dependencyEvidence,
        llmDirectionHint: llmResult?.directionHint ?? "none",
      },
      llmResult?.suggestedLinkType ?? candidate.linkType
    );
    const decision = computeDecision(mergedTri, derivedType, evidenceQuality, consistency);

    llmCandidatesByPair.set(key, {
      sourceEntryId: candidate.sourceEntryId,
      targetEntryId: candidate.targetEntryId,
      linkType: decision.linkType,
      strength: decision.strength,
      confidence: decision.confidence,
      comment: llmResult
        ? `${candidate.comment}; LLM: ${llmResult.explanation}`
        : candidate.comment,
      origin: llmResult ? "hybrid" : "rule",
      provider: llmResult?.provider,
      model: llmResult?.model,
      promptVersion: llmResult?.promptVersion,
      metadata: {
        ...candidate.metadata,
        triScores: {
          proximityScore: Number(mergedTri.proximityScore.toFixed(4)),
          supportScore: Number(mergedTri.supportScore.toFixed(4)),
          repulsionScore: Number(mergedTri.repulsionScore.toFixed(4)),
        },
        fusion: {
          ruleWeight: Number(wr.toFixed(4)),
          llmWeight: Number(wl.toFixed(4)),
          llmUsed: Boolean(llmResult),
        },
        decision: {
          consistency: Number(consistency.toFixed(4)),
          suggestedByLlm: llmResult?.suggestedLinkType ?? null,
          directionHint: llmResult?.directionHint ?? "none",
        },
      },
    });
  }

  const merged = new Map<string, LinkCandidate>();
  for (const candidate of ruleCandidates) {
    merged.set(pairKey(candidate.sourceEntryId, candidate.targetEntryId), candidate);
  }
  for (const [key, candidate] of llmCandidatesByPair.entries()) {
    merged.set(key, candidate);
  }

  return [...merged.values()].sort((a, b) => b.confidence - a.confidence);
}
