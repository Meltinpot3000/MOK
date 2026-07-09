import { describe, expect, it } from "vitest";
import { deriveFulfillmentGaps } from "@/lib/strategy-cycle/challenge-fulfillment-gaps";

describe("deriveFulfillmentGaps", () => {
  it("asks to link directions first when none", () => {
    const gaps = deriveFulfillmentGaps({
      addressing: "none",
      linkedDirectionCount: 0,
      annualTargetCountOnDirections: 0,
      initiativeCountOnDirections: 0,
      keyResultLinkCountOnDirections: 0,
      executionAnchorCount: 0,
      executionPercent: null,
    });
    expect(gaps[0]?.id).toBe("link_directions");
  });

  it("suggests annual targets when directions exist but no targets", () => {
    const gaps = deriveFulfillmentGaps({
      addressing: "medium",
      linkedDirectionCount: 2,
      annualTargetCountOnDirections: 0,
      initiativeCountOnDirections: 0,
      keyResultLinkCountOnDirections: 0,
      executionAnchorCount: 0,
      executionPercent: null,
    });
    expect(gaps.some((g) => g.id === "annual_targets")).toBe(true);
  });
});
