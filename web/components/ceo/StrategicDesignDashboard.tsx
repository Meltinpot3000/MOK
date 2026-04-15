"use client";

import { SortableTableHeader } from "@/components/table/SortableTableHeader";
import { compareSortKeys } from "@/lib/table/compare-sort-keys";
import type { CoverageBand, StrategicDesignInsightsResult } from "@/lib/strategy-cycle/strategic-design-insights";
import { STRATEGIC_DESIGN_INSIGHT_THRESHOLDS } from "@/lib/strategy-cycle/strategic-design-insight-thresholds";
import { useMemo, useState } from "react";

type Props = {
  insights: StrategicDesignInsightsResult;
};

function coverageBandLabelDe(band: CoverageBand): string {
  switch (band) {
    case "none":
      return "Keine Verankerung";
    case "weak":
      return "Schwach";
    case "medium":
      return "Mittel";
    case "strong":
      return "Stark";
    default:
      return band;
  }
}

function conflictTypeLabelDe(type: string): string {
  switch (type) {
    case "misaligned_direction":
      return "Sto\u00DFrichtung";
    case "unsupported_objective":
      return "Ziel";
    case "correlation_weak":
      return "Korrelation";
    default:
      return type;
  }
}

function barPercent(value: number, max: number): number {
  if (!Number.isFinite(value) || max <= 0) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}

const COVERAGE_BAND_ORDER: Record<CoverageBand, number> = {
  none: 0,
  weak: 1,
  medium: 2,
  strong: 3,
};

type GapTableSortCol = "title" | "score" | "coverage" | "band";
type ObjTableSortCol = "title" | "dirWeight" | "chBack";

export function StrategicDesignDashboard({ insights }: Props) {
  const [showAllConflicts, setShowAllConflicts] = useState(false);
  const [gapSortCol, setGapSortCol] = useState<GapTableSortCol | null>(null);
  const [gapSortDir, setGapSortDir] = useState<"asc" | "desc">("asc");
  const [objSortCol, setObjSortCol] = useState<ObjTableSortCol | null>(null);
  const [objSortDir, setObjSortDir] = useState<"asc" | "desc">("asc");
  const { topDirections, unaddressedChallenges, limitedChallengeBackingObjectives, conflicts, kpis } = insights;

  const requestGapSort = (col: GapTableSortCol) => {
    if (gapSortCol === col) {
      setGapSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setGapSortCol(col);
      setGapSortDir("asc");
    }
  };

  const requestObjSort = (col: ObjTableSortCol) => {
    if (objSortCol === col) {
      setObjSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setObjSortCol(col);
      setObjSortDir("asc");
    }
  };

  const sortedUnaddressedChallenges = useMemo(() => {
    if (!gapSortCol) return unaddressedChallenges;
    const mul = gapSortDir === "asc" ? 1 : -1;
    return [...unaddressedChallenges].sort((a, b) => {
      let va: string | number | null = null;
      let vb: string | number | null = null;
      if (gapSortCol === "title") {
        va = a.title;
        vb = b.title;
      } else if (gapSortCol === "score") {
        va = a.challengeScore;
        vb = b.challengeScore;
      } else if (gapSortCol === "coverage") {
        va = a.coverage;
        vb = b.coverage;
      } else {
        va = COVERAGE_BAND_ORDER[a.coverageBand];
        vb = COVERAGE_BAND_ORDER[b.coverageBand];
      }
      return compareSortKeys(va, vb) * mul;
    });
  }, [unaddressedChallenges, gapSortCol, gapSortDir]);

  const sortedLimitedObjectives = useMemo(() => {
    if (!objSortCol) return limitedChallengeBackingObjectives;
    const mul = objSortDir === "asc" ? 1 : -1;
    return [...limitedChallengeBackingObjectives].sort((a, b) => {
      let va: string | number | null = null;
      let vb: string | number | null = null;
      if (objSortCol === "title") {
        va = a.title;
        vb = b.title;
      } else if (objSortCol === "dirWeight") {
        va = a.directionLinkageWeight;
        vb = b.directionLinkageWeight;
      } else {
        va = a.challengeBacking;
        vb = b.challengeBacking;
      }
      return compareSortKeys(va, vb) * mul;
    });
  }, [limitedChallengeBackingObjectives, objSortCol, objSortDir]);

  const maxImpact = useMemo(
    () => Math.max(1, ...topDirections.map((d) => d.challengeImpact)),
    [topDirections]
  );
  const maxAlign = useMemo(
    () => Math.max(1, ...topDirections.map((d) => d.objectiveAlignment)),
    [topDirections]
  );

  const initialN = STRATEGIC_DESIGN_INSIGHT_THRESHOLDS.conflictsInitialDisplayCount;
  const visibleConflicts = showAllConflicts ? conflicts : conflicts.slice(0, initialN);

  return (
    <div className="space-y-4">
      <article className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Übersicht Strategisches Design</h2>
        <p className="mt-1 text-sm text-zinc-600">
          
          Entscheidungsorientierte Kurzsicht: Fokus-Stoßrichtungen, Lücken, Hinweise zu Zielen und Konflikten im
          Modell. Technische Kennzahlen und Schwellen in den Tooltips erklärt.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="brand-surface rounded-md p-3" title={kpis.coverageExplanationDe}>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Herausforderungs-Verankerung</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">
              {kpis.coverageChallengeShare != null ? `${kpis.coverageChallengeShare}%` : "—"}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">Mit mittlerer/starker Stoßrichtungs-Kopplung</p>
          </div>
          <div className="brand-surface rounded-md p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Kritische Lücken</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{kpis.criticalGaps}</p>
            <p className="mt-1 text-[11px] text-zinc-500">Hohe Herausforderungs-Scores ohne starken Anker</p>
          </div>
          <div className="brand-surface rounded-md p-3" title={kpis.focusExplanationDe}>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Fokus-Konzentration</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">
              {kpis.focusIndex != null ? `${Math.round(kpis.focusIndex * 100)}%` : "—"}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">Anteil der Top-3-Richtungen am Gesamt-Score</p>
          </div>
          <div className="brand-surface rounded-md p-3" title={kpis.objectiveSupportExplanationDe}>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Zielunterstützung (Reifegrad)</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">
              {kpis.objectiveAlignmentMaturity != null
                ? `${Math.round(kpis.objectiveAlignmentMaturity * 100)}%`
                : "—"}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              Top-Richtungen: Ist vs. maximal möglich bei starken Ziel-Links
              {kpis.topDirectionsStrongObjectiveLinkShare != null
                ? ` · ${Math.round(kpis.topDirectionsStrongObjectiveLinkShare * 100)}% mit starkem Ziel-Link`
                : ""}
            </p>
            {kpis.averageObjectiveSupport != null ? (
              <p className="mt-0.5 text-[10px] text-zinc-400">
                Durchschnittliche Zielunterstützung (absolut): {kpis.averageObjectiveSupport.toFixed(1)}
              </p>
            ) : null}
            <p className="mt-1 text-[10px] text-zinc-400">
              Korrelations-Overrides (Matrix): {kpis.correlationConflictCount}
            </p>
          </div>
        </div>
      </article>

      <article className="brand-card p-6">
        <h3 className="text-base font-semibold text-zinc-900">Fokus: führende Stoßrichtungen</h3>
        <p className="mt-1 text-xs text-zinc-600">Top 5 nach gewichtetem Score (Herausforderungen 70 %, Ziele 30 %).</p>
        {topDirections.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">Keine Stoßrichtungen im Zyklus.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {topDirections.map((d) => (
              <li
                key={d.directionId}
                className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-zinc-900">{d.title}</p>
                    <p className="mt-1 text-xs text-zinc-600">{d.explanationDe}</p>
                  </div>
                  <span className="rounded-md bg-zinc-100 px-2 py-1 text-sm font-semibold tabular-nums text-zinc-900">
                    {d.score.toFixed(1)}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-600">
                      <span>Problemlast (Herausforderungen)</span>
                      <span className="tabular-nums">{d.challengeImpact.toFixed(1)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: `${barPercent(d.challengeImpact, maxImpact)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-zinc-600">
                      <span>Zielunterstützung</span>
                      <span className="tabular-nums">{d.objectiveAlignment.toFixed(1)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${barPercent(d.objectiveAlignment, maxAlign)}%` }}
                      />
                    </div>
                  </div>
                </div>
                {d.linkedChallengeTitles.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {d.linkedChallengeTitles.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-700"
                      >
                        {t.length > 40 ? `${t.slice(0, 40)}…` : t}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="brand-card p-6">
        <h3 className="text-base font-semibold text-zinc-900">Kritische Lücken: Herausforderungen</h3>
        <p className="mt-1 text-xs text-zinc-600">
          
          Hoher Herausforderungs-Score ohne stark verankerte Stoßrichtung (normalisierte Link-Gewichte).
        </p>
        {unaddressedChallenges.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">Keine Einträge nach aktuellen Schwellen.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs font-semibold text-zinc-600">
                  <SortableTableHeader
                    label="Herausforderung"
                    sortDirection={gapSortCol === "title" ? gapSortDir : null}
                    onRequestSort={() => requestGapSort("title")}
                    className="py-2 pr-3"
                    buttonClassName="font-semibold text-zinc-600 hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
                  />
                  <SortableTableHeader
                    label="Score"
                    sortDirection={gapSortCol === "score" ? gapSortDir : null}
                    onRequestSort={() => requestGapSort("score")}
                    className="py-2 pr-3"
                    buttonClassName="font-semibold text-zinc-600 hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
                  />
                  <SortableTableHeader
                    label="Verankerung (max. Gewicht)"
                    sortDirection={gapSortCol === "coverage" ? gapSortDir : null}
                    onRequestSort={() => requestGapSort("coverage")}
                    className="py-2 pr-3"
                    buttonClassName="font-semibold text-zinc-600 hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
                  />
                  <SortableTableHeader
                    label="Status"
                    sortDirection={gapSortCol === "band" ? gapSortDir : null}
                    onRequestSort={() => requestGapSort("band")}
                    className="py-2"
                    buttonClassName="font-semibold text-zinc-600 hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
                  />
                </tr>
              </thead>
              <tbody>
                {sortedUnaddressedChallenges.map((row) => (
                  <tr key={row.challengeId} className="border-b border-zinc-100 align-top">
                    <td className="py-2 pr-3">
                      <span className="font-medium text-zinc-900">{row.title}</span>
                      <p className="mt-1 text-[11px] text-zinc-500">{row.explanationDe}</p>
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{row.challengeScore.toFixed(0)}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.coverage.toFixed(2)}</td>
                    <td className="py-2 text-zinc-700">{coverageBandLabelDe(row.coverageBand)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="brand-card p-6">
        <h3 className="text-base font-semibold text-zinc-900">Ziele mit schwacher Problemverankerung</h3>
        <p className="mt-1 text-xs text-zinc-600">
          
          Heuristik im Datenmodell: stark über Stoßrichtungen angebunden, aber geringe Herausforderungs-Basis — bitte
          Verknüpfungen prüfen, nicht die inhaltliche Zielpriorität automatisch verwerfen.
        </p>
        {limitedChallengeBackingObjectives.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">Keine Kandidaten nach aktuellen Schwellen.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs font-semibold text-zinc-600">
                  <SortableTableHeader
                    label="Ziel"
                    sortDirection={objSortCol === "title" ? objSortDir : null}
                    onRequestSort={() => requestObjSort("title")}
                    className="py-2 pr-3"
                    buttonClassName="font-semibold text-zinc-600 hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
                  />
                  <SortableTableHeader
                    label="Richtungs-Gewicht (Summe)"
                    sortDirection={objSortCol === "dirWeight" ? objSortDir : null}
                    onRequestSort={() => requestObjSort("dirWeight")}
                    className="py-2 pr-3"
                    buttonClassName="font-semibold text-zinc-600 hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
                  />
                  <SortableTableHeader
                    label="Herausforderungs-Basis (Summe)"
                    sortDirection={objSortCol === "chBack" ? objSortDir : null}
                    onRequestSort={() => requestObjSort("chBack")}
                    className="py-2"
                    buttonClassName="font-semibold text-zinc-600 hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
                  />
                </tr>
              </thead>
              <tbody>
                {sortedLimitedObjectives.map((row) => (
                  <tr key={row.objectiveId} className="border-b border-zinc-100 align-top">
                    <td className="py-2 pr-3">
                      <span className="font-medium text-zinc-900">{row.title}</span>
                      <p className="mt-1 text-xs text-zinc-500">{row.explanationDe}</p>
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{row.directionLinkageWeight.toFixed(2)}</td>
                    <td className="py-2 tabular-nums">{row.challengeBacking.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="brand-card p-6">
        <h3 className="text-base font-semibold text-zinc-900">Konflikte & Hinweise</h3>
        <p className="mt-1 text-xs text-zinc-600">
          Vollständig berechnet; Anzeige zunächst {initialN} Einträge. Sortierung nach Misalignment-Stärke.
        </p>
        {conflicts.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">Keine Konflikte nach aktuellen Regeln.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {visibleConflicts.map((c, idx) => {
              const rowKey =
                c.type === "misaligned_direction"
                  ? c.directionId
                  : c.type === "unsupported_objective"
                    ? c.objectiveId
                    : `${c.challengeId}-${c.objectiveId}`;
              return (
              <li
                key={`${c.type}-${idx}-${rowKey}`}
                className="rounded-md border border-amber-200 bg-amber-50/50 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                    {conflictTypeLabelDe(c.type)}
                  </span>
                  {"directionTitle" in c ? (
                    <span className="font-medium text-zinc-900">{c.directionTitle}</span>
                  ) : null}
                  {"objectiveTitle" in c && c.type === "unsupported_objective" ? (
                    <span className="font-medium text-zinc-900">{c.objectiveTitle}</span>
                  ) : null}
                  {c.type === "correlation_weak" ? (
                    <span className="font-medium text-zinc-900">
                      {c.challengeTitle} ↔ {c.objectiveTitle}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-zinc-700">{c.explanationDe}</p>
              </li>
              );
            })}
          </ul>
        )}
        {conflicts.length > initialN ? (
          <button
            type="button"
            onClick={() => setShowAllConflicts((v) => !v)}
            className="mt-3 text-xs font-medium text-zinc-700 underline hover:text-zinc-900"
          >
            {showAllConflicts ? "Weniger anzeigen" : `Alle ${conflicts.length} anzeigen`}
          </button>
        ) : null}
      </article>
    </div>
  );
}
