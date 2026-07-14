"use client";

import type { DesignFieldNode } from "@/lib/strategy-cycle/design-fields-treemap";
import {
  designFieldStatusBadgeClass,
  designFieldStatusLabelDe,
  designFieldTileSurfaceClass,
} from "./design-fields-ui";

type Props = {
  node: DesignFieldNode;
  selected: boolean;
  compact?: boolean;
  nested?: boolean;
  onSelect: () => void;
};

export function DesignFieldTile({ node, selected, compact = false, nested = false, onSelect }: Props) {
  const isBacklog = node.nodeKind === "ungrouped_backlog";

  if (nested) {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`absolute inset-0 z-10 flex min-h-0 w-full flex-col overflow-hidden rounded-md p-0 text-left transition-shadow ${
          selected ? "ring-2 ring-teal-700/40 ring-offset-1" : ""
        }`}
      >
        <div className="flex min-w-0 items-start justify-between gap-1 bg-gradient-to-b from-white/85 to-white/40 px-2 py-1.5 backdrop-blur-[1px]">
          <p
            className={`min-w-0 font-semibold text-zinc-900 ${compact ? "line-clamp-1 text-[10px]" : "line-clamp-2 text-xs"}`}
          >
            {node.label}
          </p>
          <span
            className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-medium leading-tight ${designFieldStatusBadgeClass(node.status)}`}
          >
            {designFieldStatusLabelDe(node.status)}
          </span>
        </div>
        <div className="mt-auto bg-gradient-to-t from-white/75 to-transparent px-2 py-1">
          <p className={`tabular-nums text-zinc-800 ${compact ? "text-[9px]" : "text-[10px]"}`}>
            {node.directionCount} SR · {node.weight.toFixed(1)}
          </p>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md border p-2 text-left transition-colors ${designFieldTileSurfaceClass(node.status, isBacklog)} ${
        selected ? "ring-2 ring-teal-700/30 ring-offset-1" : ""
      }`}
    >
      <div className="flex min-w-0 items-start justify-between gap-1">
        <p className={`min-w-0 truncate font-semibold text-zinc-900 ${compact ? "text-[11px]" : "text-xs"}`}>
          {node.label}
        </p>
        <span
          className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-medium leading-tight ${designFieldStatusBadgeClass(node.status)}`}
        >
          {designFieldStatusLabelDe(node.status)}
        </span>
      </div>

      <p className={`mt-1 tabular-nums text-zinc-700 ${compact ? "text-[10px]" : "text-[11px]"}`}>
        {node.directionCount} SR · Gewicht {node.weight.toFixed(1)}
      </p>

      {node.structureHint ? (
        <p className={`mt-1 leading-snug text-zinc-600 ${compact ? "text-[9px]" : "text-[10px]"}`}>
          {node.structureHint}
        </p>
      ) : (
        <p className={`mt-1 text-zinc-600 ${compact ? "text-[9px]" : "text-[10px]"}`}>{node.shortStatus}</p>
      )}

      {node.topDirections.length > 0 && !compact ? (
        <ul className="mt-auto space-y-0.5 pt-1.5">
          {node.topDirections.map((d) => (
            <li key={d.directionId} className="truncate text-[9px] text-zinc-500">
              {d.title}
            </li>
          ))}
        </ul>
      ) : null}
    </button>
  );
}
