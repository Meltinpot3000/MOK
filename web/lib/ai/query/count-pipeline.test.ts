import { describe, expect, it, vi } from "vitest";

import { runQueryPipeline } from "./query-pipelines";
import type { QueryPlan } from "./query-types";

describe("count pipeline", () => {
  it("zaehlt objectives im aktuellen zyklus", async () => {
    const execute = vi.fn(async (toolName: string) => {
      if (toolName === "get_current_okr_cycle") {
        return { toolName, success: true, outputSummary: "cycle", data: { cycleInstanceId: "c1" } };
      }
      return {
        toolName,
        success: true,
        outputSummary: "objectives",
        data: {
          cycleInstanceId: "c1",
          objectives: [
            { id: "o1", title: "A", status: "active" },
            { id: "o2", title: "B", status: "active" },
          ],
        },
      };
    });
    const plan: QueryPlan = {
      queryClass: "count",
      domain: "okr",
      domainCandidates: ["okr"],
      optionalContextDomains: [],
      targetEntity: "okr_objective",
      analysisOps: ["count_total"],
      metric: "count",
      groupBy: "none",
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
    expect(result.contract.queryClass).toBe("count");
    if (result.contract.queryClass === "count") {
      expect(result.contract.value).toBe(2);
      expect(result.contract.evidenceIds.length).toBe(2);
    }
  });
});

