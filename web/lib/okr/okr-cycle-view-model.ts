/**
 * Pure helpers for OKR cycle screens (KPIs, check-in-first "Last Update", rollup status, warnings).
 * Objective-Rollup = Durchschnitt der KR-Fortschritte (Check-in bevorzugt, sonst Metrik) — kein separates DB-Feld.
 */

import {
  computeKeyResultProgress,
  computeKeyResultTrend,
  type KeyResultRow,
  type OkrUpdateRow,
  type ReviewStatus,
  type Trend,
} from "@/lib/review/key-result-progress";
import type { OkrPlanningKeyResultRow, OkrPlanningObjectiveRow } from "@/lib/okr/planning-data";

export const OKR_STALE_CHECKIN_DAYS = 30;

/** Rückstand vs. linearem Zeitfortschritt im OKR-Zyklus (Prozentpunkte). */
export const OKR_LINEAR_AT_RISK_GAP_PP = 10;
export const OKR_LINEAR_OFF_TRACK_GAP_PP = 30;

export type OkrCycleDateWindow = {
  start_date: string;
  end_date: string;
};

/**
 * Erwarteter Fortschritt = (abgelaufene Zykluszeit / Gesamt) × 100 %.
 * at risk: (E − Fortschritt) > 10 pp · off track: > 30 pp.
 */
export function deriveReviewStatusLinearOkrCycle(
  progress: number,
  cycleStartIso: string,
  cycleEndIso: string,
  nowMs: number = Date.now()
): ReviewStatus {
  const start = Date.parse(cycleStartIso);
  const end = Date.parse(cycleEndIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return "on_track";
  }
  const clampedNow = Math.min(Math.max(nowMs, start), end);
  const lz = end - start;
  const expectedProgress = ((clampedNow - start) / lz) * 100;
  const delta = expectedProgress - progress;
  if (delta > OKR_LINEAR_OFF_TRACK_GAP_PP) return "off_track";
  if (delta > OKR_LINEAR_AT_RISK_GAP_PP) return "at_risk";
  return "on_track";
}

export type OkrWarningKind =
  | "no_direction"
  | "kr_no_initiative"
  | "initiative_no_kr"
  | "no_checkin_stale"
  | "overdue"
  | "all_kr_no_initiative";

export type OkrKeyResultView = {
  keyResult: OkrPlanningKeyResultRow;
  /** Anzeige/Rollup: letzter Check-in-Fortschritt (0–100), sonst berechnet aus Metrik (current_value). */
  progress: number;
  /** Nur Metrik (KR-Felder), unabhängig vom letzten Check-in. */
  metricProgress: number;
  trend: Trend;
  reviewStatus: ReviewStatus;
  lastCheckInAt: string | null;
  /** Check-in-first: latest okr_update for this KR, else max key_results.updated_at */
  lastActivityAt: string | null;
  effectiveOwnerMembershipId: string | null;
  effectiveOwnerDisplayName: string | null;
  effectiveDeputyMembershipId: string | null;
  effectiveDeputyDisplayName: string | null;
  confidenceLevel: number | null;
  warnings: OkrWarningKind[];
};

export type OkrObjectiveView = {
  objective: OkrPlanningObjectiveRow;
  keyResults: OkrKeyResultView[];
  /** MVP/UI only: average of KR progress — not a governance weighting rule. */
  rollupProgressPercent: number;
  rollupStatus: ReviewStatus;
  statusCounts: Record<ReviewStatus, number>;
  statusDistributionLabel: string;
  lastActivityAt: string | null;
  warnings: OkrWarningKind[];
};

function maxIsoDate(dates: (string | null | undefined)[]): string | null {
  const parsed = dates
    .filter((d): d is string => Boolean(d))
    .map((d) => ({ d, t: Date.parse(d) }))
    .filter((x) => !Number.isNaN(x.t));
  if (parsed.length === 0) return null;
  parsed.sort((a, b) => b.t - a.t);
  return parsed[0]?.d ?? null;
}

/**
 * Last Update (check-in-first): prefer latest okr_update across KRs; if none, use max key_results.updated_at.
 */
export function computeCheckInFirstLastActivityAt(
  keyResults: OkrPlanningKeyResultRow[],
  lastCheckInByKrId: Map<string, string | null>
): string | null {
  const checkIns = keyResults.map((kr) => lastCheckInByKrId.get(kr.id) ?? null);
  const latestCheckIn = maxIsoDate(checkIns);
  if (latestCheckIn) return latestCheckIn;
  return maxIsoDate(keyResults.map((kr) => kr.updatedAt));
}

export function worstReviewStatus(statuses: ReviewStatus[]): ReviewStatus {
  if (statuses.length === 0) return "on_track";
  if (statuses.some((s) => s === "off_track")) return "off_track";
  if (statuses.some((s) => s === "at_risk")) return "at_risk";
  return "on_track";
}

export function formatStatusDistribution(counts: Record<ReviewStatus, number>): string {
  const parts: string[] = [];
  if (counts.on_track > 0) parts.push(`${counts.on_track} on track`);
  if (counts.at_risk > 0) parts.push(`${counts.at_risk} at risk`);
  if (counts.off_track > 0) parts.push(`${counts.off_track} off track`);
  return parts.join(" · ");
}

function krToKeyResultRow(kr: OkrPlanningKeyResultRow): KeyResultRow {
  return {
    id: kr.id,
    objective_id: kr.objectiveId,
    metric_type: kr.metricType,
    start_value: kr.startValue,
    target_value: kr.targetValue,
    current_value: kr.currentValue,
    due_date: kr.dueDate,
  };
}

export function buildOkrKeyResultView(
  kr: OkrPlanningKeyResultRow,
  objectiveOwnerMembershipId: string | null,
  objectiveOwnerDisplayName: string | null,
  objectiveDeputyMembershipId: string | null,
  objectiveDeputyDisplayName: string | null,
  updatesDescending: OkrUpdateRow[],
  okrCycleDates: OkrCycleDateWindow | null,
  nowMs: number = Date.now()
): OkrKeyResultView {
  const row = krToKeyResultRow(kr);
  const metricProgress = computeKeyResultProgress(row);
  const latestConf = updatesDescending[0];
  const latestPv = latestConf?.progress_value;
  const progress =
    latestPv != null && Number.isFinite(Number(latestPv))
      ? Math.min(100, Math.max(0, Number(latestPv)))
      : metricProgress;
  const trend = computeKeyResultTrend(row, updatesDescending);
  const reviewStatus =
    okrCycleDates != null
      ? deriveReviewStatusLinearOkrCycle(progress, okrCycleDates.start_date, okrCycleDates.end_date, nowMs)
      : "on_track";
  const lastCheckInAt = updatesDescending[0]?.created_at ?? null;
  const lastActivityAt = lastCheckInAt ?? kr.updatedAt;

  const effectiveOwnerMembershipId = kr.ownerMembershipId ?? objectiveOwnerMembershipId;
  const effectiveOwnerDisplayName = kr.ownerMembershipId
    ? kr.ownerDisplayName
    : objectiveOwnerDisplayName;
  const effectiveDeputyMembershipId = kr.deputyMembershipId ?? objectiveDeputyMembershipId ?? null;
  const effectiveDeputyDisplayName = kr.deputyMembershipId
    ? kr.deputyDisplayName
    : objectiveDeputyDisplayName;

  const confidenceLevel =
    latestConf?.confidence_level != null ? Number(latestConf.confidence_level) : null;

  const warnings: OkrWarningKind[] = [];
  if (kr.warningNoInitiativeLink) warnings.push("kr_no_initiative");

  const daysSinceCheckIn = lastCheckInAt
    ? (nowMs - Date.parse(lastCheckInAt)) / (1000 * 60 * 60 * 24)
    : null;
  if (
    kr.status === "active" &&
    (lastCheckInAt == null || (daysSinceCheckIn != null && daysSinceCheckIn > OKR_STALE_CHECKIN_DAYS))
  ) {
    warnings.push("no_checkin_stale");
  }

  if (kr.dueDate) {
    const due = Date.parse(kr.dueDate);
    if (!Number.isNaN(due) && due < nowMs && kr.status !== "completed" && kr.status !== "archived") {
      warnings.push("overdue");
    }
  }

  return {
    keyResult: kr,
    progress,
    metricProgress,
    trend,
    reviewStatus,
    lastCheckInAt,
    lastActivityAt,
    effectiveOwnerMembershipId,
    effectiveOwnerDisplayName,
    effectiveDeputyMembershipId,
    effectiveDeputyDisplayName,
    confidenceLevel,
    warnings,
  };
}

export function buildOkrObjectiveView(
  objective: OkrPlanningObjectiveRow,
  updatesByKrId: Map<string, OkrUpdateRow[]>,
  okrCycleDates: OkrCycleDateWindow | null,
  nowMs: number = Date.now()
): OkrObjectiveView {
  const lastCheckInByKrId = new Map<string, string | null>();
  const keyResultViews = objective.keyResults.map((kr) => {
    const raw = updatesByKrId.get(kr.id) ?? [];
    const sorted = [...raw].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    const last = sorted[0]?.created_at ?? null;
    lastCheckInByKrId.set(kr.id, last);
    return buildOkrKeyResultView(
      kr,
      objective.ownerMembershipId,
      objective.ownerDisplayName,
      objective.deputyMembershipId ?? null,
      objective.deputyDisplayName ?? null,
      sorted,
      okrCycleDates,
      nowMs
    );
  });

  const progresses = keyResultViews.map((v) => v.progress);
  const rollupProgressPercent =
    progresses.length === 0 ? 0 : progresses.reduce((a, b) => a + b, 0) / progresses.length;

  const statuses = keyResultViews.map((v) => v.reviewStatus);
  const rollupStatus = worstReviewStatus(statuses);
  const statusCounts: Record<ReviewStatus, number> = {
    on_track: 0,
    at_risk: 0,
    off_track: 0,
  };
  for (const s of statuses) statusCounts[s] += 1;

  const lastActivityAt = computeCheckInFirstLastActivityAt(objective.keyResults, lastCheckInByKrId);

  const warnings: OkrWarningKind[] = [];
  if (!objective.leadingStrategicDirectionId) warnings.push("no_direction");
  if (
    objective.keyResults.length > 0 &&
    objective.keyResults.every((kr) => kr.warningNoInitiativeLink)
  ) {
    warnings.push("all_kr_no_initiative");
  }
  for (const v of keyResultViews) {
    for (const w of v.warnings) {
      if (w === "kr_no_initiative" || w === "no_checkin_stale" || w === "overdue") {
        if (!warnings.includes(w)) warnings.push(w);
      }
    }
  }

  return {
    objective,
    keyResults: keyResultViews,
    rollupProgressPercent,
    rollupStatus,
    statusCounts,
    statusDistributionLabel: formatStatusDistribution(statusCounts),
    lastActivityAt,
    warnings,
  };
}

export type OkrCycleKpis = {
  objectiveCount: number;
  keyResultCount: number;
  statusCounts: Record<ReviewStatus, number>;
  criticalCount: number;
  keyResultsWithoutInitiative: number;
  initiativesWithoutKr: number;
};

export function computeOkrCycleKpis(
  objectiveViews: OkrObjectiveView[],
  initiativeIdsWithoutKr: Set<string>
): OkrCycleKpis {
  const statusCounts: Record<ReviewStatus, number> = {
    on_track: 0,
    at_risk: 0,
    off_track: 0,
  };
  let keyResultCount = 0;
  let criticalCount = 0;
  let keyResultsWithoutInitiative = 0;

  const now = Date.now();
  for (const ov of objectiveViews) {
    for (const kv of ov.keyResults) {
      keyResultCount += 1;
      statusCounts[kv.reviewStatus] += 1;
      if (kv.keyResult.warningNoInitiativeLink) keyResultsWithoutInitiative += 1;
      const due = kv.keyResult.dueDate ? Date.parse(kv.keyResult.dueDate) : NaN;
      const overdue = !Number.isNaN(due) && due < now && kv.keyResult.status !== "completed";
      if (kv.reviewStatus === "off_track" || (kv.reviewStatus === "at_risk" && overdue)) {
        criticalCount += 1;
      }
    }
  }

  return {
    objectiveCount: objectiveViews.length,
    keyResultCount,
    statusCounts,
    criticalCount,
    keyResultsWithoutInitiative,
    initiativesWithoutKr: initiativeIdsWithoutKr.size,
  };
}
