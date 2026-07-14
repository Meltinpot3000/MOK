import {
  BINARY_TREEMAP_FIELD_PADDING,
  innerFieldBodyRect,
  layoutBinaryTreemap,
  safeTreemapWeight,
} from "@/lib/ui/binary-treemap";
import type { DesignFieldNode, DesignFieldStatus } from "@/lib/strategy-cycle/design-fields-treemap";
import { UNGROUPED_FIELD_ID } from "@/lib/strategy-cycle/design-fields-treemap";

export type TreemapVisualStatus = "good" | "warning" | "critical" | "unknown";

export type DesignFieldTreemapChildInput = {
  id: string;
  label: string;
  weight: number;
  status?: TreemapVisualStatus;
};

export type DesignFieldTreemapInput = {
  id: string;
  label: string;
  weight: number;
  displayWeight: number;
  status: TreemapVisualStatus;
  isUnassigned?: boolean;
  paletteIndex: number;
  children: DesignFieldTreemapChildInput[];
};

export type TreemapLayoutNode = {
  id: string;
  parentId?: string;
  type: "designField" | "direction";
  label: string;
  weight: number;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  status: TreemapVisualStatus;
  isUnassigned?: boolean;
  paletteIndex: number;
  compact: boolean;
  tiny: boolean;
  fieldId?: string;
  directionId?: string;
};

export function mapDesignFieldStatusToTreemap(status: DesignFieldStatus): TreemapVisualStatus {
  switch (status) {
    case "strong":
      return "good";
    case "medium":
      return "warning";
    case "weak":
      return "critical";
    default:
      return "unknown";
  }
}

export function computeUnassignedDisplayWeight(
  actualWeight: number,
  regularFieldWeights: number[]
): number {
  if (regularFieldWeights.length === 0) return actualWeight;
  const maxRegularWeight = Math.max(...regularFieldWeights.map(safeTreemapWeight));
  return Math.min(actualWeight * 0.65, maxRegularWeight * 1.25);
}

export function buildDesignFieldTreemapInputs(nodes: DesignFieldNode[]): DesignFieldTreemapInput[] {
  const regularWeights = nodes
    .filter((n) => n.nodeKind === "strategic_field")
    .map((n) => n.weight);

  let paletteCounter = 0;

  return nodes.map((node) => {
    const isUnassigned = node.nodeKind === "ungrouped_backlog";
    const paletteIndex = isUnassigned ? -1 : paletteCounter++;
    const displayWeight = isUnassigned
      ? computeUnassignedDisplayWeight(node.weight, regularWeights)
      : node.weight;

    const children = node.directions.map((d) => ({
      id: d.directionId,
      label: d.title,
      weight: safeTreemapWeight(d.score),
      status: directionStatusFromMetrics(d),
    }));

    const childWeightSum = children.reduce((sum, c) => sum + c.weight, 0);

    return {
      id: node.id,
      label: node.label,
      weight: node.weight,
      displayWeight: safeTreemapWeight(displayWeight || childWeightSum),
      status: mapDesignFieldStatusToTreemap(node.status),
      isUnassigned,
      paletteIndex,
      children,
    };
  });
}

function directionStatusFromMetrics(direction: {
  objectiveAlignment: number;
  hasStrongObjectiveLink: boolean;
}): TreemapVisualStatus {
  if (direction.hasStrongObjectiveLink && direction.objectiveAlignment > 0) return "good";
  if (direction.objectiveAlignment > 0) return "warning";
  return "unknown";
}

export function layoutDesignFieldTreemap(
  fields: DesignFieldTreemapInput[],
  canvasWidth: number,
  canvasHeight: number
): TreemapLayoutNode[] {
  if (canvasWidth <= 0 || canvasHeight <= 0 || fields.length === 0) return [];

  const fieldLayouts = layoutBinaryTreemap(
    fields.map((field) => ({ id: field.id, weight: field.displayWeight })),
    canvasWidth,
    canvasHeight,
    { gap: 3 }
  );

  const fieldById = new Map(fields.map((f) => [f.id, f]));
  const out: TreemapLayoutNode[] = [];

  for (const fieldRect of fieldLayouts) {
    const field = fieldById.get(fieldRect.id);
    if (!field) continue;

    out.push({
      id: field.id,
      type: "designField",
      label: field.label,
      weight: field.weight,
      x: fieldRect.x,
      y: fieldRect.y,
      width: fieldRect.width,
      height: fieldRect.height,
      depth: 0,
      status: field.status,
      isUnassigned: field.isUnassigned,
      paletteIndex: field.paletteIndex,
      compact: fieldRect.compact,
      tiny: fieldRect.tiny,
      fieldId: field.id,
    });

    if (field.children.length === 0) continue;

    const body = innerFieldBodyRect(fieldRect);
    if (body.width < 8 || body.height < 8) continue;

    const childLayouts = layoutBinaryTreemap(
      field.children.map((child) => ({ id: `${field.id}::${child.id}`, weight: child.weight })),
      body.width,
      body.height,
      { gap: 2 }
    );

    for (const childRect of childLayouts) {
      const childId = childRect.id.split("::")[1];
      const child = field.children.find((c) => c.id === childId);
      if (!child) continue;

      out.push({
        id: childRect.id,
        parentId: field.id,
        type: "direction",
        label: child.label,
        weight: child.weight,
        x: body.x + childRect.x,
        y: body.y + childRect.y,
        width: childRect.width,
        height: childRect.height,
        depth: 1,
        status: child.status ?? field.status,
        isUnassigned: field.isUnassigned,
        paletteIndex: field.paletteIndex,
        compact: childRect.compact,
        tiny: childRect.tiny,
        fieldId: field.id,
        directionId: child.id,
      });
    }
  }

  return out;
}

export function assertTreemapWithinCanvas(
  nodes: TreemapLayoutNode[],
  canvasWidth: number,
  canvasHeight: number
): boolean {
  return nodes.every(
    (node) =>
      node.x >= 0 &&
      node.y >= 0 &&
      node.width >= 0 &&
      node.height >= 0 &&
      node.x + node.width <= canvasWidth + 0.5 &&
      node.y + node.height <= canvasHeight + 0.5
  );
}

export function isLinearStripLayout(fieldNodes: TreemapLayoutNode[]): boolean {
  if (fieldNodes.length < 4) return false;
  const sameY = fieldNodes.every((n) => Math.abs(n.y - fieldNodes[0].y) < 1);
  const sameX = fieldNodes.every((n) => Math.abs(n.x - fieldNodes[0].x) < 1);
  return sameY || sameX;
}

export function childNodesInsideParentBody(
  nodes: TreemapLayoutNode[],
  parentId: string
): boolean {
  const parent = nodes.find((n) => n.id === parentId && n.type === "designField");
  if (!parent) return false;

  const body = innerFieldBodyRect(parent);
  const children = nodes.filter((n) => n.parentId === parentId && n.type === "direction");
  return children.every(
    (child) =>
      child.x >= body.x - 0.5 &&
      child.y >= body.y - 0.5 &&
      child.x + child.width <= body.x + body.width + 0.5 &&
      child.y + child.height <= body.y + body.height + 0.5
  );
}

export function unassignedFieldId(): string {
  return UNGROUPED_FIELD_ID;
}
