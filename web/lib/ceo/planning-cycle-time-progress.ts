function toTime(value: string): number {
  return new Date(value).getTime();
}

/** Zeitfortschritt im Planungszyklus (0–100 %), linear — analog zum erwarteten OKR-Zeitfortschritt. */
export function linearCycleProgressPercent(startIso: string, endIso: string, nowMs: number): number {
  const start = toTime(startIso);
  const end = toTime(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const clampedNow = Math.min(Math.max(nowMs, start), end);
  return Math.max(0, Math.min(100, ((clampedNow - start) / (end - start)) * 100));
}
