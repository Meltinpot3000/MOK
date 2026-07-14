"use client";

import type { ExecutionNetworkEdge } from "@/lib/review/execution-network-graph";
import type { PositionedExecutionNetworkNode } from "@/lib/review/execution-network-ui";
import {
  executionNetworkEdgePath,
  executionNetworkHealthStroke,
} from "@/lib/review/execution-network-ui";

type ExecutionNetworkEdgeLayerProps = {
  edges: ExecutionNetworkEdge[];
  posById: Map<string, PositionedExecutionNetworkNode>;
  selectedEdgeId: string | null;
  highlightIds: Set<string> | null;
  focusMode: boolean;
  onSelectEdge: (edgeId: string) => void;
};

export function ExecutionNetworkEdgeLayer({
  edges,
  posById,
  selectedEdgeId,
  highlightIds,
  focusMode,
  onSelectEdge,
}: ExecutionNetworkEdgeLayerProps) {
  return (
    <>
      {edges.map((edge) => {
        const source = posById.get(edge.sourceId);
        const target = posById.get(edge.targetId);
        if (!source || !target) return null;

        const edgeHighlighted =
          highlightIds == null ||
          (highlightIds.has(edge.sourceId) && highlightIds.has(edge.targetId));
        const dimmed = focusMode && highlightIds != null && !edgeHighlighted;
        const selected = selectedEdgeId === edge.id;
        const pathD = executionNetworkEdgePath(
          source.x,
          source.y,
          target.x,
          target.y,
          source.width,
          source.height,
          target.width,
          target.height
        );
        const stroke = executionNetworkHealthStroke(edge.health, selected, dimmed);
        const strokeWidth = edge.weight ? Math.min(4, 1 + edge.weight * 0.3) : selected ? 2.5 : 1.6;

        return (
          <g
            key={edge.id}
            className="cursor-pointer"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onSelectEdge(edge.id);
            }}
          >
            <path d={pathD} fill="none" stroke="transparent" strokeWidth={14} pointerEvents="stroke" />
            <path
              d={pathD}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={edge.style === "dashed" ? "7 5" : undefined}
              pointerEvents="none"
              opacity={dimmed ? 0.25 : 1}
            />
          </g>
        );
      })}
    </>
  );
}
