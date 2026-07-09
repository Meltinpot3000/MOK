"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { sendOkrBehindPlanRemindersAction } from "@/app/(ceo)/dashboard/actions";
import { KPI_ACCENTS } from "@/components/ceo/KpiCards";
import { KpiCardTile } from "@/components/ceo/KpiCardTile";
import type { CeoOverallProgressDetail } from "@/lib/ceo/types";
import type { KpiCard } from "@/lib/ceo/kpis";
import {
  OKR_PROGRESS_PLAN_BUCKET_LABELS,
  type OkrProgressPlanBucket,
} from "@/lib/okr/okr-progress-plan-bucket";
import { useHoverScale } from "@/lib/ui/use-hover-scale";

type CeoDashboardKpiCardsProps = {
  items: KpiCard[];
  overallProgressDetail: CeoOverallProgressDetail | null;
  canSendReminders: boolean;
  layout?: "default" | "aside";
};

const BUCKET_ORDER: OkrProgressPlanBucket[] = ["ahead", "on_plan", "behind"];

const BUCKET_ACCENTS: Record<OkrProgressPlanBucket, string> = {
  ahead: "from-emerald-500/15 to-teal-500/10 ring-emerald-200/60",
  on_plan: "from-sky-500/15 to-cyan-500/10 ring-sky-200/60",
  behind: "from-rose-500/18 to-orange-500/10 ring-rose-200/60",
};

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function PlanBucketTile({
  bucket,
  count,
  onSelect,
}: {
  bucket: OkrProgressPlanBucket;
  count: number;
  onSelect: () => void;
}) {
  const hover = useHoverScale({ scale: 1.03 });

  return (
    <button
      type="button"
      onClick={onSelect}
      style={hover.style}
      onMouseEnter={hover.onMouseEnter}
      onMouseLeave={hover.onMouseLeave}
      className={`rounded-2xl bg-gradient-to-br p-4 text-left shadow-md ring-1 hover:shadow-lg ${BUCKET_ACCENTS[bucket]}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-600">
        {OKR_PROGRESS_PLAN_BUCKET_LABELS[bucket]}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900">{count}</p>
      <p className="mt-2 text-[10px] text-zinc-600">
        {count === 1 ? "OKR-Objective" : "OKR-Objectives"}
      </p>
      <p className="mt-2 text-[10px] font-medium text-indigo-700">OKRs anzeigen →</p>
    </button>
  );
}

export function CeoDashboardKpiCards({
  items,
  overallProgressDetail,
  canSendReminders,
  layout = "default",
}: CeoDashboardKpiCardsProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<OkrProgressPlanBucket | null>(null);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const gridClass =
    layout === "aside"
      ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-1 xl:gap-2.5"
      : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5";
  const paddingClass = layout === "aside" ? "p-3 sm:p-4 xl:p-3" : "p-4";
  const valueSizeClass =
    layout === "aside" ? "text-xl sm:text-2xl xl:text-xl" : "text-2xl sm:text-3xl";

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSelectedBucket(null);
    setReminderMessage(null);
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [modalOpen]);

  const behindItems = overallProgressDetail?.buckets.behind ?? [];

  function sendReminders() {
    if (!canSendReminders || behindItems.length === 0) return;
    startTransition(async () => {
      setReminderMessage(null);
      const result = await sendOkrBehindPlanRemindersAction(behindItems.map((o) => o.id));
      if (result.ok) {
        setReminderMessage(
          result.sent > 0
            ? `${result.sent} Erinnerung${result.sent === 1 ? "" : "en"} gesendet.`
            : "Keine Erinnerungen gesendet (keine Owner oder keine aktiven OKRs)."
        );
      } else {
        setReminderMessage(result.error);
      }
    });
  }

  const planningHref =
    overallProgressDetail?.okrCycleId != null
      ? `/okr/planning?okrCycle=${encodeURIComponent(overallProgressDetail.okrCycleId)}`
      : "/okr/planning";

  return (
    <>
      <section
        className={
          layout === "aside" ? "relative z-10 flex min-h-0 flex-col space-y-3" : "relative z-10 space-y-3"
        }
      >
        <div className={`${gridClass} overflow-visible p-0.5`}>
          {items.map((item, index) => {
            const accent = KPI_ACCENTS[index % KPI_ACCENTS.length];
            const isOverallProgress = index === 0 && overallProgressDetail != null;

            return (
              <KpiCardTile
                key={item.label}
                accent={accent}
                paddingClass={paddingClass}
                valueSizeClass={valueSizeClass}
                label={item.label}
                value={item.value}
                hint={item.hint}
                interactive={isOverallProgress}
                onClick={
                  isOverallProgress
                    ? () => {
                        setSelectedBucket(null);
                        setReminderMessage(null);
                        setModalOpen(true);
                      }
                    : undefined
                }
                footer={
                  isOverallProgress ? (
                    <p className="mt-2 text-[10px] font-medium text-indigo-700 group-hover:underline">
                      Details anzeigen →
                    </p>
                  ) : null
                }
              />
            );
          })}
        </div>
      </section>

      {modalOpen && overallProgressDetail ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto overscroll-none bg-black/40 p-3 backdrop-blur-[2px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ceo-overall-progress-title"
        >
          <div className="max-h-[min(88vh,680px)] w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-2 border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-indigo-50/40 px-4 py-3">
              <div>
                <h2 id="ceo-overall-progress-title" className="text-sm font-semibold text-zinc-900">
                  {selectedBucket
                    ? OKR_PROGRESS_PLAN_BUCKET_LABELS[selectedBucket]
                    : "Gesamtfortschritt OKR"}
                </h2>
                {!selectedBucket ? (
                  <p className="mt-0.5 text-[11px] text-zinc-600">
                    Erwartung laut Zeitplan: {formatPercent(overallProgressDetail.expectedProgressPercent)}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200/60"
              >
                Schließen
              </button>
            </div>

            <div className="max-h-[min(72vh,560px)] overflow-y-auto px-4 py-4">
              {selectedBucket == null ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {BUCKET_ORDER.map((bucket) => {
                      const list = overallProgressDetail.buckets[bucket];
                      return (
                        <PlanBucketTile
                          key={bucket}
                          bucket={bucket}
                          count={list.length}
                          onSelect={() => setSelectedBucket(bucket)}
                        />
                      );
                    })}
                  </div>

                  {canSendReminders ? (
                    <div className="rounded-xl border border-rose-100 bg-rose-50/50 px-3 py-3">
                      <p className="text-xs text-zinc-700">
                        {behindItems.length > 0
                          ? `${behindItems.length} OKR${behindItems.length === 1 ? "" : "s"} hinter dem Plan — Owner per In-App-Benachrichtigung erinnern.`
                          : "Keine OKRs hinter dem Plan."}
                      </p>
                      <button
                        type="button"
                        disabled={isPending || behindItems.length === 0}
                        onClick={sendReminders}
                        className="mt-2 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isPending ? "Sende …" : "Reminder senden"}
                      </button>
                      {reminderMessage ? (
                        <p className="mt-2 text-xs text-zinc-700">{reminderMessage}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setSelectedBucket(null)}
                    className="text-xs font-medium text-indigo-700 hover:underline"
                  >
                    ← Zurück zur Übersicht
                  </button>

                  {overallProgressDetail.buckets[selectedBucket].length === 0 ? (
                    <p className="text-sm text-zinc-500">Keine OKRs in dieser Kategorie.</p>
                  ) : (
                    <ul className="space-y-2">
                      {overallProgressDetail.buckets[selectedBucket].map((obj) => (
                        <li
                          key={obj.id}
                          className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2.5"
                        >
                          <p className="text-sm font-medium text-zinc-900">{obj.title}</p>
                          <p className="mt-1 text-xs text-zinc-600">
                            Fortschritt {formatPercent(obj.progressPercent)} · Erwartung{" "}
                            {formatPercent(obj.expectedProgressPercent)}
                            {obj.ownerDisplayName ? ` · ${obj.ownerDisplayName}` : ""}
                          </p>
                          <Link
                            href={planningHref}
                            className="mt-2 inline-block text-xs font-medium text-indigo-700 hover:underline"
                          >
                            In OKR-Planung öffnen →
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}

                  {selectedBucket === "behind" && canSendReminders ? (
                    <div className="border-t border-zinc-100 pt-3">
                      <button
                        type="button"
                        disabled={isPending || behindItems.length === 0}
                        onClick={sendReminders}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isPending ? "Sende …" : "Reminder senden"}
                      </button>
                      {reminderMessage ? (
                        <p className="mt-2 text-xs text-zinc-700">{reminderMessage}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
