"use client";

import { useState, useCallback, useEffect } from "react";

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
  ai_issues_json?: unknown;
  ai_improvement_suggestion?: string | null;
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

/** Deterministischer Offset aus ID + Teilscores, damit Punkte sich sichtbar trennen (kein Zufall). */
function deterministicNudge(
  id: string,
  a: number | null | undefined,
  b: number | null | undefined,
  index: number
): number {
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const idOffset = ((hash % 17) / 17 - 0.5) * 0.24;
  const x = Number(a);
  const y = Number(b);
  const scoreOffset = Number.isFinite(x) && Number.isFinite(y) ? ((x - y) / 4) * 0.2 : 0;
  const indexOffset = (index % 5) * 0.02 - 0.04;
  return idOffset + scoreOffset + indexOffset;
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

function getScoreColorHex(score: number | null | undefined): string {
  if (score == null) return "#a1a1aa";
  if (score >= 4) return "#10b981";
  if (score >= 3) return "#f59e0b";
  return "#ef4444";
}

/** Berechnet Balance-Status aus der Verteilung der strategischen Ziele (Strategiezyklus). */
function computeBalanceStatus(
  objectives: Objective[],
  getXBase: (o: Objective) => number,
  getYBase: (o: Objective) => number,
  xAxis: string,
  yAxis: string
): { status: "balanced" | "warning"; message: string } {
  const withData = objectives.filter(
    (o) =>
      o.ai_external_internal_classification ?? o.ai_exploit_explore_classification ?? o.ai_short_long_term_classification
  );
  if (withData.length < 2) return { status: "balanced", message: "Ausgewogen über Dimensionen" };

  const avgX = withData.reduce((s, o) => s + getXBase(o), 0) / withData.length;
  const avgY = withData.reduce((s, o) => s + getYBase(o), 0) / withData.length;

  const threshold = 0.4;
  const warnings: string[] = [];

  if (xAxis === "external_internal") {
    if (avgX < -threshold) warnings.push("zu intern fokussiert");
    else if (avgX > threshold) warnings.push("zu extern fokussiert");
  } else {
    if (avgX < -threshold) warnings.push("zu kurzfristig");
    else if (avgX > threshold) warnings.push("zu langfristig");
  }

  if (yAxis === "exploit_explore") {
    if (avgY < -threshold) warnings.push("zu exploit-fokussiert");
    else if (avgY > threshold) warnings.push("zu explore-fokussiert");
  } else {
    if (avgY < -threshold) warnings.push("zu intern");
    else if (avgY > threshold) warnings.push("zu extern");
  }

  if (warnings.length > 0) {
    return { status: "warning", message: `⚠️ ${warnings.join(", ")}` };
  }
  return { status: "balanced", message: "✓ Ausgewogen über Dimensionen" };
}

export function ObjectiveBalanceScatterPlot({
  objectives,
  xAxis = "external_internal",
  yAxis = "exploit_explore",
}: ObjectiveBalanceScatterPlotProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [enlarged, setEnlarged] = useState(false);

  useEffect(() => {
    if (!enlarged) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEnlarged(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enlarged]);

  const getXBase = useCallback(
    (o: Objective) => {
      if (xAxis === "external_internal") return classificationToAxis(o.ai_external_internal_classification);
      return classificationToAxis(o.ai_short_long_term_classification);
    },
    [xAxis]
  );
  const getYBase = useCallback(
    (o: Objective) => {
      if (yAxis === "exploit_explore") return classificationToAxis(o.ai_exploit_explore_classification);
      return classificationToAxis(o.ai_external_internal_classification);
    },
    [yAxis]
  );

  const hasData = objectives.some(
    (o) =>
      o.ai_external_internal_classification ?? o.ai_exploit_explore_classification ?? o.ai_short_long_term_classification
  );

  if (!hasData || objectives.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-sm text-zinc-600">
        
        Keine Klassifikationsdaten. Führe die Ziele-Bewertung aus.
      </div>
    );
  }

  const padding = 40;
  const balance = computeBalanceStatus(objectives, getXBase, getYBase, xAxis, yAxis);
  const hoveredObjective = hoveredId ? objectives.find((o) => o.id === hoveredId) : null;

  const renderFigure = (size: number) => {
    const toX = (v: number) => padding + ((v + 1) / 2) * (size - 2 * padding);
    const toY = (v: number) => size - padding - ((v + 1) / 2) * (size - 2 * padding);
    return (
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="overflow-visible" onMouseLeave={() => setHoveredId(null)}>
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
          {objectives.map((o, index) => {
            const xb = getXBase(o);
            const yb = getYBase(o);
            const nudgeX = deterministicNudge(
              o.id,
              o.ai_strategic_relevance_score,
              o.ai_feasibility_score,
              index
            );
            const nudgeY = deterministicNudge(o.id, o.ai_clarity_score, o.ai_fit_to_company_score, index + 1);
            const x = toX(clampAxis(xb + nudgeX));
            const y = toY(clampAxis(yb + nudgeY));
            const relevanceScore = o.ai_objective_score ?? o.importance_score ?? 3;
            const r = 6 + (Math.max(1, Math.min(5, Number(relevanceScore))) - 1) * 2;
            const isHovered = hoveredId === o.id;
            return (
              <g
                key={o.id}
                onMouseEnter={(e) => {
                  setHoveredId(o.id);
                  const rect = (e.target as SVGElement).ownerSVGElement?.getBoundingClientRect();
                  if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                onMouseMove={(e) => {
                  const rect = (e.target as SVGElement).ownerSVGElement?.getBoundingClientRect();
                  if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={getScoreColorHex(o.ai_objective_score)}
                  fillOpacity={isHovered ? 1 : 0.85}
                  stroke={isHovered ? "#374151" : "#71717a"}
                  strokeWidth={isHovered ? 2 : 1}
                />
              </g>
            );
          })}
        </svg>

        {hoveredObjective && (
          <div
            className="pointer-events-none absolute z-10 max-w-xs rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left shadow-lg"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y,
              // Tooltip wächst immer Richtung Bildmitte, damit er an keinem Rand abgeschnitten wird.
              transform: `translate(${
                tooltipPos.x > size / 2 ? "calc(-100% - 12px)" : "12px"
              }, ${tooltipPos.y > size / 2 ? "calc(-100% - 12px)" : "12px"})`,
            }}
          >
            <p className="font-semibold text-zinc-900">{hoveredObjective.title}</p>
            <p className="mt-1 text-sm text-zinc-600">
              <span className="font-medium">Score:</span>{" "}
              {hoveredObjective.ai_objective_score != null
                ? hoveredObjective.ai_objective_score.toFixed(1)
                : "—"}
            </p>
            {Array.isArray(hoveredObjective.ai_issues_json) && hoveredObjective.ai_issues_json.length > 0 && (
              <p className="mt-1 text-sm text-zinc-600">
                <span className="font-medium">Issues:</span>{" "}
                {(hoveredObjective.ai_issues_json as string[]).join("; ")}
              </p>
            )}
            {hoveredObjective.ai_improvement_suggestion && (
              <p className="mt-1 text-sm text-zinc-600">
                <span className="font-medium">Suggestion:</span> {hoveredObjective.ai_improvement_suggestion}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderLegend = () => (
    <div className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs">
      <p className="font-semibold text-zinc-700">Legende</p>
      <div className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" />
        <span>Score ≥ 4 (gut)</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-full bg-amber-500" />
        <span>Score 3–4 (mittel)</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
        <span>Score &lt; 3 (problematisch)</span>
      </div>
      <div className="mt-2 border-t border-zinc-200 pt-2">
        <p className="text-zinc-600">
          <strong>Größe</strong> = Relevanz (importance_score / ai_objective_score)
        </p>
        <p className="mt-1 text-zinc-600">
          <strong>Farbe</strong> = Qualität (AI-Score)
        </p>
        <p className="mt-1 text-zinc-600">
          <strong>Position</strong> = Dimension ({xAxis === "external_internal" ? "Intern↔Extern" : "Kurz↔Lang"} ×{" "}
          {yAxis === "exploit_explore" ? "Exploit↔Explore" : "Intern↔Extern"})
        </p>
      </div>
    </div>
  );

  const enlargedSize =
    typeof window !== "undefined"
      ? Math.max(320, Math.min(720, Math.min(window.innerWidth - 96, window.innerHeight - 220)))
      : 600;

  return (
    <div className="space-y-3">
      {/* Balance-Indicator + Vergrößern */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            balance.status === "warning" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"
          }`}
        >
          Balance: {balance.message}
        </div>
        <button
          type="button"
          onClick={() => setEnlarged(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          aria-label="Diagramm vergrößern"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Vergrößern
        </button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {renderFigure(280)}
        {renderLegend()}
      </div>

      {enlarged && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            aria-label="Schließen"
            className="absolute inset-0 bg-zinc-900/60"
            onClick={() => setEnlarged(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ziel-Balance Streudiagramm (vergrößert)"
            className="relative z-10 max-h-[90vh] w-full max-w-4xl overflow-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-zinc-900">Ziel-Balance (Streudiagramm)</h2>
              <button
                type="button"
                onClick={() => setEnlarged(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
                aria-label="Schließen"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div
              className={`mt-4 rounded-md px-3 py-2 text-sm font-medium ${
                balance.status === "warning" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"
              }`}
            >
              Balance: {balance.message}
            </div>
            <div className="mt-4 flex flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center">
              {renderFigure(enlargedSize)}
              {renderLegend()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
