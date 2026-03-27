/**
 * Key Result Progress – berechnet, nicht persistiert.
 * Formeln je metric_type: numeric, percent, boolean.
 */

export type KeyResultRow = {
  id: string;
  objective_id: string;
  metric_type: string;
  start_value: number | null;
  target_value: number | null;
  current_value: number | null;
  due_date?: string | null;
};

export type OkrUpdateRow = {
  progress_value: number | null;
  created_at: string;
  confidence_level?: number | null;
  comment?: string | null;
};

export type ReviewStatus = "on_track" | "at_risk" | "off_track";
export type Trend = "up" | "stable" | "down";

/**
 * Berechnet Progress (0–100) je metric_type.
 * numeric: (current - start) / (target - start) * 100, mit Edge-Cases für abnehmende Metriken.
 * percent: current direkt als Progress (0–100).
 * boolean: current >= 1 → 100%, sonst 0%.
 */
export function computeKeyResultProgress(kr: KeyResultRow): number {
  const start = Number(kr.start_value ?? 0);
  const target = Number(kr.target_value ?? 100);
  const current = Number(kr.current_value ?? start);

  switch (kr.metric_type) {
    case "percent":
      return Math.min(100, Math.max(0, current));
    case "boolean":
      return current >= 1 ? 100 : 0;
    case "numeric":
    default: {
      const range = target - start;
      if (range === 0) return current >= target ? 100 : 0;
      const progress = (current - start) / range * 100;
      return Math.min(100, Math.max(0, progress));
    }
  }
}

/**
 * Trend aus Update-Historie: up / stable / down.
 * Vergleicht letzte 2 Updates oder current vs. vorherigen Wert.
 */
export function computeKeyResultTrend(
  kr: KeyResultRow,
  updates: OkrUpdateRow[]
): Trend {
  if (updates.length < 2) return "stable";
  const [latest, prev] = updates.slice(0, 2);
  const latestVal = Number(latest.progress_value ?? 0);
  const prevVal = Number(prev.progress_value ?? 0);
  const delta = latestVal - prevVal;
  if (delta > 2) return "up";
  if (delta < -2) return "down";
  return "stable";
}

/**
 * Abgeleiteter Review-Status: on_track / at_risk / off_track.
 * Berücksichtigt progress, trend, due date pressure.
 * Override prüfen: wenn keyResult.key_result_review_override gesetzt, diesen verwenden.
 */
export function deriveKeyResultReviewStatus(
  progress: number,
  trend: Trend,
  dueDate: string | null | undefined,
  override: ReviewStatus | null | undefined
): ReviewStatus {
  if (override) return override;

  const now = new Date();
  const due = dueDate ? new Date(dueDate) : null;
  const daysToDue = due ? Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

  if (progress >= 80 && trend !== "down") return "on_track";
  if (progress < 40 || trend === "down") return "off_track";
  if (daysToDue !== null && daysToDue < 30 && progress < 60) return "at_risk";
  if (progress < 60) return "at_risk";

  return "on_track";
}
