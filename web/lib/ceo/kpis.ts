export type KpiCard = {
  label: string;
  value: string;
  hint?: string;
};

type BuildKpisInput = {
  objectives: Array<{ progress_percent: number; status: string }>;
  keyResults: Array<{ status: string }>;
  functionDistribution: Record<string, number>;
  trendDeltaPercent: number | null;
};

function formatPercent(value: number): string {
  if (Number.isNaN(value)) {
    return "0%";
  }

  return `${Math.round(value)}%`;
}

export function buildCeoKpis(input: BuildKpisInput): KpiCard[] {
  const { objectives, keyResults, functionDistribution, trendDeltaPercent } = input;
  const objectiveCount = objectives.length;

  const totalProgress = objectives.reduce(
    (sum, objective) => sum + Number(objective.progress_percent || 0),
    0
  );
  const overallProgress = objectiveCount > 0 ? totalProgress / objectiveCount : 0;

  const completedObjectives = objectives.filter(
    (objective) => objective.status === "completed"
  ).length;
  const completionRate =
    objectiveCount > 0 ? (completedObjectives / objectiveCount) * 100 : 0;

  const atRiskObjectives = objectives.filter(
    (objective) => objective.status === "at_risk"
  ).length;
  const atRiskKeyResults = keyResults.filter((keyResult) => keyResult.status === "at_risk").length;
  const atRiskTotal = atRiskObjectives + atRiskKeyResults;

  const distributionText =
    Object.keys(functionDistribution).length === 0
      ? "Keine Funktionsziele"
      : Object.entries(functionDistribution)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, count]) => `${name}: ${count}`)
          .join(" | ");

  const trendText =
    trendDeltaPercent === null
      ? "N/A"
      : `${trendDeltaPercent >= 0 ? "+" : ""}${Math.round(trendDeltaPercent)} pp`;

  return [
    {
      label: "Gesamtfortschritt Objectives",
      value: formatPercent(overallProgress),
      hint: `${objectiveCount} Objectives im Zyklus`,
    },
    {
      label: "At-Risk Count",
      value: String(atRiskTotal),
      hint: `${atRiskObjectives} Objectives, ${atRiskKeyResults} Key Results`,
    },
    {
      label: "Abschlussquote",
      value: formatPercent(completionRate),
      hint: `${completedObjectives} von ${objectiveCount} Objectives abgeschlossen`,
    },
    {
      label: "Verteilung Funktionen",
      value: String(Object.keys(functionDistribution).length),
      hint: distributionText,
    },
    {
      label: "Trend vs. vorheriger Zyklus",
      value: trendText,
      hint: "Vergleich Durchschnittsfortschritt Objectives",
    },
  ];
}
