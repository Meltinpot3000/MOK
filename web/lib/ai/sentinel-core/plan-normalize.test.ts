import { describe, expect, it } from "vitest";

import { parseSentinelPlanWithNormalization } from "./plan-normalize";

describe("plan-normalize", () => {
  it("normalisiert Synonyme vor Schema-Parse", () => {
    const { plan, degraded } = parseSentinelPlanWithNormalization({
      taskType: "internal_lookup",
      confidence: 0.7,
      domains: ["task"],
      scope: { cycle: "current_cycle", organizationScope: "mine" },
      toolPlan: [],
      answerStrategy: {
        canAnswerLocally: true,
        needsInternalRetrieval: true,
        needsWebSearch: false,
        needsFrontierModel: false,
        reason: "ok",
      },
      safety: {
        sensitiveDataLikely: false,
        requiresRedaction: false,
        writeActionRequested: false,
        requiresHumanApproval: false,
      },
      queryClass: "count",
      metric: "anzahl",
    });
    expect(degraded).toBe(false);
    expect(plan.scope.cycle).toBe("current");
    expect(plan.scope.organizationScope).toBe("own");
    expect(plan.metric).toBe("count");
  });
});
