import type { SemanticSourceInventory } from "./inventory/inventory-types";
import { toExecutableSemanticMap } from "./runtime/map-row-mappers";
import type { ExecutableSemanticMap, SemanticMapDraft, SemanticMapPlace, SemanticMapRoad } from "./types";
import { validateMapDraft } from "./validation/validate-map-draft";

/** Findet einen Place anhand eines Ausschnitts von `businessMeaning` oder `canonicalName` (Tests). */
export function findPlaceByMeaning(
  places: SemanticMapPlace[],
  needle: string
): SemanticMapPlace | undefined {
  const n = needle.trim().toLowerCase();
  return places.find(
    (p) =>
      p.businessMeaning.toLowerCase().includes(n) || p.canonicalName.toLowerCase().includes(n)
  );
}

export function miniExecutableFromValidated(
  places: SemanticMapPlace[],
  roads: SemanticMapRoad[]
): ExecutableSemanticMap {
  const snapshotId = "11111111-1111-4111-8111-111111111111";
  const withSnap = places.map((p) => ({ ...p, snapshotId }));
  const withSnapR = roads.map((r) => ({ ...r, snapshotId }));
  const summary = {
    places: {
      total: withSnap.length,
      verified: withSnap.filter((x) => x.validationStatus === "verified").length,
      inferred: withSnap.filter((x) => x.validationStatus === "inferred").length,
      unsupported: withSnap.filter((x) => x.validationStatus === "unsupported").length,
    },
    roads: {
      total: withSnapR.length,
      verified: withSnapR.filter((x) => x.validationStatus === "verified").length,
      inferred: withSnapR.filter((x) => x.validationStatus === "inferred").length,
      missing_tool: withSnapR.filter((x) => x.validationStatus === "missing_tool").length,
      unsupported: withSnapR.filter((x) => x.validationStatus === "unsupported").length,
    },
    gapsCount: 0,
  };
  const placeRows = withSnap.map((p) => ({
    id: p.id,
    snapshot_id: p.snapshotId,
    place_key: p.placeKey,
    canonical_name: p.canonicalName,
    domain: p.domain,
    business_meaning: p.businessMeaning,
    description_for_planner: p.descriptionForPlanner,
    evidence: p.evidence,
    validation_status: p.validationStatus,
    confidence: p.confidence,
  }));
  const roadRows = withSnapR.map((r) => ({
    id: r.id,
    snapshot_id: r.snapshotId,
    road_key: r.roadKey,
    from_place_key: r.fromPlaceKey,
    to_place_key: r.toPlaceKey,
    business_meaning: r.businessMeaning,
    relation_type: r.relationType,
    evidence: r.evidence,
    validation_status: r.validationStatus,
    confidence: r.confidence,
  }));
  return toExecutableSemanticMap({
    snapshot: {
      id: snapshotId,
      run_id: null,
      draft_id: null,
      organization_id: null,
      is_active: true,
      generated_at: new Date().toISOString(),
      validation_summary: summary,
      model_provider: "fixture",
      model_name: "fixture",
    },
    placeRows: placeRows as unknown as Record<string, unknown>[],
    roadRows: roadRows as unknown as Record<string, unknown>[],
  });
}

export function validateDraftToExecutable(input: {
  draft: SemanticMapDraft;
  inventory: SemanticSourceInventory;
}): { places: SemanticMapPlace[]; roads: SemanticMapRoad[]; map: ExecutableSemanticMap } {
  const v = validateMapDraft({ draft: input.draft, inventory: input.inventory });
  const map = miniExecutableFromValidated(v.places, v.roads);
  return { places: v.places, roads: v.roads, map };
}
