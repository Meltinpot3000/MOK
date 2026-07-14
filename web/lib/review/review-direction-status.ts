/**
 * Review-Status pro Stoßrichtung: Coverage (operative Abdeckung) und Health getrennt.
 *
 * Coverage: Jahresziel | Programm | Initiative | OKR/KR
 * Health: on_track | at_risk | off_track | no_coverage | unclear
 *
 * initiativeCoverage nur über Soll-Pfad Programm (nicht Legacy initiative_target_links).
 */
import { deriveInitiativeHealth } from "./initiative-health";
import { isActiveExecutionInitiativeStatus } from "./initiative-review-fields";
import type { ReviewAttentionItem } from "./review-attention-rules";
import type {
  ReviewCycleInitiativeInput,
  ReviewCycleProgramRow,
  StrategicDirectionReviewSummary,
} from "./review-cycle-view-model";

export type DirectionReviewStatus =
  | "on_track"
  | "at_risk"
  | "off_track"
  | "no_coverage"
  | "unclear";

export type PrimaryCoverageType =
  | "annual_target"
  | "program"
  | "initiative"
  | "okr"
  | "mixed"
  | "none";

export type DirectionOperationalCoverage = {
  annualTargetCoverage: boolean;
  programCoverage: boolean;
  initiativeCoverage: boolean;
  okrCoverage: boolean;
  hasAnyCoverage: boolean;
  primaryCoverageType: PrimaryCoverageType;
  runAnnualTargetCount: number;
  changeAnnualTargetCount: number;
  activeAnnualTargetCount: number;
};

export type ReviewCycleAnnualTargetCoverageInput = {
  id: string;
  strategic_direction_id: string;
  strategy_program_id: string | null;
  status: string;
};

export type DirectionReviewStatusResult = {
  reviewStatus: DirectionReviewStatus;
  coverage: DirectionOperationalCoverage;
  /** z. B. „Programm vorhanden, Umsetzung unklar“ */
  statusHintDe: string | null;
};

export type EnrichDirectionReviewStatusInput = {
  direction: { id: string; status: string; priority: number };
  summary: StrategicDirectionReviewSummary;
  programs: ReviewCycleProgramRow[];
  programStatusById: Map<string, string>;
  initiativeRows: ReviewCycleInitiativeInput[];
  annualTargets: ReviewCycleAnnualTargetCoverageInput[];
  directionIdsWithOkrCoverage: ReadonlySet<string>;
  attentionItems: ReviewAttentionItem[];
  timeProgressPercent: number;
  deltaPp: number | null;
};

const PRIORITY_THRESHOLD = 2;
const DELTA_AT_RISK_THRESHOLD_PP = -15;
const MIN_TIME_PROGRESS_FOR_DELTA_AT_RISK = 20;

/** Soll-Pfad: Initiative → Programm → Stoßrichtung (kein Legacy-JZ-Link). */
function initiativesForDirectionViaProgram(
  directionId: string,
  initiativeRows: ReviewCycleInitiativeInput[]
): ReviewCycleInitiativeInput[] {
  return initiativeRows.filter(
    (i) => i.directionId === directionId && i.resolvedDirectionSource === "program"
  );
}

function programsForDirection(
  directionId: string,
  programs: ReviewCycleProgramRow[]
): ReviewCycleProgramRow[] {
  return programs.filter((p) => p.strategic_direction_id === directionId);
}

function activeProgramsForDirection(
  directionId: string,
  programs: ReviewCycleProgramRow[],
  programStatusById: Map<string, string>
): ReviewCycleProgramRow[] {
  return programsForDirection(directionId, programs).filter(
    (p) => programStatusById.get(p.id) === "active"
  );
}

function isDirectionExecutionRelevant(direction: { status: string; priority: number }): boolean {
  return direction.status === "active" || direction.priority <= PRIORITY_THRESHOLD;
}

function attentionForDirection(
  directionId: string,
  attentionItems: ReviewAttentionItem[]
): ReviewAttentionItem[] {
  return attentionItems.filter((a) => a.directionId === directionId);
}

function hasOffTrackSignals(
  directionId: string,
  assignedActive: ReviewCycleInitiativeInput[],
  attentionItems: ReviewAttentionItem[]
): boolean {
  const dirAttention = attentionForDirection(directionId, attentionItems);
  if (
    dirAttention.some(
      (a) => a.issueType === "blocked_initiative" || a.issueType === "overdue_initiative"
    )
  ) {
    return true;
  }
  return assignedActive.some((i) => deriveInitiativeHealth(i) === "off_track");
}

function hasAtRiskSignals(
  directionId: string,
  assignedActive: ReviewCycleInitiativeInput[],
  attentionItems: ReviewAttentionItem[],
  timeProgressPercent: number,
  deltaPp: number | null
): boolean {
  const dirAttention = attentionForDirection(directionId, attentionItems);
  // priority_direction_no_execution steuert no_coverage, nicht at_risk
  const atRiskAttentionTypes = new Set([
    "at_risk_initiative",
    "missing_owner",
    "stale_review",
    "never_reviewed",
  ]);
  if (dirAttention.some((a) => atRiskAttentionTypes.has(a.issueType))) {
    return true;
  }
  if (assignedActive.some((i) => deriveInitiativeHealth(i) === "at_risk")) {
    return true;
  }
  if (
    deltaPp !== null &&
    deltaPp < DELTA_AT_RISK_THRESHOLD_PP &&
    timeProgressPercent > MIN_TIME_PROGRESS_FOR_DELTA_AT_RISK &&
    assignedActive.length > 0
  ) {
    return true;
  }
  return false;
}

function derivePrimaryCoverageType(input: {
  annualTargetCoverage: boolean;
  programCoverage: boolean;
  initiativeCoverage: boolean;
  okrCoverage: boolean;
}): PrimaryCoverageType {
  const flags: Array<{ on: boolean; type: Exclude<PrimaryCoverageType, "mixed" | "none"> }> = [
    { on: input.annualTargetCoverage, type: "annual_target" },
    { on: input.programCoverage, type: "program" },
    { on: input.initiativeCoverage, type: "initiative" },
    { on: input.okrCoverage, type: "okr" },
  ];
  const active = flags.filter((f) => f.on);
  if (active.length === 0) return "none";
  if (active.length > 1) return "mixed";
  return active[0]!.type;
}

/** Nur aktives Programm, ohne belastbare Umsetzung (JZ / Initiative / OKR). */
export function isProgramOnlyThinCoverage(coverage: DirectionOperationalCoverage): boolean {
  return (
    coverage.programCoverage &&
    !coverage.annualTargetCoverage &&
    !coverage.initiativeCoverage &&
    !coverage.okrCoverage
  );
}

export function deriveDirectionOperationalCoverage(
  directionId: string,
  programs: ReviewCycleProgramRow[],
  programStatusById: Map<string, string>,
  initiativeRows: ReviewCycleInitiativeInput[],
  annualTargets: ReviewCycleAnnualTargetCoverageInput[],
  directionIdsWithOkrCoverage: ReadonlySet<string>
): DirectionOperationalCoverage {
  const activeTargets = annualTargets.filter(
    (t) => t.strategic_direction_id === directionId && t.status === "active"
  );
  const runAnnualTargetCount = activeTargets.filter((t) => !t.strategy_program_id).length;
  const changeAnnualTargetCount = activeTargets.filter((t) => Boolean(t.strategy_program_id)).length;
  const activeAnnualTargetCount = activeTargets.length;

  const annualTargetCoverage = activeAnnualTargetCount > 0;
  const programCoverage =
    activeProgramsForDirection(directionId, programs, programStatusById).length > 0;
  const viaProgram = initiativesForDirectionViaProgram(directionId, initiativeRows);
  const initiativeCoverage = viaProgram.some((i) => isActiveExecutionInitiativeStatus(i.status));
  const okrCoverage = directionIdsWithOkrCoverage.has(directionId);

  const hasAnyCoverage =
    annualTargetCoverage || programCoverage || initiativeCoverage || okrCoverage;

  return {
    annualTargetCoverage,
    programCoverage,
    initiativeCoverage,
    okrCoverage,
    hasAnyCoverage,
    primaryCoverageType: derivePrimaryCoverageType({
      annualTargetCoverage,
      programCoverage,
      initiativeCoverage,
      okrCoverage,
    }),
    runAnnualTargetCount,
    changeAnnualTargetCount,
    activeAnnualTargetCount,
  };
}

function isUnclearAssignment(
  directionId: string,
  assignedViaProgram: ReviewCycleInitiativeInput[],
  initiativeRows: ReviewCycleInitiativeInput[],
  programs: ReviewCycleProgramRow[],
  attentionItems: ReviewAttentionItem[]
): boolean {
  const hasConflictingForDirection = attentionItems.some(
    (a) =>
      a.issueType === "conflicting_target_directions" &&
      (a.directionId === directionId ||
        (a.initiativeId !== null &&
          initiativeRows.find((i) => i.id === a.initiativeId)?.directionId === directionId))
  );
  if (hasConflictingForDirection) return true;

  const directionProgramIds = new Set(programsForDirection(directionId, programs).map((p) => p.id));
  const unassignedInDirectionPrograms = initiativeRows.filter(
    (i) =>
      i.program_id &&
      directionProgramIds.has(i.program_id) &&
      i.resolvedDirectionSource === "unassigned"
  );
  if (unassignedInDirectionPrograms.length > 0 && assignedViaProgram.length === 0) {
    return true;
  }

  return false;
}

/** Belastbare Coverage = JZ, Initiative oder OKR (Programm allein → nicht on_track). */
function hasBelastbareCoverage(coverage: DirectionOperationalCoverage): boolean {
  return coverage.annualTargetCoverage || coverage.initiativeCoverage || coverage.okrCoverage;
}

export function deriveDirectionReviewStatus(
  input: EnrichDirectionReviewStatusInput
): DirectionReviewStatusResult {
  const {
    direction,
    programs,
    programStatusById,
    initiativeRows,
    annualTargets,
    directionIdsWithOkrCoverage,
    attentionItems,
  } = input;

  const coverage = deriveDirectionOperationalCoverage(
    direction.id,
    programs,
    programStatusById,
    initiativeRows,
    annualTargets,
    directionIdsWithOkrCoverage
  );

  const assignedViaProgram = initiativesForDirectionViaProgram(direction.id, initiativeRows);
  const assignedActive = assignedViaProgram.filter((i) =>
    isActiveExecutionInitiativeStatus(i.status)
  );

  if (
    isUnclearAssignment(direction.id, assignedViaProgram, initiativeRows, programs, attentionItems)
  ) {
    return { reviewStatus: "unclear", coverage, statusHintDe: null };
  }

  if (!coverage.hasAnyCoverage) {
    if (isDirectionExecutionRelevant(direction)) {
      return { reviewStatus: "no_coverage", coverage, statusHintDe: null };
    }
    return { reviewStatus: "on_track", coverage, statusHintDe: null };
  }

  if (isProgramOnlyThinCoverage(coverage)) {
    return {
      reviewStatus: "unclear",
      coverage,
      statusHintDe: "Programm vorhanden, Umsetzung unklar",
    };
  }

  if (hasOffTrackSignals(direction.id, assignedActive, attentionItems)) {
    return { reviewStatus: "off_track", coverage, statusHintDe: null };
  }

  if (
    hasAtRiskSignals(
      direction.id,
      assignedActive,
      attentionItems,
      input.timeProgressPercent,
      input.deltaPp
    )
  ) {
    return { reviewStatus: "at_risk", coverage, statusHintDe: null };
  }

  if (hasBelastbareCoverage(coverage)) {
    return { reviewStatus: "on_track", coverage, statusHintDe: null };
  }

  return {
    reviewStatus: "unclear",
    coverage,
    statusHintDe: "Programm vorhanden, Umsetzung unklar",
  };
}

export type EnrichedStrategicDirectionReviewSummary = StrategicDirectionReviewSummary & {
  reviewStatus: DirectionReviewStatus;
  coverage: DirectionOperationalCoverage;
  statusHintDe: string | null;
};

export function enrichDirectionSummariesWithReviewStatus(
  directions: Array<{ id: string; title: string; status: string; priority: number }>,
  summaries: StrategicDirectionReviewSummary[],
  programs: ReviewCycleProgramRow[],
  programStatusById: Map<string, string>,
  initiativeRows: ReviewCycleInitiativeInput[],
  annualTargets: ReviewCycleAnnualTargetCoverageInput[],
  directionIdsWithOkrCoverage: ReadonlySet<string>,
  attentionItems: ReviewAttentionItem[],
  timeProgressPercent: number,
  deltaPp: number | null
): EnrichedStrategicDirectionReviewSummary[] {
  const summaryById = new Map(summaries.map((s) => [s.directionId, s]));

  return directions.map((d) => {
    const summary = summaryById.get(d.id) ?? {
      directionId: d.id,
      title: d.title,
      status: d.status,
      priority: d.priority,
      directionProgress: null,
      activeInitiativeCount: 0,
      criticalInitiativeCount: 0,
      lastReviewUpdateAt: null,
      executionHealthStatus: "on_track" as const,
    };

    const statusResult = deriveDirectionReviewStatus({
      direction: d,
      summary,
      programs,
      programStatusById,
      initiativeRows,
      annualTargets,
      directionIdsWithOkrCoverage,
      attentionItems,
      timeProgressPercent,
      deltaPp,
    });

    return {
      ...summary,
      reviewStatus: statusResult.reviewStatus,
      coverage: statusResult.coverage,
      statusHintDe: statusResult.statusHintDe,
    };
  });
}

/** UI-Label für Coverage (ohne „getragen“-Metapher). */
export function primaryCoverageTypeLabelDe(coverage: DirectionOperationalCoverage): string {
  if (!coverage.hasAnyCoverage) return "Keine operative Abdeckung";

  switch (coverage.primaryCoverageType) {
    case "annual_target": {
      const run = coverage.runAnnualTargetCount > 0;
      const change = coverage.changeAnnualTargetCount > 0;
      if (run && change) return "Run- und Change-Jahresziele vorhanden";
      if (run) return "Run-Jahresziel vorhanden";
      if (change) return "Change-Jahresziel vorhanden";
      return "Jahresziel vorhanden";
    }
    case "program":
      return "Programm vorhanden";
    case "initiative":
      return "Initiativen vorhanden";
    case "okr":
      return "OKR/KR-Bezug vorhanden";
    case "mixed":
      return "Mehrere Abdeckungen";
    case "none":
    default:
      return "Keine operative Abdeckung";
  }
}
