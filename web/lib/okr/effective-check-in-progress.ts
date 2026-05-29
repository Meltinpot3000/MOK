import type { OkrUpdateRow } from "@/lib/review/key-result-progress";

export type OkrUpdateVerificationStatus = "pending" | "confirmed" | "rejected" | "superseded";

/** Updates wirksam für Rollup: NULL (= sofort) oder confirmed; nicht pending/rejected/superseded. */
export function isOkrUpdateEffectiveForProgress(
  verificationStatus: OkrUpdateVerificationStatus | null | undefined
): boolean {
  return verificationStatus == null || verificationStatus === "confirmed";
}

/**
 * Wirksamer Check-in-Fortschritt: neuester effektiver Eintrag, sonst Metrik-Fallback.
 */
export function effectiveProgressFromCheckIns(
  updatesDescending: OkrUpdateRow[],
  metricProgress: number
): number {
  for (const row of updatesDescending) {
    if (!isOkrUpdateEffectiveForProgress(row.verification_status)) continue;
    const pv = row.progress_value;
    if (pv != null && Number.isFinite(Number(pv))) {
      return Math.min(100, Math.max(0, Number(pv)));
    }
  }
  return metricProgress;
}

/** Neuester Check-in (beliebiger Status) mit 100 % und pending — für Badge. */
export function hasPendingHundredCheckIn(updatesDescending: OkrUpdateRow[]): boolean {
  const latest = updatesDescending[0];
  if (!latest) return false;
  if (latest.verification_status !== "pending") return false;
  const pv = Number(latest.progress_value ?? NaN);
  return Number.isFinite(pv) && pv >= 100;
}

export function verificationStatusLabelDe(
  status: OkrUpdateVerificationStatus | null | undefined,
  progressValue: number | null | undefined
): string | null {
  if (status == null) return null;
  const pct =
    progressValue != null && Number.isFinite(Number(progressValue))
      ? `${Math.round(Number(progressValue))} %`
      : "100 %";
  switch (status) {
    case "pending":
      return `${pct} — Bestätigung ausstehend`;
    case "rejected":
      return `${pct} — abgelehnt`;
    case "superseded":
      return `${pct} — zurückgezogen`;
    case "confirmed":
      return null;
    default:
      return null;
  }
}
