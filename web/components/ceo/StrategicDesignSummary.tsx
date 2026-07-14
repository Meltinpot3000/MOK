"use client";

import { useMemo, useState } from "react";
import type { CorrelationSummaryResult } from "@/lib/strategy-cycle/correlation";
import type { ImpactPathGraph } from "@/lib/strategy-cycle/impact-path-graph";
import type { ImpactPathMutationResult } from "@/lib/strategy-cycle/impact-path-mutation";
import {
  applyImpactPathFilters,
  DEFAULT_IMPACT_PATH_FILTERS,
  ImpactPathFilters,
} from "@/components/ceo/strategy-cycle/impact-path/ImpactPathFilters";
import { ImpactPathDetailPanel } from "@/components/ceo/strategy-cycle/impact-path/ImpactPathDetailPanel";
import { ImpactPathMatrixAudit } from "@/components/ceo/strategy-cycle/impact-path/ImpactPathMatrixAudit";
import { StrategicImpactPathMap } from "@/components/ceo/strategy-cycle/impact-path/StrategicImpactPathMap";
import { useImpactPathMutations } from "@/components/ceo/strategy-cycle/impact-path/useImpactPathMutations";

type ImpactPathMutationAction = (formData: FormData) => Promise<ImpactPathMutationResult | void>;

type StrategicDesignSummaryProps = {
  canWrite: boolean;
  summary: CorrelationSummaryResult;
  impactPathGraph: ImpactPathGraph;
  showMatrixAudit: boolean;
  initialFocusNodeId?: string | null;
  onAcceptSuggestion: ImpactPathMutationAction;
  onRejectSuggestion: ImpactPathMutationAction;
  onDeferSuggestion: ImpactPathMutationAction;
  onDeleteLink: ImpactPathMutationAction;
  onSaveOverride: ImpactPathMutationAction;
  onClearOverride: ImpactPathMutationAction;
};

export function StrategicDesignSummary({
  canWrite,
  summary,
  impactPathGraph,
  showMatrixAudit,
  initialFocusNodeId,
  onAcceptSuggestion,
  onRejectSuggestion,
  onDeferSuggestion,
  onDeleteLink,
  onSaveOverride,
  onClearOverride,
}: StrategicDesignSummaryProps) {
  const { statusBanner, setStatusBanner, isPending, wrapAction, submitForm } = useImpactPathMutations();
  const acceptSuggestion = useMemo(() => wrapAction(onAcceptSuggestion), [onAcceptSuggestion, wrapAction]);
  const rejectSuggestion = useMemo(() => wrapAction(onRejectSuggestion), [onRejectSuggestion, wrapAction]);
  const deferSuggestion = useMemo(() => wrapAction(onDeferSuggestion), [onDeferSuggestion, wrapAction]);
  const deleteLink = useMemo(() => wrapAction(onDeleteLink), [onDeleteLink, wrapAction]);
  const saveOverride = useMemo(() => wrapAction(onSaveOverride), [onSaveOverride, wrapAction]);
  const clearOverride = useMemo(() => wrapAction(onClearOverride), [onClearOverride, wrapAction]);

  const [filters, setFilters] = useState({
    ...DEFAULT_IMPACT_PATH_FILTERS,
    focusNodeId: initialFocusNodeId ?? "",
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const { nodes: filteredNodes, edges: filteredEdges } = useMemo(
    () => applyImpactPathFilters(impactPathGraph, filters),
    [impactPathGraph, filters]
  );

  const selectedNode = useMemo(
    () => impactPathGraph.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [impactPathGraph.nodes, selectedNodeId]
  );

  const selectedEdge = useMemo(
    () => impactPathGraph.edges.find((e) => e.id === selectedEdgeId) ?? null,
    [impactPathGraph.edges, selectedEdgeId]
  );

  const { kpis } = impactPathGraph;

  return (
    <div className="space-y-4">
      {statusBanner ? (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            statusBanner.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <p>{statusBanner.text}</p>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="shrink-0 text-xs opacity-70 hover:opacity-100"
              aria-label="Hinweis schließen"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}

      <p className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
        <span className="font-semibold text-zinc-900">Strategische Wirkpfade.</span>{" "}
        Erzeuge, prüfe und vervollständige strategische Verbindungen entlang des Wirkpfads: Analyse →
        Herausforderung → Stoßrichtung → Ziel. Bestehende Verbindungen sind durchgezogen, Vorschläge
        gestrichelt. Neue Verbindungen per Andockpunkt ziehen oder Vorschlag annehmen.
      </p>

      <article className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Strategische Wirkpfade</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Arbeitswerkzeug zur Kuratierung von Verbindungen — keine Management-Zusammenfassung.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <div className="brand-surface rounded-md p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Vollständige Wirkpfade</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{kpis.completePaths}</p>
          </div>
          <div className="brand-surface rounded-md p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Offene Vorschläge</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{kpis.openSuggestions}</p>
          </div>
          <div className="brand-surface rounded-md p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Schwache Verbindungen</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{kpis.weakExistingConnections}</p>
          </div>
          <div className="brand-surface rounded-md p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Unverbundene Objekte</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{kpis.unconnectedObjects}</p>
          </div>
          <div className="brand-surface rounded-md p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Nicht analysefähig</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{kpis.nonAnalysableObjects}</p>
          </div>
        </div>
      </article>

      <ImpactPathFilters
        nodes={impactPathGraph.nodes}
        edges={impactPathGraph.edges}
        filters={filters}
        onChange={setFilters}
      />

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <StrategicImpactPathMap
          canWrite={canWrite}
          graph={impactPathGraph}
          filteredNodes={filteredNodes}
          filteredEdges={filteredEdges}
          selectedNodeId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
          focusMode={filters.focusMode}
          pathDepthMin={filters.pathDepthMin}
          pathDepthMax={filters.pathDepthMax}
          onSelectNode={setSelectedNodeId}
          onSelectEdge={setSelectedEdgeId}
          onCreateLink={acceptSuggestion}
          isMutationPending={isPending}
        />
        <div className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
        <ImpactPathDetailPanel
          canWrite={canWrite}
          graph={impactPathGraph}
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          onSelectEdge={setSelectedEdgeId}
          isMutationPending={isPending}
          onAcceptSuggestion={submitForm(onAcceptSuggestion)}
          onRejectSuggestion={submitForm(onRejectSuggestion)}
          onDeferSuggestion={submitForm(onDeferSuggestion)}
          onDeleteLink={submitForm(onDeleteLink)}
          onSaveOverride={submitForm(onSaveOverride)}
          onClearOverride={submitForm(onClearOverride)}
        />
        </div>
      </div>

      {showMatrixAudit ? (
        <ImpactPathMatrixAudit
          canWrite={canWrite}
          summary={summary}
          isMutationPending={isPending}
          onSaveOverride={submitForm(onSaveOverride)}
          onClearOverride={submitForm(onClearOverride)}
        />
      ) : null}
    </div>
  );
}
