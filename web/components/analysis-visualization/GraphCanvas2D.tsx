"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildNodeLabelPlacements } from "@/components/analysis-visualization/label-layout";
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
  linkFromNodeId?: string | null;
  onCtrlClickNode?: (id: string, anchor: { x: number; y: number }) => void;
  draggableNodes?: boolean;
  onNodePositionChange?: (id: string, position: { x: number; y: number; z: number }) => void;
  onNodePositionCommit?: (id: string, position: { x: number; y: number; z: number }) => Promise<void>;
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

function withParallelOffset(p: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  offset: number;
}) {
  const dx = p.x2 - p.x1;
  const dy = p.y2 - p.y1;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;
  return {
    x1: p.x1 + nx * p.offset,
    y1: p.y1 + ny * p.offset,
    x2: p.x2 + nx * p.offset,
    y2: p.y2 + ny * p.offset,
  };
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
  linkFromNodeId = null,
  onCtrlClickNode,
  draggableNodes = false,
  onNodePositionChange,
  onNodePositionCommit,
}: GraphCanvas2DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [draggingNode, setDraggingNode] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);

  const [width, setWidth] = useState(1200);
  const rawHeight = Math.round((width * 9) / 16);
  const height = Math.max(520, Math.min(900, rawHeight));
  const centerX = width / 2;
  const centerY = height / 2;

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const labelPlacements = useMemo(
    () => (showLabels ? buildNodeLabelPlacements(nodes, selectedNodeId, centerX, centerY, 38, zoom) : new Map()),
    [showLabels, nodes, selectedNodeId, centerX, centerY, zoom]
  );
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
          if (draggingNode) return;
          setDragStart({ x: event.clientX, y: event.clientY });
          setPanStart({ ...pan });
        }}
        onMouseMove={(event) => {
          if (draggingNode && wrapperRef.current && onNodePositionChange) {
            const rect = wrapperRef.current.getBoundingClientRect();
            const worldX = (event.clientX - rect.left - pan.x) / zoom - centerX;
            const worldY = (event.clientY - rect.top - pan.y) / zoom - centerY;
            onNodePositionChange(draggingNode.id, {
              x: worldX - draggingNode.offsetX,
              y: worldY - draggingNode.offsetY,
              z: 0,
            });
            if (!draggingNode.moved) {
              setDraggingNode((prev) => (prev ? { ...prev, moved: true } : prev));
            }
            return;
          }
          if (!dragStart || !panStart) return;
          setPan({
            x: panStart.x + (event.clientX - dragStart.x),
            y: panStart.y + (event.clientY - dragStart.y),
          });
        }}
        onMouseUp={() => {
          if (draggingNode && draggingNode.moved && onNodePositionCommit) {
            const node = nodes.find((n) => n.id === draggingNode.id);
            if (node) {
              void onNodePositionCommit(node.id, { x: node.x, y: node.y, z: node.z });
            }
          }
          setDraggingNode(null);
          setDragStart(null);
          setPanStart(null);
        }}
        onMouseLeave={() => {
          setDraggingNode(null);
          setDragStart(null);
          setPanStart(null);
        }}
      >
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-zinc-300 bg-white/90 px-2 py-1.5 text-[11px] text-zinc-700 shadow-sm">
          <span className="font-semibold text-zinc-800">Legende:</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" />Umfeld</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-500" />Unternehmen</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />Wettbewerb</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />SWOT</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />Workshop</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-500" />Sonstige</span>
          <span className="border-l border-zinc-300 pl-2" />
          <span className="inline-flex items-center gap-1"><span className="h-0.5 w-3 rounded" style={{ backgroundColor: "#64748b" }} />Verbindungslinie</span>
          <span className="inline-flex items-center gap-1"><span className="h-0.5 w-3 rounded" style={{ backgroundColor: "#dc2626" }} />Einflusslinie: widerspricht</span>
          <span className="inline-flex items-center gap-1"><span className="h-0.5 w-3 rounded" style={{ backgroundColor: "#16a34a" }} />Einflusslinie: unterstützt</span>
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
              ? renderedEdges.map(({ edge, source, target }) => {
                  const x1 = centerX + source.x;
                  const y1 = centerY + source.y;
                  const x2 = centerX + target.x;
                  const y2 = centerY + target.y;
                  const selectedStroke = selectedEdgeId === edge.id ? "#0f172a" : null;
                  const connectionLine = withParallelOffset({ x1, y1, x2, y2, offset: -3 });
                  const influenceLine = withParallelOffset({ x1, y1, x2, y2, offset: 3 });
                  const opacity = edge.isDraft ? 0.45 : Math.min(0.95, Math.max(0.2, edge.confidence));

                  return (
                    <g
                      key={edge.id}
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
                    >
                      {viewMode === "cluster" ? (
                        <>
                          <line
                            x1={connectionLine.x1}
                            y1={connectionLine.y1}
                            x2={connectionLine.x2}
                            y2={connectionLine.y2}
                            stroke={selectedStroke ?? "#64748b"}
                            strokeWidth={Math.max(1, edge.strength * 0.55)}
                            strokeOpacity={opacity}
                            strokeDasharray={edge.isDraft ? "4 3" : undefined}
                          />
                          <line
                            x1={influenceLine.x1}
                            y1={influenceLine.y1}
                            x2={influenceLine.x2}
                            y2={influenceLine.y2}
                            stroke={selectedStroke ?? getEdgeColor(edge)}
                            strokeWidth={Math.max(1, edge.strength * 0.85)}
                            strokeOpacity={opacity}
                            strokeDasharray={edge.isDraft ? "4 3" : undefined}
                            markerEnd="url(#arrowhead)"
                          />
                        </>
                      ) : (
                        <line
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={selectedStroke ?? getEdgeColor(edge)}
                          strokeWidth={Math.max(1, edge.strength * 0.8)}
                          strokeOpacity={opacity}
                          strokeDasharray={edge.isDraft ? "4 3" : undefined}
                        />
                      )}
                    </g>
                  );
                })
              : null}

            {nodes.map((node) => {
              const placement = labelPlacements.get(node.id);
              const isLinkFrom = linkFromNodeId === node.id;
              const handleNodeClick = (event: React.MouseEvent) => {
                if (draggingNode?.id === node.id && draggingNode.moved) {
                  setDraggingNode((prev) => (prev && prev.id === node.id ? { ...prev, moved: false } : prev));
                  return;
                }
                event.stopPropagation();
                if (wrapperRef.current) {
                  const rect = wrapperRef.current.getBoundingClientRect();
                  const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
                  if (event.ctrlKey && onCtrlClickNode) {
                    onCtrlClickNode(node.id, anchor);
                  } else {
                    setSelectedNodeId(node.id);
                    setSelectedEdgeId(null);
                    onSelectNode?.(node.id, anchor);
                  }
                }
              };
              return (
                <g key={node.id} transform={`translate(${centerX + node.x} ${centerY + node.y}) scale(${1 / zoom})`}>
                  {isLinkFrom ? (
                    <circle
                      r={Math.max(3, (5 + node.impact * 1.9) * 0.5) + 6}
                      fill="none"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                    />
                  ) : null}
                  <circle
                    r={Math.max(3, (5 + node.impact * 1.9) * 0.5)}
                    fill={getNodeColor(node)}
                    stroke={selectedNodeId === node.id ? "#0f172a" : isLinkFrom ? "#0ea5e9" : "#ffffff"}
                    strokeWidth={selectedNodeId === node.id ? 3 : isLinkFrom ? 2 : 1.5}
                    onMouseDown={(event) => {
                      if (!draggableNodes || viewMode !== "cluster" || event.ctrlKey || !wrapperRef.current) return;
                      event.stopPropagation();
                      const rect = wrapperRef.current.getBoundingClientRect();
                      const worldX = (event.clientX - rect.left - pan.x) / zoom - centerX;
                      const worldY = (event.clientY - rect.top - pan.y) / zoom - centerY;
                      setDraggingNode({
                        id: node.id,
                        offsetX: worldX - node.x,
                        offsetY: worldY - node.y,
                        moved: false,
                      });
                    }}
                    onClick={handleNodeClick}
                  />
                  {showLabels && placement ? (
                    <>
                      <line
                        x1={placement.lineX1}
                        y1={placement.lineY1}
                        x2={placement.lineX2}
                        y2={placement.lineY2}
                        stroke="#94a3b8"
                        strokeWidth={1}
                      />
                      <rect
                        x={placement.boxX}
                        y={placement.boxY}
                        width={placement.boxWidth}
                        height={placement.boxHeight}
                        rx={3}
                        fill="#ffffff"
                        fillOpacity={0.78}
                        style={{ cursor: "pointer" }}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (wrapperRef.current) {
                            const rect = wrapperRef.current.getBoundingClientRect();
                            const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
                            if (event.ctrlKey && onCtrlClickNode) {
                              onCtrlClickNode(node.id, anchor);
                            } else {
                              setSelectedNodeId(node.id);
                              setSelectedEdgeId(null);
                              onSelectNode?.(node.id, anchor);
                            }
                          }
                        }}
                      />
                      <text
                        x={placement.textX}
                        y={placement.textY}
                        fontSize={11}
                        fill="#111827"
                        style={{ cursor: "pointer" }}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (wrapperRef.current) {
                            const rect = wrapperRef.current.getBoundingClientRect();
                            const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
                            if (event.ctrlKey && onCtrlClickNode) {
                              onCtrlClickNode(node.id, anchor);
                            } else {
                              setSelectedNodeId(node.id);
                              setSelectedEdgeId(null);
                              onSelectNode?.(node.id, anchor);
                            }
                          }
                        }}
                      >
                        {placement.text}
                      </text>
                    </>
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Zoom: Shift + Mousewheel | Drag Hintergrund: Pan | Drag Knoten (Clusteransicht): manuell platzieren | Klick: Node/Edge-Detail | Ctrl+Klick: Verbindung erstellen
      </p>
    </div>
  );
}
