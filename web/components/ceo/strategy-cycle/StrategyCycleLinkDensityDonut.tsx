"use client";

import type { LinkDensityBucket, LinkDensityDonutModel } from "@/lib/strategy-cycle/strategy-cycle-dashboard-insights";
import {
  LINK_DENSITY_BUCKET_COLORS,
  metricStatusBadgeClass,
  metricStatusLabelDe,
} from "@/lib/strategy-cycle/strategy-cycle-dashboard-insights";
import { describeDonutSegment } from "@/components/ceo/strategy-cycle/readiness/distribution-chart-utils";

type Props = {
  model: LinkDensityDonutModel;
  centerLabel: string;
  onBucketClick?: (bucket: LinkDensityBucket) => void;
};

function LinkDensityDonutSvg({
  model,
  centerLabel,
  onBucketClick,
}: {
  model: LinkDensityDonutModel;
  centerLabel: string;
  onBucketClick?: (bucket: LinkDensityBucket) => void;
}) {
  const cx = 50;
  const cy = 50;
  const outerR = 42;
  const innerR = 28;
  const visibleBuckets = model.buckets.filter((b) => b.count > 0);
  const total = model.total;

  if (total <= 0 || visibleBuckets.length === 0) {
    return (
      <svg viewBox="0 0 100 100" className="h-32 w-32 shrink-0" aria-hidden>
        <circle cx={cx} cy={cy} r={outerR} fill="#f4f4f5" />
        <circle cx={cx} cy={cy} r={innerR} fill="white" />
        <text x={cx} y={cy - 2} textAnchor="middle" style={{ fontSize: "14px", fontWeight: 600 }} fill="#18181b">
          0
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" style={{ fontSize: "7px" }} fill="#71717a">
          {centerLabel}
        </text>
      </svg>
    );
  }

  let cursor = 0;
  const paths = visibleBuckets.map((bucket) => {
    const startAngle = (cursor / total) * 360;
    cursor += bucket.count;
    const endAngle = (cursor / total) * 360;
    const d = describeDonutSegment(cx, cy, outerR, innerR, startAngle, endAngle);
    const clickable = bucket.count > 0 && onBucketClick;
    return (
      <path
        key={bucket.key}
        d={d}
        fill={LINK_DENSITY_BUCKET_COLORS[bucket.key]}
        className={clickable ? "cursor-pointer transition-opacity hover:opacity-80" : undefined}
        onClick={clickable ? () => onBucketClick(bucket) : undefined}
        role={clickable ? "button" : undefined}
        aria-label={clickable ? `${bucket.label}: ${bucket.count}` : undefined}
      />
    );
  });

  return (
    <svg viewBox="0 0 100 100" className="h-32 w-32 shrink-0" aria-hidden>
      {paths}
      <circle cx={cx} cy={cy} r={innerR} fill="white" />
      <text x={cx} y={cy - 2} textAnchor="middle" style={{ fontSize: "14px", fontWeight: 600 }} fill="#18181b">
        {total}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" style={{ fontSize: "7px" }} fill="#71717a">
        {centerLabel}
      </text>
    </svg>
  );
}

export function StrategyCycleLinkDensityDonut({ model, centerLabel, onBucketClick }: Props) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-zinc-900">{model.title}</h4>
      <p className="mt-1 text-xs text-zinc-600">{model.description}</p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex shrink-0 justify-center sm:justify-start">
          <LinkDensityDonutSvg model={model} centerLabel={centerLabel} onBucketClick={onBucketClick} />
        </div>
        <ul className="min-w-0 flex-1 space-y-1.5">
          {model.buckets.map((bucket) => {
            const clickable = bucket.count > 0 && onBucketClick;
            return (
              <li key={bucket.key}>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={clickable ? () => onBucketClick(bucket) : undefined}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                    clickable
                      ? "cursor-pointer hover:bg-zinc-50"
                      : "cursor-default text-zinc-500"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: LINK_DENSITY_BUCKET_COLORS[bucket.key] }}
                      aria-hidden
                    />
                    <span className="truncate text-zinc-700">{bucket.label}</span>
                    <span
                      className={`inline-flex shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${metricStatusBadgeClass(bucket.status)}`}
                    >
                      {metricStatusLabelDe(bucket.status)}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-zinc-900">{bucket.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {model.total === 0 ? (
        <p className="mt-3 text-xs text-zinc-500">Noch keine Daten für diese Verknüpfungsanalyse.</p>
      ) : null}
    </div>
  );
}
