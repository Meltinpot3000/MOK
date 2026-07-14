"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { KPI_ACCENTS } from "@/components/ceo/KpiCards";
import type { StrategicDesignKpis } from "@/lib/strategy-cycle/strategic-design-insights";
import type { AnalysisEntryOverviewStats } from "@/lib/strategy-cycle/analysis-entry-overview";
import type { OverviewDrillTable } from "@/lib/strategy-cycle/overview-drill-tables";
import type {
  InterpretedMetric,
  StrategyCycleDashboardModel,
} from "@/lib/strategy-cycle/strategy-cycle-dashboard-insights";
import { metricStatusBadgeClass, metricStatusLabelDe } from "@/lib/strategy-cycle/strategy-cycle-dashboard-insights";
import { StrategyCycleActionItems } from "@/components/ceo/strategy-cycle/StrategyCycleActionItems";
import { StrategyCycleManagementSummary } from "@/components/ceo/strategy-cycle/StrategyCycleManagementSummary";
import { StrategyCycleLinkDensityDonut } from "@/components/ceo/strategy-cycle/StrategyCycleLinkDensityDonut";
import { LinkDensityDetailModal } from "@/components/ceo/strategy-cycle/LinkDensityDetailModal";
import { DrillThroughModal } from "@/components/ceo/DrillThroughModal";
import { useHoverScale } from "@/lib/ui/use-hover-scale";
import type { LinkDensityBucket } from "@/lib/strategy-cycle/strategy-cycle-dashboard-insights";
import { linkDensityModalTitle } from "@/lib/strategy-cycle/strategy-cycle-dashboard-insights";

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
  dashboard: StrategyCycleDashboardModel;
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
            Konflikte und Passungsmatrix siehe die Design Summary.
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

function DesignKpiTile({
  metric,
  note,
}: {
  metric: InterpretedMetric;
  note?: string;
}) {
  return (
    <div className="flex h-auto min-h-[9rem] max-h-[12rem] flex-col rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">{metric.label}</p>
        {metric.status !== "unknown" ? (
          <span
            className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${metricStatusBadgeClass(metric.status)}`}
          >
            {metricStatusLabelDe(metric.status)}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight text-zinc-900">
        {metric.displayValue}
      </p>
      <p className="mt-1 line-clamp-3 text-[10px] leading-snug text-zinc-600">{metric.interpretation}</p>
      {note ? <p className="mt-auto pt-1 text-[10px] leading-snug text-zinc-500">{note}</p> : null}
    </div>
  );
}

function countTileSubtitle(count: number): string {
  if (count === 0) return "Noch im Aufbau";
  return "im Strategiezyklus";
}

export function StrategyCycleOverview({
  analysisEntrySummary,
  counts,
  kpis,
  drillTables,
  corporateStrategySummaryHref,
  objectiveAvgScore,
  portfolioBalanceScore,
  dashboard,
}: StrategyCycleOverviewProps) {
  const [activeTile, setActiveTile] = useState<TileId | null>(null);
  const [designInfoOpen, setDesignInfoOpen] = useState(false);
  const [linkDensityModal, setLinkDensityModal] = useState<{
    bucket: LinkDensityBucket;
    objectType: "objective" | "challenge";
    title: string;
  } | null>(null);

  const closeDrill = useCallback(() => setActiveTile(null), []);
  const closeLinkDensityModal = useCallback(() => setLinkDensityModal(null), []);

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

  const { designKpis, objectiveReadiness, analysisMaturity } = dashboard;

  return (
    <div className="space-y-6">
      <StrategyCycleManagementSummary
        readiness={dashboard.readiness}
        managementSummary={dashboard.managementSummary}
      />

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
                <p className="mt-1 text-[10px] leading-snug text-zinc-600">{objectiveReadiness.label}</p>
                <p className="mt-1 text-[10px] leading-snug text-zinc-500">{objectiveReadiness.portfolioLabel}</p>
                <dl className="mt-2 space-y-0.5 text-[10px] leading-snug text-zinc-500">
                  <div className="flex items-baseline justify-between gap-1">
                    <dt>Ø Ziel-Score</dt>
                    <dd className="font-semibold tabular-nums text-zinc-700">
                      {objectiveAvgScore != null ? `${objectiveAvgScore.toFixed(1)} / 5` : "—"}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-1">
                    <dt>Portfolio-Balance</dt>
                    <dd className="font-semibold tabular-nums text-zinc-700">
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
                <p className="mt-1 text-[10px] font-medium leading-snug text-zinc-700">
                  {analysisMaturity.label}
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
              ? count === 0
                ? "Noch im Aufbau"
                : "strategisch im Zyklus"
              : tile.id === "directions"
                ? countTileSubtitle(count)
                : count === 0
                  ? "Noch im Aufbau"
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
          titleId="strategy-cycle-drill-title"
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
          Kennzahlen wie in der Design Summary — für Details und Tabellen siehe Strategisches Design.
        </p>
        <div className="mt-4 grid gap-6 xl:grid-cols-[1fr_min(24rem,34%)]">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <DesignKpiTile metric={designKpis.challengeAnchoring} />
              <DesignKpiTile metric={designKpis.criticalGaps} />
              <DesignKpiTile metric={designKpis.focusConcentration} />
              <DesignKpiTile
                metric={designKpis.objectiveSupport}
                note={`Korrelations-Overrides: ${kpis.correlationConflictCount}`}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <StrategyCycleLinkDensityDonut
                model={dashboard.linkDensity.objectivesToDirections}
                centerLabel="Ziele"
                onBucketClick={(bucket) =>
                  setLinkDensityModal({
                    bucket,
                    objectType: "objective",
                    title: linkDensityModalTitle("objective", bucket),
                  })
                }
              />
              <StrategyCycleLinkDensityDonut
                model={dashboard.linkDensity.challengesToDirections}
                centerLabel="Herausforderungen"
                onBucketClick={(bucket) =>
                  setLinkDensityModal({
                    bucket,
                    objectType: "challenge",
                    title: linkDensityModalTitle("challenge", bucket),
                  })
                }
              />
            </div>

            <p className="text-sm">
              <Link
                href="/strategy-cycle?l1=strategic-directions&l2=dashboard"
                className="font-medium text-zinc-900 underline underline-offset-2"
              >
                Zur Design Summary (Strategisches Design)
              </Link>
            </p>
          </div>
          <StrategyCycleActionItems actionItems={dashboard.actionItems} />
        </div>
      </section>

      <LinkDensityDetailModal
        open={linkDensityModal != null}
        onClose={closeLinkDensityModal}
        title={linkDensityModal?.title ?? ""}
        bucket={linkDensityModal?.bucket ?? null}
        objectType={linkDensityModal?.objectType ?? "objective"}
      />

      <StrategicDesignInfoModal
        open={designInfoOpen}
        kpis={kpis}
        onClose={() => setDesignInfoOpen(false)}
      />
    </div>
  );
}
