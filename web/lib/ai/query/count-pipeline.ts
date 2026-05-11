import type { CountContract } from "@/lib/ai/answers/answer-contracts";
import { buildOkrObjectiveFacts } from "@/lib/ai/facts/fact-builder";

import type { ExecutePermissionedToolFn, QueryPipelineResult, QueryPlan } from "./query-types";

export async function runCountPipeline(args: {
  plan: QueryPlan;
  executePermissionedTool: ExecutePermissionedToolFn;
}): Promise<QueryPipelineResult> {
  const usedToolCalls: QueryPipelineResult["usedToolCalls"] = [];
  const missingTools: string[] = [];
  const missingCapabilities: string[] = [];
  const cycleResult = await args.executePermissionedTool("get_current_okr_cycle", {});
  usedToolCalls.push({
    toolName: cycleResult.toolName,
    inputSummary: "{}",
    outputSummary: cycleResult.outputSummary,
    success: cycleResult.success,
  });
  const cycleInstanceId =
    cycleResult.success && cycleResult.data && typeof cycleResult.data === "object"
      ? ((cycleResult.data as { cycleInstanceId?: string }).cycleInstanceId ?? null)
      : null;
  const objectivesResult = await args.executePermissionedTool("get_visible_okr_objectives", {
    cycleInstanceId: cycleInstanceId ?? undefined,
    limit: 100,
  });
  usedToolCalls.push({
    toolName: objectivesResult.toolName,
    inputSummary: JSON.stringify({ cycleInstanceId: cycleInstanceId ?? undefined, limit: 100 }),
    outputSummary: objectivesResult.outputSummary,
    success: objectivesResult.success,
  });
  for (const result of [cycleResult, objectivesResult]) {
    if (result.success) continue;
    if (result.error === "tool_not_registered") missingTools.push(result.toolName);
    if (result.error === "missing_capability") missingCapabilities.push(result.toolName);
  }
  const retrievalStatus =
    cycleResult.success && objectivesResult.success
      ? "ok"
      : missingTools.length > 0 || missingCapabilities.length > 0 || !cycleResult.success || !objectivesResult.success
        ? "failed"
        : "partial";

  const facts = objectivesResult.success ? buildOkrObjectiveFacts(objectivesResult) : [];
  const contract: CountContract = {
    queryClass: "count",
    domain: args.plan.domain ?? "okr",
    metric: args.plan.metric,
    scope: { cycle: args.plan.scope.cycle },
    value: retrievalStatus === "failed" ? null : facts.length,
    evidenceIds: facts.map((f) => f.id),
    confidence: "high",
    retrievalStatus,
    missingCapabilities,
    missingTools,
    requestedOps: args.plan.analysisOps,
    coveredOps: ["count_total"],
    missingOps: [],
  };
  return {
    contract,
    evidence: facts.map((fact) => ({ id: fact.id, label: fact.title, objectType: "okr_objective" })),
    warnings: [],
    usedToolCalls,
    contractSource: "pipeline",
  };
}

