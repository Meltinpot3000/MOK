"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PositionedNode, VisualizationEdge } from "@/components/analysis-visualization/types";

type GraphCanvas3DProps = {
  nodes: PositionedNode[];
  edges: VisualizationEdge[];
  showLabels: boolean;
  showLinks: boolean;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  onSelectNode?: (id: string, anchor: { x: number; y: number }) => void;
  onSelectEdge?: (id: string, anchor: { x: number; y: number }) => void;
};

function getEdgeColor(edge: VisualizationEdge): string {
  const tri = edge.triScores;
  if (tri) {
    if (tri.repulsionScore >= Math.max(0.52, tri.supportScore + 0.05)) return "#dc2626";
    if (tri.supportScore >= Math.max(0.52, tri.repulsionScore + 0.05)) return "#16a34a";
    return "#64748b";
  }
  if (edge.linkType === "contradicts") return "#dc2626";
  if (edge.linkType === "supports" || edge.linkType === "amplifies") return "#16a34a";
  return "#94a3b8";
}

export function GraphCanvas3D({
  nodes,
  edges,
  showLabels,
  showLinks,
  selectedNodeId,
  selectedEdgeId,
  setSelectedNodeId,
  setSelectedEdgeId,
  onSelectNode,
  onSelectEdge,
}: GraphCanvas3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(1200);
  const rawHeight = Math.round((width * 9) / 16);
  const height = Math.max(520, Math.min(900, rawHeight));
  const [yawDeg, setYawDeg] = useState(32);
  const [pitchDeg, setPitchDeg] = useState(16);
  const [zoom, setZoom] = useState(1.05);
  const centerX = width / 2;
  const centerY = height / 2;

  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;

  const projected = useMemo(() => {
    return nodes.map((node) => {
      const x = node.x;
      const y = node.y;
      const z = node.z;
      const xYaw = x * Math.cos(yaw) - z * Math.sin(yaw);
      const zYaw = x * Math.sin(yaw) + z * Math.cos(yaw);
      const yPitch = y * Math.cos(pitch) - zYaw * Math.sin(pitch);
      const zPitch = y * Math.sin(pitch) + zYaw * Math.cos(pitch);
      const perspective = 300 / (300 + zPitch);
      return {
        ...node,
        px: centerX + xYaw * perspective * zoom,
        py: centerY + yPitch * perspective * zoom,
        pz: zPitch,
        perspective,
      };
    });
  }, [nodes, yaw, pitch, zoom, centerX, centerY]);

  const projectedById = useMemo(() => new Map(projected.map((item) => [item.id, item])), [projected]);

  const projectedEdges = useMemo(
    () =>
      edges
        .map((edge) => {
          const source = projectedById.get(edge.source);
          const target = projectedById.get(edge.target);
          if (!source || !target) return null;
          return { edge, source, target };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [edges, projectedById]
  );

  const sortedNodes = [...projected].sort((a, b) => a.pz - b.pz);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const syncWidth = () => {
      const next = Math.max(640, Math.floor(el.getBoundingClientRect().width) - 8);
      setWidth(next);
    };
    syncWidth();
    const observer = new ResizeObserver(syncWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full rounded-md border border-zinc-200 bg-white p-2">
      <div className="mb-2 grid grid-cols-3 gap-2">
        <label className="text-xs text-zinc-600">
          Yaw {yawDeg}°
          <input
            type="range"
            min={-180}
            max={180}
            value={yawDeg}
            onChange={(event) => setYawDeg(Number(event.target.value))}
            className="w-full accent-[var(--brand-primary)]"
          />
        </label>
        <label className="text-xs text-zinc-600">
          Pitch {pitchDeg}°
          <input
            type="range"
            min={-75}
            max={75}
            value={pitchDeg}
            onChange={(event) => setPitchDeg(Number(event.target.value))}
            className="w-full accent-[var(--brand-primary)]"
          />
        </label>
        <label className="text-xs text-zinc-600">
          Zoom {zoom.toFixed(2)}
          <input
            type="range"
            min={0.5}
            max={2.2}
            step={0.05}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="w-full accent-[var(--brand-primary)]"
          />
        </label>
      </div>

      <div className="relative overflow-hidden rounded border border-zinc-200 bg-zinc-50" style={{ height }}>
        <svg width={width} height={height} className="absolute left-0 top-0">
          {showLinks
            ? projectedEdges.map(({ edge, source, target }) => (
                <line
                  key={edge.id}
                  x1={source.px}
                  y1={source.py}
                  x2={target.px}
                  y2={target.py}
                  stroke={selectedEdgeId === edge.id ? "#0f172a" : getEdgeColor(edge)}
                  strokeWidth={Math.max(1, edge.strength * 0.7)}
                  strokeOpacity={edge.isDraft ? 0.45 : Math.min(0.95, Math.max(0.2, edge.confidence))}
                  strokeDasharray={edge.isDraft ? "4 3" : undefined}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedEdgeId(edge.id);
                    setSelectedNodeId(null);
                    if (containerRef.current && onSelectEdge) {
                      const rect = containerRef.current.getBoundingClientRect();
                      onSelectEdge(edge.id, {
                        x: event.clientX - rect.left,
                        y: event.clientY - rect.top,
                      });
                    }
                  }}
                />
              ))
            : null}
          {sortedNodes.map((node) => (
            <g key={node.id} transform={`translate(${node.px} ${node.py})`}>
              <circle
                r={Math.max(4, (4 + node.impact * 1.4) * node.perspective)}
                fill="#334155"
                fillOpacity={0.9}
                stroke={selectedNodeId === node.id ? "#0f172a" : "#ffffff"}
                strokeWidth={selectedNodeId === node.id ? 3 : 1.2}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedNodeId(node.id);
                  setSelectedEdgeId(null);
                  if (containerRef.current && onSelectNode) {
                    const rect = containerRef.current.getBoundingClientRect();
                    onSelectNode(node.id, {
                      x: event.clientX - rect.left,
                      y: event.clientY - rect.top,
                    });
                  }
                }}
              />
              {showLabels ? (
                <text x={8} y={3} fontSize={10} fill="#111827">
                  {node.label.length > 28 ? `${node.label.slice(0, 28)}...` : node.label}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        3D-Achsen: X internal/external | Y impact | Z short/long-term
      </p>
    </div>
  );
}
