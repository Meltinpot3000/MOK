import { describe, expect, it } from "vitest";
import {
  buildStrategicDesignHybridEvaluation,
  getStrategicDesignSignalProfile,
} from "@/lib/strategy-cycle/strategic-design-hybrid";

describe("getStrategicDesignSignalProfile", () => {
  it("returns documented baseline signals and hard rules", () => {
    const p = getStrategicDesignSignalProfile();
    expect(p.version).toBe("v1");
    expect(p.signals.length).toBeGreaterThanOrEqual(4);
    expect(p.hardRulesDe.length).toBeGreaterThanOrEqual(2);
  });
});

describe("buildStrategicDesignHybridEvaluation", () => {
  it("keeps deterministic values when llm adjustment is absent", () => {
    const r = buildStrategicDesignHybridEvaluation({
      deterministicScore: 72,
      recommendationStatus: "green",
    });
    expect(r.deterministicScore).toBe(72);
    expect(r.finalScore).toBe(72);
    expect(r.llmAdjustment).toBe(0);
    expect(r.source).toBe("deterministic");
  });

  it("clamps llm adjustment guardrails to +/-15", () => {
    const up = buildStrategicDesignHybridEvaluation({
      deterministicScore: 60,
      recommendationStatus: "yellow",
      llmAdjustment: 99,
      llmExplanationDe: "stark nach oben",
    });
    const down = buildStrategicDesignHybridEvaluation({
      deterministicScore: 60,
      recommendationStatus: "yellow",
      llmAdjustment: -99,
      llmExplanationDe: "stark nach unten",
    });
    expect(up.llmAdjustment).toBe(15);
    expect(up.finalScore).toBe(75);
    expect(down.llmAdjustment).toBe(-15);
    expect(down.finalScore).toBe(45);
  });
});
