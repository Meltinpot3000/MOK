import type { SemanticSourceInventory } from "../inventory/inventory-types";
import type {
  SemanticMapDraft,
  SemanticMapValidationResult,
  SemanticMapValidationSummary,
} from "../types";
import { validatePlaceDraft } from "./validate-places";
import { validateRoadDraft } from "./validate-roads";

const PLACEHOLDER_SNAPSHOT = "00000000-0000-4000-8000-000000000000";

function countPlaces(places: SemanticMapValidationResult["places"]): SemanticMapValidationSummary["places"] {
  const o = { total: places.length, verified: 0, inferred: 0, unsupported: 0 };
  for (const p of places) {
    if (p.validationStatus === "verified") o.verified += 1;
    else if (p.validationStatus === "inferred") o.inferred += 1;
    else o.unsupported += 1;
  }
  return o;
}

function countRoads(roads: SemanticMapValidationResult["roads"]): SemanticMapValidationSummary["roads"] {
  const o = {
    total: roads.length,
    verified: 0,
    inferred: 0,
    missing_tool: 0,
    unsupported: 0,
  };
  for (const r of roads) {
    if (r.validationStatus === "verified") o.verified += 1;
    else if (r.validationStatus === "inferred") o.inferred += 1;
    else if (r.validationStatus === "missing_tool") o.missing_tool += 1;
    else o.unsupported += 1;
  }
  return o;
}

export function validateMapDraft(args: {
  draft: SemanticMapDraft;
  inventory: SemanticSourceInventory;
}): SemanticMapValidationResult {
  const places = args.draft.places.map((p) =>
    validatePlaceDraft({
      draft: p,
      inventory: args.inventory,
      snapshotId: PLACEHOLDER_SNAPSHOT,
    })
  );
  const placeKeys = new Set(places.map((p) => p.placeKey));
  const verifiedPlace = new Map(places.map((p) => [p.placeKey, p.validationStatus === "verified"]));

  const roads = args.draft.roads.map((r) =>
    validateRoadDraft({
      draft: r,
      inventory: args.inventory,
      snapshotId: PLACEHOLDER_SNAPSHOT,
      placeKeys,
      fromPlaceVerified: verifiedPlace.get(r.fromPlaceKey) === true,
      toPlaceVerified: verifiedPlace.get(r.toPlaceKey) === true,
    })
  );

  const gaps: SemanticMapValidationResult["gaps"] = [];

  for (const r of roads) {
    if (r.validationStatus === "missing_tool") {
      gaps.push({
        gapType: "missing_tool_for_road",
        detail: { roadKey: r.roadKey, from: r.fromPlaceKey, to: r.toPlaceKey },
      });
    }
    if (r.validationStatus === "unsupported") {
      gaps.push({
        gapType: "unsupported_road",
        detail: { roadKey: r.roadKey, from: r.fromPlaceKey, to: r.toPlaceKey },
      });
    }
  }

  for (const p of places) {
    if (p.validationStatus === "unsupported") {
      gaps.push({
        gapType: "unsupported_place",
        detail: { placeKey: p.placeKey },
      });
    }
  }

  const summary: SemanticMapValidationSummary = {
    places: countPlaces(places),
    roads: countRoads(roads),
    gapsCount: gaps.length,
  };

  const passed = true;

  return {
    draftId: "",
    runId: null,
    passed,
    places,
    roads,
    summary,
    gaps,
  };
}
