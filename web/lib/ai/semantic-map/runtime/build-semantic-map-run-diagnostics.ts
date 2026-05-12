import { mockResolveQuestionForTests } from "../__fixtures__/mock-resolve-question";
import type {
  ExecutableSemanticMap,
  SemanticMapQuestionResolution,
  SemanticMapRunDiagnostics,
} from "../types";
import { deriveEvidenceRequirementsFromResolution } from "./evidence-requirements-from-route";
import { evaluateCycleClaimConsistency } from "./evaluate-cycle-claim-consistency";
import { evaluateSemanticEvidenceCoverage } from "./evaluate-semantic-evidence-coverage";
import { buildSemanticUsedSourcesFromToolCalls } from "./build-semantic-used-sources";
import { planRouteFromMap } from "./plan-route-from-map";

function inferQuestionClaimsTopStrategicChallenge(question: string): boolean {
  const q = question.toLowerCase();
  const superlative =
    /grösste|groesste|grö(s|ß)sste|biggest|wichtigste|haupt(säch)?lich|top[\s-]|welches ist die/.test(q);
  const topic =
    /challenge|herausforderung|brennpunkt|engpass|strategisch|strategic/.test(q);
  return superlative && topic;
}

function emptyCoverage(): SemanticMapRunDiagnostics["evidenceCoverage"] {
  return {
    status: "failed",
    missingEvidence: [],
    answerAllowed: false,
    blockedClaims: [],
  };
}

function resolveRequiredRoads(
  map: ExecutableSemanticMap,
  resolution: SemanticMapQuestionResolution
): boolean {
  for (const rr of resolution.requiredRoads) {
    if (!rr.required) continue;
    const road = map.roadsAll.find((r) => r.roadKey === rr.roadKey);
    if (!road || road.validationStatus !== "verified") return false;
    const route = planRouteFromMap({
      map,
      fromPlaceKey: road.fromPlaceKey,
      toPlaceKey: road.toPlaceKey,
      options: { allowInferredRoads: false },
    });
    if (!route.found) return false;
  }
  return true;
}

/**
 * Bündelt Resolution, Evidence-Anforderungen, Used-Sources aus Tool-Calls, Coverage und Zyklus-Check.
 * `diagnosticsOnly` bleibt true (MVP: keine harte Chat-Blockade hier).
 */
export async function buildSemanticMapRunDiagnostics(input: {
  question: string;
  toolCalls: Array<{
    toolName: string;
    status?: string;
    resultSummary?: unknown;
    sources?: unknown;
  }>;
  map?: ExecutableSemanticMap | null;
  resolution?: SemanticMapQuestionResolution | null;
  selectedCurrentCycleId?: string | null;
  answerClaimedCycleIds?: string[];
  useMockResolver?: boolean;
}): Promise<SemanticMapRunDiagnostics> {
  const diagnosticsOnly = true as const;
  const useMock = input.useMockResolver !== false;

  if (!input.map) {
    return {
      enabled: false,
      resolutionStatus: "no_active_map",
      requiredEvidence: [],
      usedSources: buildSemanticUsedSourcesFromToolCalls({ toolCalls: input.toolCalls }),
      evidenceCoverage: emptyCoverage(),
      executionReadiness: "missing_map",
      diagnosticsOnly,
    };
  }

  let resolution: SemanticMapQuestionResolution | null = input.resolution ?? null;
  let resolutionStatus: SemanticMapRunDiagnostics["resolutionStatus"] = "ok";

  if (!resolution) {
    if (useMock) {
      resolution = mockResolveQuestionForTests();
    } else {
      resolutionStatus = "skipped";
      resolution = null;
    }
  }

  if (!resolution) {
    const usedSources = buildSemanticUsedSourcesFromToolCalls({ toolCalls: input.toolCalls });
    return {
      enabled: true,
      resolutionStatus,
      requiredEvidence: [],
      usedSources,
      evidenceCoverage: emptyCoverage(),
      executionReadiness: resolutionStatus === "skipped" ? "failed" : "failed",
      diagnosticsOnly,
    };
  }

  const topChallenge = inferQuestionClaimsTopStrategicChallenge(input.question);
  const requiredEvidence = deriveEvidenceRequirementsFromResolution({
    resolution,
    map: input.map,
  });
  const usedSources = buildSemanticUsedSourcesFromToolCalls({ toolCalls: input.toolCalls });
  const evidenceCoverage = evaluateSemanticEvidenceCoverage({
    requiredEvidence,
    usedSources,
    questionClaimsTopStrategicChallenge: topChallenge,
  });

  let cycleConsistency: SemanticMapRunDiagnostics["cycleConsistency"] | undefined;
  if (
    input.selectedCurrentCycleId != null &&
    input.selectedCurrentCycleId !== "" &&
    input.answerClaimedCycleIds?.length
  ) {
    cycleConsistency = evaluateCycleClaimConsistency({
      selectedCurrentCycleId: input.selectedCurrentCycleId,
      answerClaimedCycleIds: input.answerClaimedCycleIds,
    });
  }

  let executionReadiness: SemanticMapRunDiagnostics["executionReadiness"] = "ready";
  if (!evidenceCoverage.answerAllowed) {
    executionReadiness = "missing_evidence";
  } else if (!resolveRequiredRoads(input.map, resolution)) {
    executionReadiness = "missing_route";
  } else if (cycleConsistency && !cycleConsistency.ok) {
    executionReadiness = "failed";
  }

  return {
    enabled: true,
    resolutionStatus,
    interpretedIntent: resolution.interpretedIntent,
    relevantPlaces: resolution.relevantPlaces,
    requiredRoads: resolution.requiredRoads,
    requiredOperations: resolution.requiredOperations,
    requiredEvidence,
    usedSources,
    evidenceCoverage,
    cycleConsistency,
    executionReadiness,
    diagnosticsOnly,
  };
}
