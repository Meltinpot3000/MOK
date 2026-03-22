import type { CorrelationSummaryResult } from "@/lib/strategy-cycle/correlation";
import { directionPriorityValue, matrixCoverageFactorFromLevel } from "@/lib/strategy-cycle/program-matrix";
import { STRATEGIC_DESIGN_INSIGHT_THRESHOLDS } from "@/lib/strategy-cycle/strategic-design-insight-thresholds";

const T = STRATEGIC_DESIGN_INSIGHT_THRESHOLDS;

export function normalizedCoverageWeight(level: string | null | undefined): number {
  return matrixCoverageFactorFromLevel(level) / 2;
}

function num(v: number | string | null | undefined, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function importanceValue(raw: number | string | null | undefined): number {
  const n = num(raw, 3);
  return n > 0 ? n : 3;
}

export type CoverageBand = "none" | "weak" | "medium" | "strong";

export function coverageBandFromWMax(wMax: number): CoverageBand {
  if (wMax <= 0) return "none";
  if (wMax < T.coverageBandWeakUpper) return "weak";
  if (wMax < T.coverageBandStrongMin) return "medium";
  return "strong";
}

export type ChallengeInput = {
  id: string;
  title: string;
  challenge_score: number | string | null | undefined;
};

export type ObjectiveInput = {
  id: string;
  title: string;
  importance_score?: number | string | null;
  status?: string | null;
};

export type StrategicDirectionInput = {
  id: string;
  title: string;
  priority?: number | string | null;
};

export type ChallengeDirectionLinkInput = {
  strategic_challenge_id: string;
  strategic_direction_id: string;
  contribution_level?: string | null;
};

export type DirectionObjectiveLinkInput = {
  strategic_direction_id: string;
  objective_id: string;
  contribution_level?: string | null;
};

export type TopDirectionInsight = {
  directionId: string;
  title: string;
  score: number;
  challengeImpact: number;
  objectiveAlignment: number;
  linkedChallengeTitles: string[];
  explanationDe: string;
};

export type UnaddressedChallengeInsight = {
  challengeId: string;
  title: string;
  challengeScore: number;
  coverage: number;
  coverageBand: CoverageBand;
  explanationDe: string;
};

export type LimitedChallengeBackingObjectiveInsight = {
  objectiveId: string;
  title: string;
  directionLinkageWeight: number;
  challengeBacking: number;
  explanationDe: string;
};

export type StrategicDesignConflict =
  | {
      type: "misaligned_direction";
      directionId: string;
      directionTitle: string;
      challengeImpact: number;
      objectiveAlignment: number;
      explanationDe: string;
      explanationEn?: string;
    }
  | {
      type: "unsupported_objective";
      objectiveId: string;
      objectiveTitle: string;
      explanationDe: string;
      explanationEn?: string;
    }
  | {
      type: "correlation_weak";
      challengeId: string;
      objectiveId: string;
      challengeTitle: string;
      objectiveTitle: string;
      score: number;
      explanationDe: string;
      explanationEn?: string;
    };

export type StrategicDesignKpis = {
  /** Anteil Challenges mit mind. einem Link und max(w) >= coverageKpiMinW, Prozent 0–100 */
  coverageChallengeShare: number | null;
  criticalGaps: number;
  focusIndex: number | null;
  objectiveAlignmentMaturity: number | null;
  topDirectionsStrongObjectiveLinkShare: number | null;
  averageObjectiveSupport: number | null;
  correlationConflictCount: number;
  coverageExplanationDe: string;
  focusExplanationDe: string;
  objectiveSupportExplanationDe: string;
};

export type StrategicDesignInsightsResult = {
  topDirections: TopDirectionInsight[];
  unaddressedChallenges: UnaddressedChallengeInsight[];
  limitedChallengeBackingObjectives: LimitedChallengeBackingObjectiveInsight[];
  conflicts: StrategicDesignConflict[];
  kpis: StrategicDesignKpis;
};

export type ComputeStrategicDesignInsightsInput = {
  challenges: ChallengeInput[];
  objectives: ObjectiveInput[];
  strategicDirections: StrategicDirectionInput[];
  challengeDirectionLinks: ChallengeDirectionLinkInput[];
  directionObjectiveLinks: DirectionObjectiveLinkInput[];
  correlationSummary: CorrelationSummaryResult;
};

type DirectionMetrics = {
  directionId: string;
  title: string;
  priority: number | string | null | undefined;
  challengeImpact: number;
  objectiveAlignment: number;
  theoreticalMaxObjectiveAlignment: number;
  score: number;
  linkedChallengeTitles: string[];
  hasStrongObjectiveLink: boolean;
};

function buildDirectionMetrics(
  directions: StrategicDirectionInput[],
  challenges: ChallengeInput[],
  objectives: ObjectiveInput[],
  challengeDirectionLinks: ChallengeDirectionLinkInput[],
  directionObjectiveLinks: DirectionObjectiveLinkInput[]
): DirectionMetrics[] {
  const chById = new Map(challenges.map((c) => [c.id, c] as const));
  const objById = new Map(objectives.map((o) => [o.id, o] as const));

  const chLinksByDir = new Map<string, ChallengeDirectionLinkInput[]>();
  for (const l of challengeDirectionLinks) {
    const arr = chLinksByDir.get(l.strategic_direction_id) ?? [];
    arr.push(l);
    chLinksByDir.set(l.strategic_direction_id, arr);
  }
  const objLinksByDir = new Map<string, DirectionObjectiveLinkInput[]>();
  for (const l of directionObjectiveLinks) {
    const arr = objLinksByDir.get(l.strategic_direction_id) ?? [];
    arr.push(l);
    objLinksByDir.set(l.strategic_direction_id, arr);
  }

  return directions.map((dir) => {
    const chLinks = chLinksByDir.get(dir.id) ?? [];
    const obLinks = objLinksByDir.get(dir.id) ?? [];

    let challengeImpact = 0;
    const seenCh = new Set<string>();
    const linkedChallengeTitles: string[] = [];
    for (const link of chLinks) {
      const ch = chById.get(link.strategic_challenge_id);
      if (!ch) continue;
      const w = normalizedCoverageWeight(link.contribution_level);
      challengeImpact += num(ch.challenge_score) * w;
      if (!seenCh.has(ch.id)) {
        seenCh.add(ch.id);
        linkedChallengeTitles.push(ch.title);
      }
    }

    let objectiveAlignment = 0;
    let theoreticalMaxObjectiveAlignment = 0;
    let hasStrongObjectiveLink = false;
    for (const link of obLinks) {
      const o = objById.get(link.objective_id);
      if (!o) continue;
      const imp = importanceValue(o.importance_score);
      const w = normalizedCoverageWeight(link.contribution_level);
      objectiveAlignment += imp * w;
      theoreticalMaxObjectiveAlignment += imp * 1;
      if (w >= T.topDirectionsStrongObjectiveLinkMinW) hasStrongObjectiveLink = true;
    }

    const base = challengeImpact * 0.7 + objectiveAlignment * 0.3;
    const score = base * directionPriorityValue(dir.priority);

    return {
      directionId: dir.id,
      title: dir.title,
      priority: dir.priority,
      challengeImpact,
      objectiveAlignment,
      theoreticalMaxObjectiveAlignment,
      score,
      linkedChallengeTitles,
      hasStrongObjectiveLink,
    };
  });
}

function challengeMaxW(
  challengeId: string,
  challengeDirectionLinks: ChallengeDirectionLinkInput[]
): number {
  let m = 0;
  for (const l of challengeDirectionLinks) {
    if (l.strategic_challenge_id !== challengeId) continue;
    m = Math.max(m, normalizedCoverageWeight(l.contribution_level));
  }
  return m;
}

function objectiveChallengeBacking(
  objectiveId: string,
  directionObjectiveLinks: DirectionObjectiveLinkInput[],
  challengeDirectionLinks: ChallengeDirectionLinkInput[],
  challenges: ChallengeInput[]
): { directionLinkageWeight: number; challengeBacking: number } {
  const objDirs: { dirId: string; w: number }[] = [];
  for (const l of directionObjectiveLinks) {
    if (l.objective_id !== objectiveId) continue;
    objDirs.push({ dirId: l.strategic_direction_id, w: normalizedCoverageWeight(l.contribution_level) });
  }
  const directionLinkageWeight = objDirs.reduce((s, x) => s + x.w, 0);
  if (objDirs.length === 0) return { directionLinkageWeight: 0, challengeBacking: 0 };

  const dirSet = new Set(objDirs.map((x) => x.dirId));
  const chById = new Map(challenges.map((c) => [c.id, c] as const));

  let challengeBacking = 0;
  for (const ch of challenges) {
    let best = 0;
    for (const l of challengeDirectionLinks) {
      if (l.strategic_challenge_id !== ch.id) continue;
      if (!dirSet.has(l.strategic_direction_id)) continue;
      const wCh = normalizedCoverageWeight(l.contribution_level);
      best = Math.max(best, num(ch.challenge_score) * wCh);
    }
    if (best > 0) challengeBacking += best;
  }

  return { directionLinkageWeight, challengeBacking };
}

function maxObjectiveLinkW(
  objectiveId: string,
  directionObjectiveLinks: DirectionObjectiveLinkInput[]
): number {
  let m = 0;
  for (const l of directionObjectiveLinks) {
    if (l.objective_id !== objectiveId) continue;
    m = Math.max(m, normalizedCoverageWeight(l.contribution_level));
  }
  return m;
}

function linkedDirectionScoresAvg(
  objectiveId: string,
  directionObjectiveLinks: DirectionObjectiveLinkInput[],
  directions: StrategicDirectionInput[]
): number | null {
  const dirIds = new Set<string>();
  for (const l of directionObjectiveLinks) {
    if (l.objective_id === objectiveId) dirIds.add(l.strategic_direction_id);
  }
  if (dirIds.size === 0) return null;
  const dirById = new Map(directions.map((d) => [d.id, d] as const));
  let sum = 0;
  let n = 0;
  for (const id of dirIds) {
    const d = dirById.get(id);
    if (!d) continue;
    sum += num(d.priority, 3);
    n += 1;
  }
  return n > 0 ? sum / n : null;
}

export function computeStrategicDesignInsights(input: ComputeStrategicDesignInsightsInput): StrategicDesignInsightsResult {
  const {
    challenges,
    objectives,
    strategicDirections,
    challengeDirectionLinks,
    directionObjectiveLinks,
    correlationSummary,
  } = input;

  const dirMetrics = buildDirectionMetrics(
    strategicDirections,
    challenges,
    objectives,
    challengeDirectionLinks,
    directionObjectiveLinks
  );

  const sortedByScore = [...dirMetrics].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "de"));
  const top5 = sortedByScore.slice(0, 5);

  const topDirections: TopDirectionInsight[] = top5.map((d) => {
    const show = d.linkedChallengeTitles.slice(0, 3);
    const explain =
      d.objectiveAlignment > d.challengeImpact * 0.85
        ? "Diese Stossrichtung verbindet Ziele und Herausforderungen relativ ausgewogen; sie taucht in der Priorisierung oben auf."
        : "Hohe Problemlast ueber Herausforderungen praegt diese Stossrichtung im Modell; sie erscheint deshalb vorn in der Kurzliste.";
    return {
      directionId: d.directionId,
      title: d.title,
      score: d.score,
      challengeImpact: d.challengeImpact,
      objectiveAlignment: d.objectiveAlignment,
      linkedChallengeTitles: show,
      explanationDe: explain,
    };
  });

  const unaddressedChallenges: UnaddressedChallengeInsight[] = [];
  for (const ch of challenges) {
    const score = num(ch.challenge_score);
    const cov = challengeMaxW(ch.id, challengeDirectionLinks);
    if (score > T.challengeHighScore && cov < T.unaddressedCoverageMaxW) {
      const band = coverageBandFromWMax(cov);
      unaddressedChallenges.push({
        challengeId: ch.id,
        title: ch.title,
        challengeScore: score,
        coverage: cov,
        coverageBand: band,
        explanationDe:
          "Priorisierte Herausforderung ohne stark verankerte Stossrichtung im Modell — strategische Folgeabschaetzung und Verknuepfungen pruefen.",
      });
    }
  }

  const limitedChallengeBackingObjectives: LimitedChallengeBackingObjectiveInsight[] = [];
  for (const o of objectives) {
    const { directionLinkageWeight, challengeBacking } = objectiveChallengeBacking(
      o.id,
      directionObjectiveLinks,
      challengeDirectionLinks,
      challenges
    );
    if (directionLinkageWeight < T.limitedChallengeBacking.minDirectionLinkageWeightSum) continue;
    if (challengeBacking > T.limitedChallengeBacking.maxChallengeBackingSum) continue;
    limitedChallengeBackingObjectives.push({
      objectiveId: o.id,
      title: o.title,
      directionLinkageWeight,
      challengeBacking,
      explanationDe:
        "Das Ziel ist ueber Stossrichtungen im Modell stark angebunden; die verknuepfte Challenge-Basis bleibt niedrig — Datenlage und fehlende Links pruefen, nicht die inhaltliche Prioritaet automatisch anzweifeln.",
    });
  }
  limitedChallengeBackingObjectives.sort(
    (a, b) => b.directionLinkageWeight - a.directionLinkageWeight || a.title.localeCompare(b.title, "de")
  );

  const conflicts: StrategicDesignConflict[] = [];

  for (const d of dirMetrics) {
    const hasLink =
      (chLinksByDirectionCount(d.directionId, challengeDirectionLinks) > 0 ||
        objLinksByDirectionCount(d.directionId, directionObjectiveLinks) > 0);
    if (!hasLink) continue;
    const { minChallengeImpact, maxObjectiveAlignmentForConflict, challengeImpactVsAlignmentRatio } = T.misalignment;
    if (
      d.challengeImpact >= minChallengeImpact &&
      d.objectiveAlignment <= maxObjectiveAlignmentForConflict &&
      d.challengeImpact >= d.objectiveAlignment * challengeImpactVsAlignmentRatio
    ) {
      conflicts.push({
        type: "misaligned_direction",
        directionId: d.directionId,
        directionTitle: d.title,
        challengeImpact: d.challengeImpact,
        objectiveAlignment: d.objectiveAlignment,
        explanationDe:
          "Hohe Problemlast ueber Herausforderungen, aber geringe Anbindung an Ziele ueber diese Stossrichtung — Alignment im Modell pruefen.",
        explanationEn: "High challenge impact but low objective support along this direction — review model linkage.",
      });
    }
  }

  for (const o of objectives) {
    const imp = importanceValue(o.importance_score);
    if (imp < T.objectiveHighImportanceMin) continue;
    const maxW = maxObjectiveLinkW(o.id, directionObjectiveLinks);
    const avgDir = linkedDirectionScoresAvg(o.id, directionObjectiveLinks, strategicDirections);
    const weakLinks = maxW < T.unsupportedObjectiveMaxMaxW;
    const weakDirections = avgDir != null && avgDir <= T.unsupportedObjectiveDirectionScoreMax;
    if (weakLinks || weakDirections) {
      conflicts.push({
        type: "unsupported_objective",
        objectiveId: o.id,
        objectiveTitle: o.title,
        explanationDe:
          "Wichtiges Ziel mit schwacher oder duenner Anbindung an Stossrichtungen im Modell — Unterstuetzung und Verknuepfungen pruefen.",
        explanationEn: "Important objective with limited directional backing in the model — review links.",
      });
    }
  }

  for (const cell of correlationSummary.weakCells) {
    conflicts.push({
      type: "correlation_weak",
      challengeId: cell.challengeId,
      objectiveId: cell.objectiveId,
      challengeTitle: cell.challengeTitle,
      objectiveTitle: cell.objectiveTitle,
      score: cell.score,
      explanationDe: `Korrelations-Hinweis (Paar Herausforderung / Ziel): schwache oder unsichere Uebereinstimmung im Modell (Score ${cell.score}).`,
      explanationEn: "Correlation view flags weak alignment for this challenge–objective pair.",
    });
  }

  conflicts.sort((a, b) => {
    const gap = (c: StrategicDesignConflict) =>
      c.type === "misaligned_direction" ? c.challengeImpact - c.objectiveAlignment : 0;
    const g = gap(b) - gap(a);
    if (g !== 0) return g;
    const title = (c: StrategicDesignConflict) =>
      c.type === "misaligned_direction"
        ? c.directionTitle
        : c.type === "unsupported_objective"
          ? c.objectiveTitle
          : `${c.challengeTitle} / ${c.objectiveTitle}`;
    return title(a).localeCompare(title(b), "de");
  });

  const nCh = challenges.length;
  let withAnchor = 0;
  for (const ch of challenges) {
    const mx = challengeMaxW(ch.id, challengeDirectionLinks);
    if (mx >= T.coverageKpiMinW) withAnchor += 1;
  }
  const coverageChallengeShare = nCh > 0 ? Math.round((withAnchor / nCh) * 100) : null;

  const sumAllScores = dirMetrics.reduce((s, d) => s + d.score, 0);
  const top3Sum = [...dirMetrics]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .reduce((s, d) => s + d.score, 0);
  const focusIndex =
    sumAllScores > 0 && Number.isFinite(sumAllScores) ? top3Sum / sumAllScores : null;

  let sumActualOA = 0;
  let sumTheoOA = 0;
  for (const d of top5) {
    sumActualOA += d.objectiveAlignment;
    sumTheoOA += d.theoreticalMaxObjectiveAlignment;
  }
  const objectiveAlignmentMaturity =
    sumTheoOA > 0 && Number.isFinite(sumTheoOA) ? Math.min(1, sumActualOA / sumTheoOA) : null;

  const strongShareCount = top5.filter((d) => d.hasStrongObjectiveLink).length;
  const topDirectionsStrongObjectiveLinkShare =
    top5.length > 0 ? strongShareCount / top5.length : null;

  const averageObjectiveSupport =
    top5.length > 0
      ? top5.reduce((s, d) => s + d.objectiveAlignment, 0) / top5.length
      : null;

  const kpis: StrategicDesignKpis = {
    coverageChallengeShare,
    criticalGaps: unaddressedChallenges.length,
    focusIndex,
    objectiveAlignmentMaturity,
    topDirectionsStrongObjectiveLinkShare,
    averageObjectiveSupport,
    correlationConflictCount: correlationSummary.conflictCount,
    coverageExplanationDe:
      "Anteil der Herausforderungen mit mindestens mittlerer oder starker Verankerung an einer Stossrichtung (normalisierte Link-Gewichte).",
    focusExplanationDe:
      "Anteil der Gesamt-Prioritaet der Stossrichtungen, der auf die drei staerksten Richtungen entfaellt.",
    objectiveSupportExplanationDe:
      "Reifegrad der Zielanbindung der fuenf fuehrenden Stossrichtungen: Ist-Alignment relativ zum maximal moeglichen bei gleichen Zielen und starken Links.",
  };

  return {
    topDirections,
    unaddressedChallenges,
    limitedChallengeBackingObjectives,
    conflicts,
    kpis,
  };
}

function chLinksByDirectionCount(dirId: string, links: ChallengeDirectionLinkInput[]): number {
  let n = 0;
  for (const l of links) {
    if (l.strategic_direction_id === dirId) n += 1;
  }
  return n;
}

function objLinksByDirectionCount(dirId: string, links: DirectionObjectiveLinkInput[]): number {
  let n = 0;
  for (const l of links) {
    if (l.strategic_direction_id === dirId) n += 1;
  }
  return n;
}
