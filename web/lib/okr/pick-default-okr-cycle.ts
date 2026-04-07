/**
 * Wählt den Standard-OKR-Zeitraum ohne URL-Parameter.
 * 1) Heute liegt in [start_date, end_date]: diesen Zeitraum (mehrere → „active“ bevorzugt, dann jüngster Start).
 * 2) Sonst: Zyklus mit minimaler Distanz zum Referenzdatum (Tage außerhalb des Intervalls).
 *    Gleiche Distanz: „active“ bevorzugt, dann jüngster start_date.
 */
export type OkrCyclePickRow = {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
};

function utcDateOnlyIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Mittag UTC, um Grenzfälle bei Datum-only zu vermeiden */
function dateOnlyUtcMs(isoDate: string): number {
  const d = isoDate.slice(0, 10);
  return Date.parse(`${d}T12:00:00.000Z`);
}

/** 0 wenn reference im Intervall; sonst ms-Distanz zur nächsten Kante (immer ≥ 0) */
function distanceToCycle(referenceMs: number, c: OkrCyclePickRow): number {
  const s = dateOnlyUtcMs(c.start_date);
  const e = dateOnlyUtcMs(c.end_date);
  if (referenceMs >= s && referenceMs <= e) return 0;
  if (referenceMs < s) return s - referenceMs;
  return referenceMs - e;
}

/** Reihenfolge wie pickDefaultOkrCycle (bester zuerst) — z. B. Fallback wenn der Default-Zeitraum keine Daten hat. */
export function orderOkrCyclesByPickPreference(
  cycles: OkrCyclePickRow[],
  referenceDate: Date = new Date()
): OkrCyclePickRow[] {
  if (cycles.length === 0) return [];
  const today = utcDateOnlyIso(referenceDate);
  const refMs = dateOnlyUtcMs(today);

  const inWindow = cycles.filter((c) => c.start_date <= today && today <= c.end_date);
  if (inWindow.length > 0) {
    const activeInWindow = inWindow.filter((c) => c.status === "active");
    const pool = activeInWindow.length > 0 ? activeInWindow : inWindow;
    return [...pool].sort((a, b) => dateOnlyUtcMs(b.start_date) - dateOnlyUtcMs(a.start_date));
  }

  return [...cycles].sort((a, b) => {
    const da = distanceToCycle(refMs, a);
    const db = distanceToCycle(refMs, b);
    if (da !== db) return da - db;
    const aAct = a.status === "active" ? 0 : 1;
    const bAct = b.status === "active" ? 0 : 1;
    if (aAct !== bAct) return aAct - bAct;
    return dateOnlyUtcMs(b.start_date) - dateOnlyUtcMs(a.start_date);
  });
}

export function pickDefaultOkrCycle(cycles: OkrCyclePickRow[], referenceDate: Date = new Date()): string | null {
  return orderOkrCyclesByPickPreference(cycles, referenceDate)[0]?.id ?? null;
}
