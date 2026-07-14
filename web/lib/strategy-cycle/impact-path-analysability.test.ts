import { describe, expect, it } from "vitest";
import {
  allAnalysableMap,
  buildImpactPathAnalysabilityMap,
} from "@/lib/strategy-cycle/impact-path-analysability";
import { computeImpactPathSuggestions } from "@/lib/strategy-cycle/impact-path-suggestions";
import type { BuildImpactPathGraphInput } from "@/lib/strategy-cycle/impact-path-graph";

const ANALYSABLE_DESCRIPTION_FIXTURE =
  "Strategisches Problem mit klarer Wirkung auf Kosten und Qualität im Marktumfeld, inklusive messbarer Zielrichtung bis 2028.";

describe("impact-path-analysability", () => {
  const baseGraphInput = (): BuildImpactPathGraphInput => ({
    entries: [
      {
        id: "ae-1",
        title: "Analyse",
        description: ANALYSABLE_DESCRIPTION_FIXTURE,
      },
    ],
    challenges: [
      {
        id: "ch-1",
        title: "Herausforderung",
        description: ANALYSABLE_DESCRIPTION_FIXTURE,
        source_analysis_entry_id: "ae-1",
      },
    ],
    directions: [
      {
        id: "dir-1",
        title: "Stoßrichtung",
        description: ANALYSABLE_DESCRIPTION_FIXTURE,
      },
    ],
    objectives: [
      {
        id: "obj-1",
        title: "Ziel",
        description: ANALYSABLE_DESCRIPTION_FIXTURE,
        ai_clarity_score: 4,
      },
    ],
    challengeAnalysisEntries: [],
    challengeDirectionLinks: [
      { strategic_challenge_id: "ch-1", strategic_direction_id: "dir-1" },
    ],
    directionObjectiveLinks: [{ strategic_direction_id: "dir-1", objective_id: "obj-1" }],
    clusterMembers: [],
    correlationSummary: {
      objectives: [],
      challenges: [],
      cells: [],
      goodObjectivePercent: 0,
      topStrongAvgScore: 0,
      conflictPercent: 0,
      weakCells: [],
      strongCells: [],
      conflictCells: [],
      conflictCount: 0,
    },
    programMatrix: {
      directionRows: [],
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
    },
    pathLinkReviews: [],
    insights: {
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
    },
  });

  it("marks short descriptions as not analysable", () => {
    const map = buildImpactPathAnalysabilityMap({
      ...baseGraphInput(),
      challenges: [{ id: "ch-1", title: "Kurz", description: "zu kurz" }],
    });
    expect(map.get("ch-1")?.isAnalysable).toBe(false);
  });

  it("skips suggestions involving non-analysable nodes", () => {
    const suggestions = computeImpactPathSuggestions({
      entries: [],
      challenges: [{ id: "ch-1", title: "Kurz", description: "x" }],
      directions: [
        {
          id: "dir-1",
          title: "Stoßrichtung",
          description: ANALYSABLE_DESCRIPTION_FIXTURE,
        },
      ],
      objectives: [],
      challengeAnalysisEntries: [],
      clusterMembers: [],
      programMatrix: {
        directionRows: [
          {
            directionId: "dir-1",
            directionTitle: "Stoßrichtung",
            directionLifecycleLabel: "Aktiv",
            rowScoreSum: 0,
            linkedObjectives: [],
            cells: [
              {
                challengeId: "ch-1",
                directionId: "dir-1",
                challengeTitle: "Kurz",
                directionTitle: "Stoßrichtung",
                score: 80,
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
            objectiveCells: [],
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
        totalObjectives: 0,
      },
      insights: {
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
      },
      existingEdgeKeys: new Set(),
      analysabilityByNodeId: buildImpactPathAnalysabilityMap({
        ...baseGraphInput(),
        challenges: [{ id: "ch-1", title: "Kurz", description: "x" }],
      }),
    });

    expect(suggestions.some((s) => s.kind === "challenge_to_direction")).toBe(false);
  });
});
