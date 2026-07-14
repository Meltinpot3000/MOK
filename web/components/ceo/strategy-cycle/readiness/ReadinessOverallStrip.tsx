"use client";

import type { DesignReadinessSnapshotResult } from "@/lib/strategy-cycle/design-readiness-snapshot";
import { ReadinessStatusBadge } from "./ReadinessStatusBadge";

type Props = {
  overall: DesignReadinessSnapshotResult["overall"];
};

function BandPill({
  label,
  band,
}: {
  label: string;
  band: DesignReadinessSnapshotResult["overall"]["readinessBand"];
}) {
  return (
    <div className="text-center sm:text-left">
      <p className="text-[10px] font-medium text-zinc-500">{label}</p>
      <span className="mt-1 inline-block max-w-full">
        <ReadinessStatusBadge kind="band" value={band} compact />
      </span>
    </div>
  );
}

export function ReadinessOverallStrip({ overall }: Props) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-start justify-end gap-5 sm:gap-6">
        <BandPill label="Gesamt" band={overall.readinessBand} />
        <BandPill label="Herausforderungen" band={overall.challengeReadinessBand} />
        <BandPill label="Stoßrichtungen" band={overall.directionReadinessBand} />
      </div>
      {overall.openReviewHintsCount > 0 ? (
        <p className="text-right text-[10px] text-zinc-500">
          {overall.openReviewHintsCount} offene Review-Hinweise
        </p>
      ) : null}
    </div>
  );
}
