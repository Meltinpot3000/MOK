"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OkrObjectiveView } from "@/lib/okr/okr-cycle-view-model";
import { canEditOkrKeyResultForUser } from "@/lib/okr/okr-object-permissions";
import { buildRollupSeries } from "@/lib/okr/rollup-series";
import type { OkrUpdateRow } from "@/lib/review/key-result-progress";
import { OkrRollupSparkline } from "@/components/ceo/okr/OkrRollupSparkline";
import { createOkrCheckInAction } from "@/app/(ceo)/okr-workspace/actions";
import { ExpandableTable, type ColumnDef } from "@/components/ceo/ExpandableTable";
import { OkrProgressBar } from "@/components/ceo/okr/OkrProgressBar";
import { OkrStatusBadge } from "@/components/ceo/okr/OkrStatusBadge";
import { OkrWarningBadge } from "@/components/ceo/okr/OkrWarningBadge";

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

function formatDeShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  } catch {
    return iso;
  }
}

function confidenceLabel(level: number | null | undefined): string {
  if (level == null || Number.isNaN(level)) return "—";
  return `${Math.round(Number(level))}/10`;
}

type OkrTrackingViewProps = {
  cycleInstanceId: string;
  okrCycleId: string | null;
  okrCycleEndDate: string | null;
  canWriteArea: boolean;
  currentMembershipId: string;
  objectiveViews: OkrObjectiveView[];
  updatesByKeyResultId: Record<string, OkrUpdateRow[]>;
};

export function OkrTrackingView({
  cycleInstanceId,
  okrCycleId,
  okrCycleEndDate,
  canWriteArea,
  currentMembershipId,
  objectiveViews,
  updatesByKeyResultId,
}: OkrTrackingViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [historyOpenFor, setHistoryOpenFor] = useState<string | null>(null);
  const [checkInFor, setCheckInFor] = useState<{
    keyResultId: string;
    title: string;
    defaultProgress: number;
    defaultConfidence: number;
  } | null>(null);

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
        cellClassName: "w-[100px]",
        render: (ov) => (
          <div className="flex items-center gap-1.5">
            <OkrProgressBar value={ov.rollupProgressPercent} />
            <span className="w-7 shrink-0 text-right text-[11px] tabular-nums text-zinc-500">
              {Math.round(ov.rollupProgressPercent)}
            </span>
          </div>
        ),
      },
    ],
    []
  );

  if (!okrCycleId) {
    return (
      <p className="rounded-lg border border-zinc-200 bg-white px-3 py-4 text-center text-sm text-zinc-600">
        Kein OKR-Zeitraum.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <div className="p-2 sm:p-3">
        <ExpandableTable<OkrObjectiveView>
          columns={tableColumns}
          rows={objectiveViews}
          getRowId={(ov) => ov.objective.id}
          enableColumnPickerUi={false}
          expandLabel=""
          emptyMessage={
            objectiveViews.length === 0
              ? "Keine OKRs mit dir als Owner."
              : "Keine Einträge."
          }
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
                    const canEditThisKr =
                      canWriteArea &&
                      canEditOkrKeyResultForUser(
                        currentMembershipId,
                        ov.objective.ownerMembershipId,
                        kv.keyResult.ownerMembershipId
                      );
                    const updates = updatesByKeyResultId[kv.keyResult.id] ?? [];
                    const histOpen = historyOpenFor === kv.keyResult.id;
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
                              {lastIn ? ` · zuletzt ${formatDeShort(lastIn.created_at)}` : ""}
                            </p>
                          </div>
                          <OkrStatusBadge status={kv.reviewStatus} />
                          <div className="h-1 w-20 shrink-0 sm:w-24">
                            <OkrProgressBar value={kv.progress} />
                          </div>
                          {canEditThisKr ? (
                            <button
                              type="button"
                              onClick={() =>
                                setCheckInFor({
                                  keyResultId: kv.keyResult.id,
                                  title: kv.keyResult.title,
                                  defaultProgress: Math.min(100, Math.max(0, Math.round(kv.progress))),
                                  defaultConfidence:
                                    kv.confidenceLevel != null && Number.isFinite(Number(kv.confidenceLevel))
                                      ? Math.min(10, Math.max(1, Math.round(Number(kv.confidenceLevel))))
                                      : 5,
                                })
                              }
                              className="shrink-0 rounded-md bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-zinc-800"
                            >
                              Check-in
                            </button>
                          ) : null}
                        </div>
                        {kv.warnings.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-0.5">
                            {kv.warnings.map((w) => (
                              <OkrWarningBadge key={w} kind={w} />
                            ))}
                          </div>
                        ) : null}

                        {updates.length > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setHistoryOpenFor((id) => (id === kv.keyResult.id ? null : kv.keyResult.id))
                            }
                            className="mt-1.5 text-[10px] text-zinc-500 hover:text-zinc-800"
                          >
                            {histOpen ? "▼" : "▶"} Verlauf ({updates.length})
                          </button>
                        ) : null}
                        {histOpen ? (
                          <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto border-l-2 border-zinc-100 pl-2 text-[10px] text-zinc-600">
                            {updates.map((u, idx) => (
                              <li key={`${u.created_at}-${idx}`}>
                                <span className="font-medium tabular-nums text-zinc-800">
                                  {u.progress_value != null ? `${Math.round(Number(u.progress_value))}%` : "—"}
                                </span>
                                <span className="text-zinc-400">
                                  {" "}
                                  · {confidenceLabel(u.confidence_level)} · {formatDeShort(u.created_at)}
                                </span>
                                {u.comment?.trim() ? (
                                  <span className="mt-0.5 block text-zinc-500">„{u.comment.trim()}“</span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                <p className="mt-2 text-center text-[10px] text-zinc-400">
                  <Link href="/okr/review" className="text-zinc-600 underline underline-offset-2 hover:text-zinc-900">
                    Zum OKR Review
                  </Link>
                </p>
              </div>
            );
          }}
        />
      </div>

      {checkInFor ? (
        <CompactCheckInModal
          titleShort={checkInFor.title.length > 48 ? `${checkInFor.title.slice(0, 45)}…` : checkInFor.title}
          keyResultId={checkInFor.keyResultId}
          defaultProgress={checkInFor.defaultProgress}
          defaultConfidence={checkInFor.defaultConfidence}
          cycleInstanceId={cycleInstanceId}
          okrCycleId={okrCycleId}
          onClose={() => setCheckInFor(null)}
          pending={pending}
          startTransition={startTransition}
          onSaved={() => {
            setCheckInFor(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function CompactCheckInModal(props: {
  titleShort: string;
  keyResultId: string;
  defaultProgress: number;
  defaultConfidence: number;
  cycleInstanceId: string;
  okrCycleId: string;
  onClose: () => void;
  pending: boolean;
  startTransition: (fn: () => void) => void;
  onSaved: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkin-title"
    >
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-4 shadow-lg sm:rounded-lg">
        <h2 id="checkin-title" className="text-sm font-semibold text-zinc-900">
          Check-in
        </h2>
        <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500">{props.titleShort}</p>
        <p className="mt-2 text-[11px] leading-snug text-zinc-600">
          Fortschritt und Zuversicht für dieses Key Result eintragen — dauert nur einen Moment.
        </p>
        <form
          key={props.keyResultId}
          className="mt-3 space-y-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const confRaw = fd.get("confidence_level");
            const confidenceLevel =
              confRaw != null && String(confRaw).trim() !== ""
                ? Math.min(10, Math.max(1, Math.round(Number(confRaw))))
                : 5;
            const pRaw = fd.get("progress_percent");
            const progressValue =
              pRaw != null && String(pRaw).trim() !== "" && Number.isFinite(Number(pRaw))
                ? Number(pRaw)
                : null;
            props.startTransition(async () => {
              const r = await createOkrCheckInAction({
                cycleInstanceId: props.cycleInstanceId,
                okrCycleId: props.okrCycleId,
                keyResultId: props.keyResultId,
                progressValue,
                confidenceLevel,
                comment: String(fd.get("comment") ?? "").trim() || null,
              });
              if ("error" in r && r.error) window.alert(r.error);
              else props.onSaved();
            });
          }}
        >
          <div className="flex gap-2">
            <label className="flex-1 text-[11px] font-medium text-zinc-600">
              Fortschritt (0–100&nbsp;%)
              <input
                name="progress_percent"
                type="number"
                min={0}
                max={100}
                required
                defaultValue={props.defaultProgress}
                placeholder="z. B. 65"
                className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1.5 text-sm tabular-nums"
              />
            </label>
            <label className="w-28 shrink-0 text-[11px] font-medium text-zinc-600">
              Zuversicht (1–10)
              <select
                name="confidence_level"
                defaultValue={String(props.defaultConfidence)}
                className="mt-0.5 w-full rounded border border-zinc-200 bg-white px-1 py-1.5 text-sm"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={String(n)}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-[11px] font-medium text-zinc-600">
            Kommentar <span className="font-normal text-zinc-400">(optional)</span>
            <textarea
              name="comment"
              rows={2}
              placeholder="Kontext oder nächste Schritte …"
              className="mt-0.5 w-full resize-none rounded border border-zinc-200 px-2 py-1.5 text-xs"
            />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={props.onClose}
              className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={props.pending}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
