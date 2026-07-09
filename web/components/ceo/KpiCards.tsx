"use client";

import type { KpiCard } from "@/lib/ceo/kpis";
import { KpiCardTile } from "@/components/ceo/KpiCardTile";

type KpiCardsProps = {
  items: KpiCard[];
  /** Neben schmaler Spalte (z. B. rechts von der Cycle Map): ab xl eine Spalte, darunter weiterhin Raster. */
  layout?: "default" | "aside";
};

/** Gleiche Verlauf-Akzente wie im CEO-Dashboard; für andere Übersichtskacheln wiederverwendbar. */
export const KPI_ACCENTS = [
  "from-violet-500/15 to-fuchsia-500/10 ring-violet-200/60",
  "from-sky-500/15 to-cyan-500/10 ring-sky-200/60",
  "from-emerald-500/12 to-amber-500/10 ring-emerald-200/50",
  "from-rose-500/18 to-orange-500/10 ring-rose-200/60",
  "from-amber-500/15 to-yellow-500/8 ring-amber-200/55",
  "from-orange-500/14 to-red-500/8 ring-orange-200/55",
] as const;

export function KpiCards({ items, layout = "default" }: KpiCardsProps) {
  const gridClass =
    layout === "aside"
      ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-1 xl:gap-2.5"
      : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5";

  return (
    <section
      className={
        layout === "aside" ? "flex h-full min-h-0 flex-col space-y-3" : "space-y-3"
      }
    >
      <div className={gridClass}>
        {items.map((item, index) => {
          const accent = KPI_ACCENTS[index % KPI_ACCENTS.length];
          const paddingClass = layout === "aside" ? "p-3 sm:p-4 xl:p-3" : "p-4";
          return (
            <KpiCardTile
              key={item.label}
              accent={accent}
              paddingClass={paddingClass}
              valueSizeClass={
                layout === "aside" ? "text-xl sm:text-2xl xl:text-xl" : "text-2xl sm:text-3xl"
              }
              label={item.label}
              value={item.value}
              hint={item.hint}
            />
          );
        })}
      </div>
    </section>
  );
}
