import type { AssistantUiContext, AiUserContext } from "@/lib/ai/types";

const CYCLE_ALIASES: Record<string, "current" | "previous" | "all" | "unspecified"> = {
  current: "current",
  "current cycle": "current",
  "current quarter": "current",
  "current period": "current",
  "this cycle": "current",
  "this quarter": "current",
  aktuell: "current",
  "aktueller zyklus": "current",
  "aktuelles quartal": "current",
  laufend: "current",
  "laufender zyklus": "current",
  previous: "previous",
  "previous cycle": "previous",
  "previous quarter": "previous",
  "last cycle": "previous",
  "last quarter": "previous",
  vorheriger: "previous",
  "vorheriger zyklus": "previous",
  "letzter zyklus": "previous",
  all: "all",
  "all cycles": "all",
  alle: "all",
  unspecified: "unspecified",
  none: "unspecified",
  "": "unspecified",
};

const ORG_SCOPE_ALIASES: Record<string, "own" | "team" | "visible" | "global" | "unspecified"> = {
  own: "own",
  "my own": "own",
  "only me": "own",
  ich: "own",
  team: "team",
  "my team": "team",
  "for my team": "team",
  "mein team": "team",
  visible: "visible",
  "all visible": "visible",
  sichtbar: "visible",
  "alle sichtbaren": "visible",
  global: "global",
  organization: "global",
  "whole organization": "global",
  "ganze organisation": "global",
  unspecified: "unspecified",
  "": "unspecified",
};

const REQUIRES_OBJECT_TOOL_NAMES = new Set<string>([
  "get_okr_objective_context",
  "get_initiative_context",
  "get_strategy_objective_context",
  "get_review_session_context",
]);

export type ToolDefinitionShape = {
  name: string;
  /** Falls Tool ein objectId benoetigt, kann es aus uiContext ergaenzt werden. */
  requiresObjectId?: boolean;
};

export type NormalizationWarning = {
  field: string;
  reason: string;
  beforeValue?: unknown;
  afterValue?: unknown;
};

export type NormalizeToolInputResult = {
  input: Record<string, unknown>;
  warnings: NormalizationWarning[];
};

function normalizeStringEnum<T extends string>(
  raw: unknown,
  aliases: Record<string, T>,
  fallback: T
): { value: T; original: unknown } {
  if (typeof raw !== "string") return { value: fallback, original: raw };
  const lookup = aliases[raw.trim().toLowerCase()];
  return { value: lookup ?? fallback, original: raw };
}

function takeOrgUnitNameFromUserContext(
  raw: unknown,
  userContext: AiUserContext
): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === userContext.organizationName.toLowerCase()) {
    return userContext.organizationId;
  }
  return null;
}

/**
 * Normalisiert vom LLM gelieferten Tool-Input vor der finalen Zod-Validation:
 * - Cycle/OrganizationScope-Aliase auf kanonische Werte mappen
 * - Fehlende objectType/objectId aus UI-Kontext ergaenzen, wenn Tool sie braucht
 * - Organisationseinheits-Namen (best effort) auf bekannte IDs aufloesen
 *
 * Reine Pure-Function (testbar in Vitest).
 */
export function normalizeToolInput(
  tool: ToolDefinitionShape,
  rawInput: unknown,
  uiContext: AssistantUiContext | null | undefined,
  userContext: AiUserContext
): NormalizeToolInputResult {
  const warnings: NormalizationWarning[] = [];
  const base: Record<string, unknown> = {};
  if (rawInput && typeof rawInput === "object" && !Array.isArray(rawInput)) {
    Object.assign(base, rawInput as Record<string, unknown>);
  }

  if (base.cycle !== undefined) {
    const { value, original } = normalizeStringEnum(base.cycle, CYCLE_ALIASES, "unspecified");
    if (typeof original === "string" && original.trim().toLowerCase() !== value) {
      warnings.push({
        field: "cycle",
        reason: "alias_to_canonical",
        beforeValue: original,
        afterValue: value,
      });
    }
    base.cycle = value;
  }

  if (base.organizationScope !== undefined) {
    const { value, original } = normalizeStringEnum(
      base.organizationScope,
      ORG_SCOPE_ALIASES,
      "unspecified"
    );
    if (typeof original === "string" && original.trim().toLowerCase() !== value) {
      warnings.push({
        field: "organizationScope",
        reason: "alias_to_canonical",
        beforeValue: original,
        afterValue: value,
      });
    }
    base.organizationScope = value;
  }

  if (base.organizationUnitId !== undefined && typeof base.organizationUnitId === "string") {
    const trimmed = base.organizationUnitId.trim();
    if (trimmed.length === 0) {
      base.organizationUnitId = null;
    } else if (!/^[0-9a-fA-F-]{36}$/.test(trimmed)) {
      const resolved = takeOrgUnitNameFromUserContext(trimmed, userContext);
      if (resolved) {
        warnings.push({
          field: "organizationUnitId",
          reason: "resolved_name_to_id",
          beforeValue: trimmed,
          afterValue: resolved,
        });
        base.organizationUnitId = resolved;
      } else {
        warnings.push({
          field: "organizationUnitId",
          reason: "unresolved_name_dropped",
          beforeValue: trimmed,
          afterValue: null,
        });
        base.organizationUnitId = null;
      }
    }
  }

  if (uiContext) {
    if (!base.objectType && uiContext.objectType) {
      base.objectType = uiContext.objectType;
      warnings.push({
        field: "objectType",
        reason: "filled_from_ui_context",
        afterValue: uiContext.objectType,
      });
    }
    const needsObjectId = tool.requiresObjectId || REQUIRES_OBJECT_TOOL_NAMES.has(tool.name);
    if (needsObjectId && !base.objectId && uiContext.objectId) {
      base.objectId = uiContext.objectId;
      warnings.push({
        field: "objectId",
        reason: "filled_from_ui_context",
        afterValue: uiContext.objectId,
      });
    }
    if (!base.cycleId && uiContext.cycleId) {
      base.cycleId = uiContext.cycleId;
      warnings.push({
        field: "cycleId",
        reason: "filled_from_ui_context",
        afterValue: uiContext.cycleId,
      });
    }
  }

  if (typeof base.organizationId !== "string") {
    base.organizationId = userContext.organizationId;
    warnings.push({
      field: "organizationId",
      reason: "filled_from_user_context",
      afterValue: userContext.organizationId,
    });
  } else if (base.organizationId !== userContext.organizationId) {
    warnings.push({
      field: "organizationId",
      reason: "overridden_to_user_organization",
      beforeValue: base.organizationId,
      afterValue: userContext.organizationId,
    });
    base.organizationId = userContext.organizationId;
  }

  return { input: base, warnings };
}
