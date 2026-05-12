import type {
  ExecutableSemanticMap,
  SemanticMapPlace,
  SemanticMapRoad,
  SemanticMapValidationSummary,
} from "../types";

function mapPlaceRow(row: Record<string, unknown>, snapshotId: string): SemanticMapPlace {
  return {
    id: row.id as string,
    snapshotId,
    placeKey: row.place_key as string,
    canonicalName: row.canonical_name as string,
    domain: row.domain as string,
    businessMeaning: row.business_meaning as string,
    descriptionForPlanner: row.description_for_planner as string,
    evidence: (row.evidence as SemanticMapPlace["evidence"]) ?? [],
    validationStatus: row.validation_status as SemanticMapPlace["validationStatus"],
    confidence: Number(row.confidence ?? 0),
  };
}

function mapRoadRow(row: Record<string, unknown>, snapshotId: string): SemanticMapRoad {
  return {
    id: row.id as string,
    snapshotId,
    roadKey: row.road_key as string,
    fromPlaceKey: row.from_place_key as string,
    toPlaceKey: row.to_place_key as string,
    businessMeaning: row.business_meaning as string,
    relationType: row.relation_type as string,
    evidence: (row.evidence as SemanticMapRoad["evidence"]) ?? [],
    validationStatus: row.validation_status as SemanticMapRoad["validationStatus"],
    confidence: Number(row.confidence ?? 0),
  };
}

export function toExecutableSemanticMap(args: {
  snapshot: Record<string, unknown>;
  placeRows: Record<string, unknown>[];
  roadRows: Record<string, unknown>[];
}): ExecutableSemanticMap {
  const snapshotId = args.snapshot.id as string;
  const places = args.placeRows.map((r) => mapPlaceRow(r, snapshotId));
  const roadsAll = args.roadRows.map((r) => mapRoadRow(r, snapshotId));
  const roadsExecutableVerified = roadsAll.filter((r) => r.validationStatus === "verified");
  const validationSummary =
    (args.snapshot.validation_summary as SemanticMapValidationSummary) ??
    ({
      places: { total: 0, verified: 0, inferred: 0, unsupported: 0 },
      roads: {
        total: 0,
        verified: 0,
        inferred: 0,
        missing_tool: 0,
        unsupported: 0,
      },
      gapsCount: 0,
    } satisfies SemanticMapValidationSummary);

  return {
    snapshotId,
    draftId: (args.snapshot.draft_id as string | null) ?? null,
    runId: (args.snapshot.run_id as string | null) ?? null,
    organizationId: (args.snapshot.organization_id as string | null) ?? null,
    generatedAt: args.snapshot.generated_at as string,
    modelProvider: (args.snapshot.model_provider as string | null) ?? null,
    modelName: (args.snapshot.model_name as string | null) ?? null,
    validationSummary,
    places,
    roadsAll,
    roadsExecutableVerified,
  };
}
