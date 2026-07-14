import type { CorrelationConflictDetail, CorrelationStatus } from "@/lib/strategy-cycle/correlation";
import type { StrategicDesignConflict } from "@/lib/strategy-cycle/strategic-design-insights";

export type DesignReviewHintCategory = "fit" | "anchoring" | "override";

export type DesignReviewHintItem = {
  id: string;
  category: DesignReviewHintCategory;
  badgeLabelDe: string;
  subtypeLabelDe?: string;
  relationLabelDe: string;
  titleDe: string;
  hintDe: string;
  actionLabelDe: string;
  actionHref: string;
  score?: number;
};

export type DesignReviewHintsResult = {
  fit: DesignReviewHintItem[];
  anchoring: DesignReviewHintItem[];
  override: DesignReviewHintItem[];
  summary: { fit: number; anchoring: number; override: number; total: number };
  snapshotDelta?: number;
};

const HREF_PASSUNGSANALYSE = "/strategy-cycle?l1=strategic-directions&l2=summary";
const HREF_VERKNUEPFUNGSMATRIX = "/strategy-cycle?l1=strategic-directions&l2=strategy-matrix";

function correlationStatusLabelDe(status: CorrelationStatus): string {
  if (status === "green") return "Grün";
  if (status === "yellow") return "Gelb";
  if (status === "red") return "Rot";
  return "Unklar";
}

function mapFitHint(conflict: Extract<StrategicDesignConflict, { type: "correlation_weak" }>): DesignReviewHintItem {
  return {
    id: `fit:${conflict.challengeId}:${conflict.objectiveId}`,
    category: "fit",
    badgeLabelDe: "Passungshinweis",
    relationLabelDe: "Herausforderung → Ziel",
    titleDe: `${conflict.challengeTitle} → ${conflict.objectiveTitle}`,
    hintDe: conflict.explanationDe,
    actionLabelDe: "In Strategische Wirkpfade prüfen",
    actionHref: HREF_PASSUNGSANALYSE,
    score: conflict.score,
  };
}

function mapUnsupportedObjective(
  conflict: Extract<StrategicDesignConflict, { type: "unsupported_objective" }>
): DesignReviewHintItem {
  return {
    id: `anchoring:objective:${conflict.objectiveId}`,
    category: "anchoring",
    badgeLabelDe: "Zielverankerung",
    subtypeLabelDe: "Ziel schwach angebunden",
    relationLabelDe: "Ziel → Stoßrichtungen",
    titleDe: conflict.objectiveTitle,
    hintDe: conflict.explanationDe,
    actionLabelDe: "In Verknüpfungsmatrix / Stoßrichtungen prüfen",
    actionHref: HREF_VERKNUEPFUNGSMATRIX,
  };
}

function mapMisalignedDirection(
  conflict: Extract<StrategicDesignConflict, { type: "misaligned_direction" }>
): DesignReviewHintItem {
  return {
    id: `anchoring:direction:${conflict.directionId}`,
    category: "anchoring",
    badgeLabelDe: "Zielverankerung",
    subtypeLabelDe: "Stoßrichtung mit schwachem Zielbeitrag",
    relationLabelDe: "Stoßrichtung → Ziele",
    titleDe: conflict.directionTitle,
    hintDe: conflict.explanationDe,
    actionLabelDe: "In Verknüpfungsmatrix / Stoßrichtungen prüfen",
    actionHref: HREF_VERKNUEPFUNGSMATRIX,
    score: conflict.challengeImpact - conflict.objectiveAlignment,
  };
}

function mapOverrideHint(conflict: CorrelationConflictDetail): DesignReviewHintItem {
  const autoLabel = correlationStatusLabelDe(conflict.autoStatus);
  const effectiveLabel = correlationStatusLabelDe(conflict.effectiveStatus);
  const hintParts = [
    `Stoßrichtung: ${conflict.directionTitle}`,
    `Auto: ${autoLabel} (${conflict.autoScore}) → Override: ${effectiveLabel}`,
  ];
  if (conflict.overrideNote?.trim()) {
    hintParts.push(conflict.overrideNote.trim());
  }

  return {
    id: `override:${conflict.key}`,
    category: "override",
    badgeLabelDe: "Override",
    relationLabelDe: "Herausforderung → Ziel",
    titleDe: `${conflict.challengeTitle} → ${conflict.objectiveTitle}`,
    hintDe: hintParts.join(" · "),
    actionLabelDe: "In Strategische Wirkpfade prüfen",
    actionHref: HREF_PASSUNGSANALYSE,
    score: conflict.autoScore,
  };
}

function sortFitHints(a: DesignReviewHintItem, b: DesignReviewHintItem): number {
  const scoreA = a.score ?? Number.POSITIVE_INFINITY;
  const scoreB = b.score ?? Number.POSITIVE_INFINITY;
  if (scoreA !== scoreB) return scoreA - scoreB;
  return a.titleDe.localeCompare(b.titleDe, "de");
}

function sortAnchoringHints(a: DesignReviewHintItem, b: DesignReviewHintItem): number {
  const scoreA = a.score ?? 0;
  const scoreB = b.score ?? 0;
  if (scoreA !== scoreB) return scoreB - scoreA;
  return a.titleDe.localeCompare(b.titleDe, "de");
}

function sortOverrideHints(a: DesignReviewHintItem, b: DesignReviewHintItem): number {
  return a.titleDe.localeCompare(b.titleDe, "de");
}

export type BuildDesignReviewHintsInput = {
  conflicts: StrategicDesignConflict[];
  conflictCells: CorrelationConflictDetail[];
  openReviewHintsCount?: number;
};

export function buildDesignReviewHints(input: BuildDesignReviewHintsInput): DesignReviewHintsResult {
  const fit: DesignReviewHintItem[] = [];
  const anchoring: DesignReviewHintItem[] = [];

  for (const conflict of input.conflicts) {
    if (conflict.type === "correlation_weak") {
      fit.push(mapFitHint(conflict));
    } else if (conflict.type === "unsupported_objective") {
      anchoring.push(mapUnsupportedObjective(conflict));
    } else if (conflict.type === "misaligned_direction") {
      anchoring.push(mapMisalignedDirection(conflict));
    }
  }

  const override = input.conflictCells.map(mapOverrideHint);

  fit.sort(sortFitHints);
  anchoring.sort(sortAnchoringHints);
  override.sort(sortOverrideHints);

  const summary = {
    fit: fit.length,
    anchoring: anchoring.length,
    override: override.length,
    total: fit.length + anchoring.length + override.length,
  };

  const result: DesignReviewHintsResult = { fit, anchoring, override, summary };

  if (
    input.openReviewHintsCount != null &&
    Number.isFinite(input.openReviewHintsCount) &&
    input.openReviewHintsCount !== summary.total
  ) {
    result.snapshotDelta = input.openReviewHintsCount - summary.total;
  }

  return result;
}

export const DESIGN_REVIEW_HINTS_TOP_N = 5;
