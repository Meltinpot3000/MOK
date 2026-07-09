import { OKR_LINEAR_AT_RISK_GAP_PP } from "@/lib/okr/okr-cycle-view-model";

export type OkrProgressPlanBucket = "ahead" | "on_plan" | "behind";

export const OKR_PROGRESS_PLAN_BUCKET_LABELS: Record<OkrProgressPlanBucket, string> = {
  ahead: "Vor dem Plan",
  on_plan: "Im Plan",
  behind: "Hinter dem Plan",
};

/** Erwarteter Fortschritt entlang der OKR-Zykluszeit (0–100 %). */
export function computeLinearExpectedProgressPercent(
  cycleStartIso: string,
  cycleEndIso: string,
  nowMs: number = Date.now()
): number {
  const start = Date.parse(cycleStartIso);
  const end = Date.parse(cycleEndIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }
  const clampedNow = Math.min(Math.max(nowMs, start), end);
  return ((clampedNow - start) / (end - start)) * 100;
}

/**
 * Vergleicht Ist-Fortschritt mit linearem Zeitplan (gleiche Logik wie Review-Status, drei Stufen).
 * ahead: Fortschritt über Erwartung · on_plan: Rückstand ≤ 10 pp · behind: Rückstand > 10 pp
 */
export function classifyOkrProgressVsPlan(
  progressPercent: number,
  cycleStartIso: string,
  cycleEndIso: string,
  nowMs: number = Date.now()
): OkrProgressPlanBucket {
  const expected = computeLinearExpectedProgressPercent(cycleStartIso, cycleEndIso, nowMs);
  const gapPp = expected - progressPercent;
  if (gapPp < 0) return "ahead";
  if (gapPp <= OKR_LINEAR_AT_RISK_GAP_PP) return "on_plan";
  return "behind";
}
