import type { OkrDashboardGroupSummary } from "@/lib/okr/okr-dashboard-grouping";
import { formatStatusDistribution } from "@/lib/okr/okr-cycle-view-model";
import { OkrProgressBar } from "@/components/ceo/okr/OkrProgressBar";
import { OkrStatusBadge } from "@/components/ceo/okr/OkrStatusBadge";

type OkrDashboardGroupSummaryProps = {
  group: OkrDashboardGroupSummary;
  groupLabel: string;
};

export function OkrDashboardGroupSummaryBar({ group, groupLabel }: OkrDashboardGroupSummaryProps) {
  return (
    <div className="mb-2 rounded-lg border border-zinc-200 bg-zinc-50/90 px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{groupLabel}</p>
          <p className="truncate text-sm font-semibold text-zinc-900">{group.label}</p>
        </div>
        <OkrStatusBadge status={group.rollupStatus} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-600">
        <span>
          <span className="font-medium text-zinc-800">{group.objectiveCount}</span> Objectives
        </span>
        <span>
          <span className="font-medium text-zinc-800">{group.keyResultCount}</span> Key Results
        </span>
        <span>{formatStatusDistribution(group.statusCounts)}</span>
        {group.warningCount > 0 ? (
          <span className="text-amber-800">{group.warningCount} Hinweise</span>
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="shrink-0 text-[11px] font-medium tabular-nums text-zinc-700">
          Ø {Math.round(group.avgProgressPercent)}%
        </span>
        <div className="min-w-[120px] flex-1">
          <OkrProgressBar value={group.avgProgressPercent} />
        </div>
      </div>
    </div>
  );
}
