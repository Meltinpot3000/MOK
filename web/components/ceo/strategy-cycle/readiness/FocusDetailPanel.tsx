"use client";

import type { FocusDetailSummary } from "@/lib/strategy-cycle/design-readiness-snapshot";
import { ReadinessStatusBadge } from "./ReadinessStatusBadge";
import { ReadinessKpiCard } from "./ReadinessKpiCard";
import { ReviewActionList } from "./ReviewActionList";

type Props = {
  detail: FocusDetailSummary;
};

export function FocusDetailPanel({ detail }: Props) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-zinc-200 pb-3">
        <h3 className="min-w-0 flex-1 text-sm font-semibold text-zinc-900">{detail.title}</h3>
        <ReadinessStatusBadge kind="band" value={detail.readinessBand} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {detail.kpis.map((kpi) => (
          <ReadinessKpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            hint={kpi.hint}
            status={kpi.status}
          />
        ))}
      </div>

      <div className="mt-4 space-y-3 rounded-md border-l-4 border-amber-400 bg-amber-50/60 px-3 py-2.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/80">
            Befund
          </p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-800">{detail.finding}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/80">
            Review-Fokus
          </p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-800">{detail.reviewFocus}</p>
        </div>
      </div>

      <div className="mt-4 flex-1">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Review-Aktionen
        </p>
        <ReviewActionList actions={detail.actions} />
      </div>
    </div>
  );
}
