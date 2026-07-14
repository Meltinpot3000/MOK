"use client";

import type { ExecutionNetworkNodeKind } from "@/lib/review/execution-network-graph";
import {
  DEFAULT_EXECUTION_NETWORK_FILTERS,
  EXECUTION_NETWORK_MAX_DEPTH,
  type ExecutionNetworkFilterState,
} from "@/lib/review/execution-network-focus";
import { MinMaxRangeSlider } from "@/components/ui/MinMaxRangeSlider";

export { DEFAULT_EXECUTION_NETWORK_FILTERS, type ExecutionNetworkFilterState };

const NODE_KIND_LABEL: Record<ExecutionNetworkNodeKind, string> = {
  direction: "Stoßrichtung",
  program: "Programm",
  annual_target: "Jahresziel",
  initiative: "Initiative",
  signal: "Review-Signal",
  feedback: "Strategie-Impuls",
};

const NODE_KIND_ORDER: ExecutionNetworkNodeKind[] = [
  "direction",
  "program",
  "annual_target",
  "initiative",
  "signal",
  "feedback",
];

type ExecutionNetworkFiltersProps = {
  nodes: Array<{ id: string; kind: ExecutionNetworkNodeKind; title: string }>;
  filters: ExecutionNetworkFilterState;
  onChange: (next: ExecutionNetworkFilterState) => void;
};

function toggleSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function ExecutionNetworkFilters({ nodes, filters, onChange }: ExecutionNetworkFiltersProps) {
  const pathDepthMax = Math.min(filters.pathDepthMax, EXECUTION_NETWORK_MAX_DEPTH);
  const pathDepthMin = Math.min(filters.pathDepthMin, pathDepthMax);

  return (
    <div className="brand-surface space-y-3 rounded-xl p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Fokus & Filter</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                {NODE_KIND_LABEL[n.kind]}: {n.title}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-zinc-600">
          <span className="mb-1 flex items-center justify-between gap-2">
            <span>Pfadtiefe (Kanten)</span>
            <span className="font-medium text-zinc-800">
              {pathDepthMin}–{pathDepthMax}
            </span>
          </span>
          <p className="mb-1 text-[10px] leading-snug text-zinc-500">
            0 = isoliert, 1–2 = Teilstrecke, 3 = vollständiger Umsetzungspfad. Im Fokusmodus
            hervorgehoben.
          </p>
          <MinMaxRangeSlider
            min={0}
            max={EXECUTION_NETWORK_MAX_DEPTH}
            step={1}
            valueMin={pathDepthMin}
            valueMax={pathDepthMax}
            onChange={({ min, max }) => onChange({ ...filters, pathDepthMin: min, pathDepthMax: max })}
            className="mt-1"
          />
        </label>

        <label className="flex items-end gap-2 pb-1 text-xs text-zinc-600">
          <input
            type="checkbox"
            checked={filters.focusMode}
            onChange={(e) => onChange({ ...filters, focusMode: e.target.checked })}
            className="rounded border-zinc-300"
          />
          Fokusmodus (komplette Umsetzungspfade hervorheben)
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {NODE_KIND_ORDER.map((kind) => (
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
            {NODE_KIND_LABEL[kind]}
          </button>
        ))}
      </div>
    </div>
  );
}
