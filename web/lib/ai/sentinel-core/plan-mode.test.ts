import { describe, expect, it, vi } from "vitest";

import type { AiUserContext } from "@/lib/ai/types";
import type { SentinelPlanCallResult } from "./client";
import { runPlanMode } from "./plan-mode";

vi.mock("./client", () => ({
  callSentinelPlanMode: vi.fn(),
}));

import { callSentinelPlanMode } from "./client";

const mockedCallSentinelPlanMode = vi.mocked(callSentinelPlanMode);

const USER_CONTEXT: AiUserContext = {
  userId: "user-1",
  membershipId: "membership-1",
  organizationId: "org-1",
  organizationName: "Org",
  roleCodes: ["ceo"],
  permissionCodes: new Set(["ai.assistant.use", "nav.okr-workspace.read", "nav.tasks.read"]),
};

function buildBaseResult(): SentinelPlanCallResult {
  return {
    plan: {
      taskType: "unknown",
      confidence: 0.2,
      domains: [],
      scope: {
        cycle: "unspecified",
        organizationScope: "unspecified",
        objectType: null,
        objectId: null,
        timeHorizon: null,
      },
      toolPlan: [],
      answerStrategy: {
        canAnswerLocally: false,
        needsInternalRetrieval: false,
        needsWebSearch: false,
        needsFrontierModel: false,
        reason: "fallback",
      },
      safety: {
        sensitiveDataLikely: false,
        requiresRedaction: false,
        writeActionRequested: false,
        requiresHumanApproval: false,
      },
      queryClass: "unknown",
      targetEntity: null,
      metric: "none",
      groupBy: null,
    },
    usedFallback: true,
    fallbackReason: "mock",
    usage: null,
    provider: "ollama",
    model: "test-model",
    repaired: false,
  };
}

describe("runPlanMode heuristics", () => {
  it("setzt ranking-Klassifikation fuer 'meisten OKRs'", async () => {
    mockedCallSentinelPlanMode.mockResolvedValueOnce(buildBaseResult());
    const result = await runPlanMode({
      question: "Wer hat die meisten OKRs im aktuellen Zyklus?",
      userContext: USER_CONTEXT,
      recentMessages: [],
      tools: [
        { name: "get_current_okr_cycle", domain: "okr", description: "cycle" },
        { name: "get_okr_objective_owner_counts", domain: "okr", description: "counts" },
      ],
    });

    expect(result.plan.queryClass).toBe("ranking");
    expect(result.plan.targetEntity).toBe("okr_objective");
    expect(result.plan.metric).toBe("count");
    expect(result.plan.groupBy).toBe("owner");
  });

  it("setzt count-Klassifikation fuer 'Wie viele OKRs...'", async () => {
    mockedCallSentinelPlanMode.mockResolvedValueOnce(buildBaseResult());
    const result = await runPlanMode({
      question: "Wie viele OKRs gibt es im aktuellen Zyklus?",
      userContext: USER_CONTEXT,
      recentMessages: [],
      tools: [
        { name: "get_current_okr_cycle", domain: "okr", description: "cycle" },
        { name: "get_visible_okr_objectives", domain: "okr", description: "objectives" },
      ],
    });

    expect(result.plan.queryClass).toBe("count");
    expect(result.plan.metric).toBe("count");
    expect(result.plan.targetEntity).toBe("okr_objective");
  });

  it("normalisiert bei nicht-heuristischem Plan queryClass auf unknown", async () => {
    const nonHeuristic = buildBaseResult();
    nonHeuristic.usedFallback = false;
    nonHeuristic.plan.taskType = "internal_lookup";
    nonHeuristic.plan.toolPlan = [
      { toolName: "get_visible_tasks_for_user", purpose: "x", input: {}, required: true },
    ];
    // simulate older plan shape without queryClass
    (nonHeuristic.plan as unknown as { queryClass?: string }).queryClass = undefined;
    mockedCallSentinelPlanMode.mockResolvedValueOnce(nonHeuristic);

    const result = await runPlanMode({
      question: "Welche Aufgaben betreffen mich?",
      userContext: USER_CONTEXT,
      recentMessages: [],
      tools: [{ name: "get_visible_tasks_for_user", domain: "task", description: "tasks" }],
    });

    expect(result.plan.queryClass).toBe("unknown");
  });
});

