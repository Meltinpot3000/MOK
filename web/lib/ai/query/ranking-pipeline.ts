import type { RankingContract } from "@/lib/ai/answers/answer-contracts";

import type { ExecutePermissionedToolFn, QueryPipelineResult, QueryPlan } from "./query-types";

type OwnerRankingRow = {
  ownerMembershipId: string | null;
  ownerDisplayName?: string;
  objectiveCount: number;
  objectiveIds?: string[];
};

export async function runRankingPipeline(args: {
  plan: QueryPlan;
  executePermissionedTool: ExecutePermissionedToolFn;
}): Promise<QueryPipelineResult> {
  const usedToolCalls: QueryPipelineResult["usedToolCalls"] = [];
  const warnings: string[] = [];
  const missingTools: string[] = [];
  const missingCapabilities: string[] = [];

  const cycleResult =
    args.plan.scope.cycle === "current"
      ? await args.executePermissionedTool("get_current_okr_cycle", {})
      : null;
  if (cycleResult) {
    usedToolCalls.push({
      toolName: cycleResult.toolName,
      inputSummary: "{}",
      outputSummary: cycleResult.outputSummary,
      success: cycleResult.success,
    });
  }
  if (cycleResult && !cycleResult.success) {
    if (cycleResult.error === "tool_not_registered") missingTools.push(cycleResult.toolName);
    if (cycleResult.error === "missing_capability") missingCapabilities.push(cycleResult.toolName);
  }
  const cycleInstanceId =
    cycleResult?.success && cycleResult.data && typeof cycleResult.data === "object"
      ? ((cycleResult.data as { cycleInstanceId?: string }).cycleInstanceId ?? null)
      : null;

  const ownerCountsResult = await args.executePermissionedTool("get_okr_objective_owner_counts", {
    cycleInstanceId: cycleInstanceId ?? undefined,
    cycle: args.plan.scope.cycle === "current" ? "current" : undefined,
    limitOwners: 20,
  });
  usedToolCalls.push({
    toolName: ownerCountsResult.toolName,
    inputSummary: JSON.stringify({
      cycleInstanceId: cycleInstanceId ?? undefined,
      cycle: args.plan.scope.cycle === "current" ? "current" : undefined,
      limitOwners: 20,
    }),
    outputSummary: ownerCountsResult.outputSummary,
    success: ownerCountsResult.success,
  });
  if (!ownerCountsResult.success) {
    if (ownerCountsResult.error === "tool_not_registered") missingTools.push(ownerCountsResult.toolName);
    if (ownerCountsResult.error === "missing_capability") missingCapabilities.push(ownerCountsResult.toolName);
  }
  const retrievalStatus =
    ownerCountsResult.success && (!cycleResult || cycleResult.success)
      ? "ok"
      : missingTools.length > 0 || missingCapabilities.length > 0 || !ownerCountsResult.success
        ? "failed"
        : "partial";
  const data =
    ownerCountsResult.success && ownerCountsResult.data && typeof ownerCountsResult.data === "object"
      ? (ownerCountsResult.data as {
          cycleInstanceId?: string;
          cycleLabel?: string;
          totalObjectives?: number;
          ownerRanking?: OwnerRankingRow[];
        })
      : null;
  const rows = data?.ownerRanking ?? [];

  const top = rows
    .filter((row) => (row.objectiveCount ?? 0) > 0)
    .map((row, index) => ({
      rank: index + 1,
      label: row.ownerDisplayName ?? row.ownerMembershipId ?? "Nicht zugewiesen",
      count: row.objectiveCount ?? 0,
      evidenceIds: row.objectiveIds ?? [],
    }));

  for (const entry of top) {
    if (entry.count !== entry.evidenceIds.length) {
      warnings.push(`evidence_count_mismatch:${entry.label}`);
    }
  }

  const contract: RankingContract = {
    queryClass: "ranking",
    domain: args.plan.domain ?? "okr",
    metric: "objective_count",
    groupBy: args.plan.groupBy,
    scope: {
      cycleId: data?.cycleInstanceId ?? null,
      cycleLabel: data?.cycleLabel ?? null,
    },
    totalItems: retrievalStatus === "failed" ? null : (data?.totalObjectives ?? 0),
    top: retrievalStatus === "failed" ? [] : top,
    evidenceSummary: `Owner-Ranking aus ${rows.length} Owner-Zeilen`,
    confidence: top.length > 0 ? "high" : "medium",
    retrievalStatus,
    missingCapabilities,
    missingTools,
    requestedOps: args.plan.analysisOps,
    coveredOps: ["rank", "count_total"],
    missingOps: [],
  };

  return {
    contract,
    evidence: top.flatMap((entry) => entry.evidenceIds.map((id) => ({ id, label: entry.label }))),
    warnings,
    usedToolCalls,
    contractSource: "pipeline",
  };
}

