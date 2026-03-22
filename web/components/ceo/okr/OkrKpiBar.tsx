import type { OkrCycleKpis } from "@/lib/okr/okr-cycle-view-model";

type OkrKpiBarProps = {
  kpis: OkrCycleKpis;
};

export function OkrKpiBar({ kpis }: OkrKpiBarProps) {
  const { objectiveCount, keyResultCount, statusCounts, criticalCount, keyResultsWithoutInitiative, initiativesWithoutKr } =
    kpis;

  const cell = "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-center shadow-sm";
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <div className={cell}>
        <p className="text-xs text-zinc-500">OKR-Objectives</p>
        <p className="text-lg font-semibold text-zinc-900">{objectiveCount}</p>
      </div>
      <div className={cell}>
        <p className="text-xs text-zinc-500">Key Results</p>
        <p className="text-lg font-semibold text-zinc-900">{keyResultCount}</p>
      </div>
      <div className={cell}>
        <p className="text-xs text-zinc-500">KR Status</p>
        <p className="text-sm font-medium text-zinc-800">
          {statusCounts.on_track} / {statusCounts.at_risk} / {statusCounts.off_track}
        </p>
        <p className="text-[10px] text-zinc-500">on / risk / off</p>
      </div>
      <div className={cell}>
        <p className="text-xs text-zinc-500">Kritisch</p>
        <p className="text-lg font-semibold text-red-700">{criticalCount}</p>
      </div>
      <div className={cell}>
        <p className="text-xs text-zinc-500">KR ohne Initiative</p>
        <p className="text-lg font-semibold text-amber-800">{keyResultsWithoutInitiative}</p>
      </div>
      <div className={cell}>
        <p className="text-xs text-zinc-500">Init. ohne KR</p>
        <p className="text-lg font-semibold text-amber-800">{initiativesWithoutKr}</p>
      </div>
    </div>
  );
}
