"use client";

import Link from "next/link";
import type { CorrelationSummaryResult } from "@/lib/strategy-cycle/correlation";
import type { ImpactPathGraph } from "@/lib/strategy-cycle/impact-path-graph";

const IMPACT_PATH_HREF = "/strategy-cycle?l1=strategic-directions&l2=summary";

type ImpactPathQualitySectionProps = {
  impactPathGraph: ImpactPathGraph;
  correlationSummary: CorrelationSummaryResult;
};

export function ImpactPathQualitySection({
  impactPathGraph,
  correlationSummary,
}: ImpactPathQualitySectionProps) {
  const { kpis } = impactPathGraph;
  const rejectedCount = impactPathGraph.edges.filter(
    (e) => e.state === "suggested" && e.reviewStatus === "rejected"
  ).length;
  const deferredCount = impactPathGraph.edges.filter(
    (e) => e.state === "suggested" && e.reviewStatus === "deferred"
  ).length;
  const weakExisting = kpis.weakExistingConnections;

  return (
    <article className="brand-card space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">Wirkpfad-Qualität</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Passung, Abdeckung und Entscheidungsreife entlang Analyse → Herausforderung → Stoßrichtung →
            Ziel. Operative Bearbeitung in{" "}
            <Link href={IMPACT_PATH_HREF} className="font-medium text-indigo-700 hover:underline">
              Strategische Wirkpfade
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="brand-surface rounded-md p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Vollständige Wirkpfade</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900">{kpis.completePaths}</p>
        </div>
        <div className="brand-surface rounded-md p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Offene Vorschläge</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900">{kpis.openSuggestions}</p>
        </div>
        <div className="brand-surface rounded-md p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Schwache Verbindungen</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900">{weakExisting}</p>
        </div>
        <div className="brand-surface rounded-md p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Override-Konflikte</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900">
            {correlationSummary.conflictCount}
          </p>
        </div>
      </div>

      <ul className="space-y-1 text-sm text-zinc-700">
        <li>Unverbundene Objekte: {kpis.unconnectedObjects}</li>
        <li>Abgelehnte Vorschläge: {rejectedCount}</li>
        <li>Zurückgestellte Reviews: {deferredCount}</li>
        <li>
          Gut passende Ziele (Korrelation): {correlationSummary.goodObjectivePercent}%
        </li>
      </ul>
    </article>
  );
}
