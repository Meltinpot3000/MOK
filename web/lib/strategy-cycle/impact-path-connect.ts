import type {
  ImpactPathEdge,
  ImpactPathEdgeKind,
  ImpactPathGraph,
  ImpactPathNode,
  ImpactPathNodeKind,
} from "@/lib/strategy-cycle/impact-path-graph";
import { buildImpactPathEdgeId } from "@/lib/strategy-cycle/impact-path-graph";
import { IMPACT_PATH_COLUMN_ORDER } from "@/components/ceo/strategy-cycle/impact-path/impact-path-ui";
import type { PositionedImpactPathNode } from "@/components/ceo/strategy-cycle/impact-path/impact-path-ui";

export type ImpactPathHandleSide = "in" | "out";

const COLUMN_INDEX: Record<ImpactPathNodeKind, number> = {
  analysis_entry: 0,
  challenge: 1,
  direction: 2,
  objective: 3,
};

export function handlesForNodeKind(kind: ImpactPathNodeKind): ImpactPathHandleSide[] {
  const col = COLUMN_INDEX[kind];
  const sides: ImpactPathHandleSide[] = [];
  if (col > 0) sides.push("in");
  if (col < IMPACT_PATH_COLUMN_ORDER.length - 1) sides.push("out");
  return sides;
}

export function edgeKindForNodePair(
  sourceKind: ImpactPathNodeKind,
  targetKind: ImpactPathNodeKind
): ImpactPathEdgeKind | null {
  if (sourceKind === "analysis_entry" && targetKind === "challenge") {
    return "analysis_to_challenge";
  }
  if (sourceKind === "challenge" && targetKind === "direction") {
    return "challenge_to_direction";
  }
  if (sourceKind === "direction" && targetKind === "objective") {
    return "direction_to_objective";
  }
  return null;
}

export function impactPathHandlePosition(
  node: PositionedImpactPathNode,
  side: ImpactPathHandleSide
): { x: number; y: number } {
  const y = node.y + node.height / 2;
  if (side === "in") return { x: node.x, y };
  return { x: node.x + node.width, y };
}

export function isPathLinkActive(edge: ImpactPathEdge): boolean {
  return edge.state === "existing" || edge.reviewStatus === "accepted";
}

export function hasActivePathLink(
  edges: ImpactPathEdge[],
  kind: ImpactPathEdgeKind,
  sourceId: string,
  targetId: string
): boolean {
  const id = buildImpactPathEdgeId(kind, sourceId, targetId);
  return edges.some((e) => e.id === id && isPathLinkActive(e));
}

export function canConnectNodes(
  edges: ImpactPathEdge[],
  source: ImpactPathNode,
  target: ImpactPathNode
): boolean {
  const kind = edgeKindForNodePair(source.kind, target.kind);
  if (!kind) return false;
  if (COLUMN_INDEX[target.kind] !== COLUMN_INDEX[source.kind] + 1) return false;
  return !hasActivePathLink(edges, kind, source.id, target.id);
}

export type ImpactPathHandleVisibility = {
  nodeId: string;
  sides: ImpactPathHandleSide[];
};

/** Welche Andockpunkte bei Auswahl oder Drag sichtbar sind. */
export function resolveImpactPathHandleVisibility(input: {
  nodes: ImpactPathNode[];
  edges: ImpactPathEdge[];
  selectedNodeId: string | null;
  dragSourceNodeId: string | null;
}): ImpactPathHandleVisibility[] {
  const nodeById = new Map(input.nodes.map((n) => [n.id, n]));
  const visibility = new Map<string, Set<ImpactPathHandleSide>>();

  const addSide = (nodeId: string, side: ImpactPathHandleSide) => {
    const set = visibility.get(nodeId) ?? new Set<ImpactPathHandleSide>();
    set.add(side);
    visibility.set(nodeId, set);
  };

  const exposeConnectableFromSource = (sourceId: string) => {
    const source = nodeById.get(sourceId);
    if (!source) return;
    for (const side of handlesForNodeKind(source.kind)) {
      addSide(sourceId, side);
    }
    for (const target of input.nodes) {
      if (!canConnectNodes(input.edges, source, target)) continue;
      addSide(target.id, "in");
    }
  };

  if (input.dragSourceNodeId) {
    exposeConnectableFromSource(input.dragSourceNodeId);
    return [...visibility.entries()].map(([nodeId, sides]) => ({
      nodeId,
      sides: [...sides],
    }));
  }

  if (!input.selectedNodeId) return [];

  const selected = nodeById.get(input.selectedNodeId);
  if (!selected) return [];

  for (const side of handlesForNodeKind(selected.kind)) {
    addSide(selected.id, side);
  }

  const selectedCol = COLUMN_INDEX[selected.kind];

  for (const other of input.nodes) {
    if (other.id === selected.id) continue;
    const otherCol = COLUMN_INDEX[other.kind];
    if (Math.abs(otherCol - selectedCol) !== 1) continue;

    if (otherCol > selectedCol && canConnectNodes(input.edges, selected, other)) {
      addSide(other.id, "in");
    }
    if (otherCol < selectedCol && canConnectNodes(input.edges, other, selected)) {
      addSide(other.id, "out");
    }
  }

  return [...visibility.entries()].map(([nodeId, sides]) => ({
    nodeId,
    sides: [...sides],
  }));
}

export function findDropTargetNodeId(input: {
  nodes: ImpactPathNode[];
  positioned: PositionedImpactPathNode[];
  edges: ImpactPathEdge[];
  sourceNodeId: string;
  pointerX: number;
  pointerY: number;
  hitRadius?: number;
}): string | null {
  const source = input.nodes.find((n) => n.id === input.sourceNodeId);
  if (!source) return null;
  const posById = new Map(input.positioned.map((n) => [n.id, n]));
  const radius = input.hitRadius ?? 14;

  for (const target of input.nodes) {
    if (target.id === source.id) continue;
    if (!canConnectNodes(input.edges, source, target)) continue;
    const pos = posById.get(target.id);
    if (!pos) continue;
    const handle = impactPathHandlePosition(pos, "in");
    if (Math.hypot(handle.x - input.pointerX, handle.y - input.pointerY) <= radius) {
      return target.id;
    }
  }
  return null;
}
