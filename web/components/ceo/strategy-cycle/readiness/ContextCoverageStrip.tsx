"use client";

import type {
  CoverageSummary,
  DesignReadinessFocus,
} from "@/lib/strategy-cycle/design-readiness-snapshot";
import { coverageStatusLabelDe } from "./readiness-ui";

type Props = {
  focus: DesignReadinessFocus;
  industries: CoverageSummary;
  businessModels: CoverageSummary;
};

function zeroContextHint(
  focus: DesignReadinessFocus,
  entityLabel: string
): string {
  if (focus === "challenges") {
    return entityLabel === "Industrien"
      ? "Keine aktiven Herausforderungen sind aktuell mit Industrien verknüpft."
      : "Keine aktiven Herausforderungen sind aktuell mit Geschäftsmodellen verknüpft.";
  }
  return entityLabel === "Industrien"
    ? "Keine wirksamen Stoßrichtungen sind aktuell mit Industrien verknüpft."
    : "Keine wirksamen Stoßrichtungen sind aktuell mit Geschäftsmodellen verknüpft.";
}

function ContextTile({
  summary,
  focus,
}: {
  summary: CoverageSummary;
  focus: DesignReadinessFocus;
}) {
  const display =
    summary.total === 0
      ? "—"
      : summary.percentage != null
        ? `${summary.covered}/${summary.total} (${summary.percentage}%)`
        : `${summary.covered}/${summary.total}`;

  const hint =
    summary.total > 0 && summary.covered === 0
      ? zeroContextHint(focus, summary.label)
      : summary.hint;

  const badgeLabel = coverageStatusLabelDe(
    summary.covered,
    summary.total,
    summary.status
  );

  return (
    <div className="min-w-0 flex-1 overflow-hidden rounded-md border border-zinc-200 bg-white px-3 py-2.5">
      <div className="flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1">
        <p className="min-w-0 flex-1 text-xs font-semibold text-zinc-800">{summary.label}</p>
        <span
          className={`inline-flex max-w-full items-center justify-center rounded-full border px-1.5 py-0.5 text-[9px] font-medium leading-tight ${
            badgeLabel === "Abgedeckt"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : badgeLabel === "Prüfen"
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : badgeLabel === "Nacharbeiten"
                  ? "border-red-300 bg-red-50 text-red-800"
                  : "border-zinc-300 bg-zinc-100 text-zinc-600"
          }`}
        >
          {badgeLabel}
        </span>
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">{display}</p>
      <p className="mt-1 text-[11px] leading-snug text-zinc-600">{hint}</p>
    </div>
  );
}

export function ContextCoverageStrip({ focus, industries, businessModels }: Props) {
  const title =
    focus === "challenges"
      ? "Kontextabdeckung im Fokus Herausforderungen"
      : "Kontextabdeckung im Fokus Stoßrichtungen";

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-zinc-800">{title}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <ContextTile summary={industries} focus={focus} />
        <ContextTile summary={businessModels} focus={focus} />
      </div>
    </div>
  );
}
