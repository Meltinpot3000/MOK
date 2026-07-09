"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { layoutReferenceNetworkNodes } from "@/lib/strategy-network/layout";
import {
  getReferenceEdgeById,
  getReferenceNodeById,
} from "@/lib/strategy-network/reference-model";
import type {
  ReferenceNetworkEdge,
  ReferenceNetworkGraph,
  ReferenceNodeKind,
  ReferenceNetworkZone,
} from "@/lib/strategy-network/types";

type StrategyReferenceNetworkProps = {
  graph: ReferenceNetworkGraph;
};

const KIND_LABEL: Record<ReferenceNodeKind, string> = {
  unternehmensinfo: "Unternehmensinfo",
  analysis_entry: "Analyse-Eintrag",
  analysis_cluster: "Analyse-Cluster",
  challenge: "Herausforderung",
  direction: "Stoßrichtung",
  strategy_objective: "Strategisches Ziel",
  program: "Programm",
  annual_target: "Jahresziel",
  initiative: "Initiative",
  review_session: "Review / Freigabe",
  okr_objective: "OKR-Objective",
  key_result: "Key Result",
};

const KIND_COLOR: Record<ReferenceNodeKind, string> = {
  unternehmensinfo: "#64748b",
  analysis_entry: "#94a3b8",
  analysis_cluster: "#78716c",
  challenge: "#dc2626",
  direction: "#2563eb",
  strategy_objective: "#7c3aed",
  program: "#059669",
  annual_target: "#0d9488",
  initiative: "#ca8a04",
  review_session: "#4f46e5",
  okr_objective: "#ea580c",
  key_result: "#c2410c",
};

const ZONE_BG: Record<ReferenceNetworkZone, string> = {
  strategy: "rgba(238, 242, 255, 0.65)",
  execution: "rgba(236, 253, 245, 0.65)",
  review: "rgba(237, 233, 254, 0.65)",
  okr: "rgba(255, 247, 237, 0.65)",
};

function edgePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w1: number,
  h1: number,
  w2: number,
  h2: number
): string {
  const sx = x1 + w1 / 2;
  const sy = y1 + h1 / 2;
  const tx = x2 + w2 / 2;
  const ty = y2 + h2 / 2;
  const midY = (sy + ty) / 2;
  return `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`;
}

export function StrategyReferenceNetwork({ graph }: StrategyReferenceNetworkProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hiddenKinds, setHiddenKinds] = useState<Set<ReferenceNodeKind>>(new Set());
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(0.92);
  const dragRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);

  const selectNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
  }, []);

  const selectEdge = useCallback((edgeId: string) => {
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
  }, []);

  const viewportWidth = 1200;
  const layout = useMemo(
    () => layoutReferenceNetworkNodes(graph.nodes, viewportWidth),
    [graph.nodes]
  );

  const visibleNodes = useMemo(
    () => layout.positioned.filter((n) => !hiddenKinds.has(n.kind)),
    [layout.positioned, hiddenKinds]
  );

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const visibleEdges = useMemo(
    () =>
      graph.edges.filter(
        (e) => visibleNodeIds.has(e.sourceId) && visibleNodeIds.has(e.targetId)
      ),
    [graph.edges, visibleNodeIds]
  );

  const posById = useMemo(() => {
    const map = new Map<string, (typeof visibleNodes)[number]>();
    for (const node of visibleNodes) map.set(node.id, node);
    return map;
  }, [visibleNodes]);

  const highlightIds = useMemo(() => {
    const focusId = selectedNodeId ?? (selectedEdgeId ? null : null);
    if (selectedEdgeId) {
      const edge = getReferenceEdgeById(selectedEdgeId);
      if (!edge) return null;
      return new Set([edge.sourceId, edge.targetId]);
    }
    if (!focusId) return null;
    const ids = new Set<string>([focusId]);
    for (const edge of graph.edges) {
      if (edge.sourceId === focusId) ids.add(edge.targetId);
      if (edge.targetId === focusId) ids.add(edge.sourceId);
    }
    return ids;
  }, [graph.edges, selectedNodeId, selectedEdgeId]);

  const selectedNode = selectedNodeId ? getReferenceNodeById(selectedNodeId) ?? null : null;
  const selectedEdge = selectedEdgeId ? getReferenceEdgeById(selectedEdgeId) ?? null : null;

  const connectedEdges = selectedNodeId
    ? graph.edges.filter((e) => e.sourceId === selectedNodeId || e.targetId === selectedNodeId)
    : [];

  const toggleKind = useCallback((kind: ReferenceNodeKind) => {
    setHiddenKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }, []);

  const kindsPresent = useMemo(() => {
    const set = new Set<ReferenceNodeKind>();
    for (const node of graph.nodes) set.add(node.kind);
    return [...set];
  }, [graph.nodes]);

  const clearSelection = () => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-6 bg-zinc-500" aria-hidden />
          Standard-Beziehung
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-6 border-t-2 border-dashed border-zinc-400" aria-hidden />
          Optional konfigurierbar (Phase 2)
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {kindsPresent.map((kind) => {
          const active = !hiddenKinds.has(kind);
          return (
            <button
              key={kind}
              type="button"
              onClick={() => toggleKind(kind)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                active
                  ? "border-zinc-300 bg-white text-zinc-800 shadow-sm"
                  : "border-zinc-200 bg-zinc-100 text-zinc-400 line-through"
              }`}
            >
              <span
                className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                style={{ backgroundColor: KIND_COLOR[kind] }}
                aria-hidden
              />
              {KIND_LABEL[kind]}
            </button>
          );
        })}
        <span className="ml-auto text-xs text-zinc-500">
          {visibleNodes.length} Elementtypen · {visibleEdges.length} Beziehungstypen
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div
          className="relative h-[min(78vh,760px)] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/80"
          onWheel={(event) => {
            event.preventDefault();
            const delta = event.deltaY > 0 ? 0.92 : 1.08;
            setScale((s) => Math.min(2, Math.max(0.5, s * delta)));
          }}
          role="application"
          aria-label="Referenz-Strategienetzwerk"
        >
          <div
            className="absolute inset-0 origin-top-left"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
          >
            <svg width={layout.width} height={layout.height} className="select-none">
              <rect
                width={layout.width}
                height={layout.height}
                fill="transparent"
                data-graph-background="true"
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
                onPointerMove={(event) => {
                  const drag = dragRef.current;
                  if (!drag) return;
                  const dx = event.clientX - drag.x;
                  const dy = event.clientY - drag.y;
                  if (Math.hypot(dx, dy) > 4) drag.moved = true;
                  setPan({
                    x: drag.panX + dx,
                    y: drag.panY + dy,
                  });
                }}
                onPointerUp={(event) => {
                  const drag = dragRef.current;
                  dragRef.current = null;
                  event.currentTarget.releasePointerCapture(event.pointerId);
                  if (drag && !drag.moved) clearSelection();
                }}
              />
              {layout.zoneBands.map((band) => (
                <g key={band.zone}>
                  <rect
                    x={12}
                    y={band.y}
                    width={layout.width - 24}
                    height={band.height}
                    rx={16}
                    fill={ZONE_BG[band.zone]}
                    stroke="rgba(0,0,0,0.06)"
                    pointerEvents="none"
                  />
                  <text
                    x={28}
                    y={band.y + 24}
                    className="fill-zinc-600 text-[11px] font-semibold uppercase tracking-wide"
                    pointerEvents="none"
                  >
                    {band.label}
                  </text>
                </g>
              ))}

              {visibleEdges.map((edge) => {
                const source = posById.get(edge.sourceId);
                const target = posById.get(edge.targetId);
                if (!source || !target) return null;
                const dimmed =
                  highlightIds != null &&
                  !highlightIds.has(edge.sourceId) &&
                  !highlightIds.has(edge.targetId);
                const selected = selectedEdgeId === edge.id;
                const pathD = edgePath(
                  source.x,
                  source.y,
                  target.x,
                  target.y,
                  source.width,
                  source.height,
                  target.width,
                  target.height
                );
                return (
                  <g
                    key={edge.id}
                    data-graph-edge="true"
                    className="cursor-pointer"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      selectEdge(edge.id);
                    }}
                  >
                    <path
                      d={pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={14}
                      pointerEvents="stroke"
                    />
                    <path
                      d={pathD}
                      fill="none"
                      stroke={
                        dimmed
                          ? "rgba(161,161,170,0.2)"
                          : selected
                            ? "#18181b"
                            : "rgba(63,63,70,0.5)"
                      }
                      strokeWidth={selected ? 2.5 : 1.4}
                      strokeDasharray={edge.optional ? "6 4" : undefined}
                      pointerEvents="none"
                    />
                  </g>
                );
              })}

              {visibleNodes.map((node) => {
                const dimmed = highlightIds != null && !highlightIds.has(node.id);
                const selected = selectedNodeId === node.id;
                return (
                  <g
                    key={node.id}
                    data-graph-node="true"
                    transform={`translate(${node.x}, ${node.y})`}
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    aria-label={`${KIND_LABEL[node.kind]}: ${node.label}`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      selectNode(node.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectNode(node.id);
                      }
                    }}
                  >
                    <rect
                      width={node.width}
                      height={node.height}
                      rx={10}
                      fill={dimmed ? "#f4f4f5" : "#ffffff"}
                      stroke={selected ? KIND_COLOR[node.kind] : "rgba(0,0,0,0.12)"}
                      strokeWidth={selected ? 2.5 : 1}
                      opacity={dimmed ? 0.55 : 1}
                    />
                    <rect
                      x={0}
                      y={0}
                      width={5}
                      height={node.height}
                      rx={10}
                      fill={KIND_COLOR[node.kind]}
                      pointerEvents="none"
                    />
                    <text
                      x={12}
                      y={22}
                      className="fill-zinc-900 text-[11px] font-semibold"
                      pointerEvents="none"
                    >
                      {node.label.length > 20 ? `${node.label.slice(0, 18)}…` : node.label}
                    </text>
                    <text x={12} y={38} className="fill-zinc-500 text-[9px]" pointerEvents="none">
                      {KIND_LABEL[node.kind]}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <p className="pointer-events-none absolute bottom-3 left-3 text-[10px] text-zinc-500">
            Ziehen · Zoomen · Knoten oder Linie für Erklärung
          </p>
        </div>

        <DetailPanel
          selectedNode={selectedNode}
          selectedEdge={selectedEdge}
          connectedEdges={connectedEdges}
          graph={graph}
        />
      </div>
    </div>
  );
}

function DetailPanel({
  selectedNode,
  selectedEdge,
  connectedEdges,
  graph,
}: {
  selectedNode: ReturnType<typeof getReferenceNodeById> | null;
  selectedEdge: ReferenceNetworkEdge | null;
  connectedEdges: ReferenceNetworkEdge[];
  graph: ReferenceNetworkGraph;
}) {
  return (
    <aside className="brand-card flex max-h-[min(78vh,760px)] flex-col overflow-y-auto p-4 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Erklärung</p>

      {selectedEdge ? (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-[10px] font-medium uppercase text-zinc-500">Beziehung</p>
            <p className="mt-1 font-semibold text-zinc-900">{selectedEdge.label}</p>
            <p className="mt-1 text-xs text-zinc-600">{selectedEdge.description}</p>
          </div>
          <MetaRow label="Kardinalität" value={selectedEdge.cardinality} />
          {selectedEdge.optional ? (
            <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
              Optional – kann pro Organisation deaktiviert werden (geplant).
              {selectedEdge.ruleKey ? ` Regel: ${selectedEdge.ruleKey}` : null}
            </p>
          ) : null}
          <MetaRow label="Datenbank" value={selectedEdge.dbTables.join(", ")} />
          <MetaRow label="Oberfläche" value={selectedEdge.uiSurfaces.join(" · ")} />
        </div>
      ) : selectedNode ? (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-[10px] font-medium uppercase text-zinc-500">{selectedNode.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-700">{selectedNode.description}</p>
          </div>
          {selectedNode.examples.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-zinc-700">Beispiele</p>
              <ul className="mt-1 list-disc pl-4 text-xs text-zinc-600">
                {selectedNode.examples.map((ex) => (
                  <li key={ex}>{ex}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {selectedNode.id === "challenge" ? (
            <div className="rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2.5 text-xs text-sky-950">
              <p className="font-semibold">Herausforderungs-Profil (Systemvorschlag)</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 leading-relaxed">
                <li>
                  <strong>Adressierung</strong> — Stoßrichtungs-Verknüpfungen und Beitragsstufe
                </li>
                <li>
                  <strong>Kohärenz</strong> — Korrelation zu strategischen Zielen über gemeinsame Stoßrichtungen
                </li>
                <li>
                  <strong>Umsetzung</strong> — Fortschritt über Jahresziele und Initiativen entlang dieser Richtungen
                </li>
              </ul>
              <p className="mt-2 text-[11px] text-sky-900/90">
                Live-Berechnung im Dashboard-Pop-up zu Top-Herausforderungen; keine separate Erfüllungs-%.
              </p>
            </div>
          ) : null}
          {selectedNode.id === "annual_target" ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-xs text-emerald-950">
              <p className="font-semibold">Governance-Gate für OKR-Aktivierung</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 leading-relaxed">
                <li>
                  <strong>Gate 1:</strong> aktive Jahresziele im Zieljahr vorhanden
                </li>
                <li>
                  <strong>Gate 2:</strong> Objective direkt zu Jahresziel zugeordnet oder genehmigte Ausnahme
                </li>
              </ul>
              <p className="mt-2 text-[11px] text-emerald-900/90">
                Standardmodus: Draft erlaubt, Aktivierung blockiert.
              </p>
            </div>
          ) : null}
          <MetaRow label="Zyklus" value={zoneLabelDe(selectedNode.zone)} />
          <MetaRow label="Tabellen" value={selectedNode.dbTables.join(", ")} />
          {connectedEdges.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-zinc-700">
                Beziehungstypen ({connectedEdges.length})
              </p>
              <ul className="mt-1 space-y-1 text-xs text-zinc-600">
                {connectedEdges.map((edge) => {
                  const otherId =
                    edge.sourceId === selectedNode.id ? edge.targetId : edge.sourceId;
                  const other = graph.nodes.find((n) => n.id === otherId);
                  return (
                    <li key={edge.id}>
                      {edge.label}
                      {edge.optional ? " (optional)" : ""} → {other?.label ?? otherId}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            {selectedNode.moduleHref ? (
              <Link
                href={selectedNode.moduleHref}
                className="inline-flex rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800"
              >
                Zum Modul
              </Link>
            ) : null}
            <Link
              href={
                selectedNode.manualAnchor
                  ? `/user-manual#${selectedNode.manualAnchor}`
                  : "/user-manual#begriffe"
              }
              className="inline-flex rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
            >
              User Manual
            </Link>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs leading-relaxed text-zinc-600">
          Klicke auf einen <strong>Elementtyp</strong> (Kasten) oder eine <strong>Beziehung</strong> (Linie),
          um die Erklärung hier anzuzeigen.
        </p>
      )}
    </aside>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase text-zinc-500">{label}</p>
      <p className="mt-0.5 text-xs text-zinc-700">{value}</p>
    </div>
  );
}

function zoneLabelDe(zone: ReferenceNetworkZone): string {
  const map: Record<ReferenceNetworkZone, string> = {
    strategy: "Strategiezyklus",
    execution: "Jahresplanung & Umsetzung",
    review: "Reviewzyklus",
    okr: "OKR-Zyklus",
  };
  return map[zone];
}
