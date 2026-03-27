import type { OkrObjectiveView } from "@/lib/okr/okr-cycle-view-model";
import type { OkrUpdateRow } from "@/lib/review/key-result-progress";

/** Rollup-Fortschritt (Mittel der KRs) über alle Check-in-Zeitpunkte eines Objectives. */
export function buildRollupSeries(
  ov: OkrObjectiveView,
  updatesByKeyResultId: Record<string, OkrUpdateRow[]>
): { t: number; y: number }[] {
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
      const y =
        row.progress_value != null && Number.isFinite(Number(row.progress_value))
          ? Number(row.progress_value)
          : last[kv.keyResult.id];
      events.push({ t: Date.parse(row.created_at), krId: kv.keyResult.id, y });
    }
  }
  events.sort((a, b) => a.t - b.t);
  const points: { t: number; y: number }[] = [];
  for (const e of events) {
    last[e.krId] = e.y;
    const vals = krs.map((k) => last[k.keyResult.id]);
    points.push({ t: e.t, y: vals.reduce((a, b) => a + b, 0) / vals.length });
  }
  return points;
}

function valueAtOrBefore(series: { t: number; y: number }[], t: number): number {
  if (series.length === 0) return 0;
  let v = series[0]?.y ?? 0;
  for (const p of series) {
    if (p.t <= t) v = p.y;
    else break;
  }
  return v;
}

/** Durchschnitt der Objective-Rollups über die gemeinsame Zeitachse (für einen Gesamt-Verlauf). */
export function buildAggregateObjectiveProgressSeries(
  objectiveViews: OkrObjectiveView[],
  updatesByKeyResultId: Record<string, OkrUpdateRow[]>
): { t: number; y: number }[] {
  const perObj = objectiveViews
    .map((ov) => buildRollupSeries(ov, updatesByKeyResultId))
    .filter((s) => s.length > 0);
  if (perObj.length === 0) return [];
  const allT = new Set<number>();
  for (const s of perObj) for (const p of s) allT.add(p.t);
  const sortedT = [...allT].sort((a, b) => a - b);
  return sortedT.map((t) => ({
    t,
    y: perObj.reduce((sum, s) => sum + valueAtOrBefore(s, t), 0) / perObj.length,
  }));
}
