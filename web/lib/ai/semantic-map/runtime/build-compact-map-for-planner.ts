import type {
  BuildCompactMapOptions,
  CompactSemanticMapForPlanner,
  ExecutableSemanticMap,
} from "../types";

export function buildCompactMapForPlanner(
  input: {
    map: ExecutableSemanticMap;
    maxPlaces?: number;
    maxRoads?: number;
    options?: BuildCompactMapOptions;
  }
): CompactSemanticMapForPlanner {
  const maxPlaces = input.maxPlaces ?? input.options?.maxPlaces ?? 40;
  const maxRoads = input.maxRoads ?? input.options?.maxRoads ?? 60;
  const includeInferred = input.options?.includeInferredRoadsInCompact !== false;

  const places = input.map.places.slice(0, maxPlaces).map((p) => ({
    placeKey: p.placeKey,
    shortMeaning: p.businessMeaning.slice(0, 240),
    domain: p.domain,
    validationStatus: p.validationStatus,
  }));

  const verifiedRoads = input.map.roadsAll
    .filter((r) => r.validationStatus === "verified")
    .slice(0, maxRoads)
    .map((r) => ({
      roadKey: r.roadKey,
      fromPlaceKey: r.fromPlaceKey,
      toPlaceKey: r.toPlaceKey,
      relationType: r.relationType,
    }));

  const inferredRoads = includeInferred
    ? input.map.roadsAll
        .filter((r) => r.validationStatus === "inferred")
        .slice(0, maxRoads)
        .map((r) => ({
          roadKey: r.roadKey,
          fromPlaceKey: r.fromPlaceKey,
          toPlaceKey: r.toPlaceKey,
          relationType: r.relationType,
        }))
    : [];

  const gaps: CompactSemanticMapForPlanner["gaps"] = [];
  for (const r of input.map.roadsAll) {
    if (r.validationStatus === "missing_tool") {
      gaps.push({
        gapType: "missing_tool",
        summary: `${r.fromPlaceKey} -> ${r.toPlaceKey}`,
      });
    }
  }

  const evidenceHints = input.map.places.slice(0, maxPlaces).map((p) => ({
    placeKey: p.placeKey,
    refs: p.evidence.map((e) => `${e.sourceType}:${e.sourceRef}`).slice(0, 8),
  }));

  return {
    places,
    roadsVerified: verifiedRoads,
    roadsInferred: inferredRoads,
    gaps,
    evidenceHints,
    inferredRoadsIncludedInCompact: includeInferred,
  };
}
