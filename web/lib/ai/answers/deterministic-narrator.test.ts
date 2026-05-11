import { describe, expect, it } from "vitest";

import { renderDeterministicNarration } from "./deterministic-narrator";
import type { StructuredAnswerContract } from "./answer-contracts";

describe("renderDeterministicNarration", () => {
  it("rendert ranking-contract", () => {
    const contract: StructuredAnswerContract = {
      queryClass: "ranking",
      domain: "okr",
      metric: "objective_count",
      groupBy: "owner",
      scope: { cycleId: "c1", cycleLabel: "Zyklus" },
      totalItems: 2,
      top: [{ rank: 1, label: "Carmelo", count: 2, evidenceIds: ["o1", "o2"] }],
      evidenceSummary: "",
      confidence: "high",
    };
    const text = renderDeterministicNarration(contract);
    expect(text).toContain("Carmelo");
    expect(text).toContain("Kernaussage");
  });
});

