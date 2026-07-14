"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExecutionNetworkEdge, ExecutionNetworkGraph, ExecutionNetworkNode } from "@/lib/review/execution-network-graph";
import { resolveExecutionNetworkHighlightIds } from "@/lib/review/execution-network-focus";
import {
  computeExecutionNetworkMapViewportHeight,
  EXECUTION_NETWORK_COLUMN_GAP,
  EXECUTION_NETWORK_COLUMN_LABEL,
  EXECUTION_NETWORK_PAD_X,
  EXECUTION_NETWORK_PAD_Y,
  layoutExecutionNetworkNodes,
  type PositionedExecutionNetworkNode,
} from "@/lib/review/execution-network-ui";
import { ExecutionNetworkEdgeLayer } from "./ExecutionNetworkEdgeLayer";
import { ExecutionNetworkNodeShape } from "./ExecutionNetworkNodeShape";

type ExecutionNetworkMapProps = {
  graph: ExecutionNetworkGraph;
  filteredNodes: ExecutionNetworkNode[];
  filteredEdges: ExecutionNetworkEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  focusMode: boolean;
  pathDepthMin: number;
  pathDepthMax: number;
  onSelectNode: (nodeId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
};

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.4;
const ZOOM_STEP = 0.08;

export function ExecutionNetworkMap({
  graph,
  filteredNodes,
  filteredEdges,
  selectedNodeId,
  selectedEdgeId,
  focusMode,
  pathDepthMin,
  pathDepthMax,
  onSelectNode,
  onSelectEdge,
}: ExecutionNetworkMapProps) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [mapWidth, setMapWidth] = useState(1100);
  const [containerHeight, setContainerHeight] = useState(520);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(
    null
  );

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const syncViewport = () => {
      const width = Math.max(640, Math.floor(el.getBoundingClientRect().width));
      const maxViewportHeight = Math.max(420, window.innerHeight - 220);
      setMapWidth(width);
      setContainerHeight(computeExecutionNetworkMapViewportHeight(width, maxViewportHeight));
    };

    syncViewport();
    const observer = new ResizeObserver(syncViewport);
    observer.observe(el);
    window.addEventListener("resize", syncViewport);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  const layout = useMemo(
    () => layoutExecutionNetworkNodes(filteredNodes, mapWidth),
    [filteredNodes, mapWidth]
  );

  const highlightIds = useMemo(
    () =>
      resolveExecutionNetworkHighlightIds({
        graphNodeIds: filteredNodes.map((n) => n.id),
        edges: filteredEdges,
        focusMode,
        pathDepthMin,
        pathDepthMax,
        selectedNodeId,
        selectedEdgeId,
        allEdges: graph.edges,
      }),
    [
      filteredNodes,
      filteredEdges,
      focusMode,
      pathDepthMin,
      pathDepthMax,
      selectedNodeId,
      selectedEdgeId,
      graph.edges,
    ]
  );

  const posById = useMemo(() => {
    const map = new Map<string, PositionedExecutionNetworkNode>();
    for (const node of layout.positioned) map.set(node.id, node);
    return map;
  }, [layout.positioned]);

  const columnXs = useMemo(() => {
    const columnCount = 4;
    const columnWidth =
      (mapWidth - EXECUTION_NETWORK_PAD_X * 2 - EXECUTION_NETWORK_COLUMN_GAP * (columnCount - 1)) /
      columnCount;
    return [0, 1, 2, 3].map(
      (col) => EXECUTION_NETWORK_PAD_X + col * (columnWidth + EXECUTION_NETWORK_COLUMN_GAP)
    );
  }, [mapWidth]);

  const clearSelection = useCallback(() => {
    onSelectNode(null);
    onSelectEdge(null);
  }, [onSelectNode, onSelectEdge]);

  const handleSvgPointerMove = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > 4) drag.moved = true;
    setPan({ x: drag.panX + dx, y: drag.panY + dy });
  }, []);

  const handleSvgPointerUp = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag && !drag.moved) clearSelection();
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // ignore if capture already released
      }
    },
    [clearSelection]
  );

  if (filteredNodes.length === 0) {
    return (
      <p className="brand-surface rounded-md p-4 text-sm text-zinc-600">
        Keine Objekte für die aktuelle Filterauswahl. Bitte Fokus oder Objekttypen anpassen.
      </p>
    );
  }

  return (
    <div ref={outerRef} className="min-w-0">
      <div
        ref={wrapperRef}
        className="relative w-full overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/80"
        style={{ height: containerHeight }}
        onWheel={(event) => {
          if (!event.shiftKey) return;
          event.preventDefault();
          event.stopPropagation();
          if (!wrapperRef.current) return;
          const rect = wrapperRef.current.getBoundingClientRect();
          const mouseX = event.clientX - rect.left;
          const mouseY = event.clientY - rect.top;
          const prevZoom = scale;
          const nextZoom = Math.max(
            MIN_ZOOM,
            Math.min(MAX_ZOOM, prevZoom + (event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP))
          );
          const worldX = (mouseX - pan.x) / prevZoom;
          const worldY = (mouseY - pan.y) / prevZoom;
          setScale(nextZoom);
          setPan({
            x: mouseX - worldX * nextZoom,
            y: mouseY - worldY * nextZoom,
          });
        }}
        role="application"
        aria-label="Umsetzungsnetzwerk"
      >
        <div className="pointer-events-none absolute right-3 top-3 z-10 rounded border border-zinc-300 bg-white/90 px-2 py-1 text-[11px] font-medium text-zinc-700 shadow-sm">
          Zoom: Shift + Scroll
        </div>
        <div
          className="absolute inset-0 origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
        >
          <svg
            ref={svgRef}
            width={layout.contentWidth}
            height={layout.contentHeight}
            className="select-none touch-none"
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            onPointerCancel={handleSvgPointerUp}
          >
            <rect
              width={layout.contentWidth}
              height={layout.contentHeight}
              fill="transparent"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                dragRef.current = {
                  x: event.clientX,
                  y: event.clientY,
                  panX: pan.x,
                  panY: pan.y,
                  moved: false,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={handleSvgPointerMove}
              onPointerUp={(event) => {
                handleSvgPointerUp(event);
                try {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                } catch {
                  // ignore
                }
              }}
            />

            {columnXs.map((x, col) => (
              <text
                key={col}
                x={x + 4}
                y={EXECUTION_NETWORK_PAD_Y + 16}
                className="fill-zinc-600 text-[11px] font-semibold uppercase tracking-wide"
                pointerEvents="none"
              >
                {EXECUTION_NETWORK_COLUMN_LABEL[col] ?? ""}
              </text>
            ))}

            <ExecutionNetworkEdgeLayer
              edges={filteredEdges}
              posById={posById}
              selectedEdgeId={selectedEdgeId}
              highlightIds={highlightIds}
              focusMode={focusMode}
              onSelectEdge={(id) => {
                onSelectEdge(id);
                onSelectNode(null);
              }}
            />

            {layout.positioned.map((node) => (
              <ExecutionNetworkNodeShape
                key={node.id}
                node={node}
                selected={selectedNodeId === node.id}
                dimmed={Boolean(focusMode && highlightIds != null && !highlightIds.has(node.id))}
                onSelect={() => {
                  onSelectNode(node.id);
                  onSelectEdge(null);
                }}
              />
            ))}
          </svg>
        </div>
        <p className="pointer-events-none absolute bottom-3 left-3 text-[10px] text-zinc-500">
          Ziehen · Shift + Scroll zum Zoomen · Knoten wählen · Fokusmodus hebt Umsetzungspfade hervor
        </p>
      </div>
    </div>
  );
}
