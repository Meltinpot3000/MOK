"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OkrObjectiveView } from "@/lib/okr/okr-cycle-view-model";
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
  /** Objectives im gewählten OKR-Zeitraum (vor Zugriffsfilter) — für sinnvolle Leer-Meldung */
  inCycleObjectiveCount: number;
  objectiveViews: OkrObjectiveView[];
  updatesByKeyResultId: Record<string, OkrUpdateRow[]>;
  /** Server-vorberechnet: KR-Update (Check-in) erlaubt */
  keyResultCanUpdateById: Record<string, boolean>;
};

export function OkrTrackingView({
  cycleInstanceId,
  okrCycleId,
  okrCycleEndDate,
  canWriteArea,
  currentMembershipId,
  inCycleObjectiveCount,
  objectiveViews,
  updatesByKeyResultId,
  keyResultCanUpdateById,
}: OkrTrackingViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [historyOpenFor, setHistoryOpenFor] = useState<string | null>(null);
  const [checkInFor, setCheckInFor] = useState<{
    keyResultId: string;
    title: string;
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
              ? inCycleObjectiveCount === 0
                ? "Keine OKR-Objectives in diesem Zeitraum — anderen OKR-Zyklus wählen oder in der Planung anlegen."
                : "Es gibt Objectives in diesem Zeitraum, aber keines, das Sie mit Ihrer Rolle lesen dürfen (Owner, Deputy oder direkte Team-Linie)."
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
                      {ov.objective.leadingStrategicDirectionTitle ?? "—"} · Owner:{" "}
                      {ov.objective.ownerDisplayName ?? "—"}
                      {ov.objective.deputyDisplayName
                        ? ` · Deputy: ${ov.objective.deputyDisplayName}`
                        : ""}
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

                <div className="mt-3">
                  <OkrRollupSparkline points={rollupPoints} />
                </div>

                <ul className="mt-2 divide-y divide-zinc-100 rounded-md border border-zinc-200 bg-white">
                  {ov.keyResults.map((kv) => {
                    const canEditThisKr =
                      canWriteArea && Boolean(keyResultCanUpdateById[kv.keyResult.id]);
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
  cycleInstanceId: string;
  okrCycleId: string;
  onClose: () => void;
  pending: boolean;
  startTransition: (fn: () => void) => void;
  onSaved: () => void;
}) {
  const [progress, setProgress] = useState("");
  const [confidence, setConfidence] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    setProgress("");
    setConfidence("");
    setComment("");
  }, [props.keyResultId]);

  const progressNum = progress.trim() === "" ? NaN : Number(progress);
  const progressOk = Number.isFinite(progressNum) && progressNum >= 0 && progressNum <= 100;
  const confidenceOk = confidence !== "" && Number.isFinite(Number(confidence));
  const confidenceLevel = confidenceOk
    ? Math.min(10, Math.max(1, Math.round(Number(confidence))))
    : 5;
  const commentOk = comment.trim().length > 0;
  const canSubmit = progressOk && confidenceOk && commentOk && !props.pending;

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
          Fortschritt (%), Zuversicht (1–10) und Kommentar sind Pflicht — alle Felder ausfüllen, dann
          speichern.
        </p>
        <form
          className="mt-3 space-y-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            const progressValue = Math.min(100, Math.max(0, Math.round(progressNum)));
            props.startTransition(async () => {
              const r = await createOkrCheckInAction({
                cycleInstanceId: props.cycleInstanceId,
                okrCycleId: props.okrCycleId,
                keyResultId: props.keyResultId,
                progressValue,
                confidenceLevel,
                comment: comment.trim(),
              });
              if ("error" in r && r.error) window.alert(r.error);
              else props.onSaved();
            });
          }}
        >
          <div className="flex gap-2">
            <label className="flex-1 text-[11px] font-medium text-zinc-600">
              Fortschritt (0–100&nbsp;%) <span className="text-red-600">*</span>
              <input
                name="progress_percent"
                type="number"
                min={0}
                max={100}
                inputMode="numeric"
                autoComplete="off"
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
                placeholder="z. B. 65"
                aria-invalid={progress !== "" && !progressOk}
                className="mt-0.5 w-full rounded border border-zinc-200 px-2 py-1.5 text-sm tabular-nums aria-invalid:border-red-300"
              />
            </label>
            <label className="w-[8.5rem] shrink-0 text-[11px] font-medium text-zinc-600">
              Zuversicht (1–10) <span className="text-red-600">*</span>
              <select
                name="confidence_level"
                value={confidence}
                onChange={(e) => setConfidence(e.target.value)}
                aria-invalid={confidence === ""}
                className="mt-0.5 w-full rounded border border-zinc-200 bg-white px-1 py-1.5 text-sm aria-invalid:border-red-300"
              >
                <option value="" disabled>
                  Bitte wählen
                </option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={String(n)}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-[11px] font-medium text-zinc-600">
            Kommentar <span className="text-red-600">*</span>
            <textarea
              name="comment"
              rows={2}
              required
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Kontext oder nächste Schritte …"
              aria-invalid={comment !== "" && !commentOk}
              className="mt-0.5 w-full resize-none rounded border border-zinc-200 px-2 py-1.5 text-xs aria-invalid:border-red-300"
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
              disabled={!canSubmit}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
