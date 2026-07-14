"use client";

import type { DistributionGroup, DistributionItem } from "@/lib/strategy-cycle/design-readiness-snapshot";
import { DISTRIBUTION_CATEGORY_COLORS } from "@/lib/strategy-cycle/design-readiness-snapshot";
import { describeDonutSegment } from "./distribution-chart-utils";
import { DistributionLegendList } from "./DistributionLegendList";

type Props = {
  title: string;
  group: DistributionGroup;
};

type DonutSegment = {
  key: string;
  count: number;
  color: string;
};

function buildDonutSegments(items: DistributionItem[]): DonutSegment[] {
  const segments: DonutSegment[] = [];
  const visibleItems = items.filter((item) => item.totalCount > 0);

  visibleItems.forEach((item, index) => {
    const colors = DISTRIBUTION_CATEGORY_COLORS[index % DISTRIBUTION_CATEGORY_COLORS.length];
    if (item.activeCount > 0) {
      segments.push({
        key: `${item.id}-active`,
        count: item.activeCount,
        color: colors.active,
      });
    }
    if (item.inactiveCount > 0) {
      segments.push({
        key: `${item.id}-inactive`,
        count: item.inactiveCount,
        color: colors.inactive,
      });
    }
  });

  return segments;
}

function DonutSvg({ group }: { group: DistributionGroup }) {
  const segments = buildDonutSegments(group.items);
  const total = group.totalAssignments;
  const cx = 50;
  const cy = 50;
  const outerR = 42;
  const innerR = 28;

  if (total <= 0 || segments.length === 0) {
    return (
      <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0" aria-hidden>
        <circle cx={cx} cy={cy} r={outerR} fill="#f4f4f5" />
        <circle cx={cx} cy={cy} r={innerR} fill="white" />
      </svg>
    );
  }

  let cursor = 0;
  const paths = segments.map((seg) => {
    const startAngle = (cursor / total) * 360;
    cursor += seg.count;
    const endAngle = (cursor / total) * 360;
    const d = describeDonutSegment(cx, cy, outerR, innerR, startAngle, endAngle);
    return <path key={seg.key} d={d} fill={seg.color} />;
  });

  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0" aria-hidden>
      {paths}
      <circle cx={cx} cy={cy} r={innerR} fill="white" />
      <text
        x={cx}
        y={cy - 2}
        textAnchor="middle"
        className="fill-zinc-900 text-[14px] font-semibold"
        style={{ fontSize: "14px", fontWeight: 600 }}
      >
        {group.totalAssignments}
      </text>
      <text
        x={cx}
        y={cy + 10}
        textAnchor="middle"
        className="fill-zinc-500"
        style={{ fontSize: "7px" }}
      >
        Zuordnungen
      </text>
    </svg>
  );
}

function ActivityKey() {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-zinc-500">
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-sm bg-zinc-700" aria-hidden />
        Aktiv
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-sm bg-zinc-300" aria-hidden />
        Nicht aktiv
      </span>
    </div>
  );
}

export function DonutDistributionChart({ title, group }: Props) {
  if (group.emptyHint) {
    return (
      <div className="flex min-w-0 flex-1 flex-col rounded-md border border-dashed border-zinc-300 bg-zinc-50/60 px-4 py-5">
        <p className="text-sm font-semibold text-zinc-800">{title}</p>
        <p className="mt-2 text-sm font-medium text-zinc-700">Keine Kontext-Schwerpunkte vorhanden.</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">
          Im aktuellen Fokus sind keine Industrie- bzw. Geschäftsmodell-Zuordnungen gepflegt.
        </p>
        <p className="mt-2 text-xs text-zinc-600">{group.emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-md border border-zinc-200 bg-white px-4 py-3">
      <p className="text-sm font-semibold text-zinc-900">{title}</p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex shrink-0 justify-center sm:justify-start">
          <DonutSvg group={group} />
        </div>
        <DistributionLegendList group={group} />
      </div>
      <ActivityKey />
    </div>
  );
}
