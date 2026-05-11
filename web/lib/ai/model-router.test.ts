import { describe, expect, it } from "vitest";

import { routeModel } from "./model-router";
import { combinePolicy, DEFAULT_AI_ADMIN_SETTINGS } from "@/lib/ai/security/policy-engine";
import { getSharedLlmPolicy } from "@/lib/llm/policy";
import type { SentinelPlan } from "@/lib/ai/sentinel-core/schemas";

function makePolicy(overrides: Partial<Parameters<typeof combinePolicy>[0]["adminSettings"]> = {},
  availability = { ollama: true, groq: true, gemini: true, openaiCompat: false, anthropic: false }
) {
  return combinePolicy({
    organizationId: "o1",
    adminSettings: { ...DEFAULT_AI_ADMIN_SETTINGS, organizationId: "o1", aiEnabled: true, ...overrides },
    sharedLlmPolicy: getSharedLlmPolicy(null),
    providerAvailability: availability,
  });
}

function makePlan(overrides: Partial<SentinelPlan> = {}): SentinelPlan {
  return {
    taskType: "internal_lookup",
    confidence: 0.5,
    domains: [],
    scope: { cycle: "unspecified", organizationScope: "unspecified", objectType: null, objectId: null, timeHorizon: null },
    toolPlan: [],
    answerStrategy: {
      canAnswerLocally: true,
      needsInternalRetrieval: false,
      needsWebSearch: false,
      needsFrontierModel: false,
      reason: "test",
    },
    safety: {
      sensitiveDataLikely: false,
      requiresRedaction: false,
      writeActionRequested: false,
      requiresHumanApproval: false,
    },
    ...overrides,
  };
}

describe("routeModel", () => {
  it("waehlt local, wenn canAnswerLocally + lokales LLM aktiv", () => {
    const decision = routeModel({ plan: makePlan(), policy: makePolicy({ localLlmEnabled: true }) });
    expect(decision.modelTier).toBe("local");
    expect(decision.provider).toBe("ollama");
  });

  it("zeigt Downgrade-Hinweis bei externer Recherche & deaktivierter Web-Suche", () => {
    const plan = makePlan({
      taskType: "external_research",
      answerStrategy: {
        canAnswerLocally: false,
        needsInternalRetrieval: false,
        needsWebSearch: true,
        needsFrontierModel: false,
        reason: "test",
      },
    });
    const decision = routeModel({
      plan,
      policy: makePolicy({ externalModelsEnabled: false, webSearchEnabled: false }),
    });
    expect(decision.downgrade).toBeDefined();
    expect(decision.downgrade?.userMessage).toMatch(/Web/);
  });

  it("downgraded Frontier auf fast_external bei Anthropic-Lockout", () => {
    const plan = makePlan({
      answerStrategy: {
        canAnswerLocally: false,
        needsInternalRetrieval: true,
        needsWebSearch: false,
        needsFrontierModel: true,
        reason: "test",
      },
    });
    const decision = routeModel({
      plan,
      policy: makePolicy(
        { externalModelsEnabled: true },
        { ollama: true, groq: true, gemini: true, openaiCompat: false, anthropic: false }
      ),
    });
    expect(decision.modelTier).toBe("fast_external");
    expect(decision.downgrade?.from).toBe("frontier");
  });

  it("warnt sichtbar, wenn Frontier benoetigt aber externe deaktiviert", () => {
    const plan = makePlan({
      answerStrategy: {
        canAnswerLocally: false,
        needsInternalRetrieval: false,
        needsWebSearch: false,
        needsFrontierModel: true,
        reason: "test",
      },
    });
    const decision = routeModel({
      plan,
      policy: makePolicy({ externalModelsEnabled: false }),
    });
    expect(decision.modelTier).toBe("local");
    expect(decision.downgrade?.userMessage).toMatch(/Frontier/);
  });
});
