import type { ZodTypeAny, z } from "zod";

import type { AssistantUiContext, AiUserContext } from "@/lib/ai/types";
import type { SentinelPlan, SentinelToolPlanItem } from "@/lib/ai/sentinel-core/schemas";
import { normalizeToolInput } from "@/lib/ai/sentinel-core/normalize-tool-input";
import { filterToolPlanByPermissions } from "@/lib/ai/security/permission-guard";
import type { EffectivePolicy } from "@/lib/ai/security/policy-engine";
import { getToolByName } from "@/lib/ai/tools/registry";
import type { AiToolDefinition } from "@/lib/ai/tools/types";

export type ExecutablePlanStep = {
  stepId: string;
  toolName: string;
  toolDefinition: AiToolDefinition;
  normalizedInput: Record<string, unknown>;
  required: boolean;
  purpose: string;
  dependsOn: string[];
  /** Reihenfolge der Ausfuehrung; gleiche Stage = parallelisierbar. */
  stage: number;
};

export type ExecutablePlanWarning = {
  type:
    | "permission_dropped"
    | "deduplicated"
    | "schema_invalid"
    | "capped_by_max_tool_calls"
    | "normalization";
  toolName: string;
  detail: string;
};

export type ExecutablePlan = {
  steps: ExecutablePlanStep[];
  warnings: ExecutablePlanWarning[];
  droppedToolNames: string[];
};

function fingerprintInput(input: unknown): string {
  return JSON.stringify(input ?? null, Object.keys(input as Record<string, unknown> ?? {}).sort());
}

function topoSortByDependencies(
  steps: ExecutablePlanStep[],
  toolNameToStepId: Map<string, string>
): ExecutablePlanStep[] {
  // Each step has dependsOn: list of toolNames. Map to stepIds first.
  const dependsOnIds = new Map<string, Set<string>>();
  for (const step of steps) {
    const ids = new Set<string>();
    for (const depToolName of step.dependsOn) {
      const depStepId = toolNameToStepId.get(depToolName);
      if (depStepId && depStepId !== step.stepId) {
        ids.add(depStepId);
      }
    }
    dependsOnIds.set(step.stepId, ids);
  }

  const stage = new Map<string, number>();
  let safety = steps.length * 4 + 4;
  const pending = new Set(steps.map((s) => s.stepId));
  let currentStage = 0;
  while (pending.size > 0 && safety > 0) {
    const ready: string[] = [];
    for (const stepId of pending) {
      const deps = dependsOnIds.get(stepId) ?? new Set<string>();
      const allResolved = [...deps].every((depId) => stage.has(depId));
      if (allResolved) ready.push(stepId);
    }
    if (ready.length === 0) {
      // cycle detected — flatten remaining into current stage
      for (const stepId of pending) {
        stage.set(stepId, currentStage);
      }
      break;
    }
    for (const stepId of ready) {
      stage.set(stepId, currentStage);
      pending.delete(stepId);
    }
    currentStage += 1;
    safety -= 1;
  }
  return steps
    .map((step) => ({ ...step, stage: stage.get(step.stepId) ?? 0 }))
    .sort((a, b) => a.stage - b.stage || a.stepId.localeCompare(b.stepId));
}

export function buildExecutablePlan(args: {
  plan: SentinelPlan;
  userContext: AiUserContext;
  uiContext: AssistantUiContext | null | undefined;
  policy: EffectivePolicy;
  resolveTool?: (name: string) => AiToolDefinition | null;
}): ExecutablePlan {
  const resolveTool = args.resolveTool ?? getToolByName;
  const warnings: ExecutablePlanWarning[] = [];

  const guard = filterToolPlanByPermissions<SentinelToolPlanItem>(
    args.plan.toolPlan,
    resolveTool,
    args.userContext,
    args.policy
  );
  for (const dropped of guard.dropped) {
    warnings.push({
      type: "permission_dropped",
      toolName: dropped.item.toolName,
      detail: dropped.reason,
    });
  }
  const droppedToolNames = guard.dropped.map((d) => d.item.toolName);

  const seenFingerprints = new Set<string>();
  const intermediate: ExecutablePlanStep[] = [];
  let stepCounter = 0;
  for (const entry of guard.allowed) {
    const tool = entry.toolDefinition;
    const normalization = normalizeToolInput(
      { name: tool.name, requiresObjectId: tool.requiresObjectId },
      entry.item.input,
      args.uiContext,
      args.userContext
    );
    for (const w of normalization.warnings) {
      warnings.push({
        type: "normalization",
        toolName: tool.name,
        detail: `${w.field}: ${w.reason}`,
      });
    }

    const validation = (tool.inputSchema as ZodTypeAny).safeParse(normalization.input);
    if (!validation.success) {
      warnings.push({
        type: "schema_invalid",
        toolName: tool.name,
        detail: validation.error.message,
      });
      continue;
    }
    const validated = validation.data as z.infer<typeof tool.inputSchema>;
    const fingerprint = `${tool.name}|${fingerprintInput(validated)}`;
    if (seenFingerprints.has(fingerprint)) {
      warnings.push({
        type: "deduplicated",
        toolName: tool.name,
        detail: "Identischer Tool-Input bereits geplant.",
      });
      continue;
    }
    seenFingerprints.add(fingerprint);
    stepCounter += 1;
    intermediate.push({
      stepId: `step_${stepCounter.toString().padStart(3, "0")}`,
      toolName: tool.name,
      toolDefinition: tool,
      normalizedInput: validated as Record<string, unknown>,
      required: entry.item.required,
      purpose: entry.item.purpose,
      dependsOn: tool.dependsOnTools ?? [],
      stage: 0,
    });
  }

  const toolNameToStepId = new Map<string, string>();
  for (const step of intermediate) {
    if (!toolNameToStepId.has(step.toolName)) {
      toolNameToStepId.set(step.toolName, step.stepId);
    }
  }

  const sorted = topoSortByDependencies(intermediate, toolNameToStepId);

  const cap = Math.max(1, args.policy.maxToolCallsPerRun);
  if (sorted.length > cap) {
    for (const dropped of sorted.slice(cap)) {
      warnings.push({
        type: "capped_by_max_tool_calls",
        toolName: dropped.toolName,
        detail: `Cap=${cap} erreicht; Schritt entfernt.`,
      });
    }
  }
  return {
    steps: sorted.slice(0, cap),
    warnings,
    droppedToolNames,
  };
}

export function groupStepsByStage(steps: ExecutablePlanStep[]): ExecutablePlanStep[][] {
  const groups = new Map<number, ExecutablePlanStep[]>();
  for (const step of steps) {
    const arr = groups.get(step.stage) ?? [];
    arr.push(step);
    groups.set(step.stage, arr);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, arr]) => arr.sort((x, y) => x.stepId.localeCompare(y.stepId)));
}
