import { isStrategicDirectionEligibleForPrograms } from "@/lib/strategy-objects/direction-program-eligibility";
import type { StrategyObjectVersioningMeta } from "@/lib/strategy-objects/types";
import {
  buildDirectionMetrics,
  type ChallengeDirectionLinkInput,
  type ChallengeInput,
  type DirectionObjectiveLinkInput,
  type ObjectiveInput,
} from "@/lib/strategy-cycle/strategic-design-insights";
import { canonicalizeStrategicThemes, strategicThemeAffinity } from "@/lib/strategy-cycle/design-field-canonicalization";

const CLUSTER_SIMILARITY_THRESHOLD = 0.12;
const ABSORB_SINGLETON_THRESHOLD = 0.06;
const STRONG_MATCH_SCORE = 0.75;
const MEDIUM_MATCH_SCORE = 0.55;
const MAX_CLUSTER_CANDIDATES = 12;
const TARGET_FIELD_MIN = 2;
const TARGET_FIELD_MAX = 5;
const MIN_CLUSTER_SIZE = 2;
const MAX_KEYWORD_TOKENS = 8;

export type DesignFieldSuggestionsPrepDirection = {
  id: string;
  title: string;
  description?: string | null;
  grouping?: string | null;
  versioning?: StrategyObjectVersioningMeta | null;
};

export type DesignFieldSuggestionsPrepInput = {
  strategicDirections: DesignFieldSuggestionsPrepDirection[];
  challenges: ChallengeInput[];
  objectives: ObjectiveInput[];
  challengeDirectionLinks: ChallengeDirectionLinkInput[];
  directionObjectiveLinks: DirectionObjectiveLinkInput[];
  directionIndustries: Array<{ strategic_direction_id: string; industry_id: string }>;
  directionBusinessModels: Array<{ strategic_direction_id: string; business_model_id: string }>;
  industryLabelsById: Record<string, string>;
  businessModelLabelsById: Record<string, string>;
};

export type DirectionSummary = {
  directionId: string;
  title: string;
  score: number;
  topChallenges: string[];
  topObjectives: string[];
  industryLabels: string[];
  businessModelLabels: string[];
  keywordTokens: string[];
};

export type ClusterSignal =
  | "shared_challenges"
  | "shared_objectives"
  | "shared_industries"
  | "shared_business_models"
  | "keyword_overlap"
  | "strategic_family"
  | "canonical_theme";

export type ClusterCandidate = {
  candidateId: string;
  directionIds: string[];
  signals: ClusterSignal[];
  score: number;
  reasonDe: string;
};

export type DesignFieldSuggestionsPrepResult = {
  activeDirections: DesignFieldSuggestionsPrepDirection[];
  directionSummaries: DirectionSummary[];
  clusterCandidates: ClusterCandidate[];
  managementPartitions: ClusterCandidate[];
};

function hasGrouping(value: string | null | undefined): boolean {
  return Boolean(String(value ?? "").trim());
}

export function filterActiveStrategicDirectionsForDesignFieldSuggestions(
  directions: DesignFieldSuggestionsPrepDirection[]
): DesignFieldSuggestionsPrepDirection[] {
  return directions.filter((d) => isStrategicDirectionEligibleForPrograms(d.versioning));
}

function extractKeywordTokens(title: string, description?: string | null): string[] {
  const text = `${title} ${description ?? ""}`.toLowerCase();
  const tokens = text
    .split(/[^a-zäöüß0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
  return [...new Set(tokens)].slice(0, MAX_KEYWORD_TOKENS);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union <= 0 ? 0 : intersection / union;
}

class UnionFind {
  private parent = new Map<string, string>();

  add(id: string): void {
    if (!this.parent.has(id)) this.parent.set(id, id);
  }

  find(id: string): string {
    const parent = this.parent.get(id);
    if (!parent || parent === id) return id;
    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootB, rootA);
  }

  groups(): Map<string, string[]> {
    const grouped = new Map<string, string[]>();
    for (const id of this.parent.keys()) {
      const root = this.find(id);
      const arr = grouped.get(root) ?? [];
      arr.push(id);
      grouped.set(root, arr);
    }
    return grouped;
  }
}

function buildIdSetsByDirection(
  directionIds: string[],
  links: Array<{ strategic_direction_id: string; id: string }>
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const directionId of directionIds) {
    map.set(directionId, new Set());
  }
  for (const link of links) {
    const set = map.get(link.strategic_direction_id);
    if (set) set.add(link.id);
  }
  return map;
}

const STRATEGIC_FAMILY_KEYWORDS: Array<{ id: string; keywords: string[] }> = [
  {
    id: "cost_efficiency",
    keywords: ["opex", "kosten", "cost", "effizienz", "efficiency", "produktiv", "production", "produktion"],
  },
  {
    id: "digital",
    keywords: ["digital", "system", "data", "daten", "integration", "automation", "automatisierung", "it"],
  },
  {
    id: "market_customer",
    keywords: ["markt", "market", "kunde", "customer", "wachstum", "growth", "sales", "vertrieb", "region"],
  },
  {
    id: "organisation",
    keywords: ["organisation", "organization", "führung", "leadership", "kultur", "culture", "personal", "staff", "fähigkeit", "capability"],
  },
  {
    id: "product_engineering",
    keywords: ["produkt", "product", "engineering", "technolog", "innovation", "applikation", "application"],
  },
  {
    id: "governance",
    keywords: ["governance", "prozess", "process", "standard", "operating", "compliance"],
  },
];

export function strategicFamilyMatchScore(textA: string, textB: string): {
  score: number;
  familyId: string | null;
} {
  const a = textA.toLowerCase();
  const b = textB.toLowerCase();
  for (const family of STRATEGIC_FAMILY_KEYWORDS) {
    const aHit = family.keywords.some((k) => a.includes(k));
    const bHit = family.keywords.some((k) => b.includes(k));
    if (aHit && bHit) return { score: MEDIUM_MATCH_SCORE, familyId: family.id };
  }
  return { score: 0, familyId: null };
}

function pairSimilarity(
  aId: string,
  bId: string,
  challengeSets: Map<string, Set<string>>,
  objectiveSets: Map<string, Set<string>>,
  industrySets: Map<string, Set<string>>,
  bmSets: Map<string, Set<string>>,
  keywordSets: Map<string, Set<string>>,
  textByDirectionId: Map<string, string>
): { score: number; signals: ClusterSignal[] } {
  const signals: ClusterSignal[] = [];
  let score = 0;

  const sharedChallenges = jaccard(challengeSets.get(aId) ?? new Set(), challengeSets.get(bId) ?? new Set());
  if (sharedChallenges > 0) {
    signals.push("shared_challenges");
    score += sharedChallenges * 0.35;
  }

  const sharedObjectives = jaccard(objectiveSets.get(aId) ?? new Set(), objectiveSets.get(bId) ?? new Set());
  if (sharedObjectives > 0) {
    signals.push("shared_objectives");
    score += sharedObjectives * 0.3;
  }

  const sharedIndustries = jaccard(industrySets.get(aId) ?? new Set(), industrySets.get(bId) ?? new Set());
  if (sharedIndustries > 0) {
    signals.push("shared_industries");
    score += sharedIndustries * 0.15;
  }

  const sharedBms = jaccard(bmSets.get(aId) ?? new Set(), bmSets.get(bId) ?? new Set());
  if (sharedBms > 0) {
    signals.push("shared_business_models");
    score += sharedBms * 0.1;
  }

  const keywordOverlap = jaccard(keywordSets.get(aId) ?? new Set(), keywordSets.get(bId) ?? new Set());
  if (keywordOverlap > 0) {
    signals.push("keyword_overlap");
    score += keywordOverlap * 0.15;
  }

  const familyMatch = strategicFamilyMatchScore(
    textByDirectionId.get(aId) ?? "",
    textByDirectionId.get(bId) ?? ""
  );
  if (familyMatch.score > 0) {
    signals.push("strategic_family");
    score = Math.max(score, familyMatch.score);
  }

  const themesA = canonicalizeStrategicThemes(textByDirectionId.get(aId) ?? "");
  const themesB = canonicalizeStrategicThemes(textByDirectionId.get(bId) ?? "");
  const themeOverlap = strategicThemeAffinity(themesA, themesB);
  if (themeOverlap > 0) {
    signals.push("canonical_theme");
    score += themeOverlap * 0.45;
    score = Math.max(score, themeOverlap >= MEDIUM_MATCH_SCORE ? MEDIUM_MATCH_SCORE : score);
  }
  if (
    themesA.includes("organization_leadership") &&
    themesB.includes("organization_leadership")
  ) {
    score = Math.max(score, 0.65);
  }

  if (score >= STRONG_MATCH_SCORE && signals.length === 0) {
    signals.push("keyword_overlap");
  }

  return { score: Number(Math.min(score, 1).toFixed(3)), signals };
}

function pairScoreLookup(
  pairScores: Array<{ a: string; b: string; score: number }>
): (a: string, b: string) => number {
  const map = new Map<string, number>();
  for (const p of pairScores) {
    map.set(`${p.a}::${p.b}`, p.score);
    map.set(`${p.b}::${p.a}`, p.score);
  }
  return (a, b) => map.get(`${a}::${b}`) ?? 0;
}

function avgInterClusterScore(
  clusterA: string[],
  clusterB: string[],
  scoreOf: (a: string, b: string) => number
): number {
  if (clusterA.length === 0 || clusterB.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (const a of clusterA) {
    for (const b of clusterB) {
      sum += scoreOf(a, b);
      count += 1;
    }
  }
  return count > 0 ? sum / count : 0;
}

function absorbSingletons(
  groups: string[][],
  scoreOf: (a: string, b: string) => number
): string[][] {
  const mutable = groups.map((g) => [...g]);
  const singletons = mutable.filter((g) => g.length === 1);
  const clusters = mutable.filter((g) => g.length >= 2);
  if (clusters.length === 0) return mutable;

  for (const singleton of singletons) {
    const id = singleton[0];
    let bestIdx = -1;
    let bestScore = ABSORB_SINGLETON_THRESHOLD;
    for (let i = 0; i < clusters.length; i += 1) {
      const avg = avgInterClusterScore([id], clusters[i], scoreOf);
      if (avg > bestScore) {
        bestScore = avg;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) clusters[bestIdx].push(id);
    else clusters.push([id]);
  }

  return clusters;
}

function mergeClustersToTarget(
  groups: string[][],
  scoreOf: (a: string, b: string) => number,
  maxClusters: number
): string[][] {
  let clusters = groups.map((g) => [...g]).filter((g) => g.length > 0);
  while (clusters.length > maxClusters) {
    let bestI = 0;
    let bestJ = 1;
    let bestScore = -1;
    for (let i = 0; i < clusters.length; i += 1) {
      for (let j = i + 1; j < clusters.length; j += 1) {
        const score = avgInterClusterScore(clusters[i], clusters[j], scoreOf);
        if (score > bestScore) {
          bestScore = score;
          bestI = i;
          bestJ = j;
        }
      }
    }
    const merged = [...clusters[bestI], ...clusters[bestJ]];
    clusters = clusters.filter((_, idx) => idx !== bestI && idx !== bestJ);
    clusters.push(merged);
  }
  return clusters;
}

function seedPartition(
  directionIds: string[],
  targetCount: number,
  scoreOf: (a: string, b: string) => number
): string[][] {
  if (directionIds.length <= targetCount) {
    return directionIds.map((id) => [id]);
  }

  const centrality = directionIds.map((id) => {
    const total = directionIds
      .filter((other) => other !== id)
      .reduce((sum, other) => sum + scoreOf(id, other), 0);
    return { id, total };
  });
  centrality.sort((a, b) => b.total - a.total);
  const seeds = centrality.slice(0, targetCount).map((c) => c.id);
  const groups = seeds.map((seed) => [seed]);

  for (const id of directionIds) {
    if (seeds.includes(id)) continue;
    let bestIdx = 0;
    let bestScore = -1;
    for (let i = 0; i < seeds.length; i += 1) {
      const score = scoreOf(id, seeds[i]);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    groups[bestIdx].push(id);
  }

  return groups.filter((g) => g.length > 0);
}

function mergeSingletonPartitions(
  groups: string[][],
  scoreOf: (a: string, b: string) => number
): string[][] {
  const multi = groups.filter((g) => g.length >= MIN_CLUSTER_SIZE).map((g) => [...g]);
  const singles = groups.filter((g) => g.length === 1).map((g) => g[0]);

  for (const singleId of singles) {
    let bestIdx = -1;
    let bestScore = ABSORB_SINGLETON_THRESHOLD;
    for (let i = 0; i < multi.length; i += 1) {
      const avg = avgInterClusterScore([singleId], multi[i], scoreOf);
      if (avg > bestScore) {
        bestScore = avg;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      multi[bestIdx].push(singleId);
    } else if (multi.length > 0) {
      multi[multi.length - 1].push(singleId);
    } else {
      multi.push([singleId]);
    }
  }

  return multi.filter((g) => g.length > 0);
}

function buildManagementPartitions(
  directionIds: string[],
  pairScores: Array<{ a: string; b: string; score: number; signals: ClusterSignal[] }>
): ClusterCandidate[] {
  if (directionIds.length < 2) return [];

  const scoreOf = pairScoreLookup(pairScores);
  const uf = new UnionFind();
  for (const id of directionIds) uf.add(id);

  for (const pair of pairScores) {
    if (pair.score >= CLUSTER_SIMILARITY_THRESHOLD) uf.union(pair.a, pair.b);
  }

  let groups = [...uf.groups().values()].map((ids) => [...ids].sort());
  groups = absorbSingletons(groups, scoreOf);
  groups = mergeClustersToTarget(groups, scoreOf, TARGET_FIELD_MAX);

  const targetCount = Math.min(
    TARGET_FIELD_MAX,
    Math.max(TARGET_FIELD_MIN, Math.round(directionIds.length / 5))
  );
  if (groups.length < TARGET_FIELD_MIN && directionIds.length >= TARGET_FIELD_MIN) {
    groups = seedPartition(directionIds, targetCount, scoreOf);
  }

  groups = mergeSingletonPartitions(groups, scoreOf);

  return groups
    .filter((ids) => ids.length > 0)
    .map((ids, index) => {
      const relevantPairs = pairScores.filter((p) => ids.includes(p.a) && ids.includes(p.b));
      const score =
        relevantPairs.length > 0
          ? relevantPairs.reduce((sum, p) => sum + p.score, 0) / relevantPairs.length
          : CLUSTER_SIMILARITY_THRESHOLD;
      const signals = [...new Set(relevantPairs.flatMap((p) => p.signals))];
      return {
        candidateId: `mgmt-partition-${index + 1}`,
        directionIds: ids,
        signals,
        score: Number(score.toFixed(3)),
        reasonDe: `Management-Verdichtung (${ids.length} SR): ${buildClusterReasonDe(signals)}`,
      };
    })
    .sort((a, b) => b.directionIds.length - a.directionIds.length || b.score - a.score);
}

function buildClusterReasonDe(signals: ClusterSignal[]): string {
  const parts: string[] = [];
  if (signals.includes("shared_challenges")) parts.push("gemeinsame Herausforderungen");
  if (signals.includes("shared_objectives")) parts.push("gemeinsame Ziele");
  if (signals.includes("shared_industries")) parts.push("gleiche Branchen");
  if (signals.includes("shared_business_models")) parts.push("gleiche Geschäftsmodelle");
  if (signals.includes("keyword_overlap")) parts.push("ähnliche Begriffe");
  if (signals.includes("strategic_family")) parts.push("strategische Familie");
  if (signals.includes("canonical_theme")) parts.push("kanonische Themen");
  if (parts.length === 0) return "Schwache inhaltliche Nähe über mehrere Signale.";
  return `Cluster wegen ${parts.join(", ")}.`;
}

export function prepareDesignFieldSuggestionsInput(
  input: DesignFieldSuggestionsPrepInput
): DesignFieldSuggestionsPrepResult {
  const activeDirections = filterActiveStrategicDirectionsForDesignFieldSuggestions(
    input.strategicDirections
  );
  const activeIds = new Set(activeDirections.map((d) => d.id));

  const metrics = buildDirectionMetrics(
    activeDirections.map((d) => ({ id: d.id, title: d.title, grouping: d.grouping })),
    input.challenges,
    input.objectives,
    input.challengeDirectionLinks.filter((l) => activeIds.has(l.strategic_direction_id)),
    input.directionObjectiveLinks.filter((l) => activeIds.has(l.strategic_direction_id))
  );
  const metricsById = new Map(metrics.map((m) => [m.directionId, m] as const));

  const directionSummaries: DirectionSummary[] = activeDirections.map((dir) => {
    const m = metricsById.get(dir.id);
    const industryIds = input.directionIndustries
      .filter((r) => r.strategic_direction_id === dir.id)
      .map((r) => r.industry_id);
    const bmIds = input.directionBusinessModels
      .filter((r) => r.strategic_direction_id === dir.id)
      .map((r) => r.business_model_id);

    return {
      directionId: dir.id,
      title: dir.title,
      score: m?.score ?? 0,
      topChallenges: (m?.linkedChallengeTitles ?? []).slice(0, 3),
      topObjectives: (m?.linkedObjectiveTitles ?? []).slice(0, 3),
      industryLabels: industryIds
        .map((id) => input.industryLabelsById[id])
        .filter((label): label is string => Boolean(label))
        .slice(0, 3),
      businessModelLabels: bmIds
        .map((id) => input.businessModelLabelsById[id])
        .filter((label): label is string => Boolean(label))
        .slice(0, 3),
      keywordTokens: extractKeywordTokens(dir.title, dir.description),
    };
  });

  const directionIds = activeDirections.map((d) => d.id);
  const challengeSets = buildIdSetsByDirection(
    directionIds,
    input.challengeDirectionLinks
      .filter((l) => activeIds.has(l.strategic_direction_id))
      .map((l) => ({ strategic_direction_id: l.strategic_direction_id, id: l.strategic_challenge_id }))
  );
  const objectiveSets = buildIdSetsByDirection(
    directionIds,
    input.directionObjectiveLinks
      .filter((l) => activeIds.has(l.strategic_direction_id))
      .map((l) => ({ strategic_direction_id: l.strategic_direction_id, id: l.objective_id }))
  );
  const industrySets = buildIdSetsByDirection(
    directionIds,
    input.directionIndustries
      .filter((l) => activeIds.has(l.strategic_direction_id))
      .map((l) => ({ strategic_direction_id: l.strategic_direction_id, id: l.industry_id }))
  );
  const bmSets = buildIdSetsByDirection(
    directionIds,
    input.directionBusinessModels
      .filter((l) => activeIds.has(l.strategic_direction_id))
      .map((l) => ({ strategic_direction_id: l.strategic_direction_id, id: l.business_model_id }))
  );
  const keywordSets = new Map(
    directionSummaries.map((s) => [s.directionId, new Set(s.keywordTokens)] as const)
  );
  const textByDirectionId = new Map(
    activeDirections.map((d) => {
      const m = metricsById.get(d.id);
      const challengeText = (m?.linkedChallengeTitles ?? []).join(" ");
      const objectiveText = (m?.linkedObjectiveTitles ?? []).join(" ");
      return [
        d.id,
        `${d.title} ${d.description ?? ""} ${challengeText} ${objectiveText}`.toLowerCase(),
      ] as const;
    })
  );

  const uf = new UnionFind();
  for (const id of directionIds) uf.add(id);

  const pairScores: Array<{ a: string; b: string; score: number; signals: ClusterSignal[] }> = [];
  for (let i = 0; i < directionIds.length; i += 1) {
    for (let j = i + 1; j < directionIds.length; j += 1) {
      const a = directionIds[i];
      const b = directionIds[j];
      const sim = pairSimilarity(
        a,
        b,
        challengeSets,
        objectiveSets,
        industrySets,
        bmSets,
        keywordSets,
        textByDirectionId
      );
      pairScores.push({ a, b, score: sim.score, signals: sim.signals });
      if (sim.score >= CLUSTER_SIMILARITY_THRESHOLD) uf.union(a, b);
    }
  }

  const grouped = [...uf.groups().values()].filter((ids) => ids.length >= 2);
  const clusterCandidates: ClusterCandidate[] = grouped
    .map((ids, index) => {
      const sortedIds = [...ids].sort();
      const relevantPairs = pairScores.filter(
        (p) => sortedIds.includes(p.a) && sortedIds.includes(p.b)
      );
      const score =
        relevantPairs.length > 0
          ? relevantPairs.reduce((sum, p) => sum + p.score, 0) / relevantPairs.length
          : CLUSTER_SIMILARITY_THRESHOLD;
      const signals = [...new Set(relevantPairs.flatMap((p) => p.signals))];
      return {
        candidateId: `cluster-${index + 1}`,
        directionIds: sortedIds,
        signals,
        score: Number(score.toFixed(3)),
        reasonDe: buildClusterReasonDe(signals),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CLUSTER_CANDIDATES);

  const managementPartitions = buildManagementPartitions(directionIds, pairScores);

  return {
    activeDirections,
    directionSummaries,
    clusterCandidates,
    managementPartitions,
  };
}

export function directionHasExistingGrouping(
  directions: DesignFieldSuggestionsPrepDirection[],
  directionId: string
): boolean {
  const dir = directions.find((d) => d.id === directionId);
  return hasGrouping(dir?.grouping);
}
