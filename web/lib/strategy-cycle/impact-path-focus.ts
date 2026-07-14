type ImpactPathEdgeEndpoints = { sourceId: string; targetId: string };

/** Vollständiger Wirkpfad: Analyse → Herausforderung → Stoßrichtung → Ziel = 3 Kanten. */
export const IMPACT_PATH_MAX_DEPTH = 3;

/** Längster gerichteter Pfad (in Kanten) durch den Knoten auf sichtbaren Wirkpfad-Kanten. */
export function computeLongestPathDepthThroughNode(
  nodeIds: Iterable<string>,
  edges: ImpactPathEdgeEndpoints[]
): Map<string, number> {
  const nodeSet = new Set(nodeIds);
  for (const edge of edges) {
    nodeSet.add(edge.sourceId);
    nodeSet.add(edge.targetId);
  }

  const distFromLeft = new Map<string, number>();
  const distToRight = new Map<string, number>();
  const outEdges = new Map<string, string[]>();
  const inEdges = new Map<string, string[]>();
  for (const id of nodeSet) {
    distFromLeft.set(id, 0);
    distToRight.set(id, 0);
    outEdges.set(id, []);
    inEdges.set(id, []);
  }

  for (const edge of edges) {
    if (!nodeSet.has(edge.sourceId) || !nodeSet.has(edge.targetId)) continue;
    outEdges.get(edge.sourceId)!.push(edge.targetId);
    inEdges.get(edge.targetId)!.push(edge.sourceId);
  }

  const inDegree = new Map<string, number>();
  for (const id of nodeSet) inDegree.set(id, inEdges.get(id)!.length);

  const topo: string[] = [];
  const queue = [...nodeSet].filter((id) => (inDegree.get(id) ?? 0) === 0);
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    topo.push(nodeId);
    for (const targetId of outEdges.get(nodeId) ?? []) {
      distFromLeft.set(
        targetId,
        Math.max(distFromLeft.get(targetId) ?? 0, (distFromLeft.get(nodeId) ?? 0) + 1)
      );
      const nextIn = (inDegree.get(targetId) ?? 1) - 1;
      inDegree.set(targetId, nextIn);
      if (nextIn === 0) queue.push(targetId);
    }
  }

  for (const nodeId of [...topo].reverse()) {
    for (const sourceId of inEdges.get(nodeId) ?? []) {
      distToRight.set(
        sourceId,
        Math.max(distToRight.get(sourceId) ?? 0, (distToRight.get(nodeId) ?? 0) + 1)
      );
    }
  }

  const depths = new Map<string, number>();
  for (const id of nodeSet) {
    depths.set(id, (distFromLeft.get(id) ?? 0) + (distToRight.get(id) ?? 0));
  }
  return depths;
}

export function findNodeIdsByPathDepthRange(
  nodeIds: string[],
  edges: ImpactPathEdgeEndpoints[],
  min: number,
  max: number
): string[] {
  const depths = computeLongestPathDepthThroughNode(nodeIds, edges);
  return nodeIds.filter((id) => {
    const depth = depths.get(id) ?? 0;
    return depth >= min && depth <= max;
  });
}

export function collectUpstreamNodeIds(
  nodeId: string,
  edges: ImpactPathEdgeEndpoints[]
): Set<string> {
  const ids = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const edge of edges) {
      if (edge.targetId === current && !ids.has(edge.sourceId)) {
        ids.add(edge.sourceId);
        queue.push(edge.sourceId);
      }
    }
  }
  return ids;
}

/** Alle Nachfolger entlang sichtbarer Kanten (rechts im Wirkpfad). */
export function collectDownstreamNodeIds(
  nodeId: string,
  edges: ImpactPathEdgeEndpoints[]
): Set<string> {
  const ids = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    for (const edge of edges) {
      if (edge.sourceId === current && !ids.has(edge.targetId)) {
        ids.add(edge.targetId);
        queue.push(edge.targetId);
      }
    }
  }
  return ids;
}

/** Vollständige Wirkpfad-Hülle: von jedem Seed links und rechts durch alle Stufen. */
export function collectFullPathClosure(
  seedNodeIds: Iterable<string>,
  edges: ImpactPathEdgeEndpoints[]
): Set<string> {
  const result = new Set<string>();
  for (const seedId of seedNodeIds) {
    result.add(seedId);
    for (const id of collectUpstreamNodeIds(seedId, edges)) result.add(id);
    for (const id of collectDownstreamNodeIds(seedId, edges)) result.add(id);
  }
  return result;
}

/** Hülle für eine ausgewählte Kante: alles links von der Quelle bis rechts vom Ziel. */
export function collectFullPathClosureForEdge(
  sourceId: string,
  targetId: string,
  edges: ImpactPathEdgeEndpoints[]
): Set<string> {
  const result = new Set<string>([sourceId, targetId]);
  for (const id of collectUpstreamNodeIds(sourceId, edges)) result.add(id);
  for (const id of collectDownstreamNodeIds(targetId, edges)) result.add(id);
  return result;
}
