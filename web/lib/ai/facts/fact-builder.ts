import type { AiToolResult } from "@/lib/ai/tools/types";

import type { CanonicalOkrObjectiveFact, CanonicalTaskFact } from "./fact-types";

import { normalizeTaskStatus } from "@/lib/tasks/task-status";
import { isLinkedToOkrSource, relationsForTask } from "@/lib/tasks/task-relations";
import type { TaskRow } from "@/lib/tasks/approval-queries";

type VisibleObjectivesToolData = {
  cycleInstanceId?: string;
  objectives?: Array<{
    id: string;
    title: string;
    status?: string | null;
    ownerMembershipId?: string | null;
    ownerDisplayName?: string | null;
    rollupProgressPercent?: number | null;
  }>;
};

/** Ausgabe von get_visible_tasks_for_user (Work-Items ueber alle Memberships des Users). */
type VisibleTasksToolData = {
  tasks?: Array<{
    id: string;
    title: string;
    taskType?: string | null;
    status?: string | null;
    dueAt?: string | null;
    completedAt?: string | null;
    assignedMembershipId?: string | null;
    createdByMembershipId?: string | null;
    completedByMembershipId?: string | null;
    sourceObjectType?: string | null;
    sourceObjectId?: string | null;
  }>;
  checkedMembershipIds?: string[];
};

function rowFromToolTask(t: NonNullable<VisibleTasksToolData["tasks"]>[number]): TaskRow {
  return {
    id: t.id,
    organization_id: "",
    task_type: t.taskType ?? "",
    title: t.title,
    description: null,
    status: t.status ?? "",
    priority: "",
    assigned_membership_id: t.assignedMembershipId ?? "",
    created_by_membership_id: t.createdByMembershipId ?? "",
    source_object_type: t.sourceObjectType ?? "",
    source_object_id: t.sourceObjectId ?? "",
    routing_mode: null,
    routing_reason: null,
    due_at: t.dueAt ?? null,
    completed_at: t.completedAt ?? null,
    completed_by_membership_id: t.completedByMembershipId ?? null,
    decision_comment: null,
    created_at: "",
    updated_at: "",
  };
}

export function buildOkrObjectiveFacts(result: AiToolResult<unknown>): CanonicalOkrObjectiveFact[] {
  if (!result.success || result.toolName !== "get_visible_okr_objectives" || !result.data) return [];
  const data = result.data as VisibleObjectivesToolData;
  const objectives = data.objectives ?? [];
  return objectives.map((objective) => ({
    id: objective.id,
    title: objective.title,
    cycleId: data.cycleInstanceId ?? null,
    cycleLabel: null,
    ownerMembershipId: objective.ownerMembershipId ?? null,
    ownerDisplayName: objective.ownerDisplayName ?? null,
    status: objective.status ?? null,
    progress:
      objective.rollupProgressPercent != null
        ? Number(objective.rollupProgressPercent)
        : null,
  }));
}

export function buildTaskFacts(args: {
  result: AiToolResult<unknown>;
  currentMembershipId: string;
}): CanonicalTaskFact[] {
  const { result, currentMembershipId } = args;
  if (!result.success || result.toolName !== "get_visible_tasks_for_user" || !result.data) return [];
  const data = result.data as VisibleTasksToolData;
  const tasks = data.tasks ?? [];
  const checked = new Set(data.checkedMembershipIds?.length ? data.checkedMembershipIds : [currentMembershipId]);

  return tasks.map((task) => {
    const row = rowFromToolTask(task);
    const normalizedStatus = normalizeTaskStatus(task.status, task.completedAt ?? null, task.dueAt ?? null);
    const relationToCurrentUser = relationsForTask(row, checked);
    return {
      factType: "task",
      id: task.id,
      title: task.title,
      taskType: task.taskType ?? null,
      status: task.status ?? null,
      normalizedStatus,
      assignedMembershipId: task.assignedMembershipId ?? null,
      createdByMembershipId: task.createdByMembershipId ?? null,
      completedByMembershipId: task.completedByMembershipId ?? null,
      relationToCurrentUser,
      sourceObjectType: task.sourceObjectType ?? null,
      sourceObjectId: task.sourceObjectId ?? null,
      isLinkedToOkr: isLinkedToOkrSource(task.sourceObjectType),
      completedAt: task.completedAt ?? null,
      dueAt: task.dueAt ?? null,
    };
  });
}
