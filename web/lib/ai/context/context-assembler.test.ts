import { describe, expect, it } from "vitest";

import { assembleContext, FIELD_ALLOWLIST_BY_OBJECT_TYPE } from "./context-assembler";
import type { AiToolResult } from "@/lib/ai/tools/types";

describe("FIELD_ALLOWLIST_BY_OBJECT_TYPE", () => {
  it("enthält erwartete okr_objective-Felder", () => {
    expect(FIELD_ALLOWLIST_BY_OBJECT_TYPE.okr_objective).toContain("rollupStatus");
    expect(FIELD_ALLOWLIST_BY_OBJECT_TYPE.okr_objective).not.toContain("description");
  });
});

describe("assembleContext", () => {
  it("filtert Felder nach Allowlist", () => {
    const toolResult: AiToolResult = {
      toolName: "get_visible_okr_objectives",
      success: true,
      data: {
        objectives: [
          {
            id: "kr-1",
            title: "KR",
            secretField: "should-not-appear",
            status: "active",
            rollupProgressPercent: 50,
            rollupStatus: "at_risk",
            keyResultCount: 2,
            warnings: [],
            lastActivityAt: "2026-01-01",
          },
        ],
      },
      outputSummary: "summary",
      contextSources: [
        {
          sourceType: "okr_objective",
          sourceId: "kr-1",
          sourceTitle: "KR",
          classification: "internal",
          relevanceScore: 0.8,
        },
      ],
    };
    const assembled = assembleContext({
      question: "Test?",
      taskType: "internal_lookup",
      domains: ["okr"],
      scope: {},
      toolResults: [toolResult],
      maxContextObjects: 10,
      writeActionsAllowed: false,
      modelTierForRedaction: "local",
    });
    const obj = assembled.contextPackage.internalContext.objects[0];
    expect(obj.fields).not.toHaveProperty("secretField");
    expect(obj.fields).toHaveProperty("rollupStatus");
  });
});
