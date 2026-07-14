import {
  evaluateDescriptionQuality,
  type DescriptionQualityIssue,
  type DescriptionQualityResult,
  type DescriptionSeverity,
  type StrategyObjectKind,
} from "@/lib/strategy-cycle/strategy-object-description-quality";

export type DescriptionQualityDisplayStatus = "ok" | "review" | "rework" | "no_data";

export type DescriptionQualityFilterValue =
  | ""
  | DescriptionQualityDisplayStatus
  | "needs_work";

export type DescriptionQualityViewModel = {
  isAnalysable: boolean;
  severity: DescriptionSeverity | null;
  displayStatus: DescriptionQualityDisplayStatus;
  displayLabelDe: string;
  hintDe: string;
  issues: DescriptionQualityIssue[];
  issueLabelsDe: string[];
  recommendationDe: string;
  sortRank: number;
};

const ISSUE_LABELS_DE: Record<DescriptionQualityIssue, string> = {
  missing: "Beschreibung fehlt",
  too_short: "Beschreibung ist sehr kurz",
  duplicate_of_title: "Beschreibung wiederholt den Titel",
  generic_only: "Beschreibung wirkt generisch",
  no_measurable_outcome: "Zielzustand oder Messbarkeit nicht erkennbar",
  no_analysis_basis: "Herkunft oder Begründung nicht nachvollziehbar",
  no_linked_scope: "Wirkungsfeld über Verknüpfungen nicht erkennbar",
};

const RECOMMENDATION_DE: Record<StrategyObjectKind, string> = {
  challenge:
    "Problem, Kontext, Auswirkung und strategische Relevanz ergänzen — ggf. Analysebezug dokumentieren.",
  direction:
    "Antwortlogik, beabsichtigte Wirkung und Zielbeitrag beschreiben.",
  objective: "Zielzustand, Nutzen und Erfolgskriterium ergänzen.",
  analysis_entry:
    "Erkenntnis, Kontext und strategische Relevanz ausreichend beschreiben.",
};

export function descriptionIssueLabelDe(issue: DescriptionQualityIssue): string {
  return ISSUE_LABELS_DE[issue];
}

export function descriptionQualityRecommendationDe(kind: StrategyObjectKind): string {
  return RECOMMENDATION_DE[kind];
}

export function toDescriptionQualityDisplayStatus(
  result: Pick<DescriptionQualityResult, "isAnalysable" | "severity">
): DescriptionQualityDisplayStatus {
  if (result.isAnalysable) return "ok";
  if (result.severity === "high") return "rework";
  if (result.severity === "medium") return "review";
  return "no_data";
}

export function descriptionQualityDisplayLabelDe(status: DescriptionQualityDisplayStatus): string {
  switch (status) {
    case "ok":
      return "OK";
    case "review":
      return "Prüfen";
    case "rework":
      return "Nacharbeiten";
    default:
      return "Keine Daten";
  }
}

function sortRankForStatus(status: DescriptionQualityDisplayStatus): number {
  switch (status) {
    case "rework":
      return 0;
    case "review":
      return 1;
    case "ok":
      return 2;
    default:
      return 3;
  }
}

export function buildDescriptionQualityViewModel(
  kind: StrategyObjectKind,
  input: Parameters<typeof evaluateDescriptionQuality>[0]
): DescriptionQualityViewModel {
  const result = evaluateDescriptionQuality(input);
  const displayStatus = toDescriptionQualityDisplayStatus(result);
  return {
    isAnalysable: result.isAnalysable,
    severity: result.severity,
    displayStatus,
    displayLabelDe: descriptionQualityDisplayLabelDe(displayStatus),
    hintDe: result.hintDe,
    issues: result.issues,
    issueLabelsDe: result.issues.map(descriptionIssueLabelDe),
    recommendationDe: descriptionQualityRecommendationDe(kind),
    sortRank: sortRankForStatus(displayStatus),
  };
}

export function matchesDescriptionQualityFilter(
  status: DescriptionQualityDisplayStatus,
  filter: DescriptionQualityFilterValue
): boolean {
  if (!filter) return true;
  if (filter === "needs_work") return status === "review" || status === "rework";
  return status === filter;
}

export function parseDescriptionQualityFilter(
  raw: string | undefined
): DescriptionQualityFilterValue {
  if (raw === "ok" || raw === "review" || raw === "rework" || raw === "needs_work") {
    return raw;
  }
  return "";
}

export const DESCRIPTION_QUALITY_FILTER_OPTIONS: Array<{
  value: DescriptionQualityFilterValue;
  label: string;
}> = [
  { value: "", label: "Alle" },
  { value: "ok", label: "OK" },
  { value: "review", label: "Prüfen" },
  { value: "rework", label: "Nacharbeiten" },
  { value: "needs_work", label: "Mit Prüfbedarf" },
];

export function descriptionQualityListHref(input: {
  l1: "objectives" | "strategic-directions";
  l2?: "challenges" | "design";
  objectId?: string;
  qualityFilter?: DescriptionQualityFilterValue;
}): string {
  const params = new URLSearchParams();
  params.set("l1", input.l1);
  if (input.l2) params.set("l2", input.l2);
  params.set("review", "description_quality");
  if (input.qualityFilter) params.set("qualityFilter", input.qualityFilter);
  if (input.objectId) params.set("objectId", input.objectId);
  return `/strategy-cycle?${params.toString()}`;
}

export function primaryDescriptionQualityListHref(counts: {
  challenges: number;
  directions: number;
  objectives: number;
}): string {
  if (
    counts.directions > 0 &&
    counts.directions >= counts.challenges &&
    counts.directions >= counts.objectives
  ) {
    return descriptionQualityListHref({
      l1: "strategic-directions",
      l2: "design",
      qualityFilter: "needs_work",
    });
  }
  if (
    counts.objectives > 0 &&
    counts.objectives >= counts.challenges &&
    counts.objectives >= counts.directions
  ) {
    return descriptionQualityListHref({
      l1: "objectives",
      qualityFilter: "needs_work",
    });
  }
  return descriptionQualityListHref({
    l1: "strategic-directions",
    l2: "challenges",
    qualityFilter: "needs_work",
  });
}

export type DescriptionQualityMaps = {
  challenges: Record<string, DescriptionQualityViewModel>;
  directions: Record<string, DescriptionQualityViewModel>;
  objectives: Record<string, DescriptionQualityViewModel>;
};

export function buildDescriptionQualityMaps(input: {
  challenges: Array<{
    id: string;
    title: string;
    description?: string | null;
    source_analysis_entry_id?: string | null;
  }>;
  directions: Array<{ id: string; title: string; description?: string | null }>;
  objectives: Array<{
    id: string;
    title: string;
    description?: string | null;
    ai_clarity_score?: number | string | null;
  }>;
  analysisEntryIdsByChallenge: Record<string, string[]>;
  challengeIdsByDirection: Record<string, string[]>;
  objectiveIdsByDirection: Record<string, string[]>;
}): DescriptionQualityMaps {
  const challenges: Record<string, DescriptionQualityViewModel> = {};
  for (const challenge of input.challenges) {
    const hasAnalysisBasis =
      Boolean(challenge.source_analysis_entry_id) ||
      (input.analysisEntryIdsByChallenge[challenge.id]?.length ?? 0) > 0;
    challenges[challenge.id] = buildDescriptionQualityViewModel("challenge", {
      kind: "challenge",
      title: challenge.title,
      description: challenge.description,
      hasAnalysisBasis,
    });
  }

  const directions: Record<string, DescriptionQualityViewModel> = {};
  for (const direction of input.directions) {
    directions[direction.id] = buildDescriptionQualityViewModel("direction", {
      kind: "direction",
      title: direction.title,
      description: direction.description,
      hasLinkedChallenges: (input.challengeIdsByDirection[direction.id]?.length ?? 0) > 0,
      hasLinkedObjectives: (input.objectiveIdsByDirection[direction.id]?.length ?? 0) > 0,
    });
  }

  const objectives: Record<string, DescriptionQualityViewModel> = {};
  for (const objective of input.objectives) {
    objectives[objective.id] = buildDescriptionQualityViewModel("objective", {
      kind: "objective",
      title: objective.title,
      description: objective.description,
      aiClarityScore:
        objective.ai_clarity_score != null ? Number(objective.ai_clarity_score) : null,
    });
  }

  return { challenges, directions, objectives };
}
