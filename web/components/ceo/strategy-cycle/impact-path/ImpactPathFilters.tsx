"use client";

import type { CorrelationStatus } from "@/lib/strategy-cycle/correlation";
import type { ImpactPathEdge, ImpactPathGraph, ImpactPathNodeKind } from "@/lib/strategy-cycle/impact-path-graph";
import {
  collectFullPathClosure,
  collectFullPathClosureForEdge,
  findNodeIdsByPathDepthRange,
  IMPACT_PATH_MAX_DEPTH,
} from "@/lib/strategy-cycle/impact-path-focus";
import { IMPACT_PATH_COLUMN_LABEL } from "@/components/ceo/strategy-cycle/impact-path/impact-path-ui";
import { MinMaxRangeSlider } from "@/components/ui/MinMaxRangeSlider";

export type ImpactPathFilterState = {
  focusNodeId: string;
  nodeKinds: Set<ImpactPathNodeKind>;
  connectionTypes: Set<"existing" | "suggested" | "accepted" | "rejected" | "deferred">;
  statuses: Set<CorrelationStatus>;
  scoreMin: number;
  scoreMax: number;
  lifecycleLabels: Set<string>;
  /** Kanten entlang des Wirkpfads durch die vier Ebenen (0 = isoliert, 3 = vollständig). */
  pathDepthMin: number;
  pathDepthMax: number;
  focusMode: boolean;
};

export const DEFAULT_IMPACT_PATH_FILTERS: ImpactPathFilterState = {
  focusNodeId: "",
  nodeKinds: new Set(["analysis_entry", "challenge", "direction", "objective"]),
  connectionTypes: new Set(["existing", "suggested"]),
  statuses: new Set(["green", "yellow", "red", "unknown"]),
  scoreMin: 0,
  scoreMax: 100,
  lifecycleLabels: new Set(),
  pathDepthMin: 0,
  pathDepthMax: IMPACT_PATH_MAX_DEPTH,
  focusMode: true,
};

type ImpactPathFiltersProps = {
  nodes: Array<{ id: string; kind: ImpactPathNodeKind; title: string; lifecycleLabel?: string }>;
  edges: Array<{ sourceId: string; targetId: string }>;
  filters: ImpactPathFilterState;
  onChange: (next: ImpactPathFilterState) => void;
};

function toggleSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function ImpactPathFilters({ nodes, edges, filters, onChange }: ImpactPathFiltersProps) {
  const lifecycleOptions = [
    ...new Set(nodes.map((n) => n.lifecycleLabel).filter(Boolean) as string[]),
  ].sort((a, b) => a.localeCompare(b, "de"));

  const pathDepthMax = Math.min(filters.pathDepthMax, IMPACT_PATH_MAX_DEPTH);
  const pathDepthMin = Math.min(filters.pathDepthMin, pathDepthMax);

  return (
    <div className="brand-surface space-y-3 rounded-xl p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Filter</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs text-zinc-600">
          Fokusobjekt
          <select
            value={filters.focusNodeId}
            onChange={(e) => onChange({ ...filters, focusNodeId: e.target.value })}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="">— Alle —</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {IMPACT_PATH_COLUMN_LABEL[n.kind]}: {n.title}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-zinc-600">
          <span className="mb-1 flex items-center justify-between">
            <span>Score-Bereich</span>
            <span className="font-medium text-zinc-800">
              {filters.scoreMin}–{filters.scoreMax}
            </span>
          </span>
          <MinMaxRangeSlider
            min={0}
            max={100}
            step={1}
            valueMin={filters.scoreMin}
            valueMax={filters.scoreMax}
            onChange={({ min, max }) => onChange({ ...filters, scoreMin: min, scoreMax: max })}
            className="mt-1"
          />
        </label>

        <label className="text-xs text-zinc-600">
          <span className="mb-1 flex items-center justify-between gap-2">
            <span>Pfadtiefe (Kanten)</span>
            <span className="font-medium text-zinc-800">
              {pathDepthMin}–{pathDepthMax}
            </span>
          </span>
          <p className="mb-1 text-[10px] leading-snug text-zinc-500">
            0 = isoliert, 1–2 = Teilstrecke, 3 = vollständiger Wirkpfad. Im Fokusmodus hervorgehoben.
          </p>
          <MinMaxRangeSlider
            min={0}
            max={IMPACT_PATH_MAX_DEPTH}
            step={1}
            valueMin={pathDepthMin}
            valueMax={pathDepthMax}
            onChange={({ min, max }) =>
              onChange({ ...filters, pathDepthMin: min, pathDepthMax: max })
            }
            className="mt-1"
          />
        </label>

        <label className="flex items-end gap-2 text-xs text-zinc-600 pb-1">
          <input
            type="checkbox"
            checked={filters.focusMode}
            onChange={(e) => onChange({ ...filters, focusMode: e.target.checked })}
            className="rounded border-zinc-300"
          />
          Fokusmodus (komplette Wirkpfade hervorheben)
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["analysis_entry", "challenge", "direction", "objective"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => onChange({ ...filters, nodeKinds: toggleSet(filters.nodeKinds, kind) })}
            className={`rounded-full border px-2.5 py-1 text-[11px] ${
              filters.nodeKinds.has(kind)
                ? "border-zinc-800 bg-zinc-900 text-white"
                : "border-zinc-300 text-zinc-500"
            }`}
          >
            {IMPACT_PATH_COLUMN_LABEL[kind]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["existing", "Bestehend"],
            ["suggested", "Vorgeschlagen"],
            ["rejected", "Abgelehnt"],
            ["deferred", "Später"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() =>
              onChange({ ...filters, connectionTypes: toggleSet(filters.connectionTypes, key) })
            }
            className={`rounded-full border px-2.5 py-1 text-[11px] ${
              filters.connectionTypes.has(key)
                ? "border-indigo-400 bg-indigo-50 text-indigo-900"
                : "border-zinc-300 text-zinc-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(["green", "yellow", "red", "unknown"] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onChange({ ...filters, statuses: toggleSet(filters.statuses, status) })}
            className={`rounded-full border px-2.5 py-1 text-[11px] ${
              filters.statuses.has(status)
                ? "border-zinc-700 bg-white text-zinc-800"
                : "border-zinc-300 text-zinc-500"
            }`}
          >
            {status === "green" ? "Grün" : status === "yellow" ? "Gelb" : status === "red" ? "Rot" : "Unklar"}
          </button>
        ))}
      </div>

      {lifecycleOptions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {lifecycleOptions.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() =>
                onChange({
                  ...filters,
                  lifecycleLabels:
                    filters.lifecycleLabels.size === 0
                      ? new Set([label])
                      : toggleSet(filters.lifecycleLabels, label),
                })
              }
              className={`rounded-full border px-2.5 py-1 text-[11px] ${
                filters.lifecycleLabels.size === 0 || filters.lifecycleLabels.has(label)
                  ? "border-violet-400 bg-violet-50 text-violet-900"
                  : "border-zinc-300 text-zinc-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function applyImpactPathFilters(
  graph: ImpactPathGraph,
  filters: ImpactPathFilterState
): { nodes: ImpactPathGraph["nodes"]; edges: ImpactPathEdge[] } {
  let edges = graph.edges.filter((edge) => {
    if (edge.score < filters.scoreMin || edge.score > filters.scoreMax) return false;
    if (!filters.statuses.has(edge.status)) return false;

    const review = edge.reviewStatus ?? "pending";
    const typeKey =
      edge.state === "existing"
        ? "existing"
        : review === "rejected"
          ? "rejected"
          : review === "deferred"
            ? "deferred"
            : review === "accepted"
              ? "accepted"
              : "suggested";

    if (!filters.connectionTypes.has(typeKey as "existing" | "suggested" | "accepted" | "rejected" | "deferred")) {
      return false;
    }
    return true;
  });

  let nodes = graph.nodes.filter((node) => {
    if (!filters.nodeKinds.has(node.kind)) return false;
    if (
      filters.lifecycleLabels.size > 0 &&
      node.lifecycleLabel &&
      !filters.lifecycleLabels.has(node.lifecycleLabel)
    ) {
      return false;
    }
    return true;
  });

  if (filters.focusNodeId) {
    const focusId = filters.focusNodeId;
    const connected = collectFullPathClosure([focusId], edges);
    nodes = nodes.filter((n) => connected.has(n.id));
    edges = edges.filter((e) => connected.has(e.sourceId) && connected.has(e.targetId));
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  edges = edges.filter((e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId));

  if (filters.pathDepthMin > 0 || filters.pathDepthMax < IMPACT_PATH_MAX_DEPTH) {
    const matching = new Set(
      findNodeIdsByPathDepthRange(
        nodes.map((n) => n.id),
        edges,
        filters.pathDepthMin,
        filters.pathDepthMax
      )
    );
    nodes = nodes.filter((n) => matching.has(n.id));
    edges = edges.filter((e) => matching.has(e.sourceId) && matching.has(e.targetId));
  }

  return { nodes, edges };
}

export function resolveImpactPathHighlightIds(input: {
  graphNodeIds: string[];
  edges: Array<{ sourceId: string; targetId: string }>;
  focusMode: boolean;
  pathDepthMin: number;
  pathDepthMax: number;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  allEdges: Array<{ id: string; sourceId: string; targetId: string }>;
}): Set<string> | null {
  if (!input.focusMode) return null;

  if (input.selectedEdgeId) {
    const edge = input.allEdges.find((e) => e.id === input.selectedEdgeId);
    if (!edge) return null;
    return collectFullPathClosureForEdge(edge.sourceId, edge.targetId, input.edges);
  }

  if (input.selectedNodeId) {
    return collectFullPathClosure([input.selectedNodeId], input.edges);
  }

  const seeds = findNodeIdsByPathDepthRange(
    input.graphNodeIds,
    input.edges,
    input.pathDepthMin,
    input.pathDepthMax
  );
  if (seeds.length === 0) return null;
  return collectFullPathClosure(seeds, input.edges);
}
