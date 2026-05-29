import { describe, expect, it } from "vitest";
import {
  computeStrategicDirectionOverallLevel,
  minContributionTier,
  scopeFitToOverallMinTier,
} from "@/lib/okr/contribution-tier";

describe("minContributionTier", () => {
  it("picks the weaker tier", () => {
    expect(minContributionTier("high", "low")).toBe("low");
    expect(minContributionTier("medium", "insufficient")).toBe("insufficient");
  });
});

describe("scopeFitToOverallMinTier", () => {
  it("maps over-scoped to low cap", () => {
    expect(scopeFitToOverallMinTier("high")).toBe("low");
  });
  it("maps appropriate to no cap", () => {
    expect(scopeFitToOverallMinTier("medium")).toBe("high");
  });
});

describe("computeStrategicDirectionOverallLevel", () => {
  it("limits overall when scope is overloaded", () => {
    expect(
      computeStrategicDirectionOverallLevel({
        alignmentLevel: "high",
        formulationLevel: "high",
        scopeFitLevel: "high",
        modelOverallLevel: "high",
      })
    ).toBe("low");
  });
});
