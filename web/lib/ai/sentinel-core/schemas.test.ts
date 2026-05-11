import { describe, expect, it } from "vitest";

import {
  SENTINEL_PLAN_FALLBACK,
  sentinelPlanSchema,
  type SentinelPlan,
} from "./schemas";

const VALID_PLAN: SentinelPlan = {
  taskType: "internal_lookup",
  confidence: 0.7,
  domains: ["okr"],
  scope: {
    cycle: "current",
    organizationScope: "team",
    objectType: "okr_objective",
    objectId: null,
    timeHorizon: null,
  },
  toolPlan: [
    {
      toolName: "get_visible_okr_objectives",
      purpose: "Liste der OKRs",
      input: {},
      required: true,
    },
  ],
  answerStrategy: {
    canAnswerLocally: true,
    needsInternalRetrieval: true,
    needsWebSearch: false,
    needsFrontierModel: false,
    reason: "Interne OKR-Daten reichen aus.",
  },
  safety: {
    sensitiveDataLikely: false,
    requiresRedaction: false,
    writeActionRequested: false,
    requiresHumanApproval: false,
  },
  queryClass: "lookup",
  targetEntity: "okr_objective",
  metric: "count",
  groupBy: "owner",
  domainCandidates: ["okr"],
  optionalContextDomains: [],
  analysisOps: ["lookup"],
};

describe("sentinelPlanSchema", () => {
  it("akzeptiert vollstaendigen, gueltigen Plan", () => {
    const parsed = sentinelPlanSchema.safeParse(VALID_PLAN);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.taskType).toBe("internal_lookup");
    }
  });

  it("setzt Default-Werte fuer Scope und ToolPlan", () => {
    const minimal = {
      taskType: "direct_answer",
      confidence: 0.4,
      domains: [],
      scope: {},
      answerStrategy: {
        canAnswerLocally: true,
        needsInternalRetrieval: false,
        needsWebSearch: false,
        needsFrontierModel: false,
        reason: "trivial",
      },
      safety: {
        sensitiveDataLikely: false,
        requiresRedaction: false,
        writeActionRequested: false,
        requiresHumanApproval: false,
      },
    };
    const parsed = sentinelPlanSchema.parse(minimal);
    expect(parsed.scope.cycle).toBe("unspecified");
    expect(parsed.scope.organizationScope).toBe("unspecified");
    expect(parsed.scope.objectId).toBeNull();
    expect(parsed.toolPlan).toEqual([]);
    expect(parsed.queryClass).toBe("unknown");
    expect(parsed.targetEntity).toBeNull();
    expect(parsed.metric).toBe("none");
    expect(parsed.groupBy).toBeNull();
    expect(parsed.domainCandidates).toEqual([]);
    expect(parsed.optionalContextDomains).toEqual([]);
    expect(parsed.analysisOps).toEqual([]);
  });

  it("lehnt unbekannten taskType ab", () => {
    const broken = { ...VALID_PLAN, taskType: "do_anything" };
    expect(sentinelPlanSchema.safeParse(broken).success).toBe(false);
  });

  it("lehnt confidence > 1 ab", () => {
    const broken = { ...VALID_PLAN, confidence: 1.5 };
    expect(sentinelPlanSchema.safeParse(broken).success).toBe(false);
  });

  it("Fallback-Plan ist gueltig gegen Schema", () => {
    const parsed = sentinelPlanSchema.safeParse(SENTINEL_PLAN_FALLBACK);
    expect(parsed.success).toBe(true);
  });
});
