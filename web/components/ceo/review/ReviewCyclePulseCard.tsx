"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { formatProgressVsPlanWeeksShortDe } from "@/lib/ceo/cycle-content-progress";
import {
  buildStrategyReviewHref,
  describeLeadWindow,
  procedureStatusLabelDe,
  readinessStatusHintDe,
  readinessStatusLabelDe,
  type ReviewCyclePulseModel,
} from "@/lib/review/review-cycle-pulse";

const TIME_ARC_COLOR = "#94a3b8";
const CONTENT_ON_TRACK_COLOR = "#059669";
const CONTENT_BEHIND_COLOR = "#d97706";
const LEAD_WINDOW_COLOR = "#d97706";

function buildFullRingStyle(progressPercent: number, arcColor: string, trackMixPercent = 20): CSSProperties {
  const progress = Math.round(Math.min(100, Math.max(0, progressPercent)));
  return {
    backgroundImage: `conic-gradient(from -90deg, ${arcColor} 0deg ${progress * 3.6}deg, color-mix(in srgb, ${arcColor} ${trackMixPercent}%, white) ${progress * 3.6}deg 360deg)`,
  };
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("de-CH");
}

function contentArcColor(deltaPp: number | null): string {
  if (deltaPp == null) return CONTENT_ON_TRACK_COLOR;
  return deltaPp >= 0 ? CONTENT_ON_TRACK_COLOR : CONTENT_BEHIND_COLOR;
}

/** Linke Spalte: grosse Reviewzyklus-Grafik. */
export function ReviewCyclePulseRing({ model }: { model: ReviewCyclePulseModel }) {
  const deltaLabel = formatProgressVsPlanWeeksShortDe(
    model.deltaPp,
    model.cycleStart,
    model.cycleEnd
  );
  const onTrack = (model.deltaPp ?? 0) >= 0;
  const hasContent = model.contentProgressPercent != null;

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div
        className="relative h-[420px] w-[420px] max-w-full rounded-full p-[16px] shadow-lg sm:h-[460px] sm:w-[460px]"
        style={buildFullRingStyle(model.timeProgressPercent, TIME_ARC_COLOR, 28)}
        title={`Zeit ${model.timeProgressPercent}%`}
      >
        {model.inLeadWindow ? (
          <div
            className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-amber-400/70"
            aria-hidden
          />
        ) : null}
        <div
          className={`h-full w-full rounded-full ${hasContent ? "p-[14px]" : ""}`}
          style={
            hasContent
              ? buildFullRingStyle(
                  model.contentProgressPercent!,
                  contentArcColor(model.deltaPp),
                  22
                )
              : undefined
          }
        >
          <div
            className="flex h-full w-full flex-col items-center justify-center rounded-full px-6 text-center"
            style={{ backgroundColor: "color-mix(in srgb, var(--brand-secondary) 10%, white)" }}
          >
            <p className="text-2xl font-semibold text-zinc-900">Reviewzyklus</p>
            <p className="mt-2 text-sm text-zinc-700">
              {formatDate(model.cycleStart)} – {formatDate(model.cycleEnd)}
            </p>
            {deltaLabel ? (
              <p
                className={`mt-3 rounded-md px-3 py-1 text-xs font-semibold leading-snug ${
                  onTrack ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-950"
                }`}
              >
                {deltaLabel}
              </p>
            ) : (
              <p className="mt-3 text-xs text-zinc-500">Zeit {model.timeProgressPercent}%</p>
            )}
            {model.inLeadWindow ? (
              <p
                className="mt-3 rounded-full px-3 py-1 text-xs font-semibold text-amber-950"
                style={{ backgroundColor: `${LEAD_WINDOW_COLOR}33` }}
              >
                Review-Fenster
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <p className="mt-4 max-w-[20rem] text-center text-xs text-zinc-500">
        Äußerer Ring: Zeit · Innerer Ring: Umsetzung · Fenster öffnet {model.leadTimeDays} Tage vor
        Ende
      </p>
    </div>
  );
}

/** Rechte Spalte: Infos zum formellen Strategie-Review. */
export function ReviewCyclePulseInfo({ model }: { model: ReviewCyclePulseModel }) {
  const windowInfo = describeLeadWindow(model);
  const href = buildStrategyReviewHref(model.cycleInstanceId, model.trigger);
  const readinessLabel = readinessStatusLabelDe(model.readinessStatus);
  const readinessHint = readinessStatusHintDe(model.readinessStatus);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Reviewzyklus</p>
      <h2 className="mt-1 text-lg font-semibold text-zinc-900">Formelles Strategie-Review</h2>
      <p className="mt-1 text-sm text-zinc-600">
        {model.cycleLabel} · {formatDate(model.cycleStart)} – {formatDate(model.cycleEnd)}
      </p>

      <div
        className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
          model.inLeadWindow ||
          model.procedureStatus === "pre_read_open" ||
          model.procedureStatus === "ready_for_review" ||
          model.procedureStatus === "review_in_progress"
            ? "border-amber-200 bg-amber-50 text-amber-950"
            : "border-zinc-200 bg-zinc-50 text-zinc-700"
        }`}
      >
        <p className="font-medium">{windowInfo.title}</p>
        <p className="mt-0.5 text-xs opacity-90">{windowInfo.detail}</p>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div>
          <dt className="text-xs text-zinc-500">Verfahrensstatus</dt>
          <dd className="font-medium text-zinc-900">
            {procedureStatusLabelDe(model.procedureStatus)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Bereitschaft fürs Meeting</dt>
          <dd className="font-medium text-zinc-900">{readinessLabel}</dd>
          <dd className="mt-0.5 text-xs text-zinc-600">{readinessHint}</dd>
        </div>
        {model.daysToEnd != null ? (
          <div>
            <dt className="text-xs text-zinc-500">Tage bis Periodenende</dt>
            <dd className="font-medium tabular-nums text-zinc-900">{model.daysToEnd}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-auto pt-4">
        <Link
          href={href}
          className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 sm:w-auto"
        >
          {windowInfo.ctaLabel} →
        </Link>
      </div>
    </div>
  );
}
