import { deriveInitiativeHealth, type InitiativeRow } from "./initiative-health";
import type { ReviewStatus } from "./key-result-progress";
import { isActiveExecutionInitiativeStatus } from "./initiative-review-fields";

export type ResolvedDirectionSource = "program" | "annual_target" | "unresolved" | "unassigned";

export type StrategicDirectionResolution = {
  directionId: string | null;
  resolvedDirectionSource: ResolvedDirectionSource;
};

export type ReviewCycleProgramRow = {
  id: string;
  strategic_direction_id: string | null;
};

export type ReviewCycleAnnualTargetRow = {
  id: string;
  strategic_direction_id: string;
};

export type ReviewCycleInitiativeTargetLinkRow = {
  initiative_id: string;
  annual_target_id: string;
};

/**
 * Prioritaet: Programm mit strategic_direction_id, sonst genau eine Richtung ueber Jahresziel-Links, sonst unresolved/unassigned.
 */
export function resolveStrategicDirectionForInitiative(
  initiative: { id: string; program_id: string | null },
  programById: Map<string, ReviewCycleProgramRow>,
  targetLinks: ReviewCycleInitiativeTargetLinkRow[],
  annualTargetById: Map<string, ReviewCycleAnnualTargetRow>
): StrategicDirectionResolution {
  if (initiative.program_id) {
    const program = programById.get(initiative.program_id);
    if (program?.strategic_direction_id) {
      return {
        directionId: program.strategic_direction_id,
        resolvedDirectionSource: "program",
      };
    }
  }

  const linkedTargetIds = targetLinks
    .filter((l) => l.initiative_id === initiative.id)
    .map((l) => l.annual_target_id);
  const directionIds = new Set<string>();
  for (const tid of linkedTargetIds) {
    const t = annualTargetById.get(tid);
    if (t?.strategic_direction_id) directionIds.add(t.strategic_direction_id);
  }

  if (directionIds.size === 1) {
    return {
      directionId: [...directionIds][0]!,
      resolvedDirectionSource: "annual_target",
    };
  }
  if (directionIds.size > 1) {
    return { directionId: null, resolvedDirectionSource: "unresolved" };
  }
  return { directionId: null, resolvedDirectionSource: "unassigned" };
}

function aggregateWorstInitiativeHealth(statuses: ReviewStatus[]): ReviewStatus {
  if (statuses.length === 0) return "on_track";
  if (statuses.some((s) => s === "off_track")) return "off_track";
  if (statuses.some((s) => s === "at_risk")) return "at_risk";
  return "on_track";
}

export type ReviewCycleInitiativeInput = InitiativeRow & {
  id: string;
  title: string;
  status: string;
  program_id: string | null;
  program_title: string | null;
  owner_membership_id: string | null;
  owner_display_name: string | null;
  weight: number;
  progress_percent: number;
  review_comment: string | null;
  last_review_update_at: string | null;
} & StrategicDirectionResolution;

export type StrategicDirectionReviewSummary = {
  directionId: string;
  title: string;
  status: string;
  priority: number;
  directionProgress: number | null;
  activeInitiativeCount: number;
  criticalInitiativeCount: number;
  lastReviewUpdateAt: string | null;
  executionHealthStatus: ReviewStatus;
};

export type ReviewCycleKpis = {
  activeDirectionsCount: number;
  directionsOnTrackCount: number;
  criticalExecutionCount: number;
  overdueDeadlinesCount: number;
};

export function buildReviewCycleInitiativeRows(
  initiatives: Array<
    InitiativeRow & {
      id: string;
      title: string;
      status: string;
      program_id: string | null;
      program_title: string | null;
      owner_membership_id: string | null;
      owner_display_name: string | null;
      weight: number;
      progress_percent: number;
      review_comment: string | null;
      last_review_update_at: string | null;
    }
  >,
  programById: Map<string, ReviewCycleProgramRow>,
  programTitleById: Map<string, string>,
  targetLinks: ReviewCycleInitiativeTargetLinkRow[],
  annualTargetById: Map<string, ReviewCycleAnnualTargetRow>
): ReviewCycleInitiativeInput[] {
  return initiatives.map((i) => {
    const resolution = resolveStrategicDirectionForInitiative(i, programById, targetLinks, annualTargetById);
    return {
      ...i,
      program_title: i.program_id ? programTitleById.get(i.program_id) ?? i.program_title : i.program_title,
      ...resolution,
    };
  });
}

export function buildStrategicDirectionReviewSummaries(
  directions: Array<{ id: string; title: string; status: string; priority: number }>,
  initiativeRows: ReviewCycleInitiativeInput[]
): StrategicDirectionReviewSummary[] {
  const byDirection = new Map<string, ReviewCycleInitiativeInput[]>();
  for (const row of initiativeRows) {
    if (!row.directionId) continue;
    if (row.resolvedDirectionSource !== "program" && row.resolvedDirectionSource !== "annual_target") continue;
    const list = byDirection.get(row.directionId) ?? [];
    list.push(row);
    byDirection.set(row.directionId, list);
  }

  return directions.map((d) => {
    const assigned = byDirection.get(d.id) ?? [];
    const activeAssigned = assigned.filter((i) => isActiveExecutionInitiativeStatus(i.status));

    let directionProgress: number | null = null;
    const weightSum = activeAssigned.reduce((s, i) => s + i.weight, 0);
    if (activeAssigned.length > 0 && weightSum > 0) {
      const num = activeAssigned.reduce((s, i) => s + i.progress_percent * i.weight, 0);
      directionProgress = Math.round(num / weightSum);
    }

    const healthStatuses = activeAssigned.map((i) => deriveInitiativeHealth(i));
    const criticalInitiativeCount = activeAssigned.filter((i) => {
      const h = deriveInitiativeHealth(i);
      return h === "off_track" || h === "at_risk";
    }).length;

    const reviewTimes = activeAssigned
      .map((i) => i.last_review_update_at)
      .filter((t): t is string => Boolean(t))
      .sort();
    const lastReviewUpdateAt = reviewTimes.length > 0 ? reviewTimes[reviewTimes.length - 1]! : null;

    return {
      directionId: d.id,
      title: d.title,
      status: d.status,
      priority: d.priority,
      directionProgress,
      activeInitiativeCount: activeAssigned.length,
      criticalInitiativeCount,
      lastReviewUpdateAt,
      executionHealthStatus: aggregateWorstInitiativeHealth(healthStatuses),
    };
  });
}

/** Fuer KPI „ueberfaellige Termine“: KR mit Fälligkeit in der Vergangenheit (Zyklus-Kontext). */
export function buildReviewCycleKpis(
  directionSummaries: StrategicDirectionReviewSummary[],
  initiativeRows: ReviewCycleInitiativeInput[],
  overdueKeyResultCount: number
): ReviewCycleKpis {
  const activeDirections = directionSummaries.filter((d) => d.status === "active");
  const activeExecutionInitiatives = initiativeRows.filter((i) => isActiveExecutionInitiativeStatus(i.status));

  const criticalExecutionCount = activeExecutionInitiatives.filter((i) => {
    const h = deriveInitiativeHealth(i);
    return h === "off_track" || h === "at_risk";
  }).length;

  const now = new Date();
  const overdueInitiatives = activeExecutionInitiatives.filter((i) => {
    if (!i.end_date) return false;
    return new Date(i.end_date) < now;
  }).length;

  return {
    activeDirectionsCount: activeDirections.length,
    directionsOnTrackCount: activeDirections.filter((d) => d.executionHealthStatus === "on_track").length,
    criticalExecutionCount,
    overdueDeadlinesCount: overdueInitiatives + overdueKeyResultCount,
  };
}
