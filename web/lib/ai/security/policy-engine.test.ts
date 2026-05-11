import { describe, expect, it } from "vitest";

import { combinePolicy, DEFAULT_AI_ADMIN_SETTINGS } from "./policy-engine";
import { getSharedLlmPolicy, type SharedLlmPolicy } from "@/lib/llm/policy";

const baseShared: SharedLlmPolicy = getSharedLlmPolicy(null);

describe("combinePolicy (strengste Regel gewinnt)", () => {
  it("aiEnabled=false bei Admin disabled", () => {
    const policy = combinePolicy({
      organizationId: "org",
      adminSettings: { ...DEFAULT_AI_ADMIN_SETTINGS, organizationId: "org", aiEnabled: false },
      sharedLlmPolicy: baseShared,
      providerAvailability: { ollama: true, groq: true, gemini: true, openaiCompat: false, anthropic: false },
    });
    expect(policy.aiEnabled).toBe(false);
  });

  it("aiEnabled=true bei Admin enabled + lokales LLM verfuegbar", () => {
    const policy = combinePolicy({
      organizationId: "org",
      adminSettings: { ...DEFAULT_AI_ADMIN_SETTINGS, organizationId: "org", aiEnabled: true, localLlmEnabled: true },
      sharedLlmPolicy: baseShared,
      providerAvailability: { ollama: true, groq: false, gemini: false, openaiCompat: false, anthropic: false },
    });
    expect(policy.aiEnabled).toBe(true);
    expect(policy.externalModelsEnabled).toBe(false);
  });

  it("blockiert externalModelsEnabled, wenn keine Provider-Keys gesetzt sind", () => {
    const policy = combinePolicy({
      organizationId: "org",
      adminSettings: {
        ...DEFAULT_AI_ADMIN_SETTINGS,
        organizationId: "org",
        aiEnabled: true,
        localLlmEnabled: true,
        externalModelsEnabled: true,
      },
      sharedLlmPolicy: baseShared,
      providerAvailability: { ollama: true, groq: false, gemini: false, openaiCompat: false, anthropic: false },
    });
    expect(policy.externalModelsEnabled).toBe(false);
    expect(policy.blockedReasons.some((r) => r.includes("externen LLM-Provider"))).toBe(true);
  });

  it("webSearchEnabled erfordert externe Modelle", () => {
    const policy = combinePolicy({
      organizationId: "org",
      adminSettings: {
        ...DEFAULT_AI_ADMIN_SETTINGS,
        organizationId: "org",
        aiEnabled: true,
        localLlmEnabled: true,
        externalModelsEnabled: false,
        webSearchEnabled: true,
      },
      sharedLlmPolicy: baseShared,
      providerAvailability: { ollama: true, groq: false, gemini: false, openaiCompat: false, anthropic: false },
    });
    expect(policy.webSearchEnabled).toBe(false);
    expect(policy.blockedReasons.some((r) => r.includes("Web-Suche"))).toBe(true);
  });
});
