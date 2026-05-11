import type { AiUserContext } from "@/lib/ai/types";
import type { AiToolDefinition } from "@/lib/ai/tools/types";

import type { EffectivePolicy } from "./policy-engine";

export type PermissionGuardCheck = {
  allowed: boolean;
  reason?: string;
  reasonCode?:
    | "ai_disabled"
    | "ai_assistant_use_missing"
    | "tool_capability_missing"
    | "tool_mode_blocked"
    | "tool_classification_blocked"
    | "tool_disabled_by_admin";
};

/**
 * Vorbedingung fuer den gesamten Run: ai.assistant.use und ai_enabled.
 */
export function checkRunPrerequisites(
  userContext: AiUserContext,
  policy: EffectivePolicy
): PermissionGuardCheck {
  if (!policy.aiEnabled) {
    return {
      allowed: false,
      reasonCode: "ai_disabled",
      reason: "Sentinel Assistant ist fuer diese Organisation deaktiviert.",
    };
  }
  if (!userContext.permissionCodes.has("ai.assistant.use")) {
    return {
      allowed: false,
      reasonCode: "ai_assistant_use_missing",
      reason: "Capability ai.assistant.use fehlt.",
    };
  }
  return { allowed: true };
}

/**
 * Permission-Check fuer ein einzelnes Tool. Tools, die durchfallen, werden vom
 * Orchestrator gedroppt (nicht den ganzen Run abbrechen).
 */
export function checkToolPermission(
  tool: AiToolDefinition,
  userContext: AiUserContext,
  policy: EffectivePolicy
): PermissionGuardCheck {
  if (tool.mode === "write" && !policy.writeActionsEnabled) {
    return {
      allowed: false,
      reasonCode: "tool_mode_blocked",
      reason: `Tool ${tool.name} (mode=write) ist deaktiviert (write_actions_enabled=false).`,
    };
  }
  for (const cap of tool.requiredCapabilities) {
    if (!userContext.permissionCodes.has(cap)) {
      return {
        allowed: false,
        reasonCode: "tool_capability_missing",
        reason: `Tool ${tool.name} benoetigt Capability ${cap}.`,
      };
    }
  }
  if (tool.dataClassification === "restricted" && !policy.allowRestrictedClassification) {
    return {
      allowed: false,
      reasonCode: "tool_classification_blocked",
      reason: `Tool ${tool.name} liefert Daten mit Klassifikation 'restricted'; nicht erlaubt.`,
    };
  }
  return { allowed: true };
}

/**
 * Filtert eine Tool-Plan-Liste (Plan vom LLM) gegen Permission-Guard.
 * Liefert Allow-Liste plus die gedroppten Eintraege mit Begruendungen.
 */
export type ToolPlanGuardEntry<TItem> = {
  item: TItem;
  toolDefinition: AiToolDefinition;
};

export type ToolPlanGuardResult<TItem> = {
  allowed: ToolPlanGuardEntry<TItem>[];
  dropped: Array<{ item: TItem; reason: string; reasonCode: string }>;
};

export function filterToolPlanByPermissions<TItem extends { toolName: string }>(
  toolPlan: TItem[],
  resolveTool: (name: string) => AiToolDefinition | null,
  userContext: AiUserContext,
  policy: EffectivePolicy
): ToolPlanGuardResult<TItem> {
  const allowed: ToolPlanGuardEntry<TItem>[] = [];
  const dropped: ToolPlanGuardResult<TItem>["dropped"] = [];

  for (const item of toolPlan) {
    const def = resolveTool(item.toolName);
    if (!def) {
      dropped.push({
        item,
        reasonCode: "tool_capability_missing",
        reason: `Unbekanntes Tool '${item.toolName}'.`,
      });
      continue;
    }
    const check = checkToolPermission(def, userContext, policy);
    if (!check.allowed) {
      dropped.push({
        item,
        reasonCode: check.reasonCode ?? "tool_capability_missing",
        reason: check.reason ?? "Permission denied",
      });
      continue;
    }
    allowed.push({ item, toolDefinition: def });
  }

  return { allowed, dropped };
}
