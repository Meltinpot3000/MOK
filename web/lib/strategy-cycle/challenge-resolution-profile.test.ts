import { describe, expect, it } from "vitest";
import type { CorrelationSummaryResult } from "@/lib/strategy-cycle/correlation";
import {
  buildChallengeResolutionHint,
  coherenceForChallenge,
  deriveChallengeResolutionProfile,
  executionBandFromPercent,
  weightedExecutionPercent,
  collectExecutionAnchors,
} from "@/lib/strategy-cycle/challenge-resolution-profile";

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

describe("challenge-resolution-profile", () => {
  it("classifies execution bands", () => {
    expect(executionBandFromPercent(null)).toBe("not_measurable");
    expect(executionBandFromPercent(10)).toBe("early");
    expect(executionBandFromPercent(40)).toBe("in_progress");
    expect(executionBandFromPercent(75)).toBe("advanced");
    expect(executionBandFromPercent(95)).toBe("largely_delivered");
  });

  it("derives none addressing without direction links", () => {
    const profile = deriveChallengeResolutionProfile({
      challengeId: "c1",
      challengeTitle: "Test",
      challengeDirectionLinks: [],
      directions: [],
      correlationSummary: emptyCorrelation(),
      annualTargets: [],
      initiatives: [],
      initiativeTargetLinks: [],
      programs: [],
    });
    expect(profile.addressing).toBe("none");
    expect(profile.coherence).toBe("not_assessed");
    expect(profile.execution.band).toBe("not_measurable");
    expect(profile.systemHintDe).toContain("ohne tragende Stoßrichtung");
  });

  it("aggregates execution from annual targets weighted by contribution", () => {
    const anchors = collectExecutionAnchors({
      challengeId: "c1",
      challengeDirectionLinks: [
        { strategic_challenge_id: "c1", strategic_direction_id: "d1", contribution_level: "high" },
      ],
      annualTargets: [
        {
          id: "t1",
          title: "Umsatz",
          strategic_direction_id: "d1",
          progress_percent: 80,
        },
      ],
      initiatives: [],
      initiativeTargetLinks: [],
      programs: [],
    });
    expect(anchors).toHaveLength(1);
    expect(weightedExecutionPercent(anchors)).toBe(80);
  });

  it("picks weakest coherence across direction details", () => {
    const summary: CorrelationSummaryResult = {
      ...emptyCorrelation(),
      cells: [
        {
          key: "c1:o1",
          challengeId: "c1",
          objectiveId: "o1",
          challengeTitle: "Ch",
          objectiveTitle: "Obj",
          score: 40,
          status: "yellow",
          directionCount: 1,
          primaryDirectionId: "d1",
          objectiveLifecycleLabel: "—",
          directions: [
            {
              directionId: "d1",
              directionTitle: "Dir",
              autoScore: 40,
              autoStatus: "yellow",
              effectiveStatus: "yellow",
              hasOverride: false,
              overrideNote: null,
              overrideUpdatedAt: null,
            },
          ],
        },
        {
          key: "c1:o2",
          challengeId: "c1",
          objectiveId: "o2",
          challengeTitle: "Ch",
          objectiveTitle: "Obj2",
          score: 20,
          status: "red",
          directionCount: 1,
          primaryDirectionId: "d1",
          objectiveLifecycleLabel: "—",
          directions: [
            {
              directionId: "d1",
              directionTitle: "Dir",
              autoScore: 20,
              autoStatus: "red",
              effectiveStatus: "red",
              hasOverride: false,
              overrideNote: null,
              overrideUpdatedAt: null,
            },
          ],
        },
      ],
    };
    expect(coherenceForChallenge("c1", summary)).toBe("red");
  });

  it("includes key results linked to annual targets on direction", () => {
    const anchors = collectExecutionAnchors({
      challengeId: "c1",
      challengeDirectionLinks: [
        { strategic_challenge_id: "c1", strategic_direction_id: "d1", contribution_level: "high" },
      ],
      annualTargets: [
        { id: "t1", title: "Umsatz", strategic_direction_id: "d1", progress_percent: 50 },
      ],
      initiatives: [],
      initiativeTargetLinks: [],
      programs: [],
      keyResultTargetLinks: [
        { key_result_id: "kr1", annual_target_id: "t1", contribution_level: "medium" },
      ],
      keyResults: [{ id: "kr1", title: "NPS", progressPercent: 80 }],
    });
    expect(anchors.some((a) => a.label.includes("Key Result"))).toBe(true);
    expect(weightedExecutionPercent(anchors)).toBeGreaterThan(50);
  });

  it("builds hint for strong addressing without execution anchors", () => {
    const hint = buildChallengeResolutionHint({
      addressing: "strong",
      coherence: "green",
      execution: "not_measurable",
    });
    expect(hint).toContain("messbaren Umsetzungsanker");
  });

  it("exposes management and calculated progress channels", () => {
    const profile = deriveChallengeResolutionProfile({
      challengeId: "c1",
      challengeTitle: "Test",
      challengeDirectionLinks: [
        { strategic_challenge_id: "c1", strategic_direction_id: "d1", contribution_level: "high" },
      ],
      directions: [{ id: "d1", title: "Wachstum" }],
      correlationSummary: emptyCorrelation(),
      annualTargets: [
        {
          id: "t1",
          title: "Umsatz",
          strategic_direction_id: "d1",
          progress_percent: 70,
          progress_calculation_mode: "manual",
        },
      ],
      initiatives: [{ id: "i1", title: "Rollout", program_id: null, progress_percent: 40 }],
      initiativeTargetLinks: [{ initiative_id: "i1", annual_target_id: "t1", contribution_level: "medium" }],
      programs: [],
      keyResultTargetLinks: [{ key_result_id: "kr1", annual_target_id: "t1", contribution_level: "high" }],
      keyResults: [{ id: "kr1", title: "KR", progressPercent: 50 }],
    });

    expect(profile.managementAssessedProgress).toBe(70);
    expect(profile.calculatedProgressFromKeyResults).toBe(50);
    expect(profile.calculatedProgressFromInitiatives).toBe(40);
    expect(profile.progressSource).toBe("manual");
  });
});
