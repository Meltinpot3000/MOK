import { isActiveExecutionInitiativeStatus } from "@/lib/review/initiative-review-fields";

export type CycleContentProgress = {
  contentProgressPercent: number | null;
  detailHint: string;
};

export function computeOkrCycleContentProgress(
  objectives: Array<{ progress_percent: number }>
): CycleContentProgress {
  if (objectives.length === 0) {
    return { contentProgressPercent: null, detailHint: "Keine OKR-Objectives im Zyklus" };
  }
  const total = objectives.reduce((sum, row) => sum + Number(row.progress_percent || 0), 0);
  const avg = total / objectives.length;
  return {
    contentProgressPercent: Math.round(avg),
    detailHint: `Durchschnitt Rollup · ${objectives.length} OKR-Objectives`,
  };
}

export function computeReviewCycleContentProgress(
  initiatives: Array<{ progress_percent: number; weight: number; status: string }>
): CycleContentProgress {
  // TODO(review-coverage): Wenn Jahresziele als operative Abdeckung gelten,
  // Fortschritts-KPI um aktiven JZ-Fortschritt erweitern (nicht nur Initiativen).
  const active = initiatives.filter((row) => isActiveExecutionInitiativeStatus(row.status));
  const weightSum = active.reduce((sum, row) => sum + Number(row.weight || 0), 0);
  if (active.length === 0 || weightSum <= 0) {
    return { contentProgressPercent: null, detailHint: "Keine aktiven Initiativen mit Gewicht" };
  }
  const weighted = active.reduce(
    (sum, row) => sum + Number(row.progress_percent || 0) * Number(row.weight || 0),
    0
  );
  return {
    contentProgressPercent: Math.round(weighted / weightSum),
    detailHint: `Gewichteter Initiativen-Fortschritt · ${active.length} aktiv`,
  };
}

/** Inhalt minus Zeit (Prozentpunkte): positiv = voraus, negativ = Rückstand. */
export function computeContentVsTimeDeltaPp(
  contentProgressPercent: number | null,
  timeProgressPercent: number
): number | null {
  if (contentProgressPercent == null) return null;
  return Math.round(contentProgressPercent - timeProgressPercent);
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Kalenderwochen im Zyklus (mind. 1), gerundet. */
export function cycleDurationWeeks(cycleStartIso: string, cycleEndIso: string): number {
  const start = Date.parse(cycleStartIso);
  const end = Date.parse(cycleEndIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.max(1, Math.round((end - start) / MS_PER_WEEK));
}

export type ProgressVsPlanWeeks = {
  totalWeeks: number;
  /** Vorzeichen: positiv = voraus, negativ = zurück. */
  weeksDelta: number;
  deltaPercentPoints: number;
};

export function computeProgressVsPlanWeeks(
  deltaPp: number | null,
  cycleStartIso: string,
  cycleEndIso: string
): ProgressVsPlanWeeks | null {
  if (deltaPp == null || deltaPp === 0) return null;
  const totalWeeks = cycleDurationWeeks(cycleStartIso, cycleEndIso);
  if (totalWeeks <= 0) return null;
  const weeksMagnitude = Math.round((Math.abs(deltaPp) / 100) * totalWeeks * 10) / 10;
  const weeksDelta = deltaPp > 0 ? weeksMagnitude : -weeksMagnitude;
  return { totalWeeks, weeksDelta, deltaPercentPoints: Math.abs(deltaPp) };
}

function formatWeeksDe(weeks: number): string {
  const abs = Math.abs(weeks);
  const num = Number.isInteger(abs) ? String(abs) : abs.toFixed(1).replace(".", ",");
  if (abs === 1) return "1 Woche";
  return `${num} Wochen`;
}

/** Eine Zeile für die Zykluskarte: z. B. «≈2 Wochen voraus · 14% von 13 Wochen». */
export function formatProgressVsPlanWeeksDe(
  deltaPp: number | null,
  cycleStartIso: string | undefined,
  cycleEndIso: string | undefined
): string | null {
  if (!cycleStartIso || !cycleEndIso) return null;
  const computed = computeProgressVsPlanWeeks(deltaPp, cycleStartIso, cycleEndIso);
  if (!computed) return null;
  const { totalWeeks, weeksDelta, deltaPercentPoints } = computed;
  const weeksLabel = formatWeeksDe(weeksDelta);
  if (weeksDelta > 0) {
    return `≈${weeksLabel} voraus · ${deltaPercentPoints}% von ${totalWeeks} Wochen`;
  }
  return `≈${weeksLabel} zurück · ${deltaPercentPoints}% von ${totalWeeks} Wochen`;
}

/** Kurzform für die Kreismitte: z. B. «1,8 Wochen voraus». */
export function formatProgressVsPlanWeeksShortDe(
  deltaPp: number | null,
  cycleStartIso: string | undefined,
  cycleEndIso: string | undefined
): string | null {
  if (!cycleStartIso || !cycleEndIso) return null;
  const computed = computeProgressVsPlanWeeks(deltaPp, cycleStartIso, cycleEndIso);
  if (!computed) return null;
  const weeksLabel = formatWeeksDe(Math.abs(computed.weeksDelta));
  if (computed.weeksDelta > 0) return `${weeksLabel} voraus`;
  return `${weeksLabel} zurück`;
}
