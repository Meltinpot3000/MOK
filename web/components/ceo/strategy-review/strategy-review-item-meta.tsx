"use client";

import {
  chainItemLifecycleBadgeClass,
  chainItemLifecycleLabel,
  type StrategyReviewChainItem,
} from "@/lib/strategy-review/pre-read-chain";
import {
  coverageTooltipLines,
  type StrategyReviewExecutionCoverage,
} from "@/lib/strategy-review/execution-coverage";

export function LifecycleBadge({ item }: { item: StrategyReviewChainItem }) {
  const label = chainItemLifecycleLabel(item);
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${chainItemLifecycleBadgeClass(item)}`}
      title="Lebenszyklus"
    >
      Lifecycle: {label}
    </span>
  );
}

/** Ampel-Farben für Feedback- und Entscheidungsoptionen. */
export function feedbackOptionButtonClass(code: string, selected: boolean): string {
  if (
    code === "improved" ||
    code === "more_important" ||
    code === "increasing_relevance" ||
    code === "continue" ||
    code === "on_track" ||
    code === "keep" ||
    code === "double_down"
  ) {
    return selected
      ? "border-emerald-700 bg-emerald-600 text-white"
      : "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300";
  }
  if (code === "unchanged" || code === "unchanged_relevance") {
    return selected
      ? "border-zinc-600 bg-zinc-500 text-white"
      : "border-zinc-300 bg-zinc-50 text-zinc-700 hover:border-zinc-400";
  }
  if (
    code === "worsened" ||
    code === "less_important" ||
    code === "decreasing_relevance" ||
    code === "stop" ||
    code === "escalate" ||
    code === "no_foundation" ||
    code === "inactivate" ||
    code === "remove"
  ) {
    return selected
      ? "border-rose-700 bg-rose-600 text-white"
      : "border-rose-200 bg-rose-50 text-rose-900 hover:border-rose-300";
  }
  if (
    code === "adjust" ||
    code === "needs_adjustment" ||
    code === "revisit_direction" ||
    code === "revisit_objective" ||
    code === "questionable" ||
    code === "sharpen" ||
    code === "replace" ||
    code === "change"
  ) {
    return selected
      ? "border-amber-700 bg-amber-600 text-white"
      : "border-amber-200 bg-amber-50 text-amber-950 hover:border-amber-300";
  }

  return selected
    ? "border-zinc-900 bg-zinc-900 text-white"
    : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400";
}

/** Chip-Farbe für Feedback-Zusammenfassung (nicht selektiert, same Ampel). */
export function feedbackRatingChipClass(code: string): string {
  return feedbackOptionButtonClass(code, false);
}

export function ProgramDetailsBlock({ item }: { item: StrategyReviewChainItem }) {
  const statusLabel =
    item.status === "active"
      ? "Aktiv"
      : item.status === "draft"
        ? "Entwurf"
        : item.status === "on_hold"
          ? "Pausiert"
          : item.status === "closed"
            ? "Geschlossen"
            : item.status || "k. A.";
  const progress =
    item.progressPercent != null && Number.isFinite(Number(item.progressPercent))
      ? Math.round(Number(item.progressPercent))
      : null;
  const budget =
    item.budgetTotal != null && Number.isFinite(Number(item.budgetTotal))
      ? Number(item.budgetTotal).toLocaleString("de-CH")
      : null;

  return (
    <div className="mt-3 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        Programm-Details
      </p>
      <dl className="mt-2 grid gap-2 text-xs text-zinc-700 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Status</dt>
          <dd className="mt-0.5 font-medium text-zinc-900">{statusLabel}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Owner</dt>
          <dd className="mt-0.5 font-medium text-zinc-900">{item.ownerLabel || "—"}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Zeitraum</dt>
          <dd className="mt-0.5 font-medium text-zinc-900">
            {item.startDate || item.endDate
              ? `${item.startDate ?? "—"} – ${item.endDate ?? "—"}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Budget</dt>
          <dd className="mt-0.5 font-medium text-zinc-900">{budget != null ? budget : "—"}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Erfüllungsgrad
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900">
            {progress != null ? `${progress} %` : "—"}
          </dd>
          <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">
            Durchschnitt der Initiative-Fortschritte (aktive und übrige Initiativen des Programms).
          </p>
        </div>
        <div>
          <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Initiativen
          </dt>
          <dd className="mt-0.5 font-medium text-zinc-900">
            {item.initiativeActiveCount != null || item.initiativeCount != null
              ? `${item.initiativeActiveCount ?? 0} aktiv / ${item.initiativeCount ?? 0} gesamt`
              : "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function CoverageChips({
  coverage,
  subjectType,
}: {
  coverage: StrategyReviewExecutionCoverage;
  subjectType: "challenge" | "focus_area" | "objective" | "program";
}) {
  const showProgram = subjectType !== "program";
  const active: Array<{ key: string; label: string; title: string }> = [];

  if (showProgram && coverage.programCount > 0) {
    active.push({
      key: "program",
      label: coverage.programCount === 1 ? "1 Programm" : `${coverage.programCount} Programme`,
      title: coverageTooltipLines(coverage.programTitles, "Programme"),
    });
  }
  if (coverage.annualTargetCount > 0) {
    active.push({
      key: "at",
      label:
        coverage.annualTargetCount === 1
          ? "1 Jahresziel"
          : `${coverage.annualTargetCount} Jahresziele`,
      title: coverageTooltipLines(coverage.annualTargetTitles, "Jahresziele"),
    });
  }
  if (coverage.initiativeCount > 0) {
    active.push({
      key: "init",
      label:
        coverage.initiativeCount === 1
          ? "1 Initiative"
          : `${coverage.initiativeCount} Initiativen`,
      title: coverageTooltipLines(coverage.initiativeTitles, "Initiativen"),
    });
  }
  if (coverage.okrCount > 0) {
    active.push({
      key: "okr",
      label: coverage.okrCount === 1 ? "1 OKR" : `${coverage.okrCount} OKRs`,
      title: coverageTooltipLines(coverage.okrTitles, "OKRs"),
    });
  }

  if (active.length === 0) {
    return (
      <div className="mt-2" aria-label="Umsetzungsbezug">
        <span
          className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900"
          title="Kein Programm, Jahresziel, Initiative oder OKR auf diesem Element"
        >
          aktuell keine Umsetzung
        </span>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Umsetzungsbezug">
      {active.map((c) => (
        <span
          key={c.key}
          title={c.title}
          className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-900"
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}
