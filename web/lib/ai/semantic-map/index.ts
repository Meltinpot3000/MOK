/**
 * Sentinel Semantic Map Discovery — öffentliche API.
 * Interne Module nicht importieren; nur aus diesem Barrel.
 */

export type {
  BuildCompactMapOptions,
  CompactSemanticMapForPlanner,
  EvaluateSemanticEvidenceCoverageInput,
  ExecutableSemanticMap,
  PlanRouteOptions,
  SemanticEvidenceCoverageResult,
  SemanticEvidenceRequirement,
  SemanticMapDraft,
  SemanticMapDraftResult,
  SemanticMapQuestionResolution,
  SemanticMapRunDiagnostics,
  SemanticMapSnapshot,
  SemanticMapValidationResult,
  SemanticMapValidationSummary,
  SemanticUsedSource,
} from "./types";

export { SEMANTIC_MAP_BLOCKED_CLAIMS } from "./types";

export {
  buildSemanticMapDraft,
  getActiveSemanticMap,
  inspectSemanticMap,
  publishSemanticMapSnapshot,
  resolveQuestionAgainstSemanticMap,
  validateSemanticMapDraft,
} from "./semantic-map-service";

export { buildCompactMapForPlanner } from "./runtime/build-compact-map-for-planner";
export { planRouteFromMap } from "./runtime/plan-route-from-map";
export type { PlanRouteFromMapResult } from "./runtime/plan-route-from-map";
export { buildSemanticMapRunDiagnostics } from "./runtime/build-semantic-map-run-diagnostics";
export { buildSemanticUsedSourcesFromToolCalls } from "./runtime/build-semantic-used-sources";
export { deriveEvidenceRequirementsFromResolution } from "./runtime/evidence-requirements-from-route";
export { evaluateCycleClaimConsistency } from "./runtime/evaluate-cycle-claim-consistency";
export type {
  CycleClaimConsistencyResult,
  EvaluateCycleClaimConsistencyInput,
} from "./runtime/evaluate-cycle-claim-consistency";
export {
  evaluateSemanticEvidenceCoverage,
  minimalRequirementsFromPlaceKeys,
  placeKeyToEvidenceSlots,
} from "./runtime/evaluate-semantic-evidence-coverage";
export { buildSemanticMapRuntimeDiagnostics } from "./diagnostics/semantic-map-diagnostics";
export type { SemanticMapRuntimeDiagnostics } from "./diagnostics/semantic-map-diagnostics";
