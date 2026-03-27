"use client";

import { useMemo } from "react";
import type { OkrObjectiveView } from "@/lib/okr/okr-cycle-view-model";
import type { OkrUpdateRow } from "@/lib/review/key-result-progress";
import { buildAggregateObjectiveProgressSeries, buildRollupSeries } from "@/lib/okr/rollup-series";

const W = 720;
const H = 200;
const PAD = { l: 44, r: 12, t: 18, b: 36 };

const LINE_PALETTE = ["#6366f1", "#0ea5e9", "#14b8a6", "#f59e0b", "#d946ef", "#22c55e"];

type OkrObjectiveProgressLineChartProps = {
  objectiveViews: OkrObjectiveView[];
  updatesByKeyResultId: Record<string, OkrUpdateRow[]>;
};

function statusRank(s: OkrObjectiveView["rollupStatus"]): number {
  if (s === "off_track") return 0;
  if (s === "at_risk") return 1;
  return 2;
}

function formatDeShort(isoMs: number): string {
  try {
    return new Date(isoMs).toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

export function OkrObjectiveProgressLineChart({
  objectiveViews,
  updatesByKeyResultId,
}: OkrObjectiveProgressLineChartProps) {
  const { aggregate, detailSeries, t0, t1, hasAnyPoint } = useMemo(() => {
    const aggregatePoints = buildAggregateObjectiveProgressSeries(objectiveViews, updatesByKeyResultId);
    const sorted = [...objectiveViews].sort((a, b) => {
      const r = statusRank(a.rollupStatus) - statusRank(b.rollupStatus);
      if (r !== 0) return r;
      return a.objective.title.localeCompare(b.objective.title, "de");
    });
    const detail = sorted.slice(0, 6).map((ov, i) => ({
      id: ov.objective.id,
      label: ov.objective.title.length > 42 ? `${ov.objective.title.slice(0, 40)}…` : ov.objective.title,
      color: LINE_PALETTE[i % LINE_PALETTE.length] ?? "#71717a",
      points: buildRollupSeries(ov, updatesByKeyResultId),
    }));

    let minT = Number.POSITIVE_INFINITY;
    let maxT = Number.NEGATIVE_INFINITY;
    const consider = (pts: { t: number }[]) => {
      for (const p of pts) {
        if (p.t < minT) minT = p.t;
        if (p.t > maxT) maxT = p.t;
      }
    };
    consider(aggregatePoints);
    for (const s of detail) consider(s.points);

    const hasPoint =
      aggregatePoints.length > 0 ||
      detail.some((s) => s.points.length > 0);

    if (!Number.isFinite(minT) || !Number.isFinite(maxT) || minT === maxT) {
      if (aggregatePoints.length === 1) {
        minT = aggregatePoints[0].t - 86400000;
        maxT = aggregatePoints[0].t + 86400000;
      } else {
        const now = Date.now();
        minT = now - 7 * 86400000;
        maxT = now;
      }
    }

    return {
      aggregate: aggregatePoints,
      detailSeries: detail,
      t0: minT,
      t1: maxT,
      hasAnyPoint: hasPoint,
    };
  }, [objectiveViews, updatesByKeyResultId]);

  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const span = t1 - t0 || 1;
  const xAt = (t: number) => PAD.l + ((t - t0) / span) * iw;
  const yAt = (yp: number) => PAD.t + ih - (Math.min(100, Math.max(0, yp)) / 100) * ih;

  const aggregatePathD = useMemo(() => {
    if (aggregate.length === 0) return "";
    return aggregate
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(p.t).toFixed(1)} ${yAt(p.y).toFixed(1)}`)
      .join(" ");
  }, [aggregate, t0, t1]);

  const aggregateAreaD = useMemo(() => {
    if (aggregate.length === 0) return "";
    const baseY = PAD.t + ih;
    const firstX = xAt(aggregate[0].t).toFixed(1);
    const lastX = xAt(aggregate[aggregate.length - 1].t).toFixed(1);
    const path = aggregate
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(p.t).toFixed(1)} ${yAt(p.y).toFixed(1)}`)
      .join(" ");
    return `${path} L ${lastX} ${baseY.toFixed(1)} L ${firstX} ${baseY.toFixed(1)} Z`;
  }, [aggregate, t0, t1]);

  if (!hasAnyPoint) {
    return (
      <div className="rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-zinc-50 via-white to-indigo-50/40 px-5 py-10 text-center shadow-sm">
        <p className="text-sm font-medium text-zinc-700">Noch kein Verlauf aus Check-ins</p>
        <p className="mt-1 text-xs text-zinc-500">
          Sobald Teams Fortschritt eintragen, erscheint hier der Mittelwert über alle OKR-Objectives.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-white via-zinc-50/30 to-indigo-50/50 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100/80 px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-600/90">
            OKR-Fortschritt
          </p>
          <h3 className="mt-0.5 text-sm font-semibold text-zinc-900">Verlauf im Zeitraum</h3>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Linie: Mittel aller Objectives · Farben: bis zu sechs Einzelziele (nach Dringlichkeit sortiert)
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-5 rounded-full bg-zinc-900" />
            Mittelwert
          </span>
          {detailSeries.map((s) => (
            <span key={s.id} className="inline-flex max-w-[140px] items-center gap-1.5 truncate">
              <span className="h-0.5 w-4 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="truncate">{s.label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="px-2 pb-1 pt-2 sm:px-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[200px] w-full max-w-full"
          role="img"
          aria-label="Liniendiagramm OKR-Fortschritt über die Zeit"
        >
          <defs>
            <linearGradient id="okrChartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="okrChartStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>
          </defs>

          {[0, 25, 50, 75, 100].map((pct) => (
            <g key={pct}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={yAt(pct)}
                y2={yAt(pct)}
                stroke="#e4e4e7"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={PAD.l - 8}
                y={yAt(pct) + 4}
                textAnchor="end"
                fill="#a1a1aa"
                fontSize={9}
              >
                {pct}%
              </text>
            </g>
          ))}

          {aggregateAreaD ? (
            <path d={aggregateAreaD} fill="url(#okrChartFill)" stroke="none" />
          ) : null}
          {aggregate.length > 1 && aggregatePathD ? (
            <path
              d={aggregatePathD}
              fill="none"
              stroke="url(#okrChartStroke)"
              strokeWidth={2.75}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {aggregate.length === 1 ? (
            <circle
              cx={xAt(aggregate[0].t)}
              cy={yAt(aggregate[0].y)}
              r={5}
              fill="white"
              stroke="#4f46e5"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ) : null}

          {detailSeries.map((s) => {
            if (s.points.length < 2) return null;
            const d = s.points
              .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(p.t).toFixed(1)} ${yAt(p.y).toFixed(1)}`)
              .join(" ");
            return (
              <path
                key={s.id}
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth={1.25}
                strokeOpacity={0.72}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          <text x={PAD.l} y={H - 10} fill="#71717a" fontSize={10}>
            {formatDeShort(t0)}
          </text>
          <text x={W - PAD.r} y={H - 10} textAnchor="end" fill="#71717a" fontSize={10}>
            {formatDeShort(t1)}
          </text>
        </svg>
      </div>
    </div>
  );
}
