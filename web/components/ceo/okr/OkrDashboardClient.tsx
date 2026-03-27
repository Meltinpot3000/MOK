"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { OkrCycleKpis, OkrObjectiveView } from "@/lib/okr/okr-cycle-view-model";
import type { OkrUpdateRow } from "@/lib/review/key-result-progress";
import { ExpandableTable, type ColumnDef } from "@/components/ceo/ExpandableTable";
import { OkrKpiBar } from "@/components/ceo/okr/OkrKpiBar";
import { OkrObjectiveProgressLineChart } from "@/components/ceo/okr/OkrObjectiveProgressLineChart";
import { OkrProgressBar } from "@/components/ceo/okr/OkrProgressBar";
import { OkrRollupSparkline } from "@/components/ceo/okr/OkrRollupSparkline";
import { OkrStatusBadge } from "@/components/ceo/okr/OkrStatusBadge";
import { OkrWarningBadge } from "@/components/ceo/okr/OkrWarningBadge";
import { buildRollupSeries } from "@/lib/okr/rollup-series";

function formatDeDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function confidenceLabel(level: number | null | undefined): string {
  if (level == null || Number.isNaN(level)) return "—";
  return `${Math.round(Number(level))}/10`;
}

type OkrDashboardClientProps = {
  kpis: OkrCycleKpis;
  objectiveViews: OkrObjectiveView[];
  okrCycleId: string;
  selectedOkrCycleLabel: string;
  updatesByKeyResultId: Record<string, OkrUpdateRow[]>;
};

export function OkrDashboardClient({
  kpis,
  objectiveViews,
  okrCycleId,
  selectedOkrCycleLabel,
  updatesByKeyResultId,
}: OkrDashboardClientProps) {
  const trackingHref = useMemo(
    () => (objectiveId: string) => {
      const q = new URLSearchParams({ okrCycle: okrCycleId, objective: objectiveId });
      return `/okr/tracking?${q.toString()}`;
    },
    [okrCycleId]
  );

  const tableColumns: ColumnDef<OkrObjectiveView>[] = useMemo(
    () => [
      {
        id: "title",
        label: "Objective",
        sortValue: (ov) => ov.objective.title,
        render: (ov) => (
          <span className="text-sm font-medium text-zinc-900">{ov.objective.title}</span>
        ),
      },
      {
        id: "direction",
        label: "Stoßrichtung",
        sortValue: (ov) => ov.objective.leadingStrategicDirectionTitle ?? "",
        render: (ov) => (
          <span className="text-xs text-zinc-600">{ov.objective.leadingStrategicDirectionTitle ?? "—"}</span>
        ),
      },
      {
        id: "status",
        label: "",
        sortValue: (ov) => ov.rollupStatus,
        render: (ov) => <OkrStatusBadge status={ov.rollupStatus} />,
      },
      {
        id: "progress",
        label: "%",
        sortValue: (ov) => ov.rollupProgressPercent,
        cellClassName: "w-[108px]",
        render: (ov) => (
          <div className="flex items-center gap-1.5">
            <OkrProgressBar value={ov.rollupProgressPercent} />
            <span className="w-7 shrink-0 text-right text-[11px] tabular-nums text-zinc-500">
              {Math.round(ov.rollupProgressPercent)}
            </span>
          </div>
        ),
      },
      {
        id: "warnings",
        label: "Hinweise",
        sortValue: (ov) => ov.warnings.length,
        render: (ov) =>
          ov.warnings.length === 0 ? (
            <span className="text-[11px] text-zinc-400">—</span>
          ) : (
            <div className="flex max-w-[200px] flex-wrap gap-0.5">
              {ov.warnings.map((w) => (
                <OkrWarningBadge key={w} kind={w} />
              ))}
            </div>
          ),
      },
    ],
    []
  );

  return (
    <div className="space-y-5">
      <OkrKpiBar kpis={kpis} okrCycleId={okrCycleId} />

      <p className="text-xs text-zinc-500">
        Zeitraum: <span className="font-medium text-zinc-700">{selectedOkrCycleLabel}</span>
      </p>

      <OkrObjectiveProgressLineChart objectiveViews={objectiveViews} updatesByKeyResultId={updatesByKeyResultId} />

      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 px-3 py-2">
          <h2 className="text-sm font-semibold text-zinc-900">OKR-Objectives</h2>
          <p className="text-[11px] text-zinc-500">Zeile aufklappen für Key Results und Verlauf.</p>
        </div>
        <div className="p-2 sm:p-3">
          <ExpandableTable<OkrObjectiveView>
            columns={tableColumns}
            rows={objectiveViews}
            getRowId={(ov) => ov.objective.id}
            enableColumnPickerUi={false}
            expandLabel=""
            emptyMessage="Keine OKR-Objectives."
            renderExpandedContent={(ov) => {
              const rollupPoints = buildRollupSeries(ov, updatesByKeyResultId);
              return (
                <div className="border-t border-zinc-100 bg-zinc-50/60 px-2 py-3 sm:px-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-200/80 pb-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900">{ov.objective.title}</p>
                      <p className="truncate text-[11px] text-zinc-500">
                        {ov.objective.leadingStrategicDirectionTitle ?? "—"} · {ov.objective.ownerDisplayName ?? "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <OkrStatusBadge status={ov.rollupStatus} />
                      <span className="text-[11px] text-zinc-400">{formatDeDate(ov.lastActivityAt)}</span>
                    </div>
                  </div>

                  {ov.warnings.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {ov.warnings.map((w) => (
                        <OkrWarningBadge key={w} kind={w} />
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-3 rounded-md border border-zinc-200/80 bg-white px-2 py-2">
                    <OkrRollupSparkline points={rollupPoints} />
                  </div>

                  <ul className="mt-2 divide-y divide-zinc-100 rounded-md border border-zinc-200 bg-white">
                    {ov.keyResults.map((kv) => {
                      const updates = updatesByKeyResultId[kv.keyResult.id] ?? [];
                      const lastIn = updates[0];
                      return (
                        <li key={kv.keyResult.id} className="px-2 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-zinc-900">{kv.keyResult.title}</p>
                              <p className="truncate text-[10px] text-zinc-500">
                                {Math.round(kv.progress)}%
                                {Math.round(kv.metricProgress) !== Math.round(kv.progress)
                                  ? ` · Metrik ${Math.round(kv.metricProgress)}%`
                                  : ""}{" "}
                                · Zuversicht {confidenceLabel(kv.confidenceLevel)}
                                {lastIn ? ` · zuletzt ${formatDeDate(lastIn.created_at)}` : ""}
                              </p>
                            </div>
                            <OkrStatusBadge status={kv.reviewStatus} />
                            <div className="h-1 w-20 shrink-0 sm:w-24">
                              <OkrProgressBar value={kv.progress} />
                            </div>
                          </div>
                          {kv.warnings.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-0.5">
                              {kv.warnings.map((w) => (
                                <OkrWarningBadge key={w} kind={w} />
                              ))}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>

                  <Link
                    href={trackingHref(ov.objective.id)}
                    className="mt-3 inline-block text-[11px] font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
                  >
                    Im Tracking bearbeiten →
                  </Link>
                </div>
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}
