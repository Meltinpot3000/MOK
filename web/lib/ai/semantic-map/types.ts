import { z } from "zod";

export const SEMANTIC_MAP_DRAFT_SCHEMA_NAME = "semantic_map_draft_v1" as const;

export type SemanticMapRunStatus = "drafting" | "validating" | "completed" | "failed";

export type SemanticMapRun = {
  id: string;
  organizationId: string | null;
  triggeredByMembershipId: string | null;
  status: SemanticMapRunStatus;
  startedAt: string;
  completedAt: string | null;
  modelProvider: string | null;
  modelName: string | null;
  schemaHash: string | null;
  error: string | null;
};

export const placeEvidenceSourceSchema = z.enum([
  "table",
  "view",
  "function",
  "tool",
  "ui",
  "sample",
]);

export const placeEvidenceItemSchema = z.object({
  sourceType: placeEvidenceSourceSchema,
  sourceRef: z.string(),
});

export const roadEvidenceSourceSchema = z.enum([
  "foreign_key",
  "link_table",
  "function",
  "tool",
  "inferred",
]);

export const roadEvidenceItemSchema = z.object({
  sourceType: roadEvidenceSourceSchema,
  sourceRef: z.string(),
});

export const semanticMapPlaceDraftSchema = z.object({
  placeKey: z.string().min(1),
  canonicalName: z.string().min(1),
  domain: z.string(),
  businessMeaning: z.string(),
  descriptionForPlanner: z.string(),
  evidence: z.array(placeEvidenceItemSchema).min(1),
  confidence: z.number().min(0).max(1).optional(),
});

export const semanticMapRoadDraftSchema = z.object({
  roadKey: z.string().min(1),
  fromPlaceKey: z.string().min(1),
  toPlaceKey: z.string().min(1),
  businessMeaning: z.string(),
  relationType: z.string(),
  evidence: z.array(roadEvidenceItemSchema).min(1),
  confidence: z.number().min(0).max(1).optional(),
});

export const semanticMapSuggestedQuestionSchema = z.object({
  question: z.string(),
  relatedPlaceKeys: z.array(z.string()).optional(),
});

export const semanticMapGapDraftSchema = z.object({
  kind: z.string(),
  summary: z.string(),
  relatedPlaceKeys: z.array(z.string()).optional(),
});

export const semanticMapDraftLlmSchema = z.object({
  places: z.array(semanticMapPlaceDraftSchema),
  roads: z.array(semanticMapRoadDraftSchema),
  suggestedQuestions: z.array(semanticMapSuggestedQuestionSchema),
  gaps: z.array(semanticMapGapDraftSchema),
});

export type SemanticMapPlaceDraft = z.infer<typeof semanticMapPlaceDraftSchema>;
export type SemanticMapRoadDraft = z.infer<typeof semanticMapRoadDraftSchema>;
export type SemanticMapSuggestedQuestion = z.infer<typeof semanticMapSuggestedQuestionSchema>;
export type SemanticMapGapDraft = z.infer<typeof semanticMapGapDraftSchema>;
export type SemanticMapDraft = z.infer<typeof semanticMapDraftLlmSchema>;

export type PlaceValidationStatus = "verified" | "inferred" | "unsupported";
export type RoadValidationStatus =
  | "verified"
  | "inferred"
  | "unsupported"
  | "missing_tool";

export type SemanticMapPlace = {
  id: string;
  snapshotId: string;
  placeKey: string;
  canonicalName: string;
  domain: string;
  businessMeaning: string;
  descriptionForPlanner: string;
  evidence: Array<z.infer<typeof placeEvidenceItemSchema>>;
  validationStatus: PlaceValidationStatus;
  confidence: number;
};

export type SemanticMapRoad = {
  id: string;
  snapshotId: string;
  roadKey: string;
  fromPlaceKey: string;
  toPlaceKey: string;
  businessMeaning: string;
  relationType: string;
  evidence: Array<z.infer<typeof roadEvidenceItemSchema>>;
  validationStatus: RoadValidationStatus;
  confidence: number;
};

export type SemanticMapValidationSummary = {
  places: {
    total: number;
    verified: number;
    inferred: number;
    unsupported: number;
  };
  roads: {
    total: number;
    verified: number;
    inferred: number;
    missing_tool: number;
    unsupported: number;
  };
  gapsCount: number;
};

export type ExecutableSemanticMap = {
  snapshotId: string;
  draftId: string | null;
  runId: string | null;
  organizationId: string | null;
  generatedAt: string;
  modelProvider: string | null;
  modelName: string | null;
  validationSummary: SemanticMapValidationSummary;
  /** Alle Orte inkl. inferred/unsupported (Diagnose). */
  places: SemanticMapPlace[];
  /** Alle Straßen (Diagnose / Compact-Map-Hinweise). */
  roadsAll: SemanticMapRoad[];
  /** Standard: nur verified — ausführbar ohne Option. */
  roadsExecutableVerified: SemanticMapRoad[];
};

export type SemanticMapDraftResult = {
  runId: string;
  draftId: string;
  draft: SemanticMapDraft;
  inventorySummary: {
    tables: number;
    tools: number;
    uiRoutes: number;
    foreignKeys: number;
  };
  modelProvider: string | null;
  modelName: string | null;
  schemaHash: string | null;
};

export type SemanticMapValidationResult = {
  draftId: string;
  runId: string | null;
  passed: boolean;
  places: SemanticMapPlace[];
  roads: SemanticMapRoad[];
  summary: SemanticMapValidationSummary;
  gaps: Array<{ gapType: string; detail: Record<string, unknown> }>;
};

export type SemanticMapSnapshot = {
  id: string;
  runId: string | null;
  draftId: string | null;
  organizationId: string | null;
  isActive: boolean;
  generatedAt: string;
  validationSummary: SemanticMapValidationSummary;
  modelProvider: string | null;
  modelName: string | null;
};

export type CompactSemanticMapForPlanner = {
  places: Array<{
    placeKey: string;
    shortMeaning: string;
    domain: string;
    validationStatus: PlaceValidationStatus;
  }>;
  roadsVerified: Array<{
    roadKey: string;
    fromPlaceKey: string;
    toPlaceKey: string;
    relationType: string;
  }>;
  /** Nur Hinweise — nicht standardmäßig für ausführbare Routen. */
  roadsInferred: Array<{
    roadKey: string;
    fromPlaceKey: string;
    toPlaceKey: string;
    relationType: string;
  }>;
  gaps: Array<{ gapType: string; summary?: string }>;
  evidenceHints: Array<{ placeKey: string; refs: string[] }>;
  /** true, wenn für Routenplanung inferred-Kanten zugelassen wären. */
  inferredRoadsIncludedInCompact: boolean;
};

export const semanticMapQuestionResolutionSchema = z.object({
  interpretedIntent: z.string(),
  relevantPlaces: z.array(
    z.object({
      placeKey: z.string(),
      confidence: z.number().min(0).max(1),
      reasoningSummary: z.string(),
    })
  ),
  requiredRoads: z.array(
    z.object({
      roadKey: z.string(),
      required: z.boolean(),
      reasoningSummary: z.string(),
    })
  ),
  requiredOperations: z.array(z.string()),
  requiredEvidence: z.array(
    z.object({
      placeKey: z.string(),
      minObjects: z.number().int().min(0),
      reason: z.string(),
    })
  ),
  suggestedQueryClass: z.enum(["lookup", "ranking", "distribution", "composite", "unknown"]),
});

export type SemanticMapQuestionResolution = z.infer<typeof semanticMapQuestionResolutionSchema>;

export type SemanticEvidenceRequirement = {
  placeKey: string;
  minObjects: number;
  reason: string;
  severity: "hard" | "soft";
};

export type PlanRouteOptions = {
  /** Standard false: nur verified Roads als Kanten. */
  allowInferredRoads?: boolean;
};

export type BuildCompactMapOptions = {
  maxPlaces?: number;
  maxRoads?: number;
  /** inferred Roads im Compact-Map-Block (Planner-Hinweis), default true. */
  includeInferredRoadsInCompact?: boolean;
};

/** Vereinheitlichte Blocked-Claim-Codes (Evidence-/Answer-Gate). */
export const SEMANTIC_MAP_BLOCKED_CLAIMS = {
  challengeClaimWithoutEvidence: "challenge_claim_without_evidence",
  topChallengeWithoutChallengeEvidence: "top_challenge_without_challenge_evidence",
  initiativeClaimWithoutEvidence: "initiative_claim_without_evidence",
  currentCycleMismatch: "current_cycle_mismatch",
} as const;

export type SemanticUsedSource = {
  sourceType: "tool" | "place" | "table" | "view" | "function";
  sourceRef: string;
  placeKey?: string;
};

export type SemanticEvidenceCoverageResult = {
  status: "ok" | "partial" | "failed";
  missingEvidence: string[];
  answerAllowed: boolean;
  blockedClaims: string[];
};

export type EvaluateSemanticEvidenceCoverageInput = {
  requiredEvidence: SemanticEvidenceRequirement[];
  usedSources: SemanticUsedSource[];
  /** Wenn true: fehlende Challenge-Evidenz erzeugt zusätzlich top_challenge_without_challenge_evidence. */
  questionClaimsTopStrategicChallenge?: boolean;
};

/** Backend-/Smoke-Diagnostics für einen Sentinel-Run (keine Chat-Antwortblockade). */
export type SemanticMapRunDiagnostics = {
  enabled: boolean;
  resolutionStatus: "ok" | "no_active_map" | "failed" | "skipped";
  interpretedIntent?: string;
  relevantPlaces?: Array<{
    placeKey: string;
    confidence: number;
    reasoningSummary?: string;
  }>;
  requiredRoads?: Array<{
    roadKey: string;
    required: boolean;
    reasoningSummary?: string;
  }>;
  requiredOperations?: string[];
  requiredEvidence: SemanticEvidenceRequirement[];
  usedSources: SemanticUsedSource[];
  evidenceCoverage: SemanticEvidenceCoverageResult;
  cycleConsistency?: {
    ok: boolean;
    blockedClaims: string[];
  };
  executionReadiness:
    | "ready"
    | "missing_map"
    | "missing_evidence"
    | "missing_route"
    | "failed";
  /** true: nur Diagnose, keine harte Blockade der produktiven Chat-Antwort (MVP). */
  diagnosticsOnly: true;
};
