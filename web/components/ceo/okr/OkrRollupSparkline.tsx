"use client";

type Point = { t: number; y: number };

export function OkrRollupSparkline({ points }: { points: Point[] }) {
  if (points.length === 0) {
    return <p className="text-[11px] text-zinc-400">Noch kein Verlauf.</p>;
  }
  if (points.length === 1) {
    return (
      <p className="text-[11px] text-zinc-500">
        Ø {Math.round(points[0].y)}% <span className="text-zinc-400">(ein Punkt)</span>
      </p>
    );
  }
  const w = 480;
  const h = 72;
  const pad = { l: 28, r: 6, t: 6, b: 14 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const span = t1 - t0 || 1;
  const xAt = (t: number) => pad.l + ((t - t0) / span) * iw;
  const yAt = (yp: number) => pad.t + ih - (Math.min(100, Math.max(0, yp)) / 100) * ih;
  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(p.t).toFixed(1)} ${yAt(p.y).toFixed(1)}`)
    .join(" ");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Verlauf</span>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-12 min-w-0 flex-1" preserveAspectRatio="none">
        <path
          d={pathD}
          fill="none"
          stroke="#3f3f46"
          strokeWidth="1.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={xAt(p.t)}
            cy={yAt(p.y)}
            r={2.5}
            fill="white"
            stroke="#18181b"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}
