import { describe, expect, it, vi } from "vitest";

import { runQueryPipeline } from "./query-pipelines";
import type { QueryPlan } from "./query-types";

describe("ranking pipeline", () => {
  it("baut ranking-contract und evidenceIds aus objectiveIds", async () => {
    const execute = vi.fn(async (toolName: string) => {
      if (toolName === "get_current_okr_cycle") {
        return {
          toolName,
          success: true,
          outputSummary: "cycle",
          data: { cycleInstanceId: "c1" },
        };
      }
      return {
        toolName,
        success: true,
        outputSummary: "owner-counts",
        data: {
          cycleInstanceId: "c1",
          cycleLabel: "Aktueller Zyklus",
          totalObjectives: 3,
          ownerRanking: [
            {
              ownerMembershipId: "m1",
              ownerDisplayName: "Carmelo",
              objectiveCount: 2,
              objectiveIds: ["o1", "o2"],
            },
          ],
        },
      };
    });
    const plan: QueryPlan = {
      queryClass: "ranking",
      domain: "okr",
      domainCandidates: ["okr"],
      optionalContextDomains: [],
      targetEntity: "okr_objective",
      analysisOps: ["rank", "count_total"],
      metric: "count",
      groupBy: "owner",
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
    expect(result.contract.queryClass).toBe("ranking");
    if (result.contract.queryClass === "ranking") {
      expect(result.contract.top[0]?.evidenceIds).toEqual(["o1", "o2"]);
      expect(result.contract.top[0]?.count).toBe(result.contract.top[0]?.evidenceIds.length);
    }
    expect(execute).toHaveBeenCalled();
  });
});

