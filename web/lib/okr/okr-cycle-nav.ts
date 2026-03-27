/**
 * Chronologischer Nachfolger im OKR-Zeitraum (wie Carousel-Liste aus getOkrCycles).
 */
export type OkrCycleNavRow = {
  id: string;
  start_date: string;
};

export function resolveNextOkrCycleId(
  cycles: OkrCycleNavRow[],
  currentId: string | null | undefined
): string | null {
  const id = currentId?.trim() || null;
  if (!id || cycles.length === 0) return null;
  const sorted = [...cycles].sort((a, b) => Date.parse(a.start_date) - Date.parse(b.start_date));
  const idx = sorted.findIndex((c) => c.id === id);
  if (idx < 0 || idx >= sorted.length - 1) return null;
  return sorted[idx + 1]?.id ?? null;
}
