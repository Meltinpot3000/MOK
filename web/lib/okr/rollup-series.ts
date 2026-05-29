import type { OkrObjectiveView } from "@/lib/okr/okr-cycle-view-model";
import { isOkrUpdateEffectiveForProgress } from "@/lib/okr/effective-check-in-progress";
import type { OkrUpdateRow } from "@/lib/review/key-result-progress";

export type ProgressSeriesPoint = { t: number; y: number };

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Montag 00:00 (lokal) der Kalenderwoche, die `t` enthält. */
export function startOfWeekLocalMs(t: number): number {
  const d = new Date(t);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function valueAtOrBefore(series: ProgressSeriesPoint[], t: number): number {
  if (series.length === 0) return 0;
  let v = series[0]?.y ?? 0;
  for (const p of series) {
    if (p.t <= t) v = p.y;
    else break;
  }
  return v;
}

/**
 * Trägt eine Check-in-Zeitreihe auf Kalenderwochen vor (Wert = Stand am Wochenende).
 * Leere Eingabe bleibt leer.
 */
export function resampleProgressSeriesToWeeks(points: ProgressSeriesPoint[]): ProgressSeriesPoint[] {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const weekStart0 = startOfWeekLocalMs(sorted[0].t);
  const weekStartLast = startOfWeekLocalMs(sorted[sorted.length - 1].t);
  const out: ProgressSeriesPoint[] = [];
  for (let ws = weekStart0; ws <= weekStartLast; ws += MS_PER_WEEK) {
    const weekEnd = ws + MS_PER_WEEK - 1;
    out.push({ t: ws, y: valueAtOrBefore(sorted, weekEnd) });
  }
  return out;
}

/** Rollup-Fortschritt (Mittel der KRs) über alle Check-in-Zeitpunkte eines Objectives. */
export function buildRollupSeries(
  ov: OkrObjectiveView,
  updatesByKeyResultId: Record<string, OkrUpdateRow[]>
): ProgressSeriesPoint[] {
  const krs = ov.keyResults;
  if (krs.length === 0) return [];
  const last: Record<string, number> = {};
  for (const kv of krs) last[kv.keyResult.id] = 0;
  type Ev = { t: number; krId: string; y: number };
  const events: Ev[] = [];
  for (const kv of krs) {
    const rows = updatesByKeyResultId[kv.keyResult.id] ?? [];
    const asc = [...rows].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    for (const row of asc) {
      if (!isOkrUpdateEffectiveForProgress(row.verification_status)) continue;
      const y =
        row.progress_value != null && Number.isFinite(Number(row.progress_value))
          ? Number(row.progress_value)
          : last[kv.keyResult.id];
      events.push({ t: Date.parse(row.created_at), krId: kv.keyResult.id, y });
    }
  }
  events.sort((a, b) => a.t - b.t);
  const points: ProgressSeriesPoint[] = [];
  for (const e of events) {
    last[e.krId] = e.y;
    const vals = krs.map((k) => last[k.keyResult.id]);
    points.push({ t: e.t, y: vals.reduce((a, b) => a + b, 0) / vals.length });
  }
  return points;
}

/** Durchschnitt der Objective-Rollups über die gemeinsame Zeitachse (für einen Gesamt-Verlauf). */
export function buildAggregateObjectiveProgressSeries(
  objectiveViews: OkrObjectiveView[],
  updatesByKeyResultId: Record<string, OkrUpdateRow[]>
): ProgressSeriesPoint[] {
  const perObj = objectiveViews
    .map((ov) => buildRollupSeries(ov, updatesByKeyResultId))
    .filter((s) => s.length > 0);
  if (perObj.length === 0) return [];
  const allT = new Set<number>();
  for (const s of perObj) for (const p of s) allT.add(p.t);
  const sortedT = [...allT].sort((a, b) => a - b);
  const eventBased = sortedT.map((t) => ({
    t,
    y: perObj.reduce((sum, s) => sum + valueAtOrBefore(s, t), 0) / perObj.length,
  }));
  return resampleProgressSeriesToWeeks(eventBased);
}

/** Wochenauflösung für ein einzelnes Objective (Dashboard-Linien). */
export function buildRollupSeriesWeekly(
  ov: OkrObjectiveView,
  updatesByKeyResultId: Record<string, OkrUpdateRow[]>
): ProgressSeriesPoint[] {
  return resampleProgressSeriesToWeeks(buildRollupSeries(ov, updatesByKeyResultId));
}
