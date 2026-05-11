import type { DistributionContract } from "@/lib/ai/answers/answer-contracts";
import { buildOkrObjectiveFacts } from "@/lib/ai/facts/fact-builder";
import { distributionByKey } from "@/lib/ai/facts/aggregations";

import type { ExecutePermissionedToolFn, QueryPipelineResult, QueryPlan } from "./query-types";

export async function runDistributionPipeline(args: {
  plan: QueryPlan;
  executePermissionedTool: ExecutePermissionedToolFn;
}): Promise<QueryPipelineResult> {
  const usedToolCalls: QueryPipelineResult["usedToolCalls"] = [];
  const missingTools: string[] = [];
  const missingCapabilities: string[] = [];
  const objectivesResult = await args.executePermissionedTool("get_visible_okr_objectives", {
    limit: 100,
  });
  usedToolCalls.push({
    toolName: objectivesResult.toolName,
    inputSummary: JSON.stringify({ limit: 100 }),
    outputSummary: objectivesResult.outputSummary,
    success: objectivesResult.success,
  });
  if (!objectivesResult.success) {
    if (objectivesResult.error === "tool_not_registered") missingTools.push(objectivesResult.toolName);
    if (objectivesResult.error === "missing_capability") missingCapabilities.push(objectivesResult.toolName);
  }
  const retrievalStatus = objectivesResult.success ? "ok" : "failed";
  const facts = objectivesResult.success ? buildOkrObjectiveFacts(objectivesResult) : [];
  const dist = distributionByKey(facts, (fact) => fact.status ?? "unknown");
  const contract: DistributionContract = {
    queryClass: "distribution",
    domain: args.plan.domain ?? "okr",
    metric: args.plan.metric,
    groupBy: args.plan.groupBy,
    scope: { cycle: args.plan.scope.cycle },
    total: retrievalStatus === "failed" ? null : dist.total,
    buckets: dist.buckets.map((bucket) => ({
      label: bucket.label,
      count: bucket.count,
      share: bucket.share,
      evidenceIds: facts.filter((f) => (f.status ?? "unknown") === bucket.label).map((f) => f.id),
    })),
    confidence: "high",
    retrievalStatus,
    missingCapabilities,
    missingTools,
    requestedOps: args.plan.analysisOps,
    coveredOps: ["distribution"],
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

