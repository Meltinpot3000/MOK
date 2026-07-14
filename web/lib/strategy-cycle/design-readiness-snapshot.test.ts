import { describe, expect, it } from "vitest";
import {
  bandFromScore,
  challengeHasAnalysisBasis,
  classifyChallengeDisplayLifecycle,
  classifyDirectionDisplayLifecycle,
  computeDesignReadinessSnapshot,
  isChallengeReadinessRelevant,
  isPriorityAAnalysisEntry,
  statusFromPct,
} from "@/lib/strategy-cycle/design-readiness-snapshot";
import type { StrategyObjectVersioningMeta } from "@/lib/strategy-objects/types";

function v(overrides: Partial<StrategyObjectVersioningMeta>): StrategyObjectVersioningMeta {
  return {
    object_identity_id: "id-1",
    revision_id: "rev-1",
    revision_number: 1,
    revision_state: "current",
    identity_lifecycle_state: "active",
    operational_status: "active",
    latest_operational_signal: "on_track",
    ...overrides,
  };
}

const activeChallengeV = v({});
const approvedChallengeV = v({ revision_state: "pending_approval" });
const draftChallengeV = v({ identity_lifecycle_state: "draft", revision_state: "draft" });
const eligibleDirectionV = v({});
const draftDirectionV = v({ identity_lifecycle_state: "draft", revision_state: "draft" });

describe("classifyChallengeDisplayLifecycle", () => {
  it("maps active and approved buckets", () => {
    expect(classifyChallengeDisplayLifecycle(activeChallengeV)).toBe("active");
    expect(classifyChallengeDisplayLifecycle(approvedChallengeV)).toBe("approved");
    expect(classifyChallengeDisplayLifecycle(draftChallengeV)).toBe("draft");
  });

  it("readiness relevant only for active and approved", () => {
    expect(isChallengeReadinessRelevant(activeChallengeV)).toBe(true);
    expect(isChallengeReadinessRelevant(approvedChallengeV)).toBe(true);
    expect(isChallengeReadinessRelevant(draftChallengeV)).toBe(false);
  });
});

describe("classifyDirectionDisplayLifecycle", () => {
  it("eligible direction is active bucket", () => {
    expect(classifyDirectionDisplayLifecycle(eligibleDirectionV)).toBe("active");
    expect(classifyDirectionDisplayLifecycle(draftDirectionV)).toBe("draft");
  });
});

describe("isPriorityAAnalysisEntry", () => {
  it("uses quality_band high or impact >= 4 as MVP proxy", () => {
    expect(isPriorityAAnalysisEntry({ quality_band: "high" })).toBe(true);
    expect(isPriorityAAnalysisEntry({ impact_level: 4 })).toBe(true);
    expect(isPriorityAAnalysisEntry({ impact_level: 3, quality_band: "medium" })).toBe(false);
  });
});

describe("challengeHasAnalysisBasis", () => {
  it("union of source entry and pill links", () => {
    const map = new Map([["c1", new Set(["e2"])]]);
    expect(challengeHasAnalysisBasis("c1", null, map)).toBe(true);
    expect(challengeHasAnalysisBasis("c2", "e9", map)).toBe(true);
    expect(challengeHasAnalysisBasis("c3", null, map)).toBe(false);
  });
});

describe("scores and bands", () => {
  it("band thresholds", () => {
    expect(bandFromScore(80)).toBe("high");
    expect(bandFromScore(60)).toBe("medium");
    expect(bandFromScore(40)).toBe("low");
    expect(bandFromScore(null)).toBe("unknown");
  });

  it("status from pct", () => {
    expect(statusFromPct(85)).toBe("strong");
    expect(statusFromPct(65)).toBe("medium");
    expect(statusFromPct(40)).toBe("weak");
    expect(statusFromPct(null)).toBe("unknown");
  });
});

describe("computeDesignReadinessSnapshot", () => {
  it("returns unknown when empty", () => {
    const r = computeDesignReadinessSnapshot({
      analysisItems: [],
      directions: [],
      challenges: [],
      objectives: [],
      industries: [],
      businessModels: [],
      challengeAnalysisLinks: [],
      challengeDirectionLinks: [],
      directionObjectiveLinks: [],
      challengeIndustries: [],
      challengeBusinessModels: [],
      directionIndustries: [],
      directionBusinessModels: [],
      openReviewHintsCount: 0,
    });
    expect(r.overall.readinessBand).toBe("unknown");
    expect(r.flow.challenges.readinessRelevant).toBe(0);
  });

  it("counts only active/approved challenges as evaluated in design", () => {
    const r = computeDesignReadinessSnapshot({
      analysisItems: [{ id: "e1", quality_band: "high" }],
      directions: [{ id: "d1", versioning: eligibleDirectionV }],
      challenges: [
        { id: "c1", versioning: activeChallengeV },
        { id: "c2", versioning: draftChallengeV },
      ],
      objectives: [],
      industries: [{ id: "i1" }],
      businessModels: [],
      challengeAnalysisLinks: [{ strategic_challenge_id: "c1", analysis_entry_id: "e1" }],
      challengeDirectionLinks: [
        {
          strategic_challenge_id: "c1",
          strategic_direction_id: "d1",
          contribution_level: "high",
        },
      ],
      directionObjectiveLinks: [],
      challengeIndustries: [{ strategic_challenge_id: "c1", industry_id: "i1" }],
      challengeBusinessModels: [],
      directionIndustries: [],
      directionBusinessModels: [],
      openReviewHintsCount: 0,
    });
    expect(r.flow.challenges.readinessRelevant).toBe(1);
    expect(r.flow.challenges.total).toBe(2);
    expect(r.flow.analysis.linkedToActiveChallenges).toBe(1);
    expect(r.flow.challenges.analysisBasedCount).toBe(1);
    expect(r.flow.challenges.directlySetCount).toBe(0);
    expect(r.flow.challenges.withDirectionCount).toBe(1);
  });

  it("priority A open without evaluated challenge", () => {
    const r = computeDesignReadinessSnapshot({
      analysisItems: [{ id: "e1", quality_band: "high" }],
      directions: [],
      challenges: [{ id: "c1", versioning: draftChallengeV }],
      objectives: [],
      industries: [],
      businessModels: [],
      challengeAnalysisLinks: [],
      challengeDirectionLinks: [],
      directionObjectiveLinks: [],
      challengeIndustries: [],
      challengeBusinessModels: [],
      directionIndustries: [],
      directionBusinessModels: [],
      openReviewHintsCount: 0,
    });
    expect(r.flow.analysis.priorityAOpenCount).toBe(1);
  });

  it("directly set challenges without analysis basis", () => {
    const r = computeDesignReadinessSnapshot({
      analysisItems: [],
      directions: [],
      challenges: [{ id: "c1", versioning: activeChallengeV }],
      objectives: [],
      industries: [],
      businessModels: [],
      challengeAnalysisLinks: [],
      challengeDirectionLinks: [],
      directionObjectiveLinks: [],
      challengeIndustries: [],
      challengeBusinessModels: [],
      directionIndustries: [],
      directionBusinessModels: [],
      openReviewHintsCount: 0,
    });
    expect(r.flow.challenges.directlySetCount).toBe(1);
    expect(r.flow.challenges.analysisBasedCount).toBe(0);
  });

  it("direction focus uses eligible directions and weight threshold", () => {
    const r = computeDesignReadinessSnapshot({
      analysisItems: [],
      directions: [
        { id: "d1", versioning: eligibleDirectionV },
        { id: "d2", versioning: draftDirectionV },
      ],
      challenges: [
        { id: "c1", versioning: activeChallengeV },
        { id: "c2", versioning: activeChallengeV },
      ],
      objectives: [{ id: "o1", versioning: activeChallengeV }],
      industries: [{ id: "i1" }, { id: "i2" }],
      businessModels: [{ id: "bm1" }],
      challengeAnalysisLinks: [],
      challengeDirectionLinks: [
        {
          strategic_challenge_id: "c1",
          strategic_direction_id: "d1",
          contribution_level: "high",
        },
        {
          strategic_challenge_id: "c2",
          strategic_direction_id: "d2",
          contribution_level: "high",
        },
      ],
      directionObjectiveLinks: [
        {
          strategic_direction_id: "d1",
          objective_id: "o1",
          contribution_level: "high",
        },
      ],
      challengeIndustries: [],
      challengeBusinessModels: [],
      directionIndustries: [{ strategic_direction_id: "d1", industry_id: "i1" }],
      directionBusinessModels: [{ strategic_direction_id: "d1", business_model_id: "bm1" }],
      openReviewHintsCount: 0,
    });
    expect(r.flow.directions.eligible).toBe(1);
    expect(r.flow.directions.challengeCoveragePct).toBe(50);
    expect(r.flow.objectives.coveragePct).toBe(100);
    expect(r.context.directionsFocus.industries.covered).toBe(1);
    expect(r.context.directionsFocus.businessModels.covered).toBe(1);
    expect(r.overall.challengeReadinessBand).not.toBe("unknown");
    expect(r.overall.directionReadinessBand).not.toBe("unknown");
    expect(r.overall.readinessScore).not.toBeNull();
  });

  it("exposes separate challenge and direction readiness scores", () => {
    const r = computeDesignReadinessSnapshot({
      analysisItems: [{ id: "e1" }],
      directions: [{ id: "d1", versioning: eligibleDirectionV }],
      challenges: [{ id: "c1", versioning: activeChallengeV, source_analysis_entry_id: "e1" }],
      objectives: [],
      industries: [],
      businessModels: [],
      challengeAnalysisLinks: [],
      challengeDirectionLinks: [
        {
          strategic_challenge_id: "c1",
          strategic_direction_id: "d1",
          contribution_level: "high",
        },
      ],
      directionObjectiveLinks: [],
      challengeIndustries: [],
      challengeBusinessModels: [],
      directionIndustries: [],
      directionBusinessModels: [],
      openReviewHintsCount: 3,
    });
    expect(r.overall.challengeReadinessScore).not.toBeNull();
    expect(r.overall.directionReadinessScore).not.toBeNull();
    expect(r.overall.openReviewHintsCount).toBe(3);
    expect(r.focusDetails.challenges.kpis.some((k) => k.label === "Analyseverwertung")).toBe(true);
    expect(r.focusDetails.challenges.kpis.some((k) => k.label === "Analysefundierung")).toBe(true);
  });
});

describe("contextDistributions", () => {
  const industries = [
    { id: "i-auto", title: "Automotive" },
    { id: "i-trans", title: "Transportation" },
    { id: "i-mach", title: "Machinery Automation" },
  ];
  const businessModels = [
    { id: "bm-btp", title: "Build-to-Print" },
    { id: "bm-sol", title: "Solution / Co-Engineering" },
    { id: "bm-svc", title: "Service" },
  ];

  const baseInput = {
    analysisItems: [],
    objectives: [],
    industries,
    businessModels,
    challengeAnalysisLinks: [],
    challengeDirectionLinks: [],
    directionObjectiveLinks: [],
    openReviewHintsCount: 0,
  };

  it("challengesFocus.industries counts active and inactive challenge assignments", () => {
    const r = computeDesignReadinessSnapshot({
      ...baseInput,
      directions: [],
      challenges: [
        { id: "c1", versioning: activeChallengeV },
        { id: "c2", versioning: activeChallengeV },
        { id: "c3", versioning: draftChallengeV },
      ],
      challengeIndustries: [
        { strategic_challenge_id: "c1", industry_id: "i-auto" },
        { strategic_challenge_id: "c1", industry_id: "i-trans" },
        { strategic_challenge_id: "c2", industry_id: "i-auto" },
        { strategic_challenge_id: "c3", industry_id: "i-auto" },
        { strategic_challenge_id: "c3", industry_id: "i-mach" },
      ],
      challengeBusinessModels: [],
      directionIndustries: [],
      directionBusinessModels: [],
    });

    const g = r.contextDistributions.challengesFocus.industries;
    expect(g.totalAssignments).toBe(5);
    expect(g.activeAssignments).toBe(3);
    expect(g.inactiveAssignments).toBe(2);

    const auto = g.items.find((i) => i.id === "i-auto");
    expect(auto?.activeCount).toBe(2);
    expect(auto?.inactiveCount).toBe(1);
    expect(auto?.totalCount).toBe(3);

    const trans = g.items.find((i) => i.id === "i-trans");
    expect(trans?.activeCount).toBe(1);
    expect(trans?.inactiveCount).toBe(0);

    const mach = g.items.find((i) => i.id === "i-mach");
    expect(mach?.activeCount).toBe(0);
    expect(mach?.inactiveCount).toBe(1);
  });

  it("challengesFocus.businessModels counts active and inactive challenge assignments", () => {
    const r = computeDesignReadinessSnapshot({
      ...baseInput,
      directions: [],
      challenges: [
        { id: "c1", versioning: activeChallengeV },
        { id: "c2", versioning: approvedChallengeV },
        { id: "c3", versioning: draftChallengeV },
      ],
      challengeIndustries: [],
      challengeBusinessModels: [
        { strategic_challenge_id: "c1", business_model_id: "bm-btp" },
        { strategic_challenge_id: "c2", business_model_id: "bm-btp" },
        { strategic_challenge_id: "c3", business_model_id: "bm-btp" },
        { strategic_challenge_id: "c3", business_model_id: "bm-svc" },
      ],
      directionIndustries: [],
      directionBusinessModels: [],
    });

    const g = r.contextDistributions.challengesFocus.businessModels;
    expect(g.totalAssignments).toBe(4);
    expect(g.activeAssignments).toBe(2);
    expect(g.inactiveAssignments).toBe(2);

    const btp = g.items.find((i) => i.id === "bm-btp");
    expect(btp?.activeCount).toBe(2);
    expect(btp?.inactiveCount).toBe(1);

    const svc = g.items.find((i) => i.id === "bm-svc");
    expect(svc?.activeCount).toBe(0);
    expect(svc?.inactiveCount).toBe(1);
  });

  it("directionsFocus.industries counts eligible and non-eligible direction assignments", () => {
    const r = computeDesignReadinessSnapshot({
      ...baseInput,
      directions: [
        { id: "d1", versioning: eligibleDirectionV },
        { id: "d2", versioning: draftDirectionV },
      ],
      challenges: [],
      challengeIndustries: [],
      challengeBusinessModels: [],
      directionIndustries: [
        { strategic_direction_id: "d1", industry_id: "i-auto" },
        { strategic_direction_id: "d1", industry_id: "i-trans" },
        { strategic_direction_id: "d2", industry_id: "i-auto" },
      ],
      directionBusinessModels: [],
    });

    const g = r.contextDistributions.directionsFocus.industries;
    expect(g.totalAssignments).toBe(3);
    expect(g.activeAssignments).toBe(2);
    expect(g.inactiveAssignments).toBe(1);

    const auto = g.items.find((i) => i.id === "i-auto");
    expect(auto?.activeCount).toBe(1);
    expect(auto?.inactiveCount).toBe(1);
  });

  it("directionsFocus.businessModels counts eligible and non-eligible direction assignments", () => {
    const r = computeDesignReadinessSnapshot({
      ...baseInput,
      directions: [
        { id: "d1", versioning: eligibleDirectionV },
        { id: "d2", versioning: draftDirectionV },
      ],
      challenges: [],
      challengeIndustries: [],
      challengeBusinessModels: [],
      directionIndustries: [],
      directionBusinessModels: [
        { strategic_direction_id: "d1", business_model_id: "bm-sol" },
        { strategic_direction_id: "d2", business_model_id: "bm-sol" },
        { strategic_direction_id: "d2", business_model_id: "bm-svc" },
      ],
    });

    const g = r.contextDistributions.directionsFocus.businessModels;
    expect(g.totalAssignments).toBe(3);
    expect(g.activeAssignments).toBe(1);
    expect(g.inactiveAssignments).toBe(2);
  });

  it("counts each assignment once when entity has multiple dimensions", () => {
    const r = computeDesignReadinessSnapshot({
      ...baseInput,
      directions: [],
      challenges: [{ id: "c1", versioning: activeChallengeV }],
      challengeIndustries: [
        { strategic_challenge_id: "c1", industry_id: "i-auto" },
        { strategic_challenge_id: "c1", industry_id: "i-trans" },
      ],
      challengeBusinessModels: [],
      directionIndustries: [],
      directionBusinessModels: [],
    });

    const g = r.contextDistributions.challengesFocus.industries;
    expect(g.totalAssignments).toBe(2);
    expect(g.activeAssignments).toBe(2);
    expect(g.items.find((i) => i.id === "i-auto")?.activeCount).toBe(1);
    expect(g.items.find((i) => i.id === "i-trans")?.activeCount).toBe(1);
  });

  it("sets emptyHint when totalAssignments is zero", () => {
    const r = computeDesignReadinessSnapshot({
      ...baseInput,
      directions: [],
      challenges: [{ id: "c1", versioning: activeChallengeV }],
      challengeIndustries: [],
      challengeBusinessModels: [],
      directionIndustries: [],
      directionBusinessModels: [],
    });

    expect(r.contextDistributions.challengesFocus.industries.emptyHint).toContain(
      "Herausforderungen"
    );
    expect(r.contextDistributions.challengesFocus.industries.totalAssignments).toBe(0);
    expect(r.contextDistributions.directionsFocus.businessModels.emptyHint).toContain(
      "Stoßrichtungen"
    );
  });
});
