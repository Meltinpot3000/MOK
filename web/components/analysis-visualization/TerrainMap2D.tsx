"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PositionedNode, VisualizationEdge } from "@/components/analysis-visualization/types";

type TerrainMap2DProps = {
  nodes: PositionedNode[];
  edges: VisualizationEdge[];
  showLabels: boolean;
  showLinks: boolean;
  showDensity: boolean;
  showClusterLabels: boolean;
  showChallengeLayer: boolean;
  showDirectionLayer: boolean;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  onSelectNode?: (id: string, anchor: { x: number; y: number }) => void;
  onSelectEdge?: (id: string, anchor: { x: number; y: number }) => void;
};

function getNodeColor(analysisType: string): string {
  switch (analysisType) {
    case "environment":
      return "#0284c7";
    case "company":
      return "#7c3aed";
    case "competitor":
      return "#ea580c";
    case "swot":
      return "#059669";
    case "workshop":
      return "#dc2626";
    default:
      return "#475569";
  }
}

function getEdgeColor(edge: VisualizationEdge) {
  const tri = edge.triScores;
  if (tri) {
    if (tri.repulsionScore >= Math.max(0.52, tri.supportScore + 0.05)) return "#dc2626";
    if (tri.supportScore >= Math.max(0.52, tri.repulsionScore + 0.05)) return "#16a34a";
  }
  return "#64748b";
}

export function TerrainMap2D({
  nodes,
  edges,
  showLabels,
  showLinks,
  showDensity,
  showClusterLabels,
  showChallengeLayer,
  showDirectionLayer,
  selectedNodeId,
  selectedEdgeId,
  setSelectedNodeId,
  setSelectedEdgeId,
  onSelectNode,
  onSelectEdge,
}: TerrainMap2DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [width, setWidth] = useState(1200);
  const rawHeight = Math.round((width * 9) / 16);
  const height = Math.max(520, Math.min(900, rawHeight));
  const centerX = width / 2;
  const centerY = height / 2;

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const renderedEdges = useMemo(
    () =>
      edges
        .map((edge) => {
          const source = nodeById.get(edge.source);
          const target = nodeById.get(edge.target);
          if (!source || !target) return null;
          return { edge, source, target };
        })
        .filter((item): item is { edge: VisualizationEdge; source: PositionedNode; target: PositionedNode } => Boolean(item)),
    [edges, nodeById]
  );

  const clusters = useMemo(() => {
    const buckets = new Map<string, PositionedNode[]>();
    for (const node of nodes) {
      if (!node.clusterId) continue;
      const current = buckets.get(node.clusterId) ?? [];
      current.push(node);
      buckets.set(node.clusterId, current);
    }
    return [...buckets.entries()].map(([clusterId, members]) => {
      const cx = members.reduce((sum, node) => sum + node.x, 0) / members.length;
      const cy = members.reduce((sum, node) => sum + node.y, 0) / members.length;
      const label = members[0]?.clusterLabel ?? "Cluster";
      const radius = Math.max(
        40,
        ...members.map((node) => Math.hypot(node.x - cx, node.y - cy))
      ) + 24;
      return { clusterId, cx, cy, label, radius, size: members.length };
    });
  }, [nodes]);

  const bridges = useMemo(() => {
    const bridgeMap = new Map<string, { a: string; b: string; strength: number }>();
    for (const item of renderedEdges) {
      const a = item.source.clusterId;
      const b = item.target.clusterId;
      if (!a || !b || a === b) continue;
      const key = [a, b].sort().join("__");
      const existing = bridgeMap.get(key);
      if (existing) {
        existing.strength += item.edge.strength;
      } else {
        bridgeMap.set(key, { a, b, strength: item.edge.strength });
      }
    }
    const centroidByCluster = new Map(clusters.map((cluster) => [cluster.clusterId, cluster]));
    return [...bridgeMap.values()]
      .map((bridge) => {
        const left = centroidByCluster.get(bridge.a);
        const right = centroidByCluster.get(bridge.b);
        if (!left || !right) return null;
        return { left, right, strength: bridge.strength };
      })
      .filter(Boolean) as Array<{
      left: { cx: number; cy: number };
      right: { cx: number; cy: number };
      strength: number;
    }>;
  }, [renderedEdges, clusters]);

  const densitySpots = useMemo(
    () =>
      nodes
        .slice()
        .sort((a, b) => b.impact - a.impact)
        .slice(0, 14)
        .map((node) => ({
          x: node.x,
          y: node.y,
          r: 26 + node.impact * 9,
          alpha: 0.09 + node.impact * 0.02,
        })),
    [nodes]
  );

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
      <div
        ref={wrapperRef}
        className="relative overflow-hidden rounded border border-zinc-200 bg-zinc-50"
        style={{ height }}
        onWheel={(event) => {
          event.preventDefault();
          const delta = event.deltaY > 0 ? -0.08 : 0.08;
          setZoom((prev) => Math.max(0.35, Math.min(2.4, prev + delta)));
        }}
        onMouseDown={(event) => {
          setDragStart({ x: event.clientX, y: event.clientY });
          setPanStart({ ...pan });
        }}
        onMouseMove={(event) => {
          if (!dragStart || !panStart) return;
          setPan({
            x: panStart.x + (event.clientX - dragStart.x),
            y: panStart.y + (event.clientY - dragStart.y),
          });
        }}
        onMouseUp={() => {
          setDragStart(null);
          setPanStart(null);
        }}
        onMouseLeave={() => {
          setDragStart(null);
          setPanStart(null);
        }}
      >
        <svg width={width} height={height} className="absolute left-0 top-0">
          <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
            <line x1={centerX - 420} y1={centerY} x2={centerX + 420} y2={centerY} stroke="#cbd5e1" strokeWidth={1.5} />
            <line x1={centerX} y1={centerY - 255} x2={centerX} y2={centerY + 255} stroke="#cbd5e1" strokeWidth={1.5} />
            <text x={centerX - 410} y={centerY - 8} fontSize={10} fill="#64748b">internal</text>
            <text x={centerX + 350} y={centerY - 8} fontSize={10} fill="#64748b">external</text>
            <text x={centerX + 6} y={centerY - 236} fontSize={10} fill="#64748b">strategic</text>
            <text x={centerX + 6} y={centerY + 246} fontSize={10} fill="#64748b">operational</text>

            {showDensity
              ? densitySpots.map((spot, index) => (
                  <circle
                    key={`density-${index}`}
                    cx={centerX + spot.x}
                    cy={centerY + spot.y}
                    r={spot.r}
                    fill="#0ea5e9"
                    fillOpacity={spot.alpha}
                  />
                ))
              : null}

            {showLinks
              ? bridges.map((bridge, index) => (
                  <line
                    key={`bridge-${index}`}
                    x1={centerX + bridge.left.cx}
                    y1={centerY + bridge.left.cy}
                    x2={centerX + bridge.right.cx}
                    y2={centerY + bridge.right.cy}
                    stroke="#14b8a6"
                    strokeOpacity={0.45}
                    strokeWidth={Math.min(8, 1 + bridge.strength * 0.2)}
                    strokeDasharray="4 3"
                  />
                ))
              : null}

            {showLinks
              ? renderedEdges.map(({ edge, source, target }) => (
                  <line
                    key={edge.id}
                    x1={centerX + source.x}
                    y1={centerY + source.y}
                    x2={centerX + target.x}
                    y2={centerY + target.y}
                    stroke={selectedEdgeId === edge.id ? "#0f172a" : getEdgeColor(edge)}
                    strokeWidth={Math.max(1, edge.strength * 0.65)}
                    strokeOpacity={edge.isDraft ? 0.45 : Math.min(0.9, Math.max(0.18, edge.confidence))}
                    strokeDasharray={edge.isDraft ? "4 3" : undefined}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedEdgeId(edge.id);
                      setSelectedNodeId(null);
                      if (wrapperRef.current && onSelectEdge) {
                        const rect = wrapperRef.current.getBoundingClientRect();
                        onSelectEdge(edge.id, {
                          x: event.clientX - rect.left,
                          y: event.clientY - rect.top,
                        });
                      }
                    }}
                  />
                ))
              : null}

            {clusters.map((cluster) => (
              <g key={cluster.clusterId}>
                <circle
                  cx={centerX + cluster.cx}
                  cy={centerY + cluster.cy}
                  r={cluster.radius}
                  fill="#64748b"
                  fillOpacity={0.04}
                  stroke="#94a3b8"
                  strokeWidth={1}
                  strokeOpacity={0.45}
                />
                {showClusterLabels && cluster.size >= 2 ? (
                  <text x={centerX + cluster.cx + 6} y={centerY + cluster.cy - 6} fontSize={10} fill="#334155">
                    {cluster.label.length > 26 ? `${cluster.label.slice(0, 26)}...` : cluster.label}
                  </text>
                ) : null}
              </g>
            ))}

            {nodes.map((node) => (
              <g key={node.id} transform={`translate(${centerX + node.x} ${centerY + node.y})`}>
                <circle
                  r={Math.max(5, 5 + node.impact * 1.9)}
                  fill={getNodeColor(node.analysisType)}
                  fillOpacity={0.9}
                  stroke={selectedNodeId === node.id ? "#0f172a" : "#ffffff"}
                  strokeWidth={selectedNodeId === node.id ? 2.6 : 1.4}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedNodeId(node.id);
                    setSelectedEdgeId(null);
                    if (wrapperRef.current && onSelectNode) {
                      const rect = wrapperRef.current.getBoundingClientRect();
                      onSelectNode(node.id, {
                        x: event.clientX - rect.left,
                        y: event.clientY - rect.top,
                      });
                    }
                  }}
                />
                {showChallengeLayer && node.challengeMapped ? (
                  <circle r={Math.max(8, 8 + node.impact * 1.7)} fill="none" stroke="#f59e0b" strokeWidth={1.5} />
                ) : null}
                {showDirectionLayer && (node.directionCount ?? 0) > 0 ? (
                  <rect
                    x={-2}
                    y={-Math.max(14, 12 + node.impact * 1.8)}
                    width={4}
                    height={4}
                    fill="#0f766e"
                    transform="rotate(45)"
                  />
                ) : null}
                {showLabels ? (
                  <text x={10} y={4} fontSize={11} fill="#111827">
                    {node.label.length > 36 ? `${node.label.slice(0, 36)}...` : node.label}
                  </text>
                ) : null}
              </g>
            ))}
          </g>
        </svg>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Strategic Terrain Map: X internal/external | Y operational/strategic | Zoom + Pan per Maus.
      </p>
    </div>
  );
}

