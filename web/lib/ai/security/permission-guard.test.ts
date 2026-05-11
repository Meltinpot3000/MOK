import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { AiUserContext } from "@/lib/ai/types";
import type { AiToolDefinition } from "@/lib/ai/tools/types";

import {
  checkRunPrerequisites,
  checkToolPermission,
  filterToolPlanByPermissions,
} from "./permission-guard";
import { combinePolicy, DEFAULT_AI_ADMIN_SETTINGS } from "./policy-engine";
import { getSharedLlmPolicy } from "@/lib/llm/policy";

function makeUser(caps: string[]): AiUserContext {
  return {
    userId: "u1",
    organizationId: "o1",
    organizationName: "Acme",
    membershipId: "m1",
    roleCodes: ["org_admin"],
    permissionCodes: new Set(caps),
  };
}

function makePolicy(overrides: Partial<Parameters<typeof combinePolicy>[0]["adminSettings"]> = {}) {
  return combinePolicy({
    organizationId: "o1",
    adminSettings: { ...DEFAULT_AI_ADMIN_SETTINGS, organizationId: "o1", aiEnabled: true, ...overrides },
    sharedLlmPolicy: getSharedLlmPolicy(null),
    providerAvailability: { ollama: true, groq: false, gemini: false, openaiCompat: false, anthropic: false },
  });
}

const dummyTool: AiToolDefinition = {
  name: "demo_tool",
  description: "demo",
  domain: "okr",
  mode: "read",
  requiredCapabilities: ["nav.okr-workspace.read"],
  inputSchema: z.object({}).passthrough(),
  dataClassification: "internal",
  async execute() {
    return { toolName: "demo_tool", success: true, data: null, outputSummary: "" };
  },
};

describe("permission-guard", () => {
  it("blockiert Run, wenn ai.assistant.use fehlt", () => {
    const result = checkRunPrerequisites(makeUser(["nav.ai-assistant.read"]), makePolicy());
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("ai_assistant_use_missing");
  });

  it("erlaubt Run, wenn ai.assistant.use + aiEnabled", () => {
    const result = checkRunPrerequisites(makeUser(["ai.assistant.use"]), makePolicy());
    expect(result.allowed).toBe(true);
  });

  it("dropt Tool ohne erforderliche Capability", () => {
    const result = checkToolPermission(
      dummyTool,
      makeUser(["ai.assistant.use"]),
      makePolicy()
    );
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("tool_capability_missing");
  });

  it("erlaubt Tool mit allen Capabilities", () => {
    const result = checkToolPermission(
      dummyTool,
      makeUser(["ai.assistant.use", "nav.okr-workspace.read"]),
      makePolicy()
    );
    expect(result.allowed).toBe(true);
  });

  it("filterToolPlanByPermissions trennt allowed/dropped", () => {
    const filtered = filterToolPlanByPermissions(
      [
        { toolName: "demo_tool" },
        { toolName: "unknown_tool" },
      ],
      (name) => (name === "demo_tool" ? dummyTool : null),
      makeUser(["ai.assistant.use", "nav.okr-workspace.read"]),
      makePolicy()
    );
    expect(filtered.allowed).toHaveLength(1);
    expect(filtered.dropped).toHaveLength(1);
    expect(filtered.dropped[0].reason).toMatch(/Unbekanntes Tool/);
  });
});
