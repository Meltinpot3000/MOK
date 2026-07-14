import type { CorrelationStatus, CorrelationSummaryResult } from "@/lib/strategy-cycle/correlation";
import type { ContributionLevel } from "@/lib/strategy-cycle/coverage-level";
import { normalizeContributionLevel } from "@/lib/strategy-cycle/coverage-level";
import {
  normalizeGroupRelativeToBest,
  pathScoreFromEdgeScores,
  scoreToImpactPathStatus,
} from "@/lib/strategy-cycle/impact-path-scoring";
import {
  computeImpactPathSuggestions,
  IMPACT_PATH_SUGGESTION_MIN_SCORE,
  scoreExistingAnalysisToChallengeLink,
} from "@/lib/strategy-cycle/impact-path-suggestions";
import { buildImpactPathAnalysabilityMap, isImpactPathEdgeAnalysable } from "@/lib/strategy-cycle/impact-path-analysability";
import type { ProgramMatrixModel } from "@/lib/strategy-cycle/program-matrix";
import type { StrategicDesignInsightsResult } from "@/lib/strategy-cycle/strategic-design-insights";
import { getLifecycleLabelDe, type StrategyObjectVersioningMeta } from "@/lib/strategy-objects";

export type ImpactPathNodeKind = "analysis_entry" | "challenge" | "direction" | "objective";

export type ImpactPathEdgeKind =
  | "analysis_to_challenge"
  | "challenge_to_direction"
  | "direction_to_objective";

export type ImpactPathEdgeState = "existing" | "suggested";

export type ImpactPathReviewStatus = "pending" | "accepted" | "rejected" | "deferred";

export type PathLinkReviewInput = {
  edge_kind: ImpactPathEdgeKind;
  source_id: string;
  target_id: string;
  status: "accepted" | "rejected" | "deferred";
  suggestion_score: number | null;
  note: string | null;
};

export type ImpactPathEdge = {
  id: string;
  kind: ImpactPathEdgeKind;
  sourceId: string;
  targetId: string;
  state: ImpactPathEdgeState;
  score: number;
  rawScore?: number;
  status: CorrelationStatus;
  explanationDe: string;
  contributionLevel?: ContributionLevel | null;
  reviewStatus?: ImpactPathReviewStatus;
  reviewNote?: string | null;
  correlationDirectionId?: string;
  autoScore?: number;
  effectiveStatus?: CorrelationStatus;
  hasOverride?: boolean;
};

export type ImpactPathNode = {
  id: string;
  kind: ImpactPathNodeKind;
  title: string;
  description?: string | null;
  lifecycleLabel?: string;
  isAnalysable?: boolean;
  analysabilityLabelDe?: string;
  analysabilityHintDe?: string;
};

export type ImpactPathChain = {
  id: string;
  analysisEntryId?: string;
  challengeId: string;
  directionId: string;
  objectiveId: string;
  edgeIds: [string, string, string];
  pathScore: number;
  status: CorrelationStatus;
  weakestEdgeId: string;
  allExisting: boolean;
};

export type ImpactPathGraphKpis = {
  completePaths: number;
  openSuggestions: number;
  weakExistingConnections: number;
  unconnectedObjects: number;
  openReviews: number;
  nonAnalysableObjects: number;
};

export type ImpactPathGraph = {
  nodes: ImpactPathNode[];
  edges: ImpactPathEdge[];
  chains: ImpactPathChain[];
  kpis: ImpactPathGraphKpis;
};

export type BuildImpactPathGraphInput = {
  entries: Array<{
    id: string;
    title: string;
    description?: string | null;
    quality_score?: number | string | null;
  }>;
  challenges: Array<{
    id: string;
    title: string;
    description?: string | null;
    source_analysis_entry_id?: string | null;
  }>;
  directions: Array<{
    id: string;
    title: string;
    description?: string | null;
    grouping?: string | null;
    versioning?: StrategyObjectVersioningMeta | null;
  }>;
  objectives: Array<{
    id: string;
    title: string;
    description?: string | null;
    ai_clarity_score?: number | string | null;
    versioning?: StrategyObjectVersioningMeta | null;
  }>;
  challengeAnalysisEntries: Array<{
    strategic_challenge_id: string;
    analysis_entry_id: string;
  }>;
  challengeDirectionLinks: Array<{
    strategic_challenge_id: string;
    strategic_direction_id: string;
    contribution_level?: string | null;
  }>;
  directionObjectiveLinks: Array<{
    strategic_direction_id: string;
    objective_id: string;
    contribution_level?: string | null;
  }>;
  clusterMembers: Array<{
    cluster_id: string;
    entry_id: string;
    membership_strength?: number | null;
  }>;
  correlationSummary: CorrelationSummaryResult;
  programMatrix: ProgramMatrixModel;
  pathLinkReviews: PathLinkReviewInput[];
  insights: StrategicDesignInsightsResult;
  challengeCandidates?: Array<{
    source_type: string;
    source_ref: string;
    status: string;
    priority?: number | null;
  }>;
};

export function buildImpactPathEdgeId(
  kind: ImpactPathEdgeKind,
  sourceId: string,
  targetId: string
): string {
  return `${kind}:${sourceId}:${targetId}`;
}

const EDGE_MEANING_DE: Record<ImpactPathEdgeKind, string> = {
  analysis_to_challenge: "Diese Analyse begründet die Herausforderung.",
  challenge_to_direction: "Diese Stoßrichtung adressiert die Herausforderung.",
  direction_to_objective: "Diese Stoßrichtung zahlt auf das Ziel ein.",
};

export function impactPathEdgeMeaningDe(kind: ImpactPathEdgeKind): string {
  return EDGE_MEANING_DE[kind];
}

function reviewKey(kind: ImpactPathEdgeKind, sourceId: string, targetId: string): string {
  return `${kind}:${sourceId}:${targetId}`;
}

function buildExistingAnalysisToChallengeEdges(
  input: BuildImpactPathGraphInput,
  existingKeys: Set<string>,
  analysabilityByNodeId: Map<string, { isAnalysable: boolean }>
): ImpactPathEdge[] {
  const edges: ImpactPathEdge[] = [];
  const linkedPairs = new Set<string>();

  for (const ch of input.challenges) {
    if (ch.source_analysis_entry_id) {
      linkedPairs.add(`${ch.source_analysis_entry_id}:${ch.id}`);
    }
  }
  for (const link of input.challengeAnalysisEntries) {
    linkedPairs.add(`${link.analysis_entry_id}:${link.strategic_challenge_id}`);
  }

  const suggestionInput = {
    entries: input.entries,
    challenges: input.challenges,
    directions: input.directions,
    objectives: input.objectives,
    challengeAnalysisEntries: input.challengeAnalysisEntries,
    clusterMembers: input.clusterMembers,
    challengeCandidates: input.challengeCandidates,
    programMatrix: input.programMatrix,
    insights: input.insights,
    existingEdgeKeys: existingKeys,
    analysabilityByNodeId,
  };

  for (const pair of linkedPairs) {
    const [sourceId, targetId] = pair.split(":");
    const id = buildImpactPathEdgeId("analysis_to_challenge", sourceId, targetId);
    existingKeys.add(id);
    const scored = scoreExistingAnalysisToChallengeLink(suggestionInput, sourceId, targetId);
    edges.push({
      id,
      kind: "analysis_to_challenge",
      sourceId,
      targetId,
      state: "existing",
      score: scored.score,
      rawScore: scored.rawScore,
      status: scoreToImpactPathStatus(scored.score),
      explanationDe: scored.explanationDe,
    });
  }

  return edges;
}

function challengeDirectionMatrixRaw(
  programMatrix: ProgramMatrixModel
): Map<string, { raw: number; explanation: string; isLinked: boolean }> {
  const map = new Map<string, { raw: number; explanation: string; isLinked: boolean }>();
  for (const row of programMatrix.directionRows) {
    for (const cell of row.cells) {
      map.set(`${cell.challengeId}:${cell.directionId}`, {
        raw: cell.score,
        explanation: cell.scoreExplanation,
        isLinked: cell.isLinked,
      });
    }
  }
  return map;
}

function directionObjectiveMatrixRaw(
  programMatrix: ProgramMatrixModel
): Map<string, { raw: number; explanation: string; isLinked: boolean }> {
  const map = new Map<string, { raw: number; explanation: string; isLinked: boolean }>();
  for (const row of programMatrix.directionRows) {
    for (const cell of row.objectiveCells) {
      map.set(`${cell.directionId}:${cell.objectiveId}`, {
        raw: cell.score,
        explanation: cell.scoreExplanation,
        isLinked: cell.isLinked,
      });
    }
  }
  return map;
}

function normalizeChallengeDirectionScores(
  items: Array<{ key: string; raw: number }>
): Map<string, number> {
  const byChallenge = new Map<string, Array<{ key: string; raw: number }>>();
  for (const item of items) {
    const challengeId = item.key.split(":")[0];
    const list = byChallenge.get(challengeId) ?? [];
    list.push(item);
    byChallenge.set(challengeId, list);
  }
  const out = new Map<string, number>();
  for (const [, group] of byChallenge) {
    const normalized = normalizeGroupRelativeToBest(group);
    for (const [k, v] of normalized) out.set(k, v);
  }
  return out;
}

function normalizeDirectionObjectiveScores(
  items: Array<{ key: string; raw: number }>
): Map<string, number> {
  const byDirection = new Map<string, Array<{ key: string; raw: number }>>();
  for (const item of items) {
    const directionId = item.key.split(":")[0];
    const list = byDirection.get(directionId) ?? [];
    list.push(item);
    byDirection.set(directionId, list);
  }
  const out = new Map<string, number>();
  for (const [, group] of byDirection) {
    const normalized = normalizeGroupRelativeToBest(group);
    for (const [k, v] of normalized) out.set(k, v);
  }
  return out;
}

function buildChallengeDirectionEdges(
  input: BuildImpactPathGraphInput,
  matrixRaw: Map<string, { raw: number; explanation: string; isLinked: boolean }>,
  existingKeys: Set<string>
): ImpactPathEdge[] {
  const contributionByPair = new Map<string, ContributionLevel>();
  for (const link of input.challengeDirectionLinks) {
    contributionByPair.set(
      `${link.strategic_challenge_id}:${link.strategic_direction_id}`,
      normalizeContributionLevel(link.contribution_level)
    );
  }

  const rawItems: Array<{ key: string; raw: number }> = [];
  for (const [key, meta] of matrixRaw) {
    rawItems.push({ key, raw: meta.raw });
  }
  const normalized = normalizeChallengeDirectionScores(rawItems);

  const edges: ImpactPathEdge[] = [];
  for (const link of input.challengeDirectionLinks) {
    const key = `${link.strategic_challenge_id}:${link.strategic_direction_id}`;
    const meta = matrixRaw.get(key);
    const score = normalized.get(key) ?? 0;
    const id = buildImpactPathEdgeId(
      "challenge_to_direction",
      link.strategic_challenge_id,
      link.strategic_direction_id
    );
    existingKeys.add(id);

    let correlationDirectionId: string | undefined;
    let effectiveStatus: CorrelationStatus | undefined;
    let hasOverride = false;
    let autoScore: number | undefined;
    const cell = input.correlationSummary.cells.find(
      (c) =>
        c.challengeId === link.strategic_challenge_id &&
        c.directions.some((d) => d.directionId === link.strategic_direction_id)
    );
    if (cell) {
      const dir = cell.directions.find((d) => d.directionId === link.strategic_direction_id);
      if (dir) {
        correlationDirectionId = dir.directionId;
        effectiveStatus = dir.effectiveStatus;
        hasOverride = dir.hasOverride;
        autoScore = dir.autoScore;
      }
    }

    edges.push({
      id,
      kind: "challenge_to_direction",
      sourceId: link.strategic_challenge_id,
      targetId: link.strategic_direction_id,
      state: "existing",
      score,
      rawScore: meta?.raw ?? score,
      status: scoreToImpactPathStatus(score),
      explanationDe: meta?.explanation ?? EDGE_MEANING_DE.challenge_to_direction,
      contributionLevel: contributionByPair.get(key) ?? "medium",
      correlationDirectionId,
      effectiveStatus,
      hasOverride,
      autoScore,
    });
  }

  return edges;
}

function buildDirectionObjectiveEdges(
  input: BuildImpactPathGraphInput,
  matrixRaw: Map<string, { raw: number; explanation: string; isLinked: boolean }>,
  existingKeys: Set<string>
): ImpactPathEdge[] {
  const contributionByPair = new Map<string, ContributionLevel>();
  for (const link of input.directionObjectiveLinks) {
    contributionByPair.set(
      `${link.strategic_direction_id}:${link.objective_id}`,
      normalizeContributionLevel(link.contribution_level)
    );
  }

  const rawItems: Array<{ key: string; raw: number }> = [];
  for (const [key, meta] of matrixRaw) {
    rawItems.push({ key, raw: meta.raw });
  }
  const normalized = normalizeDirectionObjectiveScores(rawItems);

  const edges: ImpactPathEdge[] = [];
  for (const link of input.directionObjectiveLinks) {
    const key = `${link.strategic_direction_id}:${link.objective_id}`;
    const meta = matrixRaw.get(key);
    const score = normalized.get(key) ?? 0;
    const id = buildImpactPathEdgeId(
      "direction_to_objective",
      link.strategic_direction_id,
      link.objective_id
    );
    existingKeys.add(id);
    edges.push({
      id,
      kind: "direction_to_objective",
      sourceId: link.strategic_direction_id,
      targetId: link.objective_id,
      state: "existing",
      score,
      rawScore: meta?.raw ?? score,
      status: scoreToImpactPathStatus(score),
      explanationDe: meta?.explanation ?? EDGE_MEANING_DE.direction_to_objective,
      contributionLevel: contributionByPair.get(key) ?? "medium",
    });
  }

  return edges;
}

function applyReviewsToSuggestions(
  suggestions: ImpactPathEdge[],
  reviews: PathLinkReviewInput[],
  existingKeys: Set<string>,
  analysabilityByNodeId: Map<string, { isAnalysable: boolean }>
): ImpactPathEdge[] {
  const reviewByKey = new Map(
    reviews.map((r) => [reviewKey(r.edge_kind, r.source_id, r.target_id), r])
  );

  const chDirRaw = new Map<string, number>();
  const dirObjRaw = new Map<string, number>();
  for (const s of suggestions) {
    if (s.kind === "challenge_to_direction" && s.rawScore != null) {
      chDirRaw.set(`${s.sourceId}:${s.targetId}`, s.rawScore);
    }
    if (s.kind === "direction_to_objective" && s.rawScore != null) {
      dirObjRaw.set(`${s.sourceId}:${s.targetId}`, s.rawScore);
    }
  }

  const chDirNorm = normalizeChallengeDirectionScores(
    [...chDirRaw.entries()].map(([key, raw]) => ({ key, raw }))
  );
  const dirObjNorm = normalizeDirectionObjectiveScores(
    [...dirObjRaw.entries()].map(([key, raw]) => ({ key, raw }))
  );

  const out: ImpactPathEdge[] = [];
  for (const s of suggestions) {
    if (!isImpactPathEdgeAnalysable(s.sourceId, s.targetId, analysabilityByNodeId)) continue;

    const rk = reviewKey(s.kind, s.sourceId, s.targetId);
    const review = reviewByKey.get(rk);
    if (review?.status === "accepted" || existingKeys.has(s.id)) continue;

    let score = s.score;
    if (s.kind === "analysis_to_challenge") {
      score = s.score;
    } else if (s.kind === "challenge_to_direction") {
      score = chDirNorm.get(`${s.sourceId}:${s.targetId}`) ?? 0;
    } else if (s.kind === "direction_to_objective") {
      score = dirObjNorm.get(`${s.sourceId}:${s.targetId}`) ?? 0;
    }

    const reviewStatus: ImpactPathReviewStatus = review?.status ?? "pending";
    if (
      reviewStatus === "rejected" ||
      reviewStatus === "deferred" ||
      score >= IMPACT_PATH_SUGGESTION_MIN_SCORE ||
      review
    ) {
      out.push({
        ...s,
        score,
        status: scoreToImpactPathStatus(score),
        reviewStatus,
        reviewNote: review?.note ?? null,
      });
    }
  }

  return out;
}

function buildNodes(
  input: BuildImpactPathGraphInput,
  analysabilityByNodeId: Map<string, { isAnalysable: boolean; hintDe: string; displayLabelDe: string }>
): ImpactPathNode[] {
  const withAnalysability = (
    node: Omit<ImpactPathNode, "isAnalysable" | "analysabilityLabelDe" | "analysabilityHintDe">
  ): ImpactPathNode => {
    const quality = analysabilityByNodeId.get(node.id);
    if (!quality || quality.isAnalysable) return { ...node, isAnalysable: true };
    return {
      ...node,
      isAnalysable: false,
      analysabilityLabelDe: quality.displayLabelDe,
      analysabilityHintDe: quality.hintDe,
    };
  };

  const nodes: ImpactPathNode[] = [];
  for (const e of input.entries) {
    nodes.push(
      withAnalysability({
        id: e.id,
        kind: "analysis_entry",
        title: e.title,
        description: e.description ?? null,
      })
    );
  }
  for (const c of input.challenges) {
    nodes.push(
      withAnalysability({
        id: c.id,
        kind: "challenge",
        title: c.title,
        description: c.description ?? null,
      })
    );
  }
  for (const d of input.directions) {
    nodes.push(
      withAnalysability({
        id: d.id,
        kind: "direction",
        title: d.title,
        description: d.description ?? null,
        lifecycleLabel: getLifecycleLabelDe(d.versioning?.identity_lifecycle_state),
      })
    );
  }
  for (const o of input.objectives) {
    nodes.push(
      withAnalysability({
        id: o.id,
        kind: "objective",
        title: o.title,
        description: o.description ?? null,
        lifecycleLabel: getLifecycleLabelDe(o.versioning?.identity_lifecycle_state),
      })
    );
  }
  return nodes;
}

function weakestEdgeIdFromScores(
  edgeIds: [string, string, string],
  scores: [number, number, number]
): string {
  let minScore = Infinity;
  let weakest = edgeIds[0];
  for (let i = 0; i < scores.length; i += 1) {
    const s = scores[i];
    if (s > 0 && s < minScore) {
      minScore = s;
      weakest = edgeIds[i];
    }
  }
  return weakest;
}

function buildChains(edges: ImpactPathEdge[]): ImpactPathChain[] {
  const analysisToCh = edges.filter((e) => e.kind === "analysis_to_challenge");
  const chToDir = edges.filter((e) => e.kind === "challenge_to_direction");
  const dirToObj = edges.filter((e) => e.kind === "direction_to_objective");

  const chains: ImpactPathChain[] = [];
  const seen = new Set<string>();

  for (const e1 of analysisToCh) {
    const challengeId = e1.targetId;
    for (const e2 of chToDir.filter((e) => e.sourceId === challengeId)) {
      for (const e3 of dirToObj.filter((e) => e.sourceId === e2.targetId)) {
        const chainId = `${e1.sourceId}:${challengeId}:${e2.targetId}:${e3.targetId}`;
        if (seen.has(chainId)) continue;
        seen.add(chainId);

        const scores: [number, number, number] = [e1.score, e2.score, e3.score];
        const edgeIds: [string, string, string] = [e1.id, e2.id, e3.id];
        const pathScore = pathScoreFromEdgeScores(scores);

        chains.push({
          id: chainId,
          analysisEntryId: e1.sourceId,
          challengeId,
          directionId: e2.targetId,
          objectiveId: e3.targetId,
          edgeIds,
          pathScore,
          status: scoreToImpactPathStatus(pathScore),
          weakestEdgeId: weakestEdgeIdFromScores(edgeIds, scores),
          allExisting:
            e1.state === "existing" && e2.state === "existing" && e3.state === "existing",
        });
      }
    }
  }

  return chains.sort((a, b) => b.pathScore - a.pathScore);
}

function computeKpis(
  nodes: ImpactPathNode[],
  edges: ImpactPathEdge[],
  chains: ImpactPathChain[],
  analysabilityByNodeId: Map<string, { isAnalysable: boolean }>
): ImpactPathGraphKpis {
  const connectedNodeIds = new Set<string>();
  for (const e of edges) {
    connectedNodeIds.add(e.sourceId);
    connectedNodeIds.add(e.targetId);
  }

  const isScorableEdge = (edge: ImpactPathEdge) =>
    isImpactPathEdgeAnalysable(edge.sourceId, edge.targetId, analysabilityByNodeId);

  const openSuggestions = edges.filter(
    (e) =>
      e.state === "suggested" &&
      (e.reviewStatus === "pending" || !e.reviewStatus) &&
      e.score >= IMPACT_PATH_SUGGESTION_MIN_SCORE &&
      isScorableEdge(e)
  ).length;

  const weakExistingConnections = edges.filter(
    (e) =>
      e.state === "existing" &&
      (e.status === "red" || e.status === "yellow") &&
      isScorableEdge(e)
  ).length;

  const unconnectedObjects = nodes.filter((n) => !connectedNodeIds.has(n.id)).length;

  const nonAnalysableObjects = nodes.filter((n) => n.isAnalysable === false).length;

  const openReviews =
    edges.filter(
      (e) => e.state === "suggested" && e.reviewStatus === "deferred" && isScorableEdge(e)
    ).length + openSuggestions;

  const completePaths = chains.filter(
    (c) => c.allExisting && c.edgeIds[0] !== "" && c.pathScore >= 70
  ).length;

  return {
    completePaths,
    openSuggestions,
    weakExistingConnections,
    unconnectedObjects,
    openReviews,
    nonAnalysableObjects,
  };
}

export function buildImpactPathGraph(input: BuildImpactPathGraphInput): ImpactPathGraph {
  const analysabilityByNodeId = buildImpactPathAnalysabilityMap(input);
  const existingKeys = new Set<string>();
  const chDirMatrix = challengeDirectionMatrixRaw(input.programMatrix);
  const dirObjMatrix = directionObjectiveMatrixRaw(input.programMatrix);

  const existingEdges = [
    ...buildExistingAnalysisToChallengeEdges(input, existingKeys, analysabilityByNodeId),
    ...buildChallengeDirectionEdges(input, chDirMatrix, existingKeys),
    ...buildDirectionObjectiveEdges(input, dirObjMatrix, existingKeys),
  ];

  const rawSuggestions = computeImpactPathSuggestions({
    entries: input.entries,
    challenges: input.challenges,
    directions: input.directions,
    objectives: input.objectives,
    challengeAnalysisEntries: input.challengeAnalysisEntries,
    clusterMembers: input.clusterMembers,
    challengeCandidates: input.challengeCandidates,
    programMatrix: input.programMatrix,
    insights: input.insights,
    existingEdgeKeys: existingKeys,
    analysabilityByNodeId,
  });

  const suggestionEdges = applyReviewsToSuggestions(
    rawSuggestions,
    input.pathLinkReviews,
    existingKeys,
    analysabilityByNodeId
  );

  const edges = [...existingEdges, ...suggestionEdges].sort(
    (a, b) => b.score - a.score || a.kind.localeCompare(b.kind, "de")
  );

  const nodes = buildNodes(input, analysabilityByNodeId);
  const chains = buildChains(edges);
  const kpis = computeKpis(nodes, edges, chains, analysabilityByNodeId);

  return { nodes, edges, chains, kpis };
}
