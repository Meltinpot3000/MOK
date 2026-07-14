"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  edgeKindForNodePair,
  findDropTargetNodeId,
} from "@/lib/strategy-cycle/impact-path-connect";
import type { ImpactPathEdge, ImpactPathGraph, ImpactPathNode } from "@/lib/strategy-cycle/impact-path-graph";
import {
  ImpactPathConnectionHandles,
  type ImpactPathLinkDragState,
} from "@/components/ceo/strategy-cycle/impact-path/ImpactPathConnectionHandles";
import { ImpactPathEdgeLayer } from "@/components/ceo/strategy-cycle/impact-path/ImpactPathEdgeLayer";
import { resolveImpactPathHighlightIds } from "@/components/ceo/strategy-cycle/impact-path/ImpactPathFilters";
import { ImpactPathNodeShape } from "@/components/ceo/strategy-cycle/impact-path/ImpactPathNodeShape";
import {
  computeImpactPathMapViewportHeight,
  IMPACT_PATH_COLUMN_HEADER,
  IMPACT_PATH_COLUMN_LABEL,
  IMPACT_PATH_COLUMN_ORDER,
  IMPACT_PATH_PAD_Y,
  layoutImpactPathNodes,
  type PositionedImpactPathNode,
} from "@/components/ceo/strategy-cycle/impact-path/impact-path-ui";

const IMPACT_PATH_RETURN = "/strategy-cycle?l1=strategic-directions&l2=summary";

type StrategicImpactPathMapProps = {
  canWrite: boolean;
  graph: ImpactPathGraph;
  filteredNodes: ImpactPathNode[];
  filteredEdges: ImpactPathEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  focusMode: boolean;
  pathDepthMin: number;
  pathDepthMax: number;
  onSelectNode: (nodeId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
  onCreateLink: (formData: FormData) => Promise<void>;
  isMutationPending?: boolean;
};

const IMPACT_PATH_MIN_ZOOM = 0.35;
const IMPACT_PATH_MAX_ZOOM = 2.4;
const IMPACT_PATH_ZOOM_STEP = 0.08;

function pointerEventToSvgCoords(
  event: { clientX: number; clientY: number },
  svg: SVGSVGElement | null
): { x: number; y: number } {
  if (!svg) return { x: 0, y: 0 };
  const pt = svg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const local = pt.matrixTransform(ctm.inverse());
  return { x: local.x, y: local.y };
}

export function StrategicImpactPathMap({
  canWrite,
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
  onCreateLink,
  isMutationPending = false,
}: StrategicImpactPathMapProps) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [mapWidth, setMapWidth] = useState(1100);
  const [containerHeight, setContainerHeight] = useState(620);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [linkDrag, setLinkDrag] = useState<ImpactPathLinkDragState | null>(null);
  const dragRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);
  const linkPointerIdRef = useRef<number | null>(null);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const syncViewport = () => {
      const width = Math.max(640, Math.floor(el.getBoundingClientRect().width));
      const maxViewportHeight = Math.max(420, window.innerHeight - 220);
      setMapWidth(width);
      setContainerHeight(computeImpactPathMapViewportHeight(width, maxViewportHeight));
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

  const layout = useMemo(() => layoutImpactPathNodes(filteredNodes, mapWidth), [filteredNodes, mapWidth]);

  const posById = useMemo(() => {
    const map = new Map<string, PositionedImpactPathNode>();
    for (const node of layout.positioned) map.set(node.id, node);
    return map;
  }, [layout.positioned]);

  const highlightIds = useMemo(
    () =>
      resolveImpactPathHighlightIds({
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

  const clearSelection = useCallback(() => {
    onSelectNode(null);
    onSelectEdge(null);
  }, [onSelectNode, onSelectEdge]);

  const completeLink = useCallback(
    (sourceNodeId: string, targetNodeId: string) => {
      if (isMutationPending) return;
      const source = graph.nodes.find((n) => n.id === sourceNodeId);
      const target = graph.nodes.find((n) => n.id === targetNodeId);
      if (!source || !target) return;
      const kind = edgeKindForNodePair(source.kind, target.kind);
      if (!kind) return;
      const formData = new FormData();
      formData.set("edge_kind", kind);
      formData.set("source_id", sourceNodeId);
      formData.set("target_id", targetNodeId);
      formData.set("note", "manuell");
      formData.set("return_to", IMPACT_PATH_RETURN);
      void onCreateLink(formData);
    },
    [graph.nodes, isMutationPending, onCreateLink]
  );

  const handleStartLinkFromHandle = useCallback(
    (sourceNodeId: string, x: number, y: number, pointerId: number) => {
      if (!canWrite) return;
      linkPointerIdRef.current = pointerId;
      onSelectEdge(null);
      onSelectNode(sourceNodeId);
      setLinkDrag({
        sourceNodeId,
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
        hoverTargetNodeId: null,
      });
      svgRef.current?.setPointerCapture(pointerId);
    },
    [canWrite, onSelectEdge, onSelectNode]
  );

  const handleSvgPointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (linkDrag && linkPointerIdRef.current === event.pointerId) {
        const { x, y } = pointerEventToSvgCoords(event, svgRef.current);
        const hoverTargetNodeId = findDropTargetNodeId({
          nodes: graph.nodes,
          positioned: layout.positioned,
          edges: graph.edges,
          sourceNodeId: linkDrag.sourceNodeId,
          pointerX: x,
          pointerY: y,
        });
        setLinkDrag((prev) =>
          prev
            ? {
                ...prev,
                currentX: x,
                currentY: y,
                hoverTargetNodeId,
              }
            : null
        );
        return;
      }

      const drag = dragRef.current;
      if (!drag) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      setPan({ x: drag.panX + dx, y: drag.panY + dy });
    },
    [graph.edges, graph.nodes, layout.positioned, linkDrag]
  );

  const handleSvgPointerUp = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (linkDrag && linkPointerIdRef.current === event.pointerId) {
        const targetId = linkDrag.hoverTargetNodeId;
        setLinkDrag(null);
        linkPointerIdRef.current = null;
        svgRef.current?.releasePointerCapture(event.pointerId);
        if (targetId) completeLink(linkDrag.sourceNodeId, targetId);
        return;
      }

      const drag = dragRef.current;
      dragRef.current = null;
      if (drag && !drag.moved) clearSelection();
    },
    [clearSelection, completeLink, linkDrag]
  );

  if (filteredNodes.length === 0) {
    return (
      <p className="brand-surface rounded-md p-4 text-sm text-zinc-600">
        Keine Objekte für die aktuelle Filterauswahl. Bitte Filter anpassen oder zuerst Analyse-Einträge,
        Herausforderungen, Stoßrichtungen und Ziele anlegen.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-6 bg-zinc-600" aria-hidden />
          Bestehende Verbindung
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-6 border-t-2 border-dashed border-zinc-500" aria-hidden />
          Vorschlag
        </span>
        {canWrite ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border-2 border-zinc-800 bg-white" aria-hidden />
            Andockpunkt · ziehen zum Verbinden
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-5 rounded border border-dashed border-amber-600 bg-amber-50"
            aria-hidden
          />
          Nicht analysefähig (keine Passungsvorschläge)
        </span>
      </div>

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
            IMPACT_PATH_MIN_ZOOM,
            Math.min(
              IMPACT_PATH_MAX_ZOOM,
              prevZoom + (event.deltaY > 0 ? -IMPACT_PATH_ZOOM_STEP : IMPACT_PATH_ZOOM_STEP)
            )
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
        aria-label="Strategische Wirkpfadkarte"
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
            width={layout.width}
            height={layout.height}
            className="select-none"
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            onPointerCancel={handleSvgPointerUp}
          >
            <rect
              width={layout.width}
              height={layout.height}
              fill="transparent"
              onPointerDown={(event) => {
                if (event.button !== 0 || linkDrag) return;
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
                if (linkPointerIdRef.current !== event.pointerId) {
                  try {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  } catch {
                    // ignore if capture already released
                  }
                }
              }}
            />

            {IMPACT_PATH_COLUMN_ORDER.map((kind, i) => (
              <text
                key={kind}
                x={layout.columnXs[i] + 4}
                y={IMPACT_PATH_PAD_Y + 16}
                className="fill-zinc-600 text-[11px] font-semibold uppercase tracking-wide"
                pointerEvents="none"
              >
                {IMPACT_PATH_COLUMN_LABEL[kind]}
              </text>
            ))}

            <ImpactPathEdgeLayer
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
              <ImpactPathNodeShape
                key={node.id}
                node={node}
                dimmed={Boolean(focusMode && highlightIds != null && !highlightIds.has(node.id))}
                selected={selectedNodeId === node.id}
                onSelect={() => {
                  onSelectEdge(null);
                  onSelectNode(node.id);
                }}
              />
            ))}

            {canWrite ? (
              <ImpactPathConnectionHandles
                graph={graph}
                positioned={layout.positioned}
                selectedNodeId={selectedNodeId}
                linkDrag={linkDrag}
                onStartLinkFromHandle={handleStartLinkFromHandle}
              />
            ) : null}
          </svg>
        </div>
        <p className="pointer-events-none absolute bottom-3 left-3 text-[10px] text-zinc-500">
          Ziehen · Shift + Scroll zum Zoomen · Knoten wählen · Andockpunkt ziehen für neue Verbindung
        </p>
      </div>
      </div>
    </div>
  );
}
