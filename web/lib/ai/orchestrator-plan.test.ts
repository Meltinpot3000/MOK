import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { AiUserContext } from "@/lib/ai/types";
import type { AiToolDefinition } from "@/lib/ai/tools/types";
import { combinePolicy, DEFAULT_AI_ADMIN_SETTINGS } from "@/lib/ai/security/policy-engine";
import { getSharedLlmPolicy } from "@/lib/llm/policy";
import type { SentinelPlan } from "@/lib/ai/sentinel-core/schemas";

import { buildExecutablePlan, groupStepsByStage } from "./orchestrator-plan";

function makeUserContext(): AiUserContext {
  return {
    userId: "u1",
    organizationId: "11111111-1111-1111-1111-111111111111",
    organizationName: "Acme",
    membershipId: "33333333-3333-3333-3333-333333333333",
    roleCodes: ["org_admin"],
    permissionCodes: new Set([
      "ai.assistant.use",
      "nav.okr-workspace.read",
      "okr.read",
      "nav.initiatives.read",
    ]),
  };
}

function makePolicy(maxToolCallsPerRun = 8) {
  return combinePolicy({
    organizationId: "11111111-1111-1111-1111-111111111111",
    adminSettings: {
      ...DEFAULT_AI_ADMIN_SETTINGS,
      organizationId: "11111111-1111-1111-1111-111111111111",
      aiEnabled: true,
      maxToolCallsPerRun,
    },
    sharedLlmPolicy: getSharedLlmPolicy(null),
    providerAvailability: { ollama: true, groq: false, gemini: false, openaiCompat: false, anthropic: false },
  });
}

const baseInputSchema = z.object({}).passthrough();

const okrTool: AiToolDefinition = {
  name: "tool_a",
  description: "tool a",
  domain: "okr",
  mode: "read",
  requiredCapabilities: ["nav.okr-workspace.read"],
  inputSchema: baseInputSchema,
  dataClassification: "internal",
  async execute() {
    return { toolName: "tool_a", success: true, data: null, outputSummary: "" };
  },
};
const initiativeTool: AiToolDefinition = {
  name: "tool_b",
  description: "tool b",
  domain: "initiative",
  mode: "read",
  requiredCapabilities: ["nav.initiatives.read"],
  inputSchema: baseInputSchema,
  dependsOnTools: ["tool_a"],
  dataClassification: "internal",
  async execute() {
    return { toolName: "tool_b", success: true, data: null, outputSummary: "" };
  },
};
const restrictedTool: AiToolDefinition = {
  name: "tool_c",
  description: "tool c",
  domain: "okr",
  mode: "read",
  requiredCapabilities: ["nav.unknown.read"],
  inputSchema: baseInputSchema,
  dataClassification: "internal",
  async execute() {
    return { toolName: "tool_c", success: true, data: null, outputSummary: "" };
  },
};

function resolve(name: string): AiToolDefinition | null {
  if (name === "tool_a") return okrTool;
  if (name === "tool_b") return initiativeTool;
  if (name === "tool_c") return restrictedTool;
  return null;
}

function makePlan(overrides: Partial<SentinelPlan["toolPlan"]> | undefined = undefined): SentinelPlan {
  return {
    taskType: "internal_lookup",
    confidence: 0.7,
    domains: [],
    scope: {
      cycle: "unspecified",
      organizationScope: "unspecified",
      objectType: null,
      objectId: null,
      timeHorizon: null,
    },
    toolPlan: (overrides ?? []) as SentinelPlan["toolPlan"],
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
  };
}

describe("buildExecutablePlan", () => {
  it("dropt Tools ohne Permission und behaelt zugelassene", () => {
    const plan = makePlan([
      { toolName: "tool_a", purpose: "p", input: {}, required: true },
      { toolName: "tool_c", purpose: "p", input: {}, required: false },
    ]);
    const exec = buildExecutablePlan({
      plan,
      userContext: makeUserContext(),
      uiContext: null,
      policy: makePolicy(),
      resolveTool: resolve,
    });
    expect(exec.steps.map((s) => s.toolName)).toEqual(["tool_a"]);
    expect(exec.droppedToolNames).toContain("tool_c");
  });

  it("dedupliziert identische Tool-Plan-Eintraege", () => {
    const plan = makePlan([
      { toolName: "tool_a", purpose: "p", input: { x: 1 }, required: true },
      { toolName: "tool_a", purpose: "duplicate", input: { x: 1 }, required: true },
    ]);
    const exec = buildExecutablePlan({
      plan,
      userContext: makeUserContext(),
      uiContext: null,
      policy: makePolicy(),
      resolveTool: resolve,
    });
    expect(exec.steps).toHaveLength(1);
    expect(exec.warnings.some((w) => w.type === "deduplicated")).toBe(true);
  });

  it("topologisch sortiert: tool_b nach tool_a (dependsOn)", () => {
    const plan = makePlan([
      { toolName: "tool_b", purpose: "p", input: {}, required: true },
      { toolName: "tool_a", purpose: "p", input: {}, required: true },
    ]);
    const exec = buildExecutablePlan({
      plan,
      userContext: makeUserContext(),
      uiContext: null,
      policy: makePolicy(),
      resolveTool: resolve,
    });
    const stages = groupStepsByStage(exec.steps);
    const stageA = stages.findIndex((s) => s.some((step) => step.toolName === "tool_a"));
    const stageB = stages.findIndex((s) => s.some((step) => step.toolName === "tool_b"));
    expect(stageA).toBeGreaterThanOrEqual(0);
    expect(stageB).toBeGreaterThan(stageA);
  });

  it("cap maxToolCallsPerRun greift", () => {
    const plan = makePlan([
      { toolName: "tool_a", purpose: "1", input: { i: 1 }, required: true },
      { toolName: "tool_a", purpose: "2", input: { i: 2 }, required: true },
      { toolName: "tool_a", purpose: "3", input: { i: 3 }, required: true },
    ]);
    const exec = buildExecutablePlan({
      plan,
      userContext: makeUserContext(),
      uiContext: null,
      policy: makePolicy(2),
      resolveTool: resolve,
    });
    expect(exec.steps).toHaveLength(2);
    expect(exec.warnings.some((w) => w.type === "capped_by_max_tool_calls")).toBe(true);
  });
});
