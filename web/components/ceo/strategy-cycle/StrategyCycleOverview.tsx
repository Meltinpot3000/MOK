"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { KPI_ACCENTS } from "@/components/ceo/KpiCards";
import { TableHorizontalScroll } from "@/components/table/TableHorizontalScroll";
import type { StrategicDesignKpis } from "@/lib/strategy-cycle/strategic-design-insights";
import type { AnalysisEntryOverviewStats } from "@/lib/strategy-cycle/analysis-entry-overview";
import type { OverviewDrillTable } from "@/lib/strategy-cycle/overview-drill-tables";
import { useHoverScale } from "@/lib/ui/use-hover-scale";

export type StrategyCycleOverviewProps = {
  analysisEntrySummary: AnalysisEntryOverviewStats;
  counts: {
    analysisEntries: number;
    challenges: number;
    directions: number;
    objectives: number;
    programs: number;
    initiatives: number;
  };
  kpis: StrategicDesignKpis;
  drillTables: {
    objectives: OverviewDrillTable;
    analysisEntries: OverviewDrillTable;
    challenges: OverviewDrillTable;
    directions: OverviewDrillTable;
    programs: OverviewDrillTable;
    initiatives: OverviewDrillTable;
  };
  corporateStrategySummaryHref: string;
  objectiveAvgScore: number | null;
  portfolioBalanceScore: number | null;
};

type TileId =
  | "objectives"
  | "analysis-entries"
  | "challenges"
  | "directions"
  | "programs"
  | "initiatives";

type TileConfig = {
  id: TileId;
  accentIndex: number;
  label: string;
  href: string;
  hrefLabel: string;
  drillTable: OverviewDrillTable;
  emptyText: string;
};

function overviewTileClass(accentIndex: number, interactive: boolean) {
  const accent = KPI_ACCENTS[accentIndex % KPI_ACCENTS.length];
  return `group relative flex min-h-[10.5rem] w-full flex-col overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-left shadow-md ring-1 sm:min-h-[11rem] xl:aspect-square xl:min-h-0 ${accent} ${
    interactive
      ? "cursor-pointer hover:shadow-lg hover:ring-2 hover:ring-indigo-300/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      : ""
  }`;
}

function OverviewTileButton({
  accentIndex,
  label,
  onClick,
  children,
}: {
  accentIndex: number;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const hover = useHoverScale({ scale: 1.03 });
  return (
    <button
      type="button"
      onClick={onClick}
      className={overviewTileClass(accentIndex, true)}
      style={hover.style}
      onMouseEnter={hover.onMouseEnter}
      onMouseLeave={hover.onMouseLeave}
      aria-label={`${label} — Details anzeigen`}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/40 opacity-0 blur-2xl transition group-hover:opacity-100"
        aria-hidden
      />
      {children}
      <p className="mt-auto pt-2 text-[10px] font-medium text-indigo-700 group-hover:underline">
        Details anzeigen →
      </p>
    </button>
  );
}

function DrillThroughModal({
  open,
  title,
  drillTable,
  emptyText,
  href,
  hrefLabel,
  onClose,
}: {
  open: boolean;
  title: string;
  drillTable: OverviewDrillTable;
  emptyText: string;
  href: string;
  hrefLabel: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  const { columns, rows } = drillTable;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto overscroll-none bg-black/40 p-3 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="strategy-cycle-drill-title"
      onClick={onClose}
    >
      <div
        className="max-h-[min(90vh,720px)] w-full max-w-4xl overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-indigo-50/40 px-4 py-3">
          <div>
            <h2 id="strategy-cycle-drill-title" className="text-sm font-semibold text-zinc-900">
              {title}
            </h2>
            <p className="mt-0.5 text-[11px] text-zinc-600">
              {rows.length === 1 ? "1 Eintrag" : `${rows.length} Einträge`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200/60"
          >
            Schließen
          </button>
        </div>

        <div className="max-h-[min(62vh,520px)] overflow-y-auto px-4 py-4">
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-500">{emptyText}</p>
          ) : (
            <TableHorizontalScroll bordered={false}>
              <table className="w-max min-w-full border-collapse text-xs">
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col.id}
                        className="border border-zinc-200 bg-zinc-50 px-2 py-2 text-left font-semibold text-zinc-700"
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-zinc-50/80">
                      {columns.map((col) => (
                        <td
                          key={col.id}
                          className={`border border-zinc-200 px-2 py-2 text-zinc-800 ${
                            col.id === "title" ? "min-w-[10rem] max-w-[18rem] font-medium" : "whitespace-nowrap"
                          }`}
                        >
                          <span className={col.id === "title" ? "line-clamp-2" : undefined}>
                            {row.cells[col.id] ?? "—"}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableHorizontalScroll>
          )}
        </div>

        <div className="border-t border-zinc-100 px-4 py-3">
          <Link
            href={href}
            className="text-sm font-medium text-indigo-700 hover:underline"
            onClick={onClose}
          >
            {hrefLabel} →
          </Link>
        </div>
      </div>
    </div>
  );
}

function StrategicDesignInfoModal({
  open,
  kpis,
  onClose,
}: {
  open: boolean;
  kpis: StrategicDesignKpis;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  const entries: Array<{ label: string; value: string; explanation: string }> = [
    {
      label: "Herausforderungs-Verankerung",
      value: kpis.coverageChallengeShare != null ? `${kpis.coverageChallengeShare}%` : "—",
      explanation: kpis.coverageExplanationDe,
    },
    {
      label: "Kritische Lücken",
      value: String(kpis.criticalGaps),
      explanation:
        "Anzahl strategischer Herausforderungen ohne ausreichende Verankerung an Stoßrichtungen (schwache oder fehlende Abdeckung).",
    },
    {
      label: "Fokus-Konzentration",
      value: kpis.focusIndex != null ? `${Math.round(kpis.focusIndex * 100)}%` : "—",
      explanation: kpis.focusExplanationDe,
    },
    {
      label: "Zielunterstützung (Reifegrad)",
      value:
        kpis.objectiveAlignmentMaturity != null
          ? `${Math.round(kpis.objectiveAlignmentMaturity * 100)}%`
          : "—",
      explanation: kpis.objectiveSupportExplanationDe,
    },
    {
      label: "Korrelations-Overrides",
      value: String(kpis.correlationConflictCount),
      explanation:
        "Anzahl Fälle, in denen ein manueller Override vom automatisch berechneten Korrelationsstatus abweicht.",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto overscroll-none bg-black/40 p-3 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="strategic-design-info-title"
      onClick={onClose}
    >
      <div
        className="max-h-[min(88vh,640px)] w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-indigo-50/40 px-4 py-3">
          <h2 id="strategic-design-info-title" className="text-sm font-semibold text-zinc-900">
            Kennzahlen — Strategisches Design
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200/60"
          >
            Schließen
          </button>
        </div>

        <div className="max-h-[min(72vh,520px)] overflow-y-auto px-4 py-4">
          <p className="mb-4 text-xs text-zinc-600">
            Kurzüberblick der wichtigsten Kennzahlen aus dem Bereich Strategisches Design. Für Tabellen,
            Konflikte und Korrelationsmatrix siehe die vollständige Übersicht.
          </p>
          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.label} className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {entry.label}
                  </p>
                  <p className="text-lg font-semibold tabular-nums text-zinc-900">{entry.value}</p>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">{entry.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StrategyCycleOverview({
  analysisEntrySummary,
  counts,
  kpis,
  drillTables,
  corporateStrategySummaryHref,
  objectiveAvgScore,
  portfolioBalanceScore,
}: StrategyCycleOverviewProps) {
  const [activeTile, setActiveTile] = useState<TileId | null>(null);
  const [designInfoOpen, setDesignInfoOpen] = useState(false);

  const closeDrill = useCallback(() => setActiveTile(null), []);

  const tiles: TileConfig[] = [
    {
      id: "objectives",
      accentIndex: 0,
      label: "Strategische Ziele",
      href: "/strategy-cycle?l1=objectives",
      hrefLabel: "Zum Arbeitsbereich Ziele",
      drillTable: drillTables.objectives,
      emptyText: "Noch keine strategischen Ziele im Zyklus.",
    },
    {
      id: "analysis-entries",
      accentIndex: 1,
      label: "Analyse-Einträge",
      href: corporateStrategySummaryHref,
      hrefLabel: "Zur Zusammenfassung (Strategische Erkenntnisse)",
      drillTable: drillTables.analysisEntries,
      emptyText: "Noch keine Analyse-Einträge vorhanden.",
    },
    {
      id: "challenges",
      accentIndex: 2,
      label: "Herausforderungen",
      href: "/strategy-cycle?l1=strategic-directions&l2=challenges",
      hrefLabel: "Zu den strategischen Herausforderungen",
      drillTable: drillTables.challenges,
      emptyText: "Noch keine strategischen Herausforderungen.",
    },
    {
      id: "directions",
      accentIndex: 3,
      label: "Stoßrichtungen",
      href: "/strategy-cycle?l1=strategic-directions&l2=design",
      hrefLabel: "Zu den strategischen Stoßrichtungen",
      drillTable: drillTables.directions,
      emptyText: "Noch keine Stoßrichtungen.",
    },
    {
      id: "programs",
      accentIndex: 4,
      label: "Programme",
      href: "/strategy-cycle?l1=pips&l2=programme",
      hrefLabel: "Zu den Programmen",
      drillTable: drillTables.programs,
      emptyText: "Noch keine Programme.",
    },
    {
      id: "initiatives",
      accentIndex: 5,
      label: "Initiativen",
      href: "/strategy-cycle?l1=pips&l2=initiativen",
      hrefLabel: "Zu den Initiativen",
      drillTable: drillTables.initiatives,
      emptyText: "Noch keine Initiativen.",
    },
  ];

  const activeConfig = tiles.find((t) => t.id === activeTile) ?? null;

  const designKpiTiles: { label: string; value: string; note?: string; accentIndex: number }[] = [
    {
      label: "Herausforderungs-Verankerung",
      value: kpis.coverageChallengeShare != null ? `${kpis.coverageChallengeShare}%` : "—",
      accentIndex: 0,
    },
    {
      label: "Kritische Lücken",
      value: String(kpis.criticalGaps),
      accentIndex: 1,
    },
    {
      label: "Fokus-Konzentration",
      value: kpis.focusIndex != null ? `${Math.round(kpis.focusIndex * 100)}%` : "—",
      accentIndex: 2,
    },
    {
      label: "Zielunterstützung (Reifegrad)",
      value:
        kpis.objectiveAlignmentMaturity != null
          ? `${Math.round(kpis.objectiveAlignmentMaturity * 100)}%`
          : "—",
      note: `Korrelations-Overrides: ${kpis.correlationConflictCount}`,
      accentIndex: 3,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:max-w-6xl xl:grid-cols-6">
        {tiles.map((tile) => {
          if (tile.id === "objectives") {
            return (
              <OverviewTileButton
                key={tile.id}
                accentIndex={tile.accentIndex}
                label={tile.label}
                onClick={() => setActiveTile(tile.id)}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">
                  Strategische Ziele
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 sm:text-3xl">
                  {counts.objectives}
                </p>
                <p className="mt-1 text-[10px] leading-snug text-zinc-600">im Strategiezyklus</p>
                <dl className="mt-2 space-y-0.5 text-[10px] leading-snug text-zinc-600">
                  <div className="flex items-baseline justify-between gap-1">
                    <dt>Ø Ziel-Score</dt>
                    <dd className="font-semibold tabular-nums text-zinc-900">
                      {objectiveAvgScore != null ? `${objectiveAvgScore.toFixed(1)} / 5` : "—"}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-1">
                    <dt>Portfolio-Balance</dt>
                    <dd className="font-semibold tabular-nums text-zinc-900">
                      {portfolioBalanceScore != null ? `${portfolioBalanceScore.toFixed(1)} / 5` : "—"}
                    </dd>
                  </div>
                </dl>
              </OverviewTileButton>
            );
          }

          if (tile.id === "analysis-entries") {
            return (
              <OverviewTileButton
                key={tile.id}
                accentIndex={tile.accentIndex}
                label={tile.label}
                onClick={() => setActiveTile(tile.id)}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">
                  Analyse-Einträge
                </p>
                <p className="mt-2 flex flex-wrap items-baseline gap-1.5 tabular-nums">
                  <span className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
                    {analysisEntrySummary.directEntryCount}
                  </span>
                  <span className="text-base font-medium text-zinc-400">/</span>
                  <span className="text-xl font-semibold text-zinc-700 sm:text-2xl">
                    {analysisEntrySummary.total}
                  </span>
                </p>
                <p className="mt-1 text-[10px] font-medium leading-snug text-zinc-700">
                  mit Herausforderung verknüpft (direkte Quelle)
                </p>
                <p className="mt-1 text-[10px] leading-snug text-zinc-500">
                  Qualität: {analysisEntrySummary.qualityHigh} hoch · {analysisEntrySummary.qualityMedium}{" "}
                  mittel · {analysisEntrySummary.qualityLow} niedrig
                </p>
              </OverviewTileButton>
            );
          }

          const count =
            tile.id === "challenges"
              ? counts.challenges
              : tile.id === "directions"
                ? counts.directions
                : tile.id === "programs"
                  ? counts.programs
                  : counts.initiatives;

          const subtitle =
            tile.id === "challenges"
              ? "strategisch im Zyklus"
              : tile.id === "directions"
                ? "im Zyklus"
                : "PIPs";

          return (
            <OverviewTileButton
              key={tile.id}
              accentIndex={tile.accentIndex}
              label={tile.label}
              onClick={() => setActiveTile(tile.id)}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">{tile.label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 sm:text-3xl">
                {count}
              </p>
              <p className="mt-1 text-[10px] leading-snug text-zinc-600">{subtitle}</p>
            </OverviewTileButton>
          );
        })}
      </section>

      {activeConfig ? (
        <DrillThroughModal
          open={activeTile != null}
          title={activeConfig.label}
          drillTable={activeConfig.drillTable}
          emptyText={activeConfig.emptyText}
          href={activeConfig.href}
          hrefLabel={activeConfig.hrefLabel}
          onClose={closeDrill}
        />
      ) : null}

      <section className="brand-card p-6">
        <div className="flex items-start gap-2">
          <h3 className="text-base font-semibold text-zinc-900">Strategisches Design (Kurz)</h3>
          <button
            type="button"
            onClick={() => setDesignInfoOpen(true)}
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-zinc-50 text-[11px] font-bold text-zinc-600 hover:border-zinc-400 hover:bg-zinc-100"
            aria-label="Mehr Informationen zu den Kennzahlen"
            title="Mehr Informationen"
          >
            i
          </button>
        </div>
        <p className="mt-1 text-sm text-zinc-600">
          Kennzahlen wie in der Bereichs-Übersicht — für Details und Tabellen siehe Strategisches Design.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2 xl:max-w-4xl xl:grid-cols-4">
          {designKpiTiles.map((tile) => (
            <div key={tile.label} className={overviewTileClass(tile.accentIndex, false)}>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">
                {tile.label}
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 sm:text-3xl">
                {tile.value}
              </p>
              {tile.note ? (
                <p className="mt-1 text-[10px] leading-snug text-zinc-600">{tile.note}</p>
              ) : null}
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm">
          <Link
            href="/strategy-cycle?l1=strategic-directions&l2=dashboard"
            className="font-medium text-zinc-900 underline underline-offset-2"
          >
            Zur vollständigen Übersicht (Strategisches Design)
          </Link>
        </p>
      </section>

      <StrategicDesignInfoModal
        open={designInfoOpen}
        kpis={kpis}
        onClose={() => setDesignInfoOpen(false)}
      />
    </div>
  );
}
