import { describe, expect, it } from "vitest";
import {
  computeStrategicDesignInsights,
  coverageBandFromWMax,
  normalizedCoverageWeight,
} from "@/lib/strategy-cycle/strategic-design-insights";
import type { CorrelationSummaryResult } from "@/lib/strategy-cycle/correlation";

const emptyCorrelation = (): CorrelationSummaryResult => ({
  objectives: [],
  challenges: [],
  cells: [],
  goodObjectivePercent: 0,
  weakCells: [],
  conflictCount: 0,
});

describe("normalizedCoverageWeight", () => {
  it("maps matrix factors to 0–1 insight scale", () => {
    expect(normalizedCoverageWeight("low")).toBe(0.25);
    expect(normalizedCoverageWeight("medium")).toBe(0.5);
    expect(normalizedCoverageWeight("high")).toBe(1);
  });
});

describe("coverageBandFromWMax", () => {
  it("classifies bands", () => {
    expect(coverageBandFromWMax(0)).toBe("none");
    expect(coverageBandFromWMax(0.25)).toBe("weak");
    expect(coverageBandFromWMax(0.75)).toBe("medium");
    expect(coverageBandFromWMax(1)).toBe("strong");
  });
});

describe("computeStrategicDesignInsights", () => {
  it("handles empty workspace", () => {
    const r = computeStrategicDesignInsights({
      challenges: [],
      objectives: [],
      strategicDirections: [],
      challengeDirectionLinks: [],
      directionObjectiveLinks: [],
      correlationSummary: emptyCorrelation(),
    });
    expect(r.topDirections).toEqual([]);
    expect(r.unaddressedChallenges).toEqual([]);
    expect(r.limitedChallengeBackingObjectives).toEqual([]);
    expect(r.conflicts).toEqual([]);
    expect(r.kpis.focusIndex).toBeNull();
    expect(r.kpis.objectiveAlignmentMaturity).toBeNull();
    expect(r.kpis.coverageChallengeShare).toBeNull();
  });

  it("ranks directions by score and picks top 5", () => {
    const r = computeStrategicDesignInsights({
      challenges: [
        { id: "c1", title: "C1", challenge_score: 80 },
      ],
      objectives: [
        { id: "o1", title: "O1", importance_score: 5 },
      ],
      strategicDirections: [
        { id: "d_low", title: "Low", priority: 1 },
        { id: "d_high", title: "High", priority: 5 },
      ],
      challengeDirectionLinks: [
        { strategic_challenge_id: "c1", strategic_direction_id: "d_low", contribution_level: "high" },
        { strategic_challenge_id: "c1", strategic_direction_id: "d_high", contribution_level: "high" },
      ],
      directionObjectiveLinks: [
        { strategic_direction_id: "d_low", objective_id: "o1", contribution_level: "medium" },
        { strategic_direction_id: "d_high", objective_id: "o1", contribution_level: "medium" },
      ],
      correlationSummary: emptyCorrelation(),
    });
    expect(r.topDirections.length).toBeLessThanOrEqual(5);
    expect(r.topDirections[0]?.directionId).toBe("d_high");
    expect(r.kpis.focusIndex).not.toBeNull();
    expect(r.kpis.focusIndex).toBeGreaterThan(0);
    expect(r.kpis.objectiveAlignmentMaturity).not.toBeNull();
  });

  it("flags high-score challenge without strong direction link as unaddressed", () => {
    const r = computeStrategicDesignInsights({
      challenges: [{ id: "c1", title: "Big", challenge_score: 70 }],
      objectives: [],
      strategicDirections: [{ id: "d1", title: "D1", priority: 1 }],
      challengeDirectionLinks: [
        { strategic_challenge_id: "c1", strategic_direction_id: "d1", contribution_level: "medium" },
      ],
      directionObjectiveLinks: [],
      correlationSummary: emptyCorrelation(),
    });
    expect(r.unaddressedChallenges.some((x) => x.challengeId === "c1")).toBe(true);
    expect(r.kpis.criticalGaps).toBeGreaterThanOrEqual(1);
  });
});
