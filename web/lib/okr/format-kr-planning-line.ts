export type KrPlanningLineInput = {
  metricType: string;
  startValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
  measurementUnit: string | null;
};

function okrMetricTypeLabelDe(metricType: string): string {
  switch (metricType) {
    case "numeric":
      return "Numerisch";
    case "percent":
      return "Prozent";
    case "boolean":
      return "erfüllt/Nicht erfüllt";
    default:
      return metricType;
  }
}

export function formatKrPlanningReadOnlyLine(kr: KrPlanningLineInput): string {
  const kind = okrMetricTypeLabelDe(kr.metricType);
  const cur = kr.currentValue ?? "—";
  const tgt = kr.targetValue ?? "—";
  if (kr.metricType === "boolean") {
    return `${kind}: Ist ${cur} · Ziel ${tgt}`;
  }
  if (kr.metricType === "percent") {
    return `${kind}: ${cur} / Ziel ${tgt} %`;
  }
  return `${kind}: ${cur} / Ziel ${tgt} (${kr.measurementUnit ?? "—"})`;
}
