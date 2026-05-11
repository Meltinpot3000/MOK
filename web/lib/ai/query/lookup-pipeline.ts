import type { LookupContract } from "@/lib/ai/answers/answer-contracts";
import type { TaskRetrievalDiagnostics, WorkItemStatusFilter } from "@/lib/tasks/work-item-queries";
import { buildOkrObjectiveFacts, buildTaskFacts } from "@/lib/ai/facts/fact-builder";
import type { CanonicalTaskFact } from "@/lib/ai/facts/fact-types";

import type { ExecutePermissionedToolFn, QueryPipelineResult, QueryPlan } from "./query-types";

/** Pipeline intent fuer Sentinel / Lookup (heuristisch). */
export function resolveTaskStatusFilterFromPlan(plan: QueryPlan): WorkItemStatusFilter {
  /** Nur Fragetext — kein scope.timeHorizon (Smoke/UI injiziert oft «aktuell» und wuerde faelschlich «current» erzwingen). */
  const q = (plan.queryText ?? "").toLowerCase();
  if (/erledigt|abgeschlossen/.test(q)) return "completed";
  if (/unabhängig vom status|unabhaengig vom status|egal welcher status|alle status|ohne status/.test(q)) {
    return "all";
  }
  if (/wie viele.*offen|offene?\s+aufgaben|\boffen\b/.test(q)) return "open";
  if (/aktuell|betreffen mich|laufende|pending/.test(q)) return "current";
  return "all";
}

export function resolveTaskToolModifiers(plan: QueryPlan): {
  taskTypeFilter?: "approval";
  excludeApproval?: boolean;
  requireOkrLink?: boolean;
} {
  const q = `${plan.queryText ?? ""}`.toLowerCase();
  const excludeApproval = /normale aufgaben|ohne approval|keine approval|nicht.*approval/.test(q);
  const approvalExplicit =
    /approval/.test(q) &&
    !excludeApproval &&
    !/wie viele.*offen.*okr/.test(q);
  const requireOkrLink =
    (/okr|key result|objective/i.test(q) && /verknüpf|verbunden|linked|mit okr|zu okrs?/.test(q)) ||
    /okr-verknüpf/.test(q);
  return {
    ...(approvalExplicit ? { taskTypeFilter: "approval" as const } : {}),
    ...(excludeApproval ? { excludeApproval: true as const } : {}),
    ...(requireOkrLink ? { requireOkrLink: true as const } : {}),
  };
}

function filterTaskFactsForScope(facts: CanonicalTaskFact[], plan: QueryPlan): CanonicalTaskFact[] {
  if (plan.scope.organizationScope !== "own") return facts;
  return facts.filter((fact) =>
    fact.relationToCurrentUser.some((r) =>
      ["assigned", "created", "completed_by", "responsible", "owned"].includes(r)
    )
  );
}

export async function runLookupPipeline(args: {
  plan: QueryPlan;
  executePermissionedTool: ExecutePermissionedToolFn;
  currentMembershipId: string;
}): Promise<QueryPipelineResult> {
  const usedToolCalls: QueryPipelineResult["usedToolCalls"] = [];
  const missingTools: string[] = [];
  const missingCapabilities: string[] = [];

  if (args.plan.domain === "task") {
    const statusFilter = resolveTaskStatusFilterFromPlan(args.plan);
    const mods = resolveTaskToolModifiers(args.plan);
    const wantDiag =
      args.plan.taskFetchDiagnostics === true || process.env.AI_TASK_FETCH_TRACE === "true";
    const toolInput = {
      filter: statusFilter,
      limit: 50,
      ...(wantDiag ? { fetchDiagnostics: true } : {}),
      ...mods,
    };
    const taskResult = await args.executePermissionedTool("get_visible_tasks_for_user", toolInput);
    usedToolCalls.push({
      toolName: taskResult.toolName,
      inputSummary: JSON.stringify(toolInput),
      outputSummary: taskResult.outputSummary,
      success: taskResult.success,
    });
    if (!taskResult.success) {
      if (taskResult.error === "tool_not_registered") missingTools.push(taskResult.toolName);
      if (taskResult.error === "missing_capability") missingCapabilities.push(taskResult.toolName);
    }
    const retrievalStatus = taskResult.success ? "ok" : "failed";
    const rawFacts = taskResult.success
      ? buildTaskFacts({ result: taskResult, currentMembershipId: args.currentMembershipId })
      : [];
    const facts = filterTaskFactsForScope(rawFacts, args.plan);
    const taskData =
      taskResult.success && taskResult.data && typeof taskResult.data === "object"
        ? (taskResult.data as {
            totalCount?: number;
            tasks?: Array<{ id: string }>;
            taskDiagnostics?: TaskRetrievalDiagnostics;
            fetchDiagnostics?: unknown;
          })
        : null;
    const rawTotalCount = taskData?.totalCount ?? null;
    const rawReturnedCount = (taskData?.tasks ?? []).length;
    const afterFactBuildCount = rawFacts.length;
    const afterScopeCount = facts.length;
    usedToolCalls.push({
      toolName: "lookup_pipeline_trace_task",
      inputSummary: JSON.stringify({
        requestedFilter: statusFilter,
        organizationScope: args.plan.scope.organizationScope,
        currentMembershipId: args.currentMembershipId,
        modifiers: mods,
      }),
      outputSummary: JSON.stringify({
        rawTotalCount,
        rawReturnedCount,
        afterFactBuildCount,
        afterScopeCount,
        droppedInFactBuild: rawReturnedCount - afterFactBuildCount,
        droppedByScopeFilter: afterFactBuildCount - afterScopeCount,
        taskDiagnostics: taskData?.taskDiagnostics ?? null,
      }),
      success: true,
    });
    const contract: LookupContract = {
      queryClass: "lookup",
      domain: "task",
      scope: { organizationScope: args.plan.scope.organizationScope },
      totalItems: retrievalStatus === "failed" ? null : facts.length,
      items: retrievalStatus === "failed" ? [] : facts.map((fact) => ({
        id: fact.id,
        label: fact.title,
        evidenceId: fact.id,
        details: {
          status: fact.status,
          normalizedStatus: fact.normalizedStatus,
          relationToCurrentUser: fact.relationToCurrentUser,
          assignedMembershipId: fact.assignedMembershipId,
          taskType: fact.taskType,
          isLinkedToOkr: fact.isLinkedToOkr,
          dueDate: fact.dueAt,
          completedAt: fact.completedAt,
        },
      })),
      confidence: "high",
      retrievalStatus,
      missingCapabilities,
      missingTools,
      requestedOps: args.plan.analysisOps,
      coveredOps: ["lookup"],
      missingOps: [],
      taskDiagnostics: taskData?.taskDiagnostics ?? undefined,
    };
    return {
      contract,
      evidence: facts.map((fact) => ({ id: fact.id, label: fact.title, objectType: "task" })),
      warnings: [],
      usedToolCalls,
      contractSource: "pipeline",
    };
  }

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
  const facts = objectivesResult.success
    ? buildOkrObjectiveFacts(objectivesResult).filter((fact) => fact.ownerMembershipId == null)
    : [];
  const contract: LookupContract = {
    queryClass: "lookup",
    domain: args.plan.domain ?? "okr",
    scope: { objectType: args.plan.scope.objectType },
    totalItems: retrievalStatus === "failed" ? null : facts.length,
    items: retrievalStatus === "failed" ? [] : facts.map((fact) => ({
      id: fact.id,
      label: fact.title,
      evidenceId: fact.id,
      details: { status: fact.status, progress: fact.progress },
    })),
    confidence: "high",
    retrievalStatus,
    missingCapabilities,
    missingTools,
    requestedOps: args.plan.analysisOps,
    coveredOps: ["lookup"],
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
