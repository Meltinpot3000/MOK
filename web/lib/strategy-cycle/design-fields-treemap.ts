import {
  buildDirectionMetrics,
  type ChallengeDirectionLinkInput,
  type ChallengeInput,
  type DirectionObjectiveLinkInput,
  type ObjectiveInput,
  type StrategicDesignConflict,
  type StrategicDirectionInput,
} from "@/lib/strategy-cycle/strategic-design-insights";
import { computeUnassignedDisplayWeight } from "@/lib/strategy-cycle/design-fields-treemap-layout";

export const UNGROUPED_FIELD_ID = "__ungrouped__";
export const UNGROUPED_FIELD_LABEL = "Ohne Designfeld";
const WEIGHT_FLOOR = 0.01;

export type DesignFieldStatus = "strong" | "medium" | "weak" | "unknown";
export type DesignFieldNodeKind = "strategic_field" | "ungrouped_backlog";
export type DesignFieldsPortfolioState = "none" | "partial" | "complete";

export type DesignFieldDirection = {
  directionId: string;
  title: string;
  score: number;
  challengeImpact: number;
  objectiveAlignment: number;
  linkedChallengeTitles: string[];
  linkedObjectiveTitles: string[];
  hasStrongObjectiveLink: boolean;
};

export type DesignFieldNode = {
  id: string;
  label: string;
  nodeKind: DesignFieldNodeKind;
  directionCount: number;
  weight: number;
  /** Treemap sizing — caps dominant ungrouped backlog areas. */
  layoutWeight: number;
  status: DesignFieldStatus;
  shortStatus: string;
  structureHint: string | null;
  topDirections: DesignFieldDirection[];
  directions: DesignFieldDirection[];
  challengeTitles: string[];
  objectiveTitles: string[];
  reviewHints: string[];
};

export type DesignFieldsTreemapResult = {
  nodes: DesignFieldNode[];
  totalDirections: number;
  assignedCount: number;
  portfolioState: DesignFieldsPortfolioState;
  summaryFinding: string;
  summaryRecommendation: string | null;
};

export type ComputeDesignFieldsTreemapInput = {
  strategicDirections: StrategicDirectionInput[];
  challenges: ChallengeInput[];
  objectives: ObjectiveInput[];
  challengeDirectionLinks: ChallengeDirectionLinkInput[];
  directionObjectiveLinks: DirectionObjectiveLinkInput[];
  conflicts?: StrategicDesignConflict[];
};

function fieldWeightFromDirections(directions: DesignFieldDirection[]): number {
  const sum = directions.reduce((s, d) => s + d.score, 0);
  return Math.max(WEIGHT_FLOOR, sum);
}

function computeLayoutWeight(
  nodeKind: DesignFieldNodeKind,
  weight: number,
  strategicFieldWeights: number[]
): number {
  if (nodeKind !== "ungrouped_backlog") return weight;
  return computeUnassignedDisplayWeight(weight, strategicFieldWeights);
}

function qualitativeLevel(value: number, max: number): "hoch" | "mittel" | "schwach" {
  if (max <= 0 || value <= 0) return "schwach";
  const ratio = value / max;
  if (ratio >= 0.65) return "hoch";
  if (ratio >= 0.35) return "mittel";
  return "schwach";
}

function buildShortStatus(
  avgChallenge: number,
  avgObjective: number,
  maxChallenge: number,
  maxObjective: number
): string {
  const hf = qualitativeLevel(avgChallenge, maxChallenge);
  const ziele = qualitativeLevel(avgObjective, maxObjective);
  return `HF ${hf} · Ziele ${ziele}`;
}

export function classifyDesignFieldStatus(
  directions: DesignFieldDirection[],
  maxChallenge: number,
  maxObjective: number
): DesignFieldStatus {
  if (directions.length === 0) return "unknown";

  const avgChallenge =
    directions.reduce((s, d) => s + d.challengeImpact, 0) / directions.length;
  const avgObjective =
    directions.reduce((s, d) => s + d.objectiveAlignment, 0) / directions.length;
  const withoutObjective = directions.filter(
    (d) => !d.hasStrongObjectiveLink || d.objectiveAlignment <= 0
  ).length;
  const shareWithoutObjective = withoutObjective / directions.length;

  const challengeHigh = qualitativeLevel(avgChallenge, maxChallenge) === "hoch";
  const objectiveHigh = qualitativeLevel(avgObjective, maxObjective) === "hoch";
  const objectiveMedium = qualitativeLevel(avgObjective, maxObjective) !== "schwach";

  if (shareWithoutObjective >= 0.5 || qualitativeLevel(avgObjective, maxObjective) === "schwach") {
    return "weak";
  }
  if (challengeHigh && objectiveMedium && !objectiveHigh) {
    return "medium";
  }
  if (challengeHigh && objectiveHigh) {
    return "strong";
  }
  if (objectiveMedium) {
    return "medium";
  }
  return "weak";
}

function toDesignFieldDirection(
  m: ReturnType<typeof buildDirectionMetrics>[number]
): DesignFieldDirection {
  return {
    directionId: m.directionId,
    title: m.title,
    score: m.score,
    challengeImpact: m.challengeImpact,
    objectiveAlignment: m.objectiveAlignment,
    linkedChallengeTitles: m.linkedChallengeTitles,
    linkedObjectiveTitles: m.linkedObjectiveTitles,
    hasStrongObjectiveLink: m.hasStrongObjectiveLink,
  };
}

function uniqueTitles(lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const t of list) {
      if (seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

function reviewHintsForDirections(
  directionIds: Set<string>,
  conflicts: StrategicDesignConflict[]
): string[] {
  const hints: string[] = [];
  for (const c of conflicts) {
    if (c.type === "misaligned_direction" && directionIds.has(c.directionId)) {
      hints.push(c.explanationDe);
    }
  }
  return hints.slice(0, 5);
}

function groupingKey(grouping: string | null | undefined): string | null {
  const trimmed = grouping?.trim();
  return trimmed ? trimmed : null;
}

export function computeDesignFieldsTreemap(
  input: ComputeDesignFieldsTreemapInput
): DesignFieldsTreemapResult {
  const conflicts = input.conflicts ?? [];
  const metrics = buildDirectionMetrics(
    input.strategicDirections,
    input.challenges,
    input.objectives,
    input.challengeDirectionLinks,
    input.directionObjectiveLinks
  );

  const metricsById = new Map(metrics.map((m) => [m.directionId, m]));
  const maxChallenge = Math.max(0, ...metrics.map((m) => m.challengeImpact));
  const maxObjective = Math.max(0, ...metrics.map((m) => m.objectiveAlignment));

  const byField = new Map<string, DesignFieldDirection[]>();
  const ungrouped: DesignFieldDirection[] = [];

  for (const dir of input.strategicDirections) {
    const m = metricsById.get(dir.id);
    if (!m) continue;
    const fieldDir = toDesignFieldDirection(m);
    const key = groupingKey(dir.grouping);
    if (!key) {
      ungrouped.push(fieldDir);
      continue;
    }
    const list = byField.get(key) ?? [];
    list.push(fieldDir);
    byField.set(key, list);
  }

  const definedFieldLabels = [...byField.keys()];
  const totalDirections = input.strategicDirections.length;
  const assignedCount = totalDirections - ungrouped.length;

  let portfolioState: DesignFieldsPortfolioState;
  if (definedFieldLabels.length === 0) {
    portfolioState = "none";
  } else if (ungrouped.length > 0) {
    portfolioState = "partial";
  } else {
    portfolioState = "complete";
  }

  const nodes: DesignFieldNode[] = [];

  for (const label of definedFieldLabels.sort((a, b) => a.localeCompare(b, "de"))) {
    const directions = [...(byField.get(label) ?? [])].sort(
      (a, b) => b.score - a.score || a.title.localeCompare(b.title, "de")
    );
    const avgChallenge =
      directions.reduce((s, d) => s + d.challengeImpact, 0) / Math.max(1, directions.length);
    const avgObjective =
      directions.reduce((s, d) => s + d.objectiveAlignment, 0) / Math.max(1, directions.length);
    const status = classifyDesignFieldStatus(directions, maxChallenge, maxObjective);
    const directionIds = new Set(directions.map((d) => d.directionId));

    nodes.push({
      id: `field:${label}`,
      label,
      nodeKind: "strategic_field",
      directionCount: directions.length,
      weight: fieldWeightFromDirections(directions),
      layoutWeight: fieldWeightFromDirections(directions),
      status,
      shortStatus: buildShortStatus(avgChallenge, avgObjective, maxChallenge, maxObjective),
      structureHint: null,
      topDirections: directions.slice(0, 2),
      directions,
      challengeTitles: uniqueTitles(directions.map((d) => d.linkedChallengeTitles)).slice(0, 8),
      objectiveTitles: uniqueTitles(directions.map((d) => d.linkedObjectiveTitles)).slice(0, 8),
      reviewHints: reviewHintsForDirections(directionIds, conflicts),
    });
  }

  const strategicWeights = nodes
    .filter((n) => n.nodeKind === "strategic_field")
    .map((n) => n.weight);

  if (ungrouped.length > 0) {
    const sortedUngrouped = [...ungrouped].sort(
      (a, b) => b.score - a.score || a.title.localeCompare(b.title, "de")
    );
    const backlogWeight = fieldWeightFromDirections(sortedUngrouped);
    nodes.push({
      id: UNGROUPED_FIELD_ID,
      label: UNGROUPED_FIELD_LABEL,
      nodeKind: "ungrouped_backlog",
      directionCount: sortedUngrouped.length,
      weight: backlogWeight,
      layoutWeight: computeLayoutWeight("ungrouped_backlog", backlogWeight, strategicWeights),
      status: "weak",
      shortStatus: "Struktur offen",
      structureHint: `${sortedUngrouped.length} Stoßrichtung${sortedUngrouped.length === 1 ? "" : "en"} sind noch keinem Designfeld zugeordnet.`,
      topDirections: sortedUngrouped.slice(0, 2),
      directions: sortedUngrouped,
      challengeTitles: uniqueTitles(sortedUngrouped.map((d) => d.linkedChallengeTitles)).slice(0, 8),
      objectiveTitles: uniqueTitles(sortedUngrouped.map((d) => d.linkedObjectiveTitles)).slice(0, 8),
      reviewHints: [],
    });
  }

  nodes.sort((a, b) => {
    if (a.nodeKind === "ungrouped_backlog" && b.nodeKind !== "ungrouped_backlog") return 1;
    if (b.nodeKind === "ungrouped_backlog" && a.nodeKind !== "ungrouped_backlog") return -1;
    return b.weight - a.weight || a.label.localeCompare(b.label, "de");
  });

  let summaryFinding: string;
  let summaryRecommendation: string | null = null;

  if (portfolioState === "none") {
    summaryFinding = `Noch keine Designfelder definiert. ${totalDirections} Stoßrichtung${totalDirections === 1 ? "" : "en"} ${totalDirections === 1 ? "ist" : "sind"} aktuell keinem Designfeld zugeordnet.`;
    summaryRecommendation =
      "Für die Management-Review-Sicht sollten 3–5 Designfelder gebildet werden.";
  } else if (portfolioState === "partial") {
    summaryFinding = `${assignedCount} von ${totalDirections} Stoßrichtungen sind Designfeldern zugeordnet.`;
    summaryRecommendation =
      ungrouped.length > 0
        ? `${ungrouped.length} Stoßrichtung${ungrouped.length === 1 ? "" : "en"} noch ohne Designfeld — Struktur nachziehen.`
        : null;
  } else {
    summaryFinding = `Alle ${totalDirections} Stoßrichtungen sind Designfeldern zugeordnet.`;
    summaryRecommendation = null;
  }

  return {
    nodes,
    totalDirections,
    assignedCount,
    portfolioState,
    summaryFinding,
    summaryRecommendation,
  };
}

export function designFieldStatusLabelDe(status: DesignFieldStatus): string {
  switch (status) {
    case "strong":
      return "Tragfähig";
    case "medium":
      return "Prüfen";
    case "weak":
      return "Nacharbeiten";
    default:
      return "Keine Daten";
  }
}
