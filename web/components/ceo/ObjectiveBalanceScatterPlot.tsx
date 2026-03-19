"use client";

type Objective = {
  id: string;
  title: string;
  importance_score?: number | null;
  ai_objective_score?: number | null;
  ai_external_internal_classification?: string | null;
  ai_exploit_explore_classification?: string | null;
  ai_short_long_term_classification?: string | null;
  ai_clarity_score?: number | null;
  ai_strategic_relevance_score?: number | null;
  ai_feasibility_score?: number | null;
  ai_fit_to_company_score?: number | null;
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

/** Leichte Verschiebung aus Teilscores (1–5), damit Punkte nicht alle exakt auf Gitter (-1/0/1) liegen. */
function scoreNudge(a: number | null | undefined, b: number | null | undefined): number {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
  return ((x - y) / 4) * 0.32;
}

function clampAxis(v: number): number {
  return Math.max(-1, Math.min(1, v));
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
  const getXBase = (o: Objective) => {
    if (xAxis === "external_internal") return classificationToAxis(o.ai_external_internal_classification);
    return classificationToAxis(o.ai_short_long_term_classification);
  };
  const getYBase = (o: Objective) => {
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
        Keine Klassifikationsdaten. Fuehre die Objectives-Bewertung aus.
      </div>
    );
  }

  const size = 280;
  const padding = 40;
  const toX = (v: number) => padding + ((v + 1) / 2) * (size - 2 * padding);
  const toY = (v: number) => size - padding - ((v + 1) / 2) * (size - 2 * padding);

  return (
    <div className="space-y-2">
      <p className="max-w-sm text-xs text-zinc-500">
        Position: KI-Klassifikation (diskrete Felder). Zusaetzliche kleine Verschiebung aus den Teilscores (1–5), damit
        sich aehnliche Objective sichtbar trennen — nicht interpretierbar als neue Dimension.
      </p>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="overflow-visible">
          <line x1={padding} y1={size / 2} x2={size - padding} y2={size / 2} stroke="#d4d4d8" strokeWidth={1} />
          <line x1={size / 2} y1={padding} x2={size / 2} y2={size - padding} stroke="#d4d4d8" strokeWidth={1} />
          <text x={padding} y={size / 2 - 12} className="fill-zinc-500 text-xs">
            {xAxis === "external_internal" ? "Intern" : "Kurz"}
          </text>
          <text x={size - padding - 28} y={size / 2 - 12} className="fill-zinc-500 text-xs">
            {xAxis === "external_internal" ? "Extern" : "Lang"}
          </text>
          <text x={size / 2 - 16} y={padding - 8} className="fill-zinc-500 text-xs">
            {yAxis === "exploit_explore" ? "Exploit" : "Intern"}
          </text>
          <text x={size / 2 - 18} y={size - padding + 16} className="fill-zinc-500 text-xs">
            {yAxis === "exploit_explore" ? "Explore" : "Extern"}
          </text>
          {objectives.map((o) => {
            const xb = getXBase(o);
            const yb = getYBase(o);
            const nudgeX = scoreNudge(o.ai_strategic_relevance_score, o.ai_feasibility_score);
            const nudgeY = scoreNudge(o.ai_clarity_score, o.ai_fit_to_company_score);
            const x = toX(clampAxis(xb + nudgeX));
            const y = toY(clampAxis(yb + nudgeY));
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
                <title>{`${o.title} (Gesamtscore: ${o.ai_objective_score ?? "-"})`}</title>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
