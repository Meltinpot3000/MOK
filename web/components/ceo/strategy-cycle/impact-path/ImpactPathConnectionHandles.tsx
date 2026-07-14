"use client";

import {
  impactPathHandlePosition,
  resolveImpactPathHandleVisibility,
  type ImpactPathHandleSide,
} from "@/lib/strategy-cycle/impact-path-connect";
import type { ImpactPathEdge, ImpactPathGraph } from "@/lib/strategy-cycle/impact-path-graph";
import type { PositionedImpactPathNode } from "@/components/ceo/strategy-cycle/impact-path/impact-path-ui";

export type ImpactPathLinkDragState = {
  sourceNodeId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  hoverTargetNodeId: string | null;
};

type ImpactPathConnectionHandlesProps = {
  graph: ImpactPathGraph;
  positioned: PositionedImpactPathNode[];
  selectedNodeId: string | null;
  linkDrag: ImpactPathLinkDragState | null;
  onStartLinkFromHandle: (sourceNodeId: string, x: number, y: number, pointerId: number) => void;
};

function handleStroke(
  side: ImpactPathHandleSide,
  nodeId: string,
  linkDrag: ImpactPathLinkDragState | null
): string {
  if (linkDrag?.hoverTargetNodeId === nodeId && side === "in") return "#059669";
  if (linkDrag?.sourceNodeId === nodeId && side === "out") return "#18181b";
  return "#3f3f46";
}

function handleFill(
  side: ImpactPathHandleSide,
  nodeId: string,
  linkDrag: ImpactPathLinkDragState | null
): string {
  if (linkDrag?.hoverTargetNodeId === nodeId && side === "in") return "#d1fae5";
  if (linkDrag?.sourceNodeId === nodeId && side === "out") return "#18181b";
  return "#ffffff";
}

export function ImpactPathConnectionHandles({
  graph,
  positioned,
  selectedNodeId,
  linkDrag,
  onStartLinkFromHandle,
}: ImpactPathConnectionHandlesProps) {
  const visibility = resolveImpactPathHandleVisibility({
    nodes: graph.nodes,
    edges: graph.edges,
    selectedNodeId,
    dragSourceNodeId: linkDrag?.sourceNodeId ?? null,
  });

  if (visibility.length === 0 && !linkDrag) return null;

  const visibleByNode = new Map(visibility.map((v) => [v.nodeId, new Set(v.sides)]));
  const posById = new Map(positioned.map((n) => [n.id, n]));

  return (
    <g className="impact-path-handles">
      {linkDrag ? (
        <line
          x1={linkDrag.startX}
          y1={linkDrag.startY}
          x2={linkDrag.currentX}
          y2={linkDrag.currentY}
          stroke={linkDrag.hoverTargetNodeId ? "#059669" : "#71717a"}
          strokeWidth={2}
          strokeDasharray="6 4"
          pointerEvents="none"
        />
      ) : null}

      {visibility.flatMap(({ nodeId, sides }) => {
        const node = posById.get(nodeId);
        if (!node) return [];
        return sides.map((side) => {
          const { x, y } = impactPathHandlePosition(node, side);
          const isOut = side === "out";
          return (
            <circle
              key={`${nodeId}:${side}`}
              cx={x}
              cy={y}
              r={7}
              fill={handleFill(side, nodeId, linkDrag)}
              stroke={handleStroke(side, nodeId, linkDrag)}
              strokeWidth={2}
              className={isOut ? "cursor-crosshair" : linkDrag ? "cursor-copy" : "cursor-default"}
              onPointerDown={(event) => {
                if (!isOut || linkDrag) return;
                event.stopPropagation();
                onStartLinkFromHandle(nodeId, x, y, event.pointerId);
              }}
            />
          );
        });
      })}
    </g>
  );
}
