import { describe, expect, it } from "vitest";
import { buildDesignQualityConnectionReview } from "@/lib/strategy-cycle/design-quality-connection-review";
import type { DesignReadinessSnapshotResult } from "@/lib/strategy-cycle/design-readiness-snapshot";
import type { StrategicDesignInsightsResult } from "@/lib/strategy-cycle/strategic-design-insights";

function emptySnapshot(): DesignReadinessSnapshotResult {
  return {
    overall: {
      readinessScore: null,
      readinessBand: "unknown",
      openReviewHintsCount: 0,
      challengeReadinessScore: null,
      challengeReadinessBand: "unknown",
      directionReadinessScore: null,
      directionReadinessBand: "unknown",
    },
    flow: {
      analysis: {
        total: 0,
        linkedToActiveChallenges: 0,
        coveragePct: null,
        priorityAOpenCount: 0,
        status: "unknown",
        hint: "",
      },
      challenges: {
        total: 0,
        readinessRelevant: 0,
        lifecycleCounts: { active: 0, approved: 0, draft: 0, paused: 0, retired: 0 },
        analysisBasedCount: 0,
        directlySetCount: 0,
        withoutAnalysisBasisCount: 0,
        withDirectionCount: 0,
        directionResponsePct: null,
        status: "unknown",
        hint: "",
      },
      directions: {
        total: 0,
        eligible: 0,
        lifecycleCounts: { active: 0, approved: 0, draft: 0, paused: 0, retired: 0 },
        challengeCoveragePct: null,
        challengesCoveredCount: 0,
        challengesCoverageTotal: 0,
        objectiveCoveragePct: null,
        status: "unknown",
        hint: "",
      },
      objectives: {
        totalEligible: 0,
        coveredByEligibleDirections: 0,
        coveragePct: null,
        status: "unknown",
        hint: "",
      },
    },
    context: {
      challengesFocus: {
        industries: { covered: 0, total: 0, percentage: null, status: "unknown", label: "", hint: "" },
        businessModels: { covered: 0, total: 0, percentage: null, status: "unknown", label: "", hint: "" },
      },
      directionsFocus: {
        industries: { covered: 0, total: 0, percentage: null, status: "unknown", label: "", hint: "" },
        businessModels: { covered: 0, total: 0, percentage: null, status: "unknown", label: "", hint: "" },
      },
    },
    contextDistributions: {
      challengesFocus: { industries: { totalAssignments: 0, activeAssignments: 0, inactiveAssignments: 0, items: [], emptyHint: null }, businessModels: { totalAssignments: 0, activeAssignments: 0, inactiveAssignments: 0, items: [], emptyHint: null } },
      directionsFocus: { industries: { totalAssignments: 0, activeAssignments: 0, inactiveAssignments: 0, items: [], emptyHint: null }, businessModels: { totalAssignments: 0, activeAssignments: 0, inactiveAssignments: 0, items: [], emptyHint: null } },
    },
    focusDetails: {
      challenges: { title: "", readinessBand: "unknown", kpis: [], finding: "", reviewFocus: "", actions: [] },
      directions: { title: "", readinessBand: "unknown", kpis: [], finding: "", reviewFocus: "", actions: [] },
    },
  };
}

function emptyInsights(): StrategicDesignInsightsResult {
  return {
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
  };
}

describe("buildDesignQualityConnectionReview", () => {
  it("places unsupported_objective in missing connections and correlation_weak in questionable", () => {
    const insights: StrategicDesignInsightsResult = {
      ...emptyInsights(),
      conflicts: [
        {
          type: "unsupported_objective",
          objectiveId: "o1",
          objectiveTitle: "Ziel A",
          explanationDe: "Schwache Stoßrichtungsunterstützung.",
        },
        {
          type: "correlation_weak",
          challengeId: "c1",
          objectiveId: "o1",
          challengeTitle: "Herausforderung A",
          objectiveTitle: "Ziel A",
          score: 40,
          explanationDe: "Passungshinweis (Herausforderung → Ziel): schwache oder unsichere Übereinstimmung im Modell (Score 40).",
        },
      ],
    };

    const result = buildDesignQualityConnectionReview({
      workspace: {
        challenges: [],
        directions: [],
        objectives: [],
        analysisItems: [],
        challengeAnalysisLinks: [],
        challengeDirectionLinks: [],
        directionObjectiveLinks: [],
      },
      insights,
      readinessSnapshot: emptySnapshot(),
      conflictCells: [],
    });

    expect(result.missingConnections.some((i) => i.id.includes("objective-support"))).toBe(true);
    expect(result.questionableConnections.some((i) => i.subtypeLabelDe === "Herausforderung → Ziel")).toBe(
      true
    );
  });

  it("aggregates context coverage into at most two checkpoints", () => {
    const snapshot = emptySnapshot();
    snapshot.context.challengesFocus.industries = {
      covered: 1,
      total: 5,
      percentage: 20,
      status: "weak",
      label: "",
      hint: "",
    };
    snapshot.context.directionsFocus.businessModels = {
      covered: 0,
      total: 4,
      percentage: 0,
      status: "weak",
      label: "",
      hint: "",
    };

    const result = buildDesignQualityConnectionReview({
      workspace: {
        challenges: [],
        directions: [],
        objectives: [],
        analysisItems: [],
        challengeAnalysisLinks: [],
        challengeDirectionLinks: [],
        directionObjectiveLinks: [],
      },
      insights: emptyInsights(),
      readinessSnapshot: snapshot,
      conflictCells: [],
    });

    const contextItems = result.missingConnections.filter((i) => i.objectTypeDe === "Kontext");
    expect(contextItems.length).toBeLessThanOrEqual(2);
    expect(contextItems.every((i) => i.titleDe.includes("Industrie- und Geschäftsmodellkontext"))).toBe(
      true
    );
  });

  it("lists insufficient description before connection issues in category order", () => {
    const result = buildDesignQualityConnectionReview({
      workspace: {
        challenges: [{ id: "c1", title: "Risiko", description: "" }],
        directions: [],
        objectives: [],
        analysisItems: [],
        challengeAnalysisLinks: [],
        challengeDirectionLinks: [],
        directionObjectiveLinks: [],
      },
      insights: {
        ...emptyInsights(),
        conflicts: [
          {
            type: "correlation_weak",
            challengeId: "c1",
            objectiveId: "o1",
            challengeTitle: "Risiko",
            objectiveTitle: "Ziel",
            score: 30,
            explanationDe: "Passungshinweis.",
          },
        ],
      },
      readinessSnapshot: emptySnapshot(),
      conflictCells: [],
    });

    expect(result.insufficientDescription.length).toBeGreaterThan(0);
    expect(result.insufficientDescription[0]?.severity).toBe("high");
    expect(result.summary.total).toBe(
      result.insufficientDescription.length +
        result.missingConnections.length +
        result.questionableConnections.length +
        result.professionalOverrides.length
    );
  });

  it("highlights overrides without note", () => {
    const result = buildDesignQualityConnectionReview({
      workspace: {
        challenges: [],
        directions: [],
        objectives: [],
        analysisItems: [],
        challengeAnalysisLinks: [],
        challengeDirectionLinks: [],
        directionObjectiveLinks: [],
      },
      insights: emptyInsights(),
      readinessSnapshot: emptySnapshot(),
      conflictCells: [
        {
          key: "k1",
          cellKey: "c:o",
          challengeId: "c1",
          objectiveId: "o1",
          challengeTitle: "Herausforderung A",
          objectiveTitle: "Ziel A",
          directionId: "d1",
          directionTitle: "Stoßrichtung A",
          autoScore: 70,
          autoStatus: "green",
          effectiveStatus: "red",
          overrideNote: null,
        },
      ],
    });

    expect(result.professionalOverrides[0]?.subtypeLabelDe).toBe("Ohne Begründung");
    expect(result.professionalOverrides[0]?.severity).toBe("high");
  });
});
