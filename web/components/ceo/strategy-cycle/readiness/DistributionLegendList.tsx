"use client";

import type { DistributionGroup } from "@/lib/strategy-cycle/design-readiness-snapshot";
import { DISTRIBUTION_CATEGORY_COLORS } from "@/lib/strategy-cycle/design-readiness-snapshot";

type Props = {
  group: DistributionGroup;
};

export function DistributionLegendList({ group }: Props) {
  const visibleItems = group.items.filter((item) => item.totalCount > 0);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_3rem_3rem] gap-x-2 border-b border-zinc-200 pb-1 text-[9px] font-semibold uppercase tracking-wide text-zinc-500">
        <span>Kategorie</span>
        <span className="text-right">Aktiv</span>
        <span className="text-right">Nicht aktiv</span>
      </div>
      <ul className="space-y-1">
        {visibleItems.map((item, index) => {
          const color =
            DISTRIBUTION_CATEGORY_COLORS[index % DISTRIBUTION_CATEGORY_COLORS.length].active;
          return (
            <li
              key={item.id}
              className="grid grid-cols-[minmax(0,1fr)_3rem_3rem] gap-x-2 text-[11px] leading-snug text-zinc-700"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="text-right font-semibold tabular-nums text-zinc-900">
                {item.activeCount}
              </span>
              <span className="text-right font-semibold tabular-nums text-zinc-600">
                {item.inactiveCount}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
