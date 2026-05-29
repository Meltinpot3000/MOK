"use client";

import { useId, useMemo } from "react";

type Point = { t: number; y: number };

const W = 520;
const H = 112;
const PAD = { l: 36, r: 10, t: 10, b: 22 };

function formatDeShort(isoMs: number): string {
  try {
    return new Date(isoMs).toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}

/** Gerade Verbindung zwischen Check-in-Punkten — kein Spline, damit der Fortschritt nicht überschwingt. */
function linePathD(
  points: Point[],
  xAt: (t: number) => number,
  yAt: (yp: number) => number
): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => {
      const x = xAt(p.t).toFixed(2);
      const y = yAt(p.y).toFixed(2);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

type SparkGeom = {
  lineD: string;
  areaD: string;
  t0: number;
  t1: number;
  lastY: number;
  dotPoints: Point[];
  xAt: (t: number) => number;
  yAt: (yp: number) => number;
  ih: number;
};

function buildGeom(points: Point[]): SparkGeom | null {
  if (points.length === 0) return null;

  const t0v = points[0].t;
  const t1v = points[points.length - 1].t;
  const span = t1v - t0v || 1;
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const xAt = (t: number) => PAD.l + ((t - t0v) / span) * iw;
  const yAt = (yp: number) => PAD.t + ih - (Math.min(100, Math.max(0, yp)) / 100) * ih;

  const lineD = linePathD(points, xAt, yAt);
  let areaD = "";
  if (points.length >= 2 && lineD) {
    const baseY = PAD.t + ih;
    const xFirst = xAt(points[0].t).toFixed(2);
    const xLast = xAt(points[points.length - 1].t).toFixed(2);
    areaD = `${lineD} L ${xLast} ${baseY.toFixed(2)} L ${xFirst} ${baseY.toFixed(2)} Z`;
  }

  const maxDots = 6;
  const dotPoints = points.length <= maxDots ? points : [points[0], points[points.length - 1]];

  return {
    lineD,
    areaD,
    t0: t0v,
    t1: t1v,
    lastY: points[points.length - 1].y,
    dotPoints,
    xAt,
    yAt,
    ih,
  };
}

export function OkrRollupSparkline({ points }: { points: Point[] }) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const fillGradId = `okrSparkFill-${rawId}`;
  const strokeGradId = `okrSparkStroke-${rawId}`;
  const dotGradId = `okrSparkDot-${rawId}`;

  const geom = useMemo(() => buildGeom(points), [points]);

  if (!geom && points.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200/90 bg-zinc-50/50 px-3 py-6 text-center">
        <p className="text-[11px] font-medium text-zinc-500">Noch kein Verlauf aus Check-ins</p>
        <p className="mt-0.5 text-[10px] text-zinc-400">Mit mindestens zwei Zeitpunkten erscheint die Kurve.</p>
      </div>
    );
  }

  if (points.length === 1 && geom) {
    const { xAt, yAt, ih } = geom;
    const x = xAt(points[0].t);
    const y = yAt(points[0].y);
    return (
      <div className="overflow-hidden rounded-lg border border-zinc-200/80 bg-gradient-to-br from-white to-zinc-50/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100/90 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-600/85">
            Rollup-Verlauf
          </span>
          <span className="text-[11px] tabular-nums text-zinc-600">
            <span className="font-semibold text-zinc-900">{Math.round(points[0].y)}%</span>
            <span className="text-zinc-400"> · ein Datenpunkt</span>
          </span>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[100px] w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="OKR-Rollup: ein Check-in-Wert"
        >
          <defs>
            <radialGradient id={dotGradId} cx="50%" cy="40%" r="65%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </radialGradient>
          </defs>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={PAD.t + ih * 0.5}
            y2={PAD.t + ih * 0.5}
            stroke="#f4f4f5"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={x} cy={y} r={28} fill={`url(#${dotGradId})`} opacity={0.9} />
          <circle
            cx={x}
            cy={y}
            r={6}
            fill="white"
            stroke="#4f46e5"
            strokeWidth={2.25}
            vectorEffect="non-scaling-stroke"
          />
          <text x={PAD.l} y={H - 6} fill="#a1a1aa" fontSize={9}>
            {formatDeShort(points[0].t)}
          </text>
        </svg>
      </div>
    );
  }

  if (!geom) return null;

  const { lineD, areaD, t0, t1, lastY, dotPoints, xAt, yAt } = geom;
  const gridLevels = [0, 50, 100];

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200/80 bg-gradient-to-br from-white via-white to-indigo-50/25 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.7)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100/90 px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-600/85">
          Rollup-Verlauf
        </span>
        <span className="text-[11px] tabular-nums text-zinc-600">
          aktuell <span className="font-semibold text-zinc-900">{Math.round(lastY)}%</span>
          <span className="text-zinc-400">
            {" "}
            · {points.length} {points.length === 1 ? "Punkt" : "Punkte"}
          </span>
        </span>
      </div>
      <div className="px-1.5 pb-0.5 pt-1 sm:px-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[108px] w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Liniendiagramm Rollup-Fortschritt über die Zeit"
        >
          <defs>
            <linearGradient id={fillGradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.22" />
              <stop offset="55%" stopColor="#6366f1" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={strokeGradId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="55%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>
          </defs>

          {gridLevels.map((pct) => (
            <g key={pct}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={yAt(pct)}
                y2={yAt(pct)}
                stroke={pct === 0 || pct === 100 ? "#e4e4e7" : "#f4f4f5"}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={PAD.l - 6}
                y={yAt(pct) + 3}
                textAnchor="end"
                fill="#a1a1aa"
                fontSize={8}
              >
                {pct}%
              </text>
            </g>
          ))}

          {areaD ? <path d={areaD} fill={`url(#${fillGradId})`} stroke="none" /> : null}
          {lineD ? (
            <path
              d={lineD}
              fill="none"
              stroke={`url(#${strokeGradId})`}
              strokeWidth={2.35}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}

          {dotPoints.map((p, i) => {
            const cx = xAt(p.t);
            const cy = yAt(p.y);
            const isEnd = i === dotPoints.length - 1 && dotPoints.length > 1;
            return (
              <circle
                key={`${p.t}-${i}`}
                cx={cx}
                cy={cy}
                r={isEnd ? 5.5 : 4}
                fill="white"
                stroke={isEnd ? "#4f46e5" : "#71717a"}
                strokeWidth={isEnd ? 2.25 : 1.75}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          <text x={PAD.l} y={H - 5} fill="#a1a1aa" fontSize={9}>
            {formatDeShort(t0)}
          </text>
          <text x={W - PAD.r} y={H - 5} textAnchor="end" fill="#a1a1aa" fontSize={9}>
            {formatDeShort(t1)}
          </text>
        </svg>
      </div>
    </div>
  );
}
