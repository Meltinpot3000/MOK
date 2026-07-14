import { describe, expect, it } from "vitest";
import {
  buildLinkDensityModels,
  buildStrategyCycleActionItems,
  buildStrategyCycleDashboardModel,
  challengeLinkBucketStatus,
  evaluateAnalysisMaturity,
  evaluateChallengeAnchoringStatus,
  evaluateCriticalGapsStatus,
  evaluateFocusConcentrationStatus,
  evaluateObjectiveReadiness,
  evaluateObjectiveSupportStatus,
  evaluateStrategyCycleReadiness,
  interpretDesignKpis,
  linkCountToBucketKey,
  objectiveLinkBucketStatus,
} from "@/lib/strategy-cycle/strategy-cycle-dashboard-insights";
import type { StrategicDesignKpis } from "@/lib/strategy-cycle/strategic-design-insights";

function baseKpis(overrides: Partial<StrategicDesignKpis> = {}): StrategicDesignKpis {
  return {
    coverageChallengeShare: 89,
    criticalGaps: 0,
    focusIndex: 0.27,
    objectiveAlignmentMaturity: 0.25,
    topDirectionsStrongObjectiveLinkShare: null,
    averageObjectiveSupport: null,
    correlationConflictCount: 0,
    coverageExplanationDe: "",
    focusExplanationDe: "",
    objectiveSupportExplanationDe: "",
    ...overrides,
  };
}

function emptyAnalysisSummary() {
  return {
    total: 0,
    qualityHigh: 0,
    qualityMedium: 0,
    qualityLow: 0,
    inChallengesUnique: 0,
    onlyAnalysis: 0,
    directEntryCount: 0,
    clusterOnlyEntryCount: 0,
    bothDirectAndClusterCount: 0,
    directOnlyEntryCount: 0,
  };
}

function emptyLinkDensityEntities() {
  return {
    objectives: [],
    challenges: [],
    directions: [],
    directionObjectiveLinks: [],
    challengeDirectionLinks: [],
  };
}

function sampleLinkDensityEntities() {
  return {
    objectives: [
      { id: "o0", label: "Ziel ohne Links" },
      { id: "o1", label: "Ziel mit 1 Link" },
      { id: "o2", label: "Ziel mit 2 Links" },
      { id: "o3", label: "Ziel mit 3 Links" },
      { id: "o4", label: "Ziel mit 5 Links" },
    ],
    challenges: [
      { id: "c0", label: "Challenge ohne Links" },
      { id: "c1", label: "Challenge mit 1 Link" },
      { id: "c2", label: "Challenge mit 2 Links" },
      { id: "c5", label: "Challenge mit 5 Links" },
    ],
    directions: [
      { id: "d1", label: "Stoßrichtung 1" },
      { id: "d2", label: "Stoßrichtung 2" },
      { id: "d3", label: "Stoßrichtung 3" },
      { id: "d4", label: "Stoßrichtung 4" },
      { id: "d5", label: "Stoßrichtung 5" },
    ],
    directionObjectiveLinks: [
      { objective_id: "o1", strategic_direction_id: "d1" },
      { objective_id: "o2", strategic_direction_id: "d1" },
      { objective_id: "o2", strategic_direction_id: "d2" },
      { objective_id: "o3", strategic_direction_id: "d1" },
      { objective_id: "o3", strategic_direction_id: "d2" },
      { objective_id: "o3", strategic_direction_id: "d3" },
      { objective_id: "o4", strategic_direction_id: "d1" },
      { objective_id: "o4", strategic_direction_id: "d2" },
      { objective_id: "o4", strategic_direction_id: "d3" },
      { objective_id: "o4", strategic_direction_id: "d4" },
      { objective_id: "o4", strategic_direction_id: "d5" },
    ],
    challengeDirectionLinks: [
      { strategic_challenge_id: "c1", strategic_direction_id: "d1" },
      { strategic_challenge_id: "c2", strategic_direction_id: "d1" },
      { strategic_challenge_id: "c2", strategic_direction_id: "d2" },
      { strategic_challenge_id: "c5", strategic_direction_id: "d1" },
      { strategic_challenge_id: "c5", strategic_direction_id: "d2" },
      { strategic_challenge_id: "c5", strategic_direction_id: "d3" },
      { strategic_challenge_id: "c5", strategic_direction_id: "d4" },
      { strategic_challenge_id: "c5", strategic_direction_id: "d5" },
    ],
  };
}

function goodLinkDensityEntities() {
  return {
    objectives: [{ id: "o1", label: "Ziel A" }],
    challenges: [{ id: "c1", label: "Challenge A" }],
    directions: [
      { id: "d1", label: "Dir 1" },
      { id: "d2", label: "Dir 2" },
    ],
    directionObjectiveLinks: [
      { objective_id: "o1", strategic_direction_id: "d1" },
      { objective_id: "o1", strategic_direction_id: "d2" },
    ],
    challengeDirectionLinks: [
      { strategic_challenge_id: "c1", strategic_direction_id: "d1" },
      { strategic_challenge_id: "c1", strategic_direction_id: "d2" },
    ],
  };
}

describe("design KPI thresholds", () => {
  it("challenge anchoring 79/80", () => {
    expect(evaluateChallengeAnchoringStatus(79)).toBe("warning");
    expect(evaluateChallengeAnchoringStatus(80)).toBe("good");
    expect(evaluateChallengeAnchoringStatus(49)).toBe("critical");
    expect(evaluateChallengeAnchoringStatus(50)).toBe("warning");
  });

  it("critical gaps 0, 1, 2, 3", () => {
    expect(evaluateCriticalGapsStatus(0)).toBe("good");
    expect(evaluateCriticalGapsStatus(1)).toBe("warning");
    expect(evaluateCriticalGapsStatus(2)).toBe("warning");
    expect(evaluateCriticalGapsStatus(3)).toBe("critical");
  });

  it("focus concentration 39/40 and 24/25", () => {
    expect(evaluateFocusConcentrationStatus(39)).toBe("warning");
    expect(evaluateFocusConcentrationStatus(40)).toBe("good");
    expect(evaluateFocusConcentrationStatus(24)).toBe("critical");
    expect(evaluateFocusConcentrationStatus(25)).toBe("warning");
  });

  it("objective support 69/70 and 39/40", () => {
    expect(evaluateObjectiveSupportStatus(69)).toBe("warning");
    expect(evaluateObjectiveSupportStatus(70)).toBe("good");
    expect(evaluateObjectiveSupportStatus(39)).toBe("critical");
    expect(evaluateObjectiveSupportStatus(40)).toBe("warning");
  });
});

describe("null fallbacks", () => {
  it("null produces unknown and no false good", () => {
    const kpis = interpretDesignKpis(
      baseKpis({
        coverageChallengeShare: null,
        focusIndex: null,
        objectiveAlignmentMaturity: null,
      })
    );
    expect(kpis.challengeAnchoring.status).toBe("unknown");
    expect(kpis.challengeAnchoring.displayValue).toBe("—");
    expect(kpis.challengeAnchoring.status).not.toBe("good");
    expect(kpis.focusConcentration.status).toBe("unknown");
    expect(kpis.objectiveSupport.status).toBe("unknown");
  });
});

describe("readiness priority", () => {
  it("empty cycle → draft", () => {
    const model = buildStrategyCycleDashboardModel({
      counts: { objectives: 0, challenges: 0, directions: 0, programs: 0, initiatives: 0 },
      analysisEntrySummary: emptyAnalysisSummary(),
      kpis: baseKpis(),
      objectives: [],
      objectiveAvgScore: null,
      portfolioBalanceScore: null,
      linkDensityEntities: emptyLinkDensityEntities(),
    });
    expect(model.readiness.status).toBe("draft");
    expect(model.readiness.label).toBe("Entwurf");
  });

  it("good values → ready_for_review", () => {
    const model = buildStrategyCycleDashboardModel({
      counts: { objectives: 5, challenges: 3, directions: 4, programs: 1, initiatives: 2 },
      analysisEntrySummary: {
        ...emptyAnalysisSummary(),
        total: 10,
        directEntryCount: 9,
      },
      kpis: baseKpis({
        coverageChallengeShare: 90,
        criticalGaps: 0,
        focusIndex: 0.45,
        objectiveAlignmentMaturity: 0.75,
      }),
      objectives: [{ ai_objective_score: 4.0 }],
      objectiveAvgScore: 4,
      portfolioBalanceScore: 4,
      linkDensityEntities: goodLinkDensityEntities(),
    });
    expect(model.readiness.status).toBe("ready_for_review");
  });

  it("warning without critical → review_recommended", () => {
    const model = buildStrategyCycleDashboardModel({
      counts: { objectives: 5, challenges: 3, directions: 4, programs: 0, initiatives: 0 },
      analysisEntrySummary: {
        ...emptyAnalysisSummary(),
        total: 10,
        directEntryCount: 8,
      },
      kpis: baseKpis({
        coverageChallengeShare: 90,
        criticalGaps: 0,
        focusIndex: 0.45,
        objectiveAlignmentMaturity: 0.55,
      }),
      objectives: [{ ai_objective_score: 4.0 }],
      objectiveAvgScore: 4,
      portfolioBalanceScore: 4,
      linkDensityEntities: goodLinkDensityEntities(),
    });
    expect(model.readiness.status).toBe("review_recommended");
  });

  it("critical KPI → in_progress", () => {
    const model = buildStrategyCycleDashboardModel({
      counts: { objectives: 5, challenges: 3, directions: 4, programs: 0, initiatives: 0 },
      analysisEntrySummary: {
        ...emptyAnalysisSummary(),
        total: 10,
        directEntryCount: 8,
      },
      kpis: baseKpis({ objectiveAlignmentMaturity: 0.25 }),
      objectives: [],
      objectiveAvgScore: null,
      portfolioBalanceScore: null,
      linkDensityEntities: emptyLinkDensityEntities(),
    });
    expect(model.readiness.status).toBe("in_progress");
  });

  it("criticalGaps > 2 → in_progress", () => {
    const designKpis = interpretDesignKpis(baseKpis({ criticalGaps: 3 }));
    const readiness = evaluateStrategyCycleReadiness({
      counts: { objectives: 2, challenges: 2, directions: 2, programs: 0, initiatives: 0 },
      designKpis,
      analysisMaturity: evaluateAnalysisMaturity({
        ...emptyAnalysisSummary(),
        total: 10,
        directEntryCount: 8,
      }),
    });
    expect(readiness.status).toBe("in_progress");
  });
});

describe("objective readiness buckets", () => {
  it("classifies score bands and outdated", () => {
    const result = evaluateObjectiveReadiness(
      [
        { ai_objective_score: 4.0 },
        { ai_objective_score: 2.5 },
        { ai_objective_score: 1.5 },
        { ai_evaluation_status: "outdated", ai_objective_score: 4.5 },
        {},
      ],
      3.5
    );
    expect(result.reviewReady).toBe(1);
    expect(result.unclear).toBe(2);
    expect(result.critical).toBe(2);
    expect(result.label).toBe("1 reviewfähig · 2 unklar · 2 kritisch");
    expect(result.portfolioLabel).toBe("Portfolio-Balance ausgewogen");
    expect(result.portfolioStatus).toBe("good");
  });

  it("empty objectives fallback", () => {
    const result = evaluateObjectiveReadiness([], null);
    expect(result.label).toBe("Noch keine Ziele erfasst");
    expect(result.portfolioStatus).toBe("unknown");
  });
});

describe("action items", () => {
  it("critical before warning and max 5", () => {
    const model = buildStrategyCycleDashboardModel({
      counts: { objectives: 3, challenges: 2, directions: 4, programs: 0, initiatives: 0 },
      analysisEntrySummary: {
        ...emptyAnalysisSummary(),
        total: 25,
        directEntryCount: 12,
      },
      kpis: baseKpis({
        coverageChallengeShare: 40,
        criticalGaps: 3,
        focusIndex: 0.2,
        objectiveAlignmentMaturity: 0.25,
      }),
      objectives: [{ ai_objective_score: 1.0 }, { ai_evaluation_status: "outdated" }],
      objectiveAvgScore: 2,
      portfolioBalanceScore: 2,
      linkDensityEntities: sampleLinkDensityEntities(),
    });
    expect(model.actionItems.length).toBeLessThanOrEqual(5);
    const statuses = model.actionItems.map((i) => i.status);
    const firstCritical = statuses.indexOf("critical");
    const firstWarning = statuses.indexOf("warning");
    if (firstCritical >= 0 && firstWarning >= 0) {
      expect(firstCritical).toBeLessThan(firstWarning);
    }
  });

  it("empty when all good", () => {
    const designKpis = interpretDesignKpis(
      baseKpis({
        coverageChallengeShare: 90,
        criticalGaps: 0,
        focusIndex: 0.5,
        objectiveAlignmentMaturity: 0.8,
      })
    );
    const linkDensity = buildLinkDensityModels(goodLinkDensityEntities());
    const items = buildStrategyCycleActionItems({
      designKpis,
      objectiveReadiness: evaluateObjectiveReadiness([{ ai_objective_score: 4 }], 4),
      analysisMaturity: evaluateAnalysisMaturity({
        ...emptyAnalysisSummary(),
        total: 10,
        directEntryCount: 9,
      }),
      analysisEntrySummary: {
        ...emptyAnalysisSummary(),
        total: 10,
        directEntryCount: 9,
      },
      linkDensity,
    });
    expect(items).toHaveLength(0);
  });
});

describe("link density donuts", () => {
  it("buckets objectives by link count", () => {
    const models = buildLinkDensityModels(sampleLinkDensityEntities());
    const buckets = models.objectivesToDirections.buckets;
    expect(buckets.find((b) => b.key === "zero")?.count).toBe(1);
    expect(buckets.find((b) => b.key === "one")?.count).toBe(1);
    expect(buckets.find((b) => b.key === "two_to_three")?.count).toBe(2);
    expect(buckets.find((b) => b.key === "four_plus")?.count).toBe(1);
    expect(models.objectivesToDirections.total).toBe(5);
  });

  it("buckets challenges by link count", () => {
    const models = buildLinkDensityModels(sampleLinkDensityEntities());
    const buckets = models.challengesToDirections.buckets;
    expect(buckets.find((b) => b.key === "zero")?.count).toBe(1);
    expect(buckets.find((b) => b.key === "one")?.count).toBe(1);
    expect(buckets.find((b) => b.key === "two_to_three")?.count).toBe(1);
    expect(buckets.find((b) => b.key === "four_plus")?.count).toBe(1);
  });

  it("objective bucket statuses", () => {
    expect(objectiveLinkBucketStatus("zero")).toBe("critical");
    expect(objectiveLinkBucketStatus("one")).toBe("warning");
    expect(objectiveLinkBucketStatus("two_to_three")).toBe("good");
    expect(objectiveLinkBucketStatus("four_plus")).toBe("warning");
  });

  it("challenge bucket statuses", () => {
    expect(challengeLinkBucketStatus("zero")).toBe("critical");
    expect(challengeLinkBucketStatus("one")).toBe("warning");
    expect(challengeLinkBucketStatus("two_to_three")).toBe("good");
    expect(challengeLinkBucketStatus("four_plus")).toBe("good");
  });

  it("items include linked directions", () => {
    const models = buildLinkDensityModels(sampleLinkDensityEntities());
    const item = models.objectivesToDirections.buckets
      .find((b) => b.key === "two_to_three")
      ?.items.find((i) => i.id === "o2");
    expect(item?.linkCount).toBe(2);
    expect(item?.linkedDirections).toEqual([
      { id: "d1", label: "Stoßrichtung 1" },
      { id: "d2", label: "Stoßrichtung 2" },
    ]);
  });

  it("link count bucket keys", () => {
    expect(linkCountToBucketKey(0)).toBe("zero");
    expect(linkCountToBucketKey(1)).toBe("one");
    expect(linkCountToBucketKey(2)).toBe("two_to_three");
    expect(linkCountToBucketKey(3)).toBe("two_to_three");
    expect(linkCountToBucketKey(4)).toBe("four_plus");
  });

  it("empty data fallback", () => {
    const models = buildLinkDensityModels(emptyLinkDensityEntities());
    expect(models.objectivesToDirections.total).toBe(0);
    expect(models.challengesToDirections.total).toBe(0);
    expect(models.objectivesToDirections.buckets.every((b) => b.count === 0)).toBe(true);
  });

  it("creates action items for missing links", () => {
    const linkDensity = buildLinkDensityModels(sampleLinkDensityEntities());
    const items = buildStrategyCycleActionItems({
      designKpis: interpretDesignKpis(baseKpis()),
      objectiveReadiness: evaluateObjectiveReadiness([], null),
      analysisMaturity: evaluateAnalysisMaturity(emptyAnalysisSummary()),
      analysisEntrySummary: emptyAnalysisSummary(),
      linkDensity,
    });
    expect(items.some((i) => i.title.includes("Ziele ohne"))).toBe(true);
    expect(items.some((i) => i.title.includes("Herausforderungen ohne"))).toBe(true);
    expect(items.some((i) => i.title.includes("Ziel-Fokus"))).toBe(true);
  });
});
