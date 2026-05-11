import { z } from "zod";

import type { AiToolDefinition, AiToolExecuteArgs, AiToolResult } from "./types";

const inputSchema = z.object({}).passthrough();

export const getCurrentUserContextTool: AiToolDefinition<typeof inputSchema> = {
  name: "get_current_user_context",
  description:
    "Liefert den aktuellen User-Kontext (Membership, Organisation, Rollen, Permission-Codes).",
  domain: "organization",
  mode: "read",
  requiredCapabilities: ["nav.ai-assistant.read"],
  inputSchema,
  inputSchemaHint: "{} (kein Input erforderlich)",
  dataClassification: "internal",
  async execute({ userContext }: AiToolExecuteArgs<unknown>): Promise<AiToolResult> {
    const data = {
      userId: userContext.userId,
      organizationId: userContext.organizationId,
      organizationName: userContext.organizationName,
      membershipId: userContext.membershipId,
      roleCodes: userContext.roleCodes,
      capabilityCount: userContext.permissionCodes.size,
      capabilities: [...userContext.permissionCodes].sort(),
    };
    return {
      toolName: "get_current_user_context",
      success: true,
      data,
      outputSummary: `User ${userContext.userId.slice(0, 8)} in ${userContext.organizationName}, Rollen: ${userContext.roleCodes.join(", ") || "(keine)"}; ${data.capabilityCount} Capabilities.`,
      contextSources: [
        {
          sourceType: "user",
          sourceId: userContext.userId,
          sourceTitle: userContext.organizationName,
          classification: "internal",
          relevanceScore: 1.0,
          sourceReason: "Aktive Membership des Users",
        },
      ],
    };
  },
};
