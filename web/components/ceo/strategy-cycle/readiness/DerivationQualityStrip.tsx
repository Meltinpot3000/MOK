"use client";

import type { DesignReadinessSnapshotResult } from "@/lib/strategy-cycle/design-readiness-snapshot";
import { ReadinessStatusBadge } from "./ReadinessStatusBadge";

type Props = {
  flow: DesignReadinessSnapshotResult["flow"];
};

function DerivationTile({
  label,
  pct,
  countLabel,
  status,
}: {
  label: string;
  pct: number | null;
  countLabel: string;
  status: DesignReadinessSnapshotResult["flow"]["analysis"]["status"];
}) {
  return (
    <div className="flex min-h-[6.75rem] min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-zinc-200 bg-zinc-50/80 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[10px] font-semibold leading-snug text-zinc-700">{label}</p>
        <ReadinessStatusBadge kind="status" value={status} compact className="shrink-0" />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900">
        {pct != null ? `${pct}%` : "—"}
      </p>
      <p className="mt-auto pt-1 text-[10px] leading-snug text-zinc-500">{countLabel}</p>
    </div>
  );
}

export function DerivationQualityStrip({ flow }: Props) {
  const ch = flow.challenges;
  const obj = flow.objectives;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        Ableitungsqualität
      </p>
      <div className="grid grid-cols-1 items-stretch gap-2 sm:grid-cols-3">
        <DerivationTile
          label="Analyse → Herausforderung"
          pct={flow.analysis.coveragePct}
          countLabel={`${flow.analysis.linkedToActiveChallenges} von ${flow.analysis.total} strategisch verarbeitet`}
          status={flow.analysis.status}
        />
        <DerivationTile
          label="Herausforderung → Stoßrichtung"
          pct={ch.directionResponsePct}
          countLabel={`${ch.withDirectionCount} von ${ch.readinessRelevant} mit Stoßrichtungsantwort`}
          status={ch.status}
        />
        <DerivationTile
          label="Stoßrichtung → Ziel"
          pct={obj.coveragePct}
          countLabel={`${obj.coveredByEligibleDirections} von ${obj.totalEligible} Ziele unterstützt`}
          status={obj.status}
        />
      </div>
    </div>
  );
}
