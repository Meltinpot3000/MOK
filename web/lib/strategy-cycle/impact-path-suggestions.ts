import type { ImpactPathEdge } from "@/lib/strategy-cycle/impact-path-graph";
import { buildImpactPathEdgeId } from "@/lib/strategy-cycle/impact-path-graph";
import type { ImpactPathAnalysability } from "@/lib/strategy-cycle/impact-path-analysability";
import { isImpactPathEdgeAnalysable } from "@/lib/strategy-cycle/impact-path-analysability";
import {
  analysisToChallengePassungExplanationDe,
  clampUiScore,
  computeAnalysisToChallengePassungRaw,
  keywordSimilarity01,
  normalizeAnalysisSuggestions,
  scoreToImpactPathStatus,
} from "@/lib/strategy-cycle/impact-path-scoring";
import type { ProgramMatrixModel } from "@/lib/strategy-cycle/program-matrix";
import type { StrategicDesignInsightsResult } from "@/lib/strategy-cycle/strategic-design-insights";

/** Mindest-Score (normiert 0–100) für aktive Vorschlagsanzeige. */
export const IMPACT_PATH_SUGGESTION_MIN_SCORE = 35;

type AnalysisEntryInput = {
  id: string;
  title: string;
  description?: string | null;
  quality_score?: number | string | null;
};

type ChallengeInput = {
  id: string;
  title: string;
  description?: string | null;
  source_analysis_entry_id?: string | null;
};

type DirectionInput = {
  id: string;
  title: string;
  description?: string | null;
  grouping?: string | null;
};

type ObjectiveInput = {
  id: string;
  title: string;
  description?: string | null;
};

type ClusterMemberInput = {
  cluster_id: string;
  entry_id: string;
  membership_strength?: number | null;
};

type ChallengeAnalysisLinkInput = {
  strategic_challenge_id: string;
  analysis_entry_id: string;
};

type ChallengeCandidateInput = {
  source_type: string;
  source_ref: string;
  status: string;
  priority?: number | null;
};

export type ComputeImpactPathSuggestionsInput = {
  entries: AnalysisEntryInput[];
  challenges: ChallengeInput[];
  directions: DirectionInput[];
  objectives: ObjectiveInput[];
  challengeAnalysisEntries: ChallengeAnalysisLinkInput[];
  clusterMembers: ClusterMemberInput[];
  challengeCandidates?: ChallengeCandidateInput[];
  programMatrix: ProgramMatrixModel;
  insights: StrategicDesignInsightsResult;
  existingEdgeKeys: Set<string>;
  analysabilityByNodeId: Map<string, ImpactPathAnalysability>;
};

function clusterIdsByEntryId(members: ClusterMemberInput[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const m of members) {
    const set = map.get(m.entry_id) ?? new Set<string>();
    set.add(m.cluster_id);
    map.set(m.entry_id, set);
  }
  return map;
}

function analysisEntryIdsByChallengeId(
  challenges: ChallengeInput[],
  links: ChallengeAnalysisLinkInput[]
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const ch of challenges) {
    const set = new Set<string>();
    if (ch.source_analysis_entry_id) set.add(ch.source_analysis_entry_id);
    map.set(ch.id, set);
  }
  for (const link of links) {
    const set = map.get(link.strategic_challenge_id) ?? new Set<string>();
    set.add(link.analysis_entry_id);
    map.set(link.strategic_challenge_id, set);
  }
  return map;
}

function linkedAnalysisEntryIds(
  challenges: ChallengeInput[],
  links: ChallengeAnalysisLinkInput[]
): Set<string> {
  const linked = new Set<string>();
  for (const ch of challenges) {
    if (ch.source_analysis_entry_id) linked.add(ch.source_analysis_entry_id);
  }
  for (const link of links) {
    linked.add(link.analysis_entry_id);
  }
  return linked;
}

function candidatePriority01(
  entryId: string,
  clustersByEntry: Map<string, Set<string>>,
  candidates: ChallengeCandidateInput[]
): number {
  let best = 0;
  const entryClusters = clustersByEntry.get(entryId) ?? new Set<string>();
  for (const c of candidates) {
    if (c.status !== "draft") continue;
    const prio = Number(c.priority ?? 3);
    const prio01 = Number.isFinite(prio) ? Math.min(1, prio / 5) : 0.6;
    if (c.source_ref === entryId) {
      best = Math.max(best, prio01);
    }
    if (c.source_type === "cluster" && entryClusters.has(c.source_ref)) {
      best = Math.max(best, prio01 * 0.9);
    }
  }
  return best;
}

function clusterProximity01(
  entryId: string,
  challengeId: string,
  clustersByEntry: Map<string, Set<string>>,
  entryIdsByChallenge: Map<string, Set<string>>
): number {
  const entryClusters = clustersByEntry.get(entryId) ?? new Set<string>();
  if (entryClusters.size === 0) return 0;
  const challengeEntries = entryIdsByChallenge.get(challengeId) ?? new Set<string>();
  let best = 0;
  for (const eid of challengeEntries) {
    const other = clustersByEntry.get(eid) ?? new Set<string>();
    for (const cid of entryClusters) {
      if (other.has(cid)) best = Math.max(best, 0.85);
    }
  }
  return best;
}

function skipNonAnalysableEdge(
  input: ComputeImpactPathSuggestionsInput,
  sourceId: string,
  targetId: string
): boolean {
  return !isImpactPathEdgeAnalysable(sourceId, targetId, input.analysabilityByNodeId);
}

function measureAnalysisToChallengeLink(
  input: ComputeImpactPathSuggestionsInput,
  entryId: string,
  challengeId: string
): { rawPassung: number; keyword: number; cluster: number; explanationDe: string } {
  const entry = input.entries.find((e) => e.id === entryId);
  const challenge = input.challenges.find((c) => c.id === challengeId);
  if (!entry || !challenge) {
    return {
      rawPassung: 0,
      keyword: 0,
      cluster: 0,
      explanationDe: "Analyse-Eintrag oder Herausforderung nicht gefunden.",
    };
  }

  const clustersByEntry = clusterIdsByEntryId(input.clusterMembers);
  const entryIdsByChallenge = analysisEntryIdsByChallengeId(
    input.challenges,
    input.challengeAnalysisEntries
  );
  const cluster = clusterProximity01(
    entry.id,
    challenge.id,
    clustersByEntry,
    entryIdsByChallenge
  );
  const keyword = keywordSimilarity01(
    `${entry.title} ${entry.description ?? ""}`,
    `${challenge.title} ${challenge.description ?? ""}`
  );
  const rawPassung = computeAnalysisToChallengePassungRaw(keyword, cluster);

  return {
    rawPassung,
    keyword,
    cluster,
    explanationDe: analysisToChallengePassungExplanationDe(keyword, cluster),
  };
}

export function scoreExistingAnalysisToChallengeLink(
  input: ComputeImpactPathSuggestionsInput,
  entryId: string,
  challengeId: string
): { score: number; rawScore: number; explanationDe: string } {
  const measured = measureAnalysisToChallengeLink(input, entryId, challengeId);
  const score = clampUiScore(measured.rawPassung * 100);
  return {
    score,
    rawScore: measured.rawPassung,
    explanationDe: measured.explanationDe,
  };
}

function suggestAnalysisToChallenge(input: ComputeImpactPathSuggestionsInput): ImpactPathEdge[] {
  const linkedEntries = linkedAnalysisEntryIds(input.challenges, input.challengeAnalysisEntries);
  const unlinkedEntries = input.entries.filter((e) => !linkedEntries.has(e.id));
  const suggestions: ImpactPathEdge[] = [];

  for (const entry of unlinkedEntries) {
    const rawCandidates: Array<{ key: string; raw: number; challengeId: string; reason: string }> =
      [];

    for (const challenge of input.challenges) {
      const key = buildImpactPathEdgeId("analysis_to_challenge", entry.id, challenge.id);
      if (input.existingEdgeKeys.has(key)) continue;

      const measured = measureAnalysisToChallengeLink(input, entry.id, challenge.id);
      const raw = measured.rawPassung;
      const reason = measured.explanationDe;

      rawCandidates.push({ key, raw, challengeId: challenge.id, reason });
    }

    const normalized = normalizeAnalysisSuggestions(
      rawCandidates.map((c) => ({ key: c.key, raw: c.raw }))
    );

    for (const c of rawCandidates) {
      const score = normalized.get(c.key) ?? 0;
      if (score < IMPACT_PATH_SUGGESTION_MIN_SCORE) continue;
      if (skipNonAnalysableEdge(input, entry.id, c.challengeId)) continue;
      suggestions.push({
        id: c.key,
        kind: "analysis_to_challenge",
        sourceId: entry.id,
        targetId: c.challengeId,
        state: "suggested",
        score,
        rawScore: c.raw,
        status: scoreToImpactPathStatus(score),
        explanationDe: c.reason,
        reviewStatus: "pending",
      });
    }
  }

  return suggestions;
}

function suggestChallengeToDirection(input: ComputeImpactPathSuggestionsInput): ImpactPathEdge[] {
  const suggestions: ImpactPathEdge[] = [];
  const unaddressedIds = new Set(
    input.insights.unaddressedChallenges.map((c) => c.challengeId)
  );

  for (const row of input.programMatrix.directionRows) {
    for (const cell of row.cells) {
      if (cell.isLinked) continue;
      const edgeId = buildImpactPathEdgeId(
        "challenge_to_direction",
        cell.challengeId,
        cell.directionId
      );
      if (input.existingEdgeKeys.has(edgeId)) continue;
      if (skipNonAnalysableEdge(input, cell.challengeId, cell.directionId)) continue;

      let raw = cell.score;
      let reason = cell.scoreExplanation || "Programm-Matrix-Gap mit hohem Potenzial.";
      if (unaddressedIds.has(cell.challengeId)) {
        raw = Math.max(raw, 50);
        reason = "Herausforderung ohne ausreichende Stoßrichtungsantwort.";
      }

      const challenge = input.challenges.find((c) => c.id === cell.challengeId);
      const direction = input.directions.find((d) => d.id === cell.directionId);
      if (challenge && direction) {
        const sim = keywordSimilarity01(challenge.title, direction.title);
        if (sim >= 0.2) {
          raw = Math.max(raw, Math.round(sim * 100));
          reason = "Ähnliche Begriffe zwischen Herausforderung und Stoßrichtung.";
        }
      }

      suggestions.push({
        id: edgeId,
        kind: "challenge_to_direction",
        sourceId: cell.challengeId,
        targetId: cell.directionId,
        state: "suggested",
        score: 0,
        rawScore: raw,
        status: "unknown",
        explanationDe: reason,
        reviewStatus: "pending",
      });
    }
  }

  return suggestions;
}

function suggestDirectionToObjective(input: ComputeImpactPathSuggestionsInput): ImpactPathEdge[] {
  const suggestions: ImpactPathEdge[] = [];

  for (const row of input.programMatrix.directionRows) {
    const hasChallenges = row.cells.some((c) => c.isLinked);
    if (!hasChallenges) continue;

    for (const cell of row.objectiveCells) {
      if (cell.isLinked) continue;
      const edgeId = buildImpactPathEdgeId(
        "direction_to_objective",
        cell.directionId,
        cell.objectiveId
      );
      if (input.existingEdgeKeys.has(edgeId)) continue;
      if (skipNonAnalysableEdge(input, cell.directionId, cell.objectiveId)) continue;

      let raw = cell.score;
      let reason = cell.scoreExplanation || "Stoßrichtung ohne ausreichenden Zielbeitrag.";

      const direction = input.directions.find((d) => d.id === cell.directionId);
      const objective = input.objectives.find((o) => o.id === cell.objectiveId);
      if (direction && objective) {
        const sim = keywordSimilarity01(direction.title, objective.title);
        if (sim >= 0.2) {
          raw = Math.max(raw, Math.round(sim * 100));
          reason = "Semantische Nähe zwischen Stoßrichtung und Ziel.";
        }
        if (direction.description && objective.description) {
          const descSim = keywordSimilarity01(direction.description, objective.description);
          if (descSim >= 0.15) {
            raw = Math.max(raw, Math.round(descSim * 100));
            reason = "Ähnliche Beschreibungstexte deuten auf Zielbeitrag hin.";
          }
        }
      }

      suggestions.push({
        id: edgeId,
        kind: "direction_to_objective",
        sourceId: cell.directionId,
        targetId: cell.objectiveId,
        state: "suggested",
        score: 0,
        rawScore: raw,
        status: "unknown",
        explanationDe: reason,
        reviewStatus: "pending",
      });
    }
  }

  return suggestions;
}

export function computeImpactPathSuggestions(
  input: ComputeImpactPathSuggestionsInput
): ImpactPathEdge[] {
  const byId = new Map<string, ImpactPathEdge>();

  for (const edge of [
    ...suggestAnalysisToChallenge(input),
    ...suggestChallengeToDirection(input),
    ...suggestDirectionToObjective(input),
  ]) {
    const prev = byId.get(edge.id);
    if (!prev || (edge.rawScore ?? 0) > (prev.rawScore ?? 0)) {
      byId.set(edge.id, edge);
    }
  }

  return [...byId.values()];
}
