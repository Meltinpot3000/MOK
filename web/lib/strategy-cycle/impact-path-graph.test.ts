import { describe, expect, it } from "vitest";
import { buildImpactPathGraph, buildImpactPathEdgeId } from "@/lib/strategy-cycle/impact-path-graph";
import type { CorrelationSummaryResult } from "@/lib/strategy-cycle/correlation";
import type { ProgramMatrixModel } from "@/lib/strategy-cycle/program-matrix";
import type { StrategicDesignInsightsResult } from "@/lib/strategy-cycle/strategic-design-insights";

const emptyCorrelation = (): CorrelationSummaryResult => ({
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
});

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

function minimalProgramMatrix(): ProgramMatrixModel {
  return {
    directionRows: [
      {
        directionId: "dir-1",
        directionTitle: "Direction A",
        directionLifecycleLabel: "Aktiv",
        rowScoreSum: 100,
        linkedObjectives: [],
        cells: [
          {
            challengeId: "ch-1",
            directionId: "dir-1",
            challengeTitle: "Challenge 1",
            directionTitle: "Direction A",
            score: 80,
            isGap: false,
            statusTier: "strong",
            linkedObjectives: [],
            objectiveCoverage: 0,
            isLinked: true,
            contributionWeight: 1,
            contributionLevel: "medium",
            overlapCount: 0,
            scoreExplanation: "Linked",
            isTopInRow: true,
          },
          {
            challengeId: "ch-2",
            directionId: "dir-1",
            challengeTitle: "Challenge 2",
            directionTitle: "Direction A",
            score: 40,
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
            objectiveTitle: "Objective 1",
            objectiveVersioning: null,
            directionTitle: "Direction A",
            score: 60,
            statusTier: "medium",
            isLinked: true,
            contributionWeight: 1,
            contributionLevel: "medium",
            scoreExplanation: "Linked",
            isTopInRow: true,
          },
        ],
      },
    ],
    challengeColumns: [],
    objectiveColumns: [],
    insights: {
      coveragePercent: 50,
      addressedChallenges: 1,
      totalChallenges: 2,
      redundancyHighChallengeCount: 0,
      matrixCriticalOverlapChallengeCount: 0,
    },
    totalObjectives: 1,
  };
}

describe("buildImpactPathGraph", () => {
  const analysableText =
    "Ausreichend lange strategische Beschreibung mit Kontext, Wirkung und Zielbild für die Analysefähigkeit im Wirkpfad.";

  const baseInput = {
    entries: [{ id: "ae-1", title: "Analyse Eintrag", description: analysableText }],
    challenges: [
      {
        id: "ch-1",
        title: "Challenge 1",
        description: analysableText,
        source_analysis_entry_id: "ae-1",
      },
      { id: "ch-2", title: "Challenge 2", description: analysableText },
    ],
    directions: [{ id: "dir-1", title: "Direction A", description: analysableText }],
    objectives: [{ id: "obj-1", title: "Objective 1", description: analysableText, ai_clarity_score: 4 }],
    challengeAnalysisEntries: [],
    challengeDirectionLinks: [
      { strategic_challenge_id: "ch-1", strategic_direction_id: "dir-1", contribution_level: "medium" },
    ],
    directionObjectiveLinks: [
      { strategic_direction_id: "dir-1", objective_id: "obj-1", contribution_level: "high" },
    ],
    clusterMembers: [],
    correlationSummary: emptyCorrelation(),
    programMatrix: minimalProgramMatrix(),
    pathLinkReviews: [],
    insights: emptyInsights(),
  };

  it("creates existing analysis→challenge edge with semantic passung score", () => {
    const graph = buildImpactPathGraph({
      ...baseInput,
      entries: [
        {
          id: "ae-1",
          title: "Digitalisierung und modulare Servicebausteine",
          description:
            "Standardisierte Servicebausteine erhoehen Wiederverwendbarkeit, Geschwindigkeit und Margenqualitaet.",
        },
      ],
      challenges: [
        {
          id: "ch-1",
          title: "Modulares Serviceportfolio aufbauen",
          description:
            "Wiederverwendbare Servicebausteine fuer schnellere Angebote und bessere Margen etablieren.",
          source_analysis_entry_id: "ae-1",
        },
        baseInput.challenges[1],
      ],
    });
    const edge = graph.edges.find((e) => e.kind === "analysis_to_challenge");
    expect(edge).toBeDefined();
    expect(edge?.score).toBeGreaterThan(0);
    expect(edge?.state).toBe("existing");
  });

  it("scores unrelated existing analysis→challenge links at 0", () => {
    const graph = buildImpactPathGraph({
      ...baseInput,
      entries: [
        {
          id: "ae-1",
          title: "Aufbau eines modularen Serviceportfolios",
          description:
            "Standardisierte Servicebausteine erhoehen Wiederverwendbarkeit, Geschwindigkeit und Margenqualitaet.",
        },
      ],
      challenges: [
        {
          id: "ch-1",
          title: "[Seed] Demo-Herausforderung (Matrix-Anker)",
          description: "Seed: eine Herausforderung fuer Challenge–Direction-Links aller Demo-Richtungen.",
          source_analysis_entry_id: "ae-1",
        },
        baseInput.challenges[1],
      ],
    });
    const edge = graph.edges.find((e) => e.kind === "analysis_to_challenge");
    expect(edge?.score).toBe(0);
    expect(edge?.status).toBe("unknown");
  });

  it("creates existing challenge→direction edge with contextual score 0–100", () => {
    const graph = buildImpactPathGraph(baseInput);
    const edge = graph.edges.find((e) => e.kind === "challenge_to_direction");
    expect(edge).toBeDefined();
    expect(edge?.score).toBeGreaterThanOrEqual(0);
    expect(edge?.score).toBeLessThanOrEqual(100);
    expect(edge?.state).toBe("existing");
  });

  it("creates existing direction→objective edge", () => {
    const graph = buildImpactPathGraph(baseInput);
    const edge = graph.edges.find((e) => e.kind === "direction_to_objective");
    expect(edge).toBeDefined();
    expect(edge?.score).toBeLessThanOrEqual(100);
    expect(edge?.state).toBe("existing");
  });

  it("derives status from normalized score", () => {
    const graph = buildImpactPathGraph(baseInput);
    for (const edge of graph.edges) {
      expect(edge.score).toBeGreaterThanOrEqual(0);
      expect(edge.score).toBeLessThanOrEqual(100);
      if (edge.score >= 70) expect(edge.status).toBe("green");
    }
  });

  it("hides rejected suggestions from active suggestions but keeps edge for filters", () => {
    const graph = buildImpactPathGraph({
      ...baseInput,
      insights: {
        ...emptyInsights(),
        unaddressedChallenges: [
          {
            challengeId: "ch-2",
            title: "Challenge 2",
            challengeScore: 4,
            coverage: 0,
            coverageBand: "none",
            explanationDe: "Ohne Stoßrichtung",
          },
        ],
      },
      pathLinkReviews: [
        {
          edge_kind: "challenge_to_direction",
          source_id: "ch-2",
          target_id: "dir-1",
          status: "rejected",
          suggestion_score: 50,
          note: "Nein",
        },
      ],
    });
    const rejected = graph.edges.find(
      (e) =>
        e.kind === "challenge_to_direction" &&
        e.sourceId === "ch-2" &&
        e.reviewStatus === "rejected"
    );
    expect(rejected).toBeDefined();
    expect(graph.kpis.openSuggestions).toBe(0);
  });

  it("computes full path score as minimum of edge scores", () => {
    const graph = buildImpactPathGraph(baseInput);
    const chain = graph.chains.find((c) => c.analysisEntryId === "ae-1");
    expect(chain).toBeDefined();
    if (!chain) return;
    const e1 = graph.edges.find((e) => e.id === chain.edgeIds[0])!;
    const e2 = graph.edges.find((e) => e.id === chain.edgeIds[1])!;
    const e3 = graph.edges.find((e) => e.id === chain.edgeIds[2])!;
    expect(chain.pathScore).toBe(Math.min(e1.score, e2.score, e3.score));
  });

  it("buildImpactPathEdgeId is stable", () => {
    expect(buildImpactPathEdgeId("analysis_to_challenge", "a", "b")).toBe(
      "analysis_to_challenge:a:b"
    );
  });
});
