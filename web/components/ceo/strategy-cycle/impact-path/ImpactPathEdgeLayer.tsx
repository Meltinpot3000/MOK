"use client";

import type { ImpactPathEdge } from "@/lib/strategy-cycle/impact-path-graph";
import type { PositionedImpactPathNode } from "@/components/ceo/strategy-cycle/impact-path/impact-path-ui";
import {
  impactPathEdgePath,
  statusStrokeColor,
} from "@/components/ceo/strategy-cycle/impact-path/impact-path-ui";

type ImpactPathEdgeLayerProps = {
  edges: ImpactPathEdge[];
  posById: Map<string, PositionedImpactPathNode>;
  selectedEdgeId: string | null;
  highlightIds: Set<string> | null;
  focusMode: boolean;
  onSelectEdge: (edgeId: string) => void;
};

export function ImpactPathEdgeLayer({
  edges,
  posById,
  selectedEdgeId,
  highlightIds,
  focusMode,
  onSelectEdge,
}: ImpactPathEdgeLayerProps) {
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
        const pathD = impactPathEdgePath(
          source.x,
          source.y,
          target.x,
          target.y,
          source.width,
          source.height,
          target.width,
          target.height
        );
        const stroke = statusStrokeColor(edge.status, selected, dimmed);
        const dashed = edge.state === "suggested";

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
            <path d={pathD} fill="none" stroke="transparent" strokeWidth={16} pointerEvents="stroke" />
            <path
              d={pathD}
              fill="none"
              stroke={stroke}
              strokeWidth={selected ? 2.5 : 1.6}
              strokeDasharray={dashed ? "7 5" : undefined}
              pointerEvents="none"
            />
            <text
              x={(source.x + source.width + target.x) / 2}
              y={(source.y + source.height / 2 + target.y + target.height / 2) / 2 - 6}
              textAnchor="middle"
              className="fill-zinc-700 text-[10px] font-semibold"
              pointerEvents="none"
              opacity={dimmed ? 0.25 : 1}
            >
              {edge.score}
            </text>
          </g>
        );
      })}
    </>
  );
}
