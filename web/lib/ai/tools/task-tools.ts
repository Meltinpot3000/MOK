import { z } from "zod";

import {
  fetchUserWorkItemsWithDiagnostics,
  type TaskRetrievalDiagnostics,
  type WorkItemStatusFilter,
} from "@/lib/tasks/work-item-queries";

import type { AiContextSource } from "@/lib/ai/types";
import type { AiToolDefinition, AiToolExecuteArgs, AiToolResult } from "./types";

const taskInputSchema = z.object({
  /**
   * Status nach Normalisierung:
   * open | current | completed | all
   */
  filter: z.enum(["open", "completed", "all", "current"]).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  fetchDiagnostics: z.boolean().optional(),
  taskTypeFilter: z.enum(["approval"]).nullable().optional(),
  excludeApproval: z.boolean().optional(),
  requireOkrLink: z.boolean().optional(),
});

export const getVisibleTasksForUserTool: AiToolDefinition<typeof taskInputSchema> = {
  name: "get_visible_tasks_for_user",
  description: `Work Items fuer auth.users in dieser organization_id: alle aktiven Memberships
des Users werden beruecksichtigt (Zeile sichtbar bei Treffer auf assigned_membership_id OR
created_by_membership_id OR completed_by_membership_id). DB-Feld: assigned_membership_id.
Inkl. task_type=approval sofern nicht excludeApproval. Statusfilter auf normalisierten Status.`,
  domain: "task",
  mode: "read",
  requiredCapabilities: ["nav.my-tasks.read", "tasks.read"],
  inputSchema: taskInputSchema,
  inputSchemaHint:
    "{ filter?: 'open'|'completed'|'all'|'current', limit?, fetchDiagnostics?, taskTypeFilter?: 'approval', excludeApproval?, requireOkrLink? }",
  dataClassification: "internal",
  async execute({ userContext, input, supabase }: AiToolExecuteArgs<unknown>): Promise<AiToolResult> {
    const parsed = taskInputSchema.parse(input);
    const statusFilter = (parsed.filter ?? "current") as WorkItemStatusFilter;
    const limit = parsed.limit ?? 30;
    const wantDiag =
      parsed.fetchDiagnostics === true || process.env.AI_TASK_FETCH_TRACE === "true";

    const bundle = await fetchUserWorkItemsWithDiagnostics(supabase, {
      organizationId: userContext.organizationId,
      authUserId: userContext.userId,
      activeMembershipId: userContext.membershipId,
      statusFilter,
      taskTypeFilter: parsed.taskTypeFilter ?? undefined,
      excludeApproval: parsed.excludeApproval === true,
      requireOkrLink: parsed.requireOkrLink === true,
      includeDiagnostics: wantDiag,
      includeLegacyAssignedProbe: wantDiag,
    });

    const all = bundle.rows;
    const tasks = all.slice(0, limit);
    const diagnostics = bundle.diagnostics;

    const data: Record<string, unknown> = {
      perspective: "work_items_across_user_memberships_in_org",
      statusFilter,
      taskTypeFilter: parsed.taskTypeFilter ?? null,
      excludeApproval: parsed.excludeApproval === true,
      requireOkrLink: parsed.requireOkrLink === true,
      totalCount: all.length,
      checkedMembershipIds: diagnostics?.checkedMembershipIds ?? null,
      tasks: tasks.map((t) => ({
        id: t.id,
        taskType: t.task_type,
        title: t.title,
        status: t.status,
        priority: t.priority,
        assignedMembershipId: t.assigned_membership_id,
        createdByMembershipId: t.created_by_membership_id,
        completedByMembershipId: t.completed_by_membership_id,
        sourceObjectType: t.source_object_type,
        sourceObjectId: t.source_object_id,
        dueAt: t.due_at,
        completedAt: t.completed_at,
        createdAt: t.created_at,
      })),
    };

    if (diagnostics) {
      data.taskDiagnostics = diagnostics as TaskRetrievalDiagnostics;
    }

    let summary = `${tasks.length} Work-Item(s) (${statusFilter}), gesamt ${all.length}.`;
    if (diagnostics) {
      summary += ` Gepruefte Memberships: ${diagnostics.checkedMembershipIds.join(", ") || "—"}.`;
      summary += ` rawVorStatus=${diagnostics.rawTotalBeforeStatusFilter}, nachStatus=${diagnostics.totalAfterStatusFilter}.`;
      if (diagnostics.rawTotalBeforeStatusFilter > 0 && diagnostics.totalAfterStatusFilter === 0) {
        summary += ` Tasks vorhanden, Statusfilter schliesst alle aus.`;
      }
    }

    return {
      toolName: "get_visible_tasks_for_user",
      success: true,
      data,
      outputSummary: summary,
      contextSources: tasks.map(
        (t): AiContextSource => ({
          sourceType: "task",
          sourceId: t.id,
          sourceTitle: t.title,
          classification: "internal",
          relevanceScore: t.priority === "high" ? 0.9 : 0.6,
          sourceReason: `Status=${t.status}, type=${t.task_type}`,
        })
      ),
    };
  },
};
