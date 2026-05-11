import { describe, expect, it } from "vitest";

import type { AiToolResult } from "@/lib/ai/tools/types";

import { buildOkrObjectiveFacts, buildTaskFacts } from "./fact-builder";

describe("fact-builder", () => {
  it("mappt OKR objectives auf Canonical Facts", () => {
    const result: AiToolResult = {
      toolName: "get_visible_okr_objectives",
      success: true,
      outputSummary: "ok",
      data: {
        cycleInstanceId: "cycle-1",
        objectives: [
          {
            id: "o1",
            title: "Objective 1",
            status: "active",
            ownerMembershipId: "m1",
            ownerDisplayName: "Carmelo",
            rollupProgressPercent: 42,
          },
        ],
      },
    };
    const facts = buildOkrObjectiveFacts(result);
    expect(facts).toEqual([
      {
        id: "o1",
        title: "Objective 1",
        cycleId: "cycle-1",
        cycleLabel: null,
        ownerMembershipId: "m1",
        ownerDisplayName: "Carmelo",
        status: "active",
        progress: 42,
      },
    ]);
  });

  it("mappt Tasks auf Canonical Facts", () => {
    const result: AiToolResult = {
      toolName: "get_visible_tasks_for_user",
      success: true,
      outputSummary: "ok",
      data: {
        checkedMembershipIds: ["m-current"],
        tasks: [
          {
            id: "t1",
            title: "Task 1",
            taskType: "general",
            status: "open",
            dueAt: "2031-05-01",
            assignedMembershipId: "m-current",
            createdByMembershipId: "m-other",
            sourceObjectType: "okr_objective",
            sourceObjectId: "o1",
          },
        ],
      },
    };
    const facts = buildTaskFacts({ result, currentMembershipId: "m-current" });
    expect(facts).toEqual([
      {
        factType: "task",
        id: "t1",
        title: "Task 1",
        taskType: "general",
        status: "open",
        normalizedStatus: "open",
        assignedMembershipId: "m-current",
        createdByMembershipId: "m-other",
        completedByMembershipId: null,
        relationToCurrentUser: ["assigned", "responsible", "visible"],
        sourceObjectType: "okr_objective",
        sourceObjectId: "o1",
        isLinkedToOkr: true,
        completedAt: null,
        dueAt: "2031-05-01",
      },
    ]);
  });
});

