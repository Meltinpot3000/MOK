"use client";

import { useMemo, useState } from "react";
import type { ReviewCycleData } from "@/lib/review/review-cycle-data";
import type { ExecutionNetworkNode } from "@/lib/review/execution-network-graph";
import {
  applyExecutionNetworkFilters,
  DEFAULT_EXECUTION_NETWORK_FILTERS,
} from "@/lib/review/execution-network-focus";
import { ExecutionNetworkMap } from "./ExecutionNetworkMap";
import { ExecutionNetworkFilters } from "./ExecutionNetworkFilters";
import { ExecutionNetworkDetailPanel } from "./ExecutionNetworkDetailPanel";
import { ReviewMeasureDialog } from "../ReviewMeasureDialog";
import { ReviewImpulseDialog } from "../ReviewImpulseDialog";

type ReviewExecutionNetworkSectionProps = {
  cycleData: ReviewCycleData;
  ownerSelectOptions: Array<{ id: string; label: string }>;
  canWrite: boolean;
};

type MeasureDialogContext = {
  directionId: string;
  initiativeId?: string;
  programId?: string;
  annualTargetId?: string;
  signalType?: string;
};

type ImpulseDialogContext = {
  directionId: string;
  objectType: string;
  objectId: string;
};

export function ReviewExecutionNetworkSection({
  cycleData,
  ownerSelectOptions,
  canWrite,
}: ReviewExecutionNetworkSectionProps) {
  const [filters, setFilters] = useState(DEFAULT_EXECUTION_NETWORK_FILTERS);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [measureDialog, setMeasureDialog] = useState<MeasureDialogContext | null>(null);
  const [impulseDialog, setImpulseDialog] = useState<ImpulseDialogContext | null>(null);

  const graph = cycleData.executionNetwork;

  const { nodes: filteredNodes, edges: filteredEdges } = useMemo(
    () => applyExecutionNetworkFilters(graph, filters),
    [graph, filters]
  );

  const selectedNode = useMemo((): ExecutionNetworkNode | null => {
    if (!selectedNodeId) return null;
    return graph.nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [selectedNodeId, graph.nodes]);

  return (
    <div className="space-y-4">
      <section className="brand-card p-4">
        <h2 className="text-lg font-semibold text-zinc-900">Umsetzungsnetzwerk</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Stoßrichtungen → Programme / Jahresziele → Initiativen → Review-Signale. Programme sind der
          primäre Umsetzungspfad; Jahresziele erscheinen als Planungsanker.
        </p>
      </section>

      <ExecutionNetworkFilters nodes={graph.nodes} filters={filters} onChange={setFilters} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_510px]">
        <ExecutionNetworkMap
          graph={graph}
          filteredNodes={filteredNodes}
          filteredEdges={filteredEdges}
          selectedNodeId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
          focusMode={filters.focusMode}
          pathDepthMin={filters.pathDepthMin}
          pathDepthMax={filters.pathDepthMax}
          onSelectNode={setSelectedNodeId}
          onSelectEdge={setSelectedEdgeId}
        />
        <ExecutionNetworkDetailPanel
          selectedNode={selectedNode}
          cycleData={cycleData}
          ownerSelectOptions={ownerSelectOptions}
          canWrite={canWrite}
          onReviewUpdate={() => {}}
          onOpenMeasureDialog={setMeasureDialog}
          onOpenImpulseDialog={setImpulseDialog}
        />
      </div>

      {measureDialog ? (
        <ReviewMeasureDialog
          open
          context={measureDialog}
          cycleData={cycleData}
          cycleInstanceId={cycleData.cycleInstanceId}
          onClose={() => setMeasureDialog(null)}
        />
      ) : null}

      {impulseDialog ? (
        <ReviewImpulseDialog
          open
          context={impulseDialog}
          cycleInstanceId={cycleData.cycleInstanceId}
          onClose={() => setImpulseDialog(null)}
        />
      ) : null}
    </div>
  );
}
