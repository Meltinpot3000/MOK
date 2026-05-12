import type { ExecutableSemanticMap, PlanRouteOptions, SemanticMapRoad } from "../types";

function roadEdges(
  roads: SemanticMapRoad[],
  allowInferred: boolean
): Map<string, Array<{ to: string; road: SemanticMapRoad }>> {
  const out = new Map<string, Array<{ to: string; road: SemanticMapRoad }>>();
  const use = (r: SemanticMapRoad) =>
    r.validationStatus === "verified" ||
    (allowInferred && r.validationStatus === "inferred");
  for (const r of roads) {
    if (!use(r)) continue;
    const arr = out.get(r.fromPlaceKey) ?? [];
    arr.push({ to: r.toPlaceKey, road: r });
    out.set(r.fromPlaceKey, arr);
  }
  return out;
}

export type PlanRouteFromMapResult = {
  found: boolean;
  pathPlaceKeys: string[];
  roadKeysUsed: string[];
  gapReason?: string;
};

export function planRouteFromMap(input: {
  map: ExecutableSemanticMap;
  fromPlaceKey: string;
  toPlaceKey: string;
  options?: PlanRouteOptions;
}): PlanRouteFromMapResult {
  const allowInferred = input.options?.allowInferredRoads === true;
  const edges = roadEdges(input.map.roadsAll, allowInferred);
  const start = input.fromPlaceKey;
  const goal = input.toPlaceKey;
  if (start === goal) {
    return { found: true, pathPlaceKeys: [start], roadKeysUsed: [] };
  }

  type Back = { prevPlace: string | null; road: SemanticMapRoad | null };
  const back = new Map<string, Back>();
  back.set(start, { prevPlace: null, road: null });
  const q: string[] = [start];

  while (q.length) {
    const cur = q.shift()!;
    if (cur === goal) break;
    for (const { to, road } of edges.get(cur) ?? []) {
      if (back.has(to)) continue;
      back.set(to, { prevPlace: cur, road });
      q.push(to);
    }
  }

  if (!back.has(goal)) {
    return {
      found: false,
      pathPlaceKeys: [],
      roadKeysUsed: [],
      gapReason: allowInferred
        ? "Keine Route (auch mit inferred) zwischen den Orten."
        : "Keine Route nur mit verified Roads; allowInferredRoads:true pruefen.",
    };
  }

  const pathPlaceKeys: string[] = [];
  const roadKeysUsed: string[] = [];
  let cur: string | null = goal;
  while (cur) {
    pathPlaceKeys.push(cur);
    const b = back.get(cur);
    if (!b || b.prevPlace === null) break;
    if (b.road) roadKeysUsed.push(b.road.roadKey);
    cur = b.prevPlace;
  }
  pathPlaceKeys.reverse();
  roadKeysUsed.reverse();
  return { found: true, pathPlaceKeys, roadKeysUsed };
}
