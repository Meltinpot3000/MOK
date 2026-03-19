"use client";

type Objective = {
  id: string;
  title: string;
  importance_score?: number | null;
  ai_objective_score?: number | null;
  ai_external_internal_classification?: string | null;
  ai_exploit_explore_classification?: string | null;
  ai_short_long_term_classification?: string | null;
};

type ObjectiveBalanceScatterPlotProps = {
  objectives: Objective[];
  xAxis?: "external_internal" | "short_long";
  yAxis?: "exploit_explore" | "external_internal";
};

function classificationToAxis(value: string | null | undefined): number {
  if (!value) return 0;
  const map: Record<string, number> = {
    internal: -1,
    balanced: 0,
    external: 1,
    short: -1,
    mid: 0,
    long: 1,
    exploit: -1,
    explore: 1,
  };
  return map[value] ?? 0;
}

function getScoreColor(score: number | null | undefined): string {
  if (score == null) return "bg-zinc-300";
  if (score >= 4) return "bg-emerald-500";
  if (score >= 3) return "bg-amber-500";
  return "bg-red-500";
}

export function ObjectiveBalanceScatterPlot({
  objectives,
  xAxis = "external_internal",
  yAxis = "exploit_explore",
}: ObjectiveBalanceScatterPlotProps) {
  const getX = (o: Objective) => {
    if (xAxis === "external_internal") return classificationToAxis(o.ai_external_internal_classification);
    return classificationToAxis(o.ai_short_long_term_classification);
  };
  const getY = (o: Objective) => {
    if (yAxis === "exploit_explore") return classificationToAxis(o.ai_exploit_explore_classification);
    return classificationToAxis(o.ai_external_internal_classification);
  };

  const hasData = objectives.some(
    (o) =>
      o.ai_external_internal_classification ?? o.ai_exploit_explore_classification ?? o.ai_short_long_term_classification
  );

  if (!hasData || objectives.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-sm text-zinc-600">
        Keine Klassifikationsdaten. Fuehre die Objectives KI-Bewertung aus.
      </div>
    );
  }

  const size = 280;
  const padding = 40;
  const toX = (v: number) => padding + ((v + 1) / 2) * (size - 2 * padding);
  const toY = (v: number) => size - padding - ((v + 1) / 2) * (size - 2 * padding);

  return (
    <div className="space-y-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="overflow-visible">
          <line x1={padding} y1={size / 2} x2={size - padding} y2={size / 2} stroke="#d4d4d8" strokeWidth={1} />
          <line x1={size / 2} y1={padding} x2={size / 2} y2={size - padding} stroke="#d4d4d8" strokeWidth={1} />
          <text x={padding} y={size / 2 - 12} className="fill-zinc-500 text-xs">
            {xAxis === "external_internal" ? "Internal" : "Short"}
          </text>
          <text x={size - padding - 24} y={size / 2 - 12} className="fill-zinc-500 text-xs">
            {xAxis === "external_internal" ? "External" : "Long"}
          </text>
          <text x={size / 2 - 12} y={padding - 8} className="fill-zinc-500 text-xs">
            {yAxis === "exploit_explore" ? "Exploit" : "Internal"}
          </text>
          <text x={size / 2 - 12} y={size - padding + 16} className="fill-zinc-500 text-xs">
            {yAxis === "exploit_explore" ? "Explore" : "External"}
          </text>
          {objectives.map((o, i) => {
            const x = toX(getX(o));
            const y = toY(getY(o));
            const r = 8 + (Number(o.importance_score ?? 3) - 1) * 2;
            return (
              <g key={o.id}>
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  className={getScoreColor(o.ai_objective_score)}
                  fillOpacity={0.8}
                  stroke="#71717a"
                  strokeWidth={1}
                />
                <title>{`${o.title} (Score: ${o.ai_objective_score ?? "-"})`}</title>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
