import { describe, expect, it, vi } from "vitest";

import { runQueryPipeline } from "./query-pipelines";
import type { QueryPlan } from "./query-types";

describe("distribution pipeline", () => {
  it("berechnet status-buckets mit shares", async () => {
    const execute = vi.fn(async (toolName: string) => ({
      toolName,
      success: true,
      outputSummary: "objectives",
      data: {
        objectives: [
          { id: "o1", title: "A", status: "active" },
          { id: "o2", title: "B", status: "active" },
          { id: "o3", title: "C", status: "completed" },
        ],
      },
    }));
    const plan: QueryPlan = {
      queryClass: "distribution",
      domain: "okr",
      domainCandidates: ["okr"],
      optionalContextDomains: [],
      targetEntity: "okr_objective",
      analysisOps: ["distribution"],
      metric: "share",
      groupBy: "status",
      scope: {
        cycle: "current",
        organizationScope: "visible",
        objectType: "okr_objective",
        objectId: null,
        timeHorizon: null,
      },
    };
    const result = await runQueryPipeline(plan, {
      executePermissionedTool: execute,
      userContext: {
        userId: "u1",
        membershipId: "m1",
        organizationId: "org1",
        organizationName: "Org",
        roleCodes: [],
        permissionCodes: new Set(),
      },
    });
    expect(result.contract.queryClass).toBe("distribution");
    if (result.contract.queryClass === "distribution") {
      const shareSum = result.contract.buckets.reduce((sum, bucket) => sum + bucket.share, 0);
      expect(shareSum).toBeCloseTo(1, 2);
    }
  });
});

