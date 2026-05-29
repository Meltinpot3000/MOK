export type KpiCard = {
  label: string;
  value: string;
  hint?: string;
};

type BuildKpisInput = {
  okrObjectives: Array<{ status: string; progress_percent: number }>;
  /** Abweichung vom Plan: Objectives (Rollup-Status wackelig/kritisch). */
  atRiskObjectiveCount: number;
  /** Abweichung vom Plan: Key Results (Review-Status wackelig/kritisch). */
  atRiskKeyResultCount: number;
  okrObjectiveCount: number;
  keyResultCount: number;
  trendDeltaPercent: number | null;
  okrAssigneeCount: number;
  activeMemberCount: number;
};

function formatPercent(value: number): string {
  if (Number.isNaN(value)) {
    return "0%";
  }

  return `${Math.round(value)}%`;
}

export function buildCeoKpis(input: BuildKpisInput): KpiCard[] {
  const okrObjectivesSafe = input.okrObjectives ?? [];
  const {
    atRiskObjectiveCount,
    atRiskKeyResultCount,
    okrObjectiveCount,
    keyResultCount,
    trendDeltaPercent,
    okrAssigneeCount,
    activeMemberCount,
  } = input;
  const objectiveCount = okrObjectivesSafe.length;

  const totalProgress = okrObjectivesSafe.reduce(
    (sum, objective) => sum + Number(objective.progress_percent || 0),
    0
  );
  const overallProgress = objectiveCount > 0 ? totalProgress / objectiveCount : 0;

  const completedObjectives = okrObjectivesSafe.filter(
    (objective) => objective.status === "completed"
  ).length;
  const completionRate =
    objectiveCount > 0 ? (completedObjectives / objectiveCount) * 100 : 0;

  const atRiskTotal = atRiskObjectiveCount + atRiskKeyResultCount;

  const trendText =
    trendDeltaPercent === null
      ? "N/A"
      : `${trendDeltaPercent >= 0 ? "+" : ""}${Math.round(trendDeltaPercent)} pp`;

  const withoutOkrObjectiveCount = Math.max(0, activeMemberCount - okrAssigneeCount);

  return [
    {
      label: "Gesamtfortschritt OKR",
      value: formatPercent(overallProgress),
      hint: `Durchschnitt Rollup wie OKR-Übersicht · ${objectiveCount} OKR-Objectives`,
    },
    {
      label: "Abweichung vom Plan",
      value: String(atRiskTotal),
      hint: `${atRiskObjectiveCount} OKR-Objectives, ${atRiskKeyResultCount} Key Results (wackelig/kritisch)`,
    },
    {
      label: "Abschlussquote",
      value: formatPercent(completionRate),
      hint: `${completedObjectives} von ${objectiveCount} OKR-Objectives abgeschlossen`,
    },
    {
      label: "OKRs",
      value: String(okrObjectiveCount),
      hint:
        okrObjectiveCount === 0
          ? "Keine OKRs in diesem Quartal"
          : "OKRs im aktuellen Quartal",
    },
    {
      label: "Key Results",
      value: String(keyResultCount),
      hint:
        keyResultCount === 0
          ? "Keine Key Results in diesem Quartal"
          : `Key Results zu ${okrObjectiveCount} OKR${okrObjectiveCount === 1 ? "" : "s"}`,
    },
    {
      label: "Trend zum vorherigen Zyklus",
      value: trendText,
      hint: "Vergleich Durchschnitts-Rollup wie OKR-Übersicht",
    },
    {
      label: "Personen mit OKR-Objective",
      value: `${okrAssigneeCount} / ${activeMemberCount}`,
      hint: `${withoutOkrObjectiveCount} aktive Mitglieder ohne OKR-Objective`,
    },
  ];
}
