"use client";

import type { DesignFieldsTreemapResult } from "@/lib/strategy-cycle/design-fields-treemap";
import { UNGROUPED_FIELD_ID } from "@/lib/strategy-cycle/design-fields-treemap";
import {
  buildDesignFieldTreemapInputs,
  layoutDesignFieldTreemap,
  type TreemapLayoutNode,
} from "@/lib/strategy-cycle/design-fields-treemap-layout";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  compactDirectionLabel,
  paletteForField,
  statusBadgeClass,
  statusLabelDe,
  UNASSIGNED_FIELD_STYLE,
} from "./design-fields-ui";

export type DesignFieldTreemapSelection = {
  fieldId: string;
  directionId: string | null;
};

type Props = {
  data: DesignFieldsTreemapResult;
  selection: DesignFieldTreemapSelection | null;
  onSelectField: (fieldId: string) => void;
  onSelectDirection: (fieldId: string, directionId: string) => void;
};

type LayoutSize = { width: number; height: number };

const CANVAS_HEIGHT = 420;

export function DesignFieldsTreemap({
  data,
  selection,
  onSelectField,
  onSelectDirection,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<LayoutSize>({ width: 0, height: CANVAS_HEIGHT });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const width = Math.floor(el.clientWidth);
      const height = Math.floor(el.clientHeight) || CANVAS_HEIGHT;
      if (width > 0) setSize({ width, height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const treemapInputs = useMemo(() => buildDesignFieldTreemapInputs(data.nodes), [data.nodes]);

  const layoutNodes = useMemo(() => {
    if (size.width <= 0 || size.height <= 0) return [];
    return layoutDesignFieldTreemap(treemapInputs, size.width, size.height);
  }, [size.height, size.width, treemapInputs]);

  const fields = useMemo(
    () => layoutNodes.filter((n) => n.type === "designField"),
    [layoutNodes]
  );
  const directionsByField = useMemo(() => {
    const map = new Map<string, TreemapLayoutNode[]>();
    for (const node of layoutNodes) {
      if (node.type !== "direction" || !node.parentId) continue;
      const list = map.get(node.parentId) ?? [];
      list.push(node);
      map.set(node.parentId, list);
    }
    return map;
  }, [layoutNodes]);

  if (data.nodes.length === 0) {
    return <p className="text-sm text-zinc-600">Keine Stoßrichtungen im Zyklus.</p>;
  }

  return (
    <>
      <div
        ref={containerRef}
        className="relative hidden h-[420px] w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 md:block"
      >
        {size.width > 0
          ? fields.map((fieldNode) => {
              const palette = paletteForField(fieldNode.paletteIndex, fieldNode.isUnassigned);
              const isBacklog = fieldNode.isUnassigned === true;
              const fieldSelected =
                selection?.fieldId === fieldNode.id && selection.directionId === null;
              const childNodes = directionsByField.get(fieldNode.id) ?? [];
              const sourceNode = data.nodes.find((n) => n.id === fieldNode.id);
              const hiddenCount = Math.max(
                0,
                (sourceNode?.directionCount ?? 0) -
                  childNodes.filter((c) => !c.tiny).length
              );

              return (
                <div
                  key={fieldNode.id}
                  className={`absolute box-border overflow-hidden rounded-sm border-2 ${palette.bg} ${palette.border} ${
                    isBacklog ? UNASSIGNED_FIELD_STYLE.dashed : ""
                  } ${fieldSelected ? "ring-2 ring-teal-600/50 ring-offset-1" : ""}`}
                  style={{
                    left: fieldNode.x,
                    top: fieldNode.y,
                    width: fieldNode.width,
                    height: fieldNode.height,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onSelectField(fieldNode.id)}
                    aria-pressed={fieldSelected}
                    className={`relative z-10 flex w-full min-w-0 items-start justify-between gap-1 border-b px-2 py-1.5 text-left ${palette.header} ${palette.headerText} ${
                      isBacklog ? "border-orange-200" : "border-black/10"
                    }`}
                    style={{ minHeight: 38 }}
                  >
                    <div className="min-w-0">
                      <p
                        className={`font-semibold leading-tight ${fieldNode.compact ? "line-clamp-1 text-[10px]" : "line-clamp-2 text-xs"}`}
                      >
                        {fieldNode.label}
                      </p>
                      <p
                        className={`mt-0.5 tabular-nums opacity-90 ${fieldNode.compact ? "text-[8px]" : "text-[9px]"}`}
                      >
                        {sourceNode?.directionCount ?? 0} SR · Gewicht {fieldNode.weight.toFixed(1)}
                        {hiddenCount > 0 ? ` · +${hiddenCount} weitere` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-medium leading-tight ${
                        isBacklog ? UNASSIGNED_FIELD_STYLE.badge : statusBadgeClass(fieldNode.status)
                      }`}
                    >
                      {isBacklog ? "Nachbearbeiten" : statusLabelDe(fieldNode.status)}
                    </span>
                  </button>

                  {childNodes.map((child) => {
                    const directionSelected =
                      selection?.fieldId === fieldNode.id &&
                      selection.directionId === child.directionId;
                    const showText = !child.tiny;
                    const label = compactDirectionLabel(child.label, child.compact);
                    return (
                      <button
                        key={child.id}
                        type="button"
                        title={child.label}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (child.directionId) onSelectDirection(fieldNode.id, child.directionId);
                        }}
                        aria-pressed={directionSelected}
                        className={`absolute z-0 box-border overflow-hidden rounded-sm border text-left transition-colors ${palette.childBg} ${palette.childBorder} ${palette.childHover} ${
                          directionSelected ? "z-20 ring-2 ring-teal-600/60" : ""
                        }`}
                        style={{
                          left: child.x - fieldNode.x,
                          top: child.y - fieldNode.y,
                          width: child.width,
                          height: child.height,
                        }}
                      >
                        {showText ? (
                          <p className="line-clamp-2 px-1 py-0.5 text-[9px] font-medium leading-tight text-zinc-900">
                            {label}
                          </p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })
          : null}
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {data.nodes.map((node, index) => {
          const palette = paletteForField(
            node.nodeKind === "ungrouped_backlog" ? -1 : index,
            node.nodeKind === "ungrouped_backlog"
          );
          const isFieldSelected =
            selection?.fieldId === node.id && selection.directionId === null;
          return (
            <div key={node.id} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => onSelectField(node.id)}
                className={`rounded-md border-2 px-3 py-2 text-left text-sm font-semibold ${palette.bg} ${palette.border} ${
                  isFieldSelected ? "ring-2 ring-teal-600/40" : ""
                }`}
              >
                {node.label} ({node.directionCount} SR)
              </button>
              {node.directions.slice(0, 6).map((d) => {
                const directionSelected =
                  selection?.fieldId === node.id && selection?.directionId === d.directionId;
                return (
                  <button
                    key={d.directionId}
                    type="button"
                    onClick={() => onSelectDirection(node.id, d.directionId)}
                    className={`ml-3 rounded border px-2 py-1 text-left text-xs ${palette.childBg} ${palette.childBorder} ${
                      directionSelected ? "ring-2 ring-teal-600/40" : ""
                    }`}
                  >
                    {d.title}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}

export function defaultSelectedFieldId(data: DesignFieldsTreemapResult): string | null {
  if (data.nodes.length === 0) return null;
  if (data.portfolioState === "none") {
    return data.nodes.find((n) => n.id === UNGROUPED_FIELD_ID)?.id ?? data.nodes[0].id;
  }
  const strategic = data.nodes.find((n) => n.nodeKind === "strategic_field");
  return strategic?.id ?? data.nodes[0].id;
}

export type { DesignFieldNode } from "@/lib/strategy-cycle/design-fields-treemap";
