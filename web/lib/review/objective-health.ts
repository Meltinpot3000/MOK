/**
 * Objective Health – nachvollziehbare Regelbasis.
 * Primär: KR progress. Sekundär: KR trend. Optional: due date pressure. Override: klar getrennt.
 */

import type { ReviewStatus, Trend } from "./key-result-progress";
import {
  computeKeyResultProgress,
  computeKeyResultTrend,
  deriveKeyResultReviewStatus,
} from "./key-result-progress";
import type { KeyResultRow } from "./key-result-progress";
import type { OkrUpdateRow } from "./key-result-progress";

export type ObjectiveRow = {
  id: string;
  objective_health_override?: string | null;
  objective_health_override_by_membership_id?: string | null;
  objective_health_override_at?: string | null;
};

export type ObjectiveHealthResult = {
  status: ReviewStatus;
  score: number;
  trend: Trend;
  isOverride: boolean;
};

/**
 * Berechnet Objective Health Score (0–100) aus Key Results.
 * Gewichteter Durchschnitt der KR-Progress-Werte.
 */
export function computeObjectiveHealthScore(
  keyResults: Array<{ progress: number }>
): number {
  if (keyResults.length === 0) return 0;
  const sum = keyResults.reduce((a, kr) => a + kr.progress, 0);
  return sum / keyResults.length;
}

/**
 * Aggregiert KR-Status zu Objective-Status.
 * Regel: mindestens ein off_track → off_track; mindestens ein at_risk → at_risk; sonst on_track.
 */
function aggregateStatus(statuses: ReviewStatus[]): ReviewStatus {
  if (statuses.some((s) => s === "off_track")) return "off_track";
  if (statuses.some((s) => s === "at_risk")) return "at_risk";
  return "on_track";
}

/**
 * Berechnet Trend aus KR-Trends: mehr down als up → down, mehr up als down → up, sonst stable.
 */
function aggregateTrend(trends: Trend[]): Trend {
  const up = trends.filter((t) => t === "up").length;
  const down = trends.filter((t) => t === "down").length;
  if (down > up) return "down";
  if (up > down) return "up";
  return "stable";
}

/**
 * Vollständige Objective-Health-Berechnung.
 * Override hat Vorrang; sonst: KR progress (primär), KR trend (sekundär).
 */
export function computeObjectiveHealth(
  objective: ObjectiveRow,
  keyResults: KeyResultRow[],
  updatesByKeyResultId: Record<string, OkrUpdateRow[]>
): ObjectiveHealthResult {
  if (objective.objective_health_override) {
    return {
      status: objective.objective_health_override as ReviewStatus,
      score: 0,
      trend: "stable",
      isOverride: true,
    };
  }

  const krResults = keyResults.map((kr) => {
    const progress = computeKeyResultProgress(kr);
    const updates = updatesByKeyResultId[kr.id] ?? [];
    const trend = computeKeyResultTrend(kr, updates);
    const status = deriveKeyResultReviewStatus(progress, trend, kr.due_date, null);
    return { progress, status, trend };
  });

  const score = computeObjectiveHealthScore(krResults);
  const status = aggregateStatus(krResults.map((r) => r.status));
  const trend = aggregateTrend(krResults.map((r) => r.trend));

  return {
    status,
    score,
    trend,
    isOverride: false,
  };
}
