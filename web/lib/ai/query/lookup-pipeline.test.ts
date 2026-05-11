import { describe, expect, it, vi } from "vitest";

import { runQueryPipeline } from "./query-pipelines";
import type { QueryPlan } from "./query-types";

describe("lookup pipeline", () => {
  it("liefert tasks fuer mich", async () => {
    const execute = vi.fn(async (toolName: string) => ({
      toolName,
      success: true,
      outputSummary: "tasks",
      data: {
        checkedMembershipIds: ["m1"],
        tasks: [
          {
            id: "t1",
            title: "Task 1",
            status: "open",
            dueAt: null,
            assignedMembershipId: "m1",
            taskType: "general",
            createdByMembershipId: "m1",
            sourceObjectType: "initiative",
            sourceObjectId: "x",
          },
        ],
      },
    }));
    const plan: QueryPlan = {
      queryClass: "lookup",
      domain: "task",
      domainCandidates: ["task"],
      optionalContextDomains: [],
      queryText: "Welche Aufgaben betreffen mich aktuell?",
      targetEntity: "task",
      analysisOps: ["lookup"],
      metric: "none",
      groupBy: "none",
      scope: {
        cycle: "current",
        organizationScope: "own",
        objectType: "task",
        objectId: null,
        timeHorizon: "aktuell",
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
    expect(result.contract.queryClass).toBe("lookup");
    if (result.contract.queryClass === "lookup") {
      expect(result.contract.totalItems).toBe(1);
    }
    expect(result.usedToolCalls.some((c) => c.toolName === "lookup_pipeline_trace_task")).toBe(true);
    expect(execute).toHaveBeenCalledWith("get_visible_tasks_for_user", {
      filter: "current",
      limit: 50,
    });
  });

  it("mapped erledigt-intent auf completed filter", async () => {
    const execute = vi.fn(async (toolName: string) => ({
      toolName,
      success: true,
      outputSummary: "tasks",
      data: { tasks: [] },
    }));
    const plan: QueryPlan = {
      queryClass: "lookup",
      domain: "task",
      domainCandidates: ["task"],
      optionalContextDomains: [],
      queryText: "Welche meiner Aufgaben sind erledigt?",
      targetEntity: "task",
      analysisOps: ["lookup"],
      metric: "none",
      groupBy: "none",
      scope: {
        cycle: "current",
        organizationScope: "own",
        objectType: "task",
        objectId: null,
        timeHorizon: "aktuell",
      },
    };
    await runQueryPipeline(plan, {
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
    expect(execute).toHaveBeenCalledWith("get_visible_tasks_for_user", { filter: "completed", limit: 50 });
  });
});

