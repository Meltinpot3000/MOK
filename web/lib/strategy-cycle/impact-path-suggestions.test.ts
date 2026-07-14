import { describe, expect, it } from "vitest";
import { allAnalysableMap } from "@/lib/strategy-cycle/impact-path-analysability";
import {
  computeImpactPathSuggestions,
  IMPACT_PATH_SUGGESTION_MIN_SCORE,
} from "@/lib/strategy-cycle/impact-path-suggestions";
import type { ProgramMatrixModel } from "@/lib/strategy-cycle/program-matrix";
import type { StrategicDesignInsightsResult } from "@/lib/strategy-cycle/strategic-design-insights";

const emptyInsights = (): StrategicDesignInsightsResult => ({
  topDirections: [],
  unaddressedChallenges: [],
  limitedChallengeBackingObjectives: [],
  conflicts: [],
  kpis: {
    coverageChallengeShare: null,
    criticalGaps: 0,
    focusIndex: null,
    objectiveAlignmentMaturity: null,
    topDirectionsStrongObjectiveLinkShare: null,
    averageObjectiveSupport: null,
    correlationConflictCount: 0,
    coverageExplanationDe: "",
    focusExplanationDe: "",
    objectiveSupportExplanationDe: "",
  },
});

function gapProgramMatrix(): ProgramMatrixModel {
  return {
    directionRows: [
      {
        directionId: "dir-1",
        directionTitle: "Dir",
        directionLifecycleLabel: "Aktiv",
        rowScoreSum: 0,
        linkedObjectives: [],
        cells: [
          {
            challengeId: "ch-1",
            directionId: "dir-1",
            challengeTitle: "Ch",
            directionTitle: "Dir",
            score: 55,
            isGap: true,
            statusTier: "gap",
            linkedObjectives: [],
            objectiveCoverage: 0,
            isLinked: false,
            contributionWeight: 0,
            contributionLevel: null,
            overlapCount: 0,
            scoreExplanation: "Gap",
            isTopInRow: false,
          },
        ],
        objectiveCells: [
          {
            objectiveId: "obj-1",
            directionId: "dir-1",
            objectiveTitle: "Obj",
            objectiveVersioning: null,
            directionTitle: "Dir",
            score: 50,
            statusTier: "medium",
            isLinked: false,
            contributionWeight: 0,
            contributionLevel: null,
            scoreExplanation: "Gap obj",
            isTopInRow: false,
          },
        ],
      },
    ],
    challengeColumns: [],
    objectiveColumns: [],
    insights: {
      coveragePercent: 0,
      addressedChallenges: 0,
      totalChallenges: 1,
      redundancyHighChallengeCount: 0,
      matrixCriticalOverlapChallengeCount: 0,
    },
    totalObjectives: 1,
  };
}

describe("computeImpactPathSuggestions", () => {
  it("does not show suggestions below min score after normalization", () => {
    const suggestions = computeImpactPathSuggestions({
      entries: [{ id: "ae-1", title: "X", quality_score: 1 }],
      challenges: [{ id: "ch-1", title: "Y" }],
      directions: [],
      objectives: [],
      challengeAnalysisEntries: [],
      clusterMembers: [],
      programMatrix: {
        ...gapProgramMatrix(),
        directionRows: [],
      },
      insights: emptyInsights(),
      existingEdgeKeys: new Set(),
      analysabilityByNodeId: allAnalysableMap(["ae-1", "ch-1"]),
    });
    const low = suggestions.filter((s) => s.score < IMPACT_PATH_SUGGESTION_MIN_SCORE);
    expect(low.length).toBe(0);
  });

  it("suggests challenge→direction from program matrix gap", () => {
    const suggestions = computeImpactPathSuggestions({
      entries: [],
      challenges: [{ id: "ch-1", title: "Challenge" }],
      directions: [{ id: "dir-1", title: "Direction" }],
      objectives: [],
      challengeAnalysisEntries: [],
      clusterMembers: [],
      programMatrix: gapProgramMatrix(),
      insights: {
        ...emptyInsights(),
        unaddressedChallenges: [
          {
            challengeId: "ch-1",
            title: "Challenge",
            challengeScore: 4,
            coverage: 0,
            coverageBand: "none",
            explanationDe: "Ohne Stoßrichtung",
          },
        ],
      },
      existingEdgeKeys: new Set(),
      analysabilityByNodeId: allAnalysableMap(["ch-1", "dir-1"]),
    });
    const edge = suggestions.find((s) => s.kind === "challenge_to_direction");
    expect(edge).toBeDefined();
    expect(edge?.rawScore).toBeGreaterThanOrEqual(IMPACT_PATH_SUGGESTION_MIN_SCORE);
  });

  it("suggests direction→objective gap cell", () => {
    const suggestions = computeImpactPathSuggestions({
      entries: [],
      challenges: [{ id: "ch-1", title: "Ch" }],
      directions: [{ id: "dir-1", title: "Dir" }],
      objectives: [{ id: "obj-1", title: "Obj" }],
      challengeAnalysisEntries: [],
      clusterMembers: [],
      programMatrix: {
        ...gapProgramMatrix(),
        directionRows: [
          {
            ...gapProgramMatrix().directionRows[0],
            cells: [
              {
                ...gapProgramMatrix().directionRows[0].cells[0],
                isLinked: true,
                isGap: false,
              },
            ],
          },
        ],
      },
      insights: emptyInsights(),
      existingEdgeKeys: new Set(),
      analysabilityByNodeId: allAnalysableMap(["ch-1", "dir-1", "obj-1"]),
    });
    const edge = suggestions.find((s) => s.kind === "direction_to_objective");
    expect(edge).toBeDefined();
  });

  it("suggests analysis→challenge for unlinked entry", () => {
    const suggestions = computeImpactPathSuggestions({
      entries: [{ id: "ae-1", title: "Digitalisierung Markt", quality_score: 4 }],
      challenges: [{ id: "ch-1", title: "Digitalisierung Herausforderung" }],
      directions: [],
      objectives: [],
      challengeAnalysisEntries: [],
      clusterMembers: [],
      programMatrix: gapProgramMatrix(),
      insights: emptyInsights(),
      existingEdgeKeys: new Set(),
      analysabilityByNodeId: allAnalysableMap(["ae-1", "ch-1"]),
    });
    const edge = suggestions.find((s) => s.kind === "analysis_to_challenge");
    expect(edge).toBeDefined();
  });
});
