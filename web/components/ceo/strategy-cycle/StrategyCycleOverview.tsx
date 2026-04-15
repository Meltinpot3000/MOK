"use client";

import Link from "next/link";
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
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <article
          className="brand-card p-4 sm:col-span-2 xl:col-span-2"
          title={
            "Qualitätsband nach Bewertung (Score oder Regel). „In Herausforderungen“: Eintrag ist Quelle einer " +
            "strategischen Herausforderung und/oder gehört zu einem Cluster, der bereits in eine Herausforderung " +
            "übernommen wurde."
          }
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Analyse-Einträge</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{analysisEntrySummary.total}</p>
          <p className="mt-1 text-[11px] leading-snug text-zinc-600">
            {analysisEntrySummary.qualityHigh} hoch · {analysisEntrySummary.qualityMedium} mittel ·{" "}
            {analysisEntrySummary.qualityLow} niedrig
          </p>
          <p className="mt-1 text-[11px] leading-snug text-zinc-600">
            {analysisEntrySummary.inChallengesUnique} in Herausforderungen · {analysisEntrySummary.onlyAnalysis} nur
            Analyse
          </p>
          {analysisEntrySummary.inChallengesUnique > 0 ? (
            <p className="mt-1 text-[10px] leading-snug text-zinc-500">
              davon {analysisEntrySummary.directOnlyEntryCount} nur direkt · {analysisEntrySummary.clusterOnlyEntryCount}{" "}
              nur über Cluster · {analysisEntrySummary.bothDirectAndClusterCount} in beiden Pfaden
            </p>
          ) : null}
          <p className="mt-2 text-[11px]">
            <Link
              href={corporateStrategySummaryHref}
              className="font-medium text-zinc-800 underline underline-offset-2 hover:text-zinc-950"
            >
              Zur Zusammenfassung
            </Link>
          </p>
        </article>
        <article className="brand-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Herausforderungen</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{counts.challenges}</p>
          <p className="mt-1 text-xs text-zinc-500">strategisch</p>
        </article>
        <article className="brand-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Stoßrichtungen</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{counts.directions}</p>
          <p className="mt-1 text-xs text-zinc-500">im Zyklus</p>
        </article>
        <article className="brand-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Strategische Ziele</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{counts.objectives}</p>
          <p className="mt-1 text-xs text-zinc-500">im Strategiezyklus</p>
        </article>
        <article className="brand-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Programme</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{counts.programs}</p>
          <p className="mt-1 text-xs text-zinc-500">PIPs</p>
        </article>
        <article className="brand-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Initiativen</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{counts.initiatives}</p>
          <p className="mt-1 text-xs text-zinc-500">PIPs</p>
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
