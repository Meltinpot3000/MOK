import type { ExecutionNetworkEdge, ExecutionNetworkGraph } from "./execution-network-graph";
import type { ExecutionNetworkNodeKind } from "./execution-network-graph";
import {
  collectFullPathClosure,
  collectFullPathClosureForEdge,
  findNodeIdsByPathDepthRange,
  IMPACT_PATH_MAX_DEPTH,
} from "@/lib/strategy-cycle/impact-path-focus";

/** Vollständiger Umsetzungspfad: Stoßrichtung → Programm/JZ → Initiative → Signal = 3 Kanten. */
export const EXECUTION_NETWORK_MAX_DEPTH = IMPACT_PATH_MAX_DEPTH;

export type ExecutionNetworkFilterState = {
  focusNodeId: string;
  nodeKinds: Set<ExecutionNetworkNodeKind>;
  pathDepthMin: number;
  pathDepthMax: number;
  focusMode: boolean;
};

export const DEFAULT_EXECUTION_NETWORK_FILTERS: ExecutionNetworkFilterState = {
  focusNodeId: "",
  nodeKinds: new Set([
    "direction",
    "program",
    "annual_target",
    "initiative",
    "signal",
    "feedback",
  ]),
  pathDepthMin: 0,
  pathDepthMax: EXECUTION_NETWORK_MAX_DEPTH,
  focusMode: true,
};

export function applyExecutionNetworkFilters(
  graph: ExecutionNetworkGraph,
  filters: ExecutionNetworkFilterState
): { nodes: ExecutionNetworkGraph["nodes"]; edges: ExecutionNetworkEdge[] } {
  let edges = [...graph.edges];
  let nodes = graph.nodes.filter((node) => filters.nodeKinds.has(node.kind));

  if (filters.focusNodeId) {
    const connected = collectFullPathClosure([filters.focusNodeId], edges);
    nodes = nodes.filter((n) => connected.has(n.id));
    edges = edges.filter((e) => connected.has(e.sourceId) && connected.has(e.targetId));
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  edges = edges.filter((e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId));

  if (filters.pathDepthMin > 0 || filters.pathDepthMax < EXECUTION_NETWORK_MAX_DEPTH) {
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

export function resolveExecutionNetworkHighlightIds(input: {
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
