"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PositionedNode, VisualizationEdge, VisualizationViewMode } from "@/components/analysis-visualization/types";

type GraphCanvas2DProps = {
  nodes: PositionedNode[];
  edges: VisualizationEdge[];
  viewMode: VisualizationViewMode;
  showLabels: boolean;
  showLinks: boolean;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  onSelectNode?: (id: string, anchor: { x: number; y: number }) => void;
  onSelectEdge?: (id: string, anchor: { x: number; y: number }) => void;
};

function getNodeColor(node: PositionedNode): string {
  if (node.clusterId) {
    const hash = node.clusterId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const hue = hash % 360;
    return `hsl(${hue} 70% 52%)`;
  }
  switch (node.analysisType) {
    case "environment":
      return "#0ea5e9";
    case "company":
      return "#8b5cf6";
    case "competitor":
      return "#f59e0b";
    case "swot":
      return "#10b981";
    case "workshop":
      return "#ef4444";
    default:
      return "#64748b";
  }
}

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

export function GraphCanvas2D({
  nodes,
  edges,
  viewMode,
  showLabels,
  showLinks,
  selectedNodeId,
  selectedEdgeId,
  setSelectedNodeId,
  setSelectedEdgeId,
  onSelectNode,
  onSelectEdge,
}: GraphCanvas2DProps) {
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
  const visibleLabelNodeIds = useMemo(() => {
    if (!showLabels) return new Set<string>();
    if (zoom < 0.7) return selectedNodeId ? new Set([selectedNodeId]) : new Set<string>();

    const sorted = [...nodes].sort((a, b) => {
      if (a.id === selectedNodeId) return -1;
      if (b.id === selectedNodeId) return 1;
      return b.impact - a.impact;
    });
    const placed: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    const accepted = new Set<string>();
    for (const node of sorted) {
      const text = node.label.length > 38 ? `${node.label.slice(0, 38)}...` : node.label;
      const x = (centerX + node.x + 10) * zoom + pan.x;
      const y = (centerY + node.y + 4) * zoom + pan.y;
      const width = Math.max(36, text.length * 6.2) * zoom;
      const height = 12 * zoom;
      const box = { x1: x, y1: y - height, x2: x + width, y2: y + 2 };
      const overlaps = placed.some(
        (p) => !(box.x2 < p.x1 || box.x1 > p.x2 || box.y2 < p.y1 || box.y1 > p.y2)
      );
      if (overlaps && node.id !== selectedNodeId) continue;
      accepted.add(node.id);
      placed.push(box);
    }
    return accepted;
  }, [showLabels, zoom, selectedNodeId, nodes, centerX, centerY, pan.x, pan.y]);
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
          if (!event.shiftKey) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          if (!wrapperRef.current) return;
          const rect = wrapperRef.current.getBoundingClientRect();
          const mouseX = event.clientX - rect.left;
          const mouseY = event.clientY - rect.top;
          const prevZoom = zoom;
          const nextZoom = Math.max(0.35, Math.min(2.4, prevZoom + (event.deltaY > 0 ? -0.08 : 0.08)));
          const worldX = (mouseX - pan.x) / prevZoom;
          const worldY = (mouseY - pan.y) / prevZoom;
          setZoom(nextZoom);
          setPan({
            x: mouseX - worldX * nextZoom,
            y: mouseY - worldY * nextZoom,
          });
        }}
        onMouseDown={(event) => {
          if (event.button !== 0) return;
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
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2 rounded border border-zinc-300 bg-white/90 px-2 py-1 text-[11px] text-zinc-700 shadow-sm">
          <span className="font-semibold text-zinc-800">Legende:</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" />Umfeld</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-500" />Unternehmen</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />Wettbewerb</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />SWOT</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />Workshop</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-500" />Sonstige</span>
        </div>
        <div className="pointer-events-none absolute right-3 top-3 z-10 rounded border border-zinc-300 bg-white/90 px-2 py-1 text-[11px] font-medium text-zinc-700 shadow-sm">
          Zoom: Shift + Scroll
        </div>
        <svg width={width} height={height} className="absolute left-0 top-0">
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#475569" />
            </marker>
          </defs>
          <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
            {showLinks
              ? renderedEdges.map(({ edge, source, target }) => (
                  <line
                    key={edge.id}
                    x1={centerX + source.x}
                    y1={centerY + source.y}
                    x2={centerX + target.x}
                    y2={centerY + target.y}
                    stroke={selectedEdgeId === edge.id ? "#0f172a" : getEdgeColor(edge)}
                    strokeWidth={Math.max(1, edge.strength * 0.8)}
                    strokeOpacity={edge.isDraft ? 0.45 : Math.min(0.95, Math.max(0.2, edge.confidence))}
                    strokeDasharray={edge.isDraft ? "4 3" : undefined}
                    markerEnd={viewMode === "influence" ? "url(#arrowhead)" : undefined}
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

            {nodes.map((node) => (
              <g key={node.id} transform={`translate(${centerX + node.x} ${centerY + node.y})`}>
                <circle
                  r={Math.max(3, (5 + node.impact * 1.9) * 0.5)}
                  fill={getNodeColor(node)}
                  stroke={selectedNodeId === node.id ? "#0f172a" : "#ffffff"}
                  strokeWidth={selectedNodeId === node.id ? 3 : 1.5}
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
                {showLabels && visibleLabelNodeIds.has(node.id) ? (
                  <text x={10} y={4} fontSize={11} fill="#111827">
                    {node.label.length > 38 ? `${node.label.slice(0, 38)}...` : node.label}
                  </text>
                ) : null}
              </g>
            ))}
          </g>
        </svg>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Zoom: Shift + Mousewheel | Drag: Pan | Klick: Node/Edge-Detail
      </p>
    </div>
  );
}
