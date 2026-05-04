"use client";

import Link from "next/link";
import { KPI_ACCENTS } from "@/components/ceo/KpiCards";
import type { StrategicDesignKpis } from "@/lib/strategy-cycle/strategic-design-insights";
import type { AnalysisEntryOverviewStats } from "@/lib/strategy-cycle/analysis-entry-overview";

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
  topChallenges: Array<{
    id: string;
    title: string;
    challenge_score: number | string | null | undefined;
  }>;
  topDirections: Array<{
    id: string;
    title: string;
    priority?: number | string | null;
  }>;
  missionTeaser: string | null;
  kennwerteTeaser: string | null;
  corporateStrategySummaryHref: string;
};

function scoreNum(v: number | string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function overviewTileClass(accentIndex: number) {
  const accent = KPI_ACCENTS[accentIndex % KPI_ACCENTS.length];
  return `relative flex min-h-[10.5rem] flex-col overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-left shadow-md ring-1 sm:min-h-[11rem] xl:aspect-square xl:min-h-0 ${accent}`;
}

export function StrategyCycleOverview({
  analysisEntrySummary,
  counts,
  kpis,
  topChallenges,
  topDirections,
  missionTeaser,
  kennwerteTeaser,
  corporateStrategySummaryHref,
}: StrategyCycleOverviewProps) {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <article
          className={overviewTileClass(0)}
          title={
            "Direkt: Analyse-Eintrag ist Quelle einer Herausforderung (übernommen oder nachträglich zugeordnet). " +
            "Zusätzlich können Einträge über einen bereits übernommenen Analyse-Cluster einbezogen sein. " +
            "Qualität: Bewertungsband (Score oder Regel)."
          }
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">Analyse-Einträge</p>
          <p className="mt-2 flex flex-wrap items-baseline gap-1.5 tabular-nums">
            <span className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              {analysisEntrySummary.directEntryCount}
            </span>
            <span className="text-base font-medium text-zinc-400">/</span>
            <span className="text-xl font-semibold text-zinc-700 sm:text-2xl">{analysisEntrySummary.total}</span>
          </p>
          <p className="mt-1 text-[10px] font-medium leading-snug text-zinc-700">
            mit Herausforderung verknüpft (direkte Quelle)
          </p>
          <p className="mt-2 text-[10px] leading-snug text-zinc-600">
            {analysisEntrySummary.inChallengesUnique} von {analysisEntrySummary.total} Einträgen in Herausforderungen
            einbezogen
            {analysisEntrySummary.clusterOnlyEntryCount > 0
              ? ` (${analysisEntrySummary.clusterOnlyEntryCount} nur über übernommenen Cluster)`
              : ""}
            {analysisEntrySummary.bothDirectAndClusterCount > 0
              ? ` · ${analysisEntrySummary.bothDirectAndClusterCount} direkt und im Cluster`
              : ""}
          </p>
          <p className="mt-1 text-[10px] leading-snug text-zinc-500">
            Qualität: {analysisEntrySummary.qualityHigh} hoch · {analysisEntrySummary.qualityMedium} mittel ·{" "}
            {analysisEntrySummary.qualityLow} niedrig · {analysisEntrySummary.onlyAnalysis} ohne Herausforderungs-Bezug
          </p>
          <p className="mt-auto pt-2">
            <Link
              href={corporateStrategySummaryHref}
              className="text-[10px] font-semibold text-zinc-800 underline underline-offset-2 hover:text-zinc-950"
            >
              Zur Zusammenfassung
            </Link>
          </p>
        </article>
        <article className={overviewTileClass(1)} title="Strategische Herausforderungen im Zyklus">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">Herausforderungen</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 sm:text-3xl">
            {counts.challenges}
          </p>
          <p className="mt-auto text-[10px] leading-snug text-zinc-600">strategisch im Zyklus</p>
        </article>
        <article className={overviewTileClass(2)} title="Strategische Stoßrichtungen">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">Stoßrichtungen</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 sm:text-3xl">
            {counts.directions}
          </p>
          <p className="mt-auto text-[10px] leading-snug text-zinc-600">im Zyklus</p>
        </article>
        <article className={overviewTileClass(3)} title="Strategische Ziele (nicht OKR-Objectives)">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">Strategische Ziele</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 sm:text-3xl">
            {counts.objectives}
          </p>
          <p className="mt-auto text-[10px] leading-snug text-zinc-600">im Strategiezyklus</p>
        </article>
        <article className={overviewTileClass(4)} title="Programme (PIP)">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">Programme</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 sm:text-3xl">
            {counts.programs}
          </p>
          <p className="mt-auto text-[10px] leading-snug text-zinc-600">PIPs</p>
        </article>
        <article className={overviewTileClass(5)} title="Initiativen (PIP)">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">Initiativen</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900 sm:text-3xl">
            {counts.initiatives}
          </p>
          <p className="mt-auto text-[10px] leading-snug text-zinc-600">PIPs</p>
        </article>
      </section>

      <section className="brand-card p-6">
        <h3 className="text-base font-semibold text-zinc-900">Strategisches Design (Kurz)</h3>
        <p className="mt-1 text-sm text-zinc-600">
          Kennzahlen wie in der Bereichs-Übersicht — für Details und Tabellen siehe Strategisches Design.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="brand-surface rounded-md p-3" title={kpis.coverageExplanationDe}>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Herausforderungs-Verankerung</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">
              {kpis.coverageChallengeShare != null ? `${kpis.coverageChallengeShare}%` : "—"}
            </p>
          </div>
          <div className="brand-surface rounded-md p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Kritische Lücken</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{kpis.criticalGaps}</p>
          </div>
          <div className="brand-surface rounded-md p-3" title={kpis.focusExplanationDe}>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Fokus-Konzentration</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">
              {kpis.focusIndex != null ? `${Math.round(kpis.focusIndex * 100)}%` : "—"}
            </p>
          </div>
          <div className="brand-surface rounded-md p-3" title={kpis.objectiveSupportExplanationDe}>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Zielunterstützung (Reifegrad)</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">
              {kpis.objectiveAlignmentMaturity != null
                ? `${Math.round(kpis.objectiveAlignmentMaturity * 100)}%`
                : "—"}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              Korrelations-Overrides: {kpis.correlationConflictCount}
            </p>
          </div>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="brand-card p-6">
          <h3 className="text-base font-semibold text-zinc-900">Unternehmensinfo</h3>
          {missionTeaser ? (
            <p className="mt-2 text-sm text-zinc-700">{missionTeaser}</p>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">Noch kein Missionstext hinterlegt.</p>
          )}
          {kennwerteTeaser ? (
            <p className="mt-2 text-xs text-zinc-500">{kennwerteTeaser}</p>
          ) : null}
          <p className="mt-4 text-sm">
            <Link
              href="/unternehmensinfo?l2=kennwerte"
              className="text-zinc-900 underline underline-offset-2"
            >
              Zu Kennwerten und Profil
            </Link>
          </p>
        </section>

        <section className="brand-card p-6">
          <h3 className="text-base font-semibold text-zinc-900">Strategische Ziele</h3>
          <p className="mt-2 text-sm text-zinc-600">
            {counts.objectives} strategische Ziele im Zyklus — Balance, Bewertung und Tabellen im Reiter{" "}
            <span className="font-medium text-zinc-800">Ziele</span> (nicht zu verwechseln mit OKR-Objectives im
            OKR-Arbeitsbereich).
          </p>
          <p className="mt-4 text-sm">
            <Link href="/strategy-cycle?l1=objectives" className="text-zinc-900 underline underline-offset-2">
              Zum Arbeitsbereich Ziele
            </Link>
          </p>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="brand-card p-6">
          <h3 className="text-base font-semibold text-zinc-900">Führende Herausforderungen</h3>
          <p className="mt-1 text-xs text-zinc-600">Nach Herausforderungs-Score (Top 5).</p>
          <ul className="mt-3 space-y-2 text-sm">
            {topChallenges.length === 0 ? (
              <li className="text-zinc-600">Keine strategischen Herausforderungen.</li>
            ) : (
              topChallenges.map((c) => (
                <li key={c.id} className="brand-surface rounded-md p-2">
                  <span className="font-medium text-zinc-900">{c.title}</span>
                  <span className="ml-2 text-zinc-600">Score {scoreNum(c.challenge_score).toFixed(0)}</span>
                </li>
              ))
            )}
          </ul>
          <p className="mt-4 text-sm">
            <Link href={corporateStrategySummaryHref} className="text-zinc-900 underline underline-offset-2">
              Zur Zusammenfassung (Strategische Erkenntnisse)
            </Link>
          </p>
        </section>

        <section className="brand-card p-6">
          <h3 className="text-base font-semibold text-zinc-900">Priorisierte Stoßrichtungen</h3>
          <p className="mt-1 text-xs text-zinc-600">Nach Priorität (Top 5).</p>
          <ul className="mt-3 space-y-2 text-sm">
            {topDirections.length === 0 ? (
              <li className="text-zinc-600">Keine Stoßrichtungen.</li>
            ) : (
              topDirections.map((d) => (
                <li key={d.id} className="brand-surface rounded-md p-2">
                  <span className="font-medium text-zinc-900">{d.title}</span>
                  <span className="ml-2 text-zinc-600">Prio {d.priority ?? "—"}</span>
                </li>
              ))
            )}
          </ul>
          <p className="mt-4 text-sm">
            <Link
              href="/strategy-cycle?l1=strategic-directions&l2=design"
              className="text-zinc-900 underline underline-offset-2"
            >
              Zu den Stoßrichtungen
            </Link>
          </p>
        </section>
      </div>

      <section className="brand-card p-6">
        <h3 className="text-base font-semibold text-zinc-900">Programme &amp; Initiativen</h3>
        <p className="mt-2 text-sm text-zinc-600">
          {counts.programs} Programme, {counts.initiatives} Initiativen — Umsetzung und Details unter PIPs.
        </p>
        <p className="mt-4 flex flex-wrap gap-4 text-sm">
          <Link href="/strategy-cycle?l1=pips&l2=programme" className="text-zinc-900 underline underline-offset-2">
            Zu den Programmen
          </Link>
          <Link href="/strategy-cycle?l1=pips&l2=initiativen" className="text-zinc-900 underline underline-offset-2">
            Zu den Initiativen
          </Link>
        </p>
      </section>
    </div>
  );
}
