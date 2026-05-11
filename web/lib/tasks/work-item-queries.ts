import type { SupabaseClient } from "@supabase/supabase-js";

import {
  fetchTasksForMembershipWithDiagnostics,
  type TaskFetchDiagnostics,
  type TaskRow,
} from "@/lib/tasks/approval-queries";

import { isCurrentWorkStatus, normalizeTaskStatus, type NormalizedTaskStatus } from "./task-status";
import type { TaskUserRelation } from "./task-relations";

export type WorkItemStatusFilter = "open" | "completed" | "all" | "current";

export type { TaskUserRelation };

export type TaskRetrievalDiagnostics = {
  authUserId: string;
  activeMembershipId: string;
  organizationId: string;
  allMembershipIdsForUserInOrganization: string[];
  selectedTaskMembershipId: string;
  membershipSelectionReason: string;
  taskCountsByMembership: Array<{
    membershipId: string;
    assignedCount: number;
    createdCount: number;
    completedByCount: number;
  }>;
  checkedMembershipIds: string[];
  countsByRelation: {
    assigned: number;
    created: number;
    completedBy: number;
  };
  rawTotalBeforeStatusFilter: number;
  totalAfterStatusFilter: number;
  statusFilter: WorkItemStatusFilter;
  taskTypeFilter: string | null;
  sourceObjectTypeFilter: string | null;
  /** Ein-Membership-Histogramm (assigned_membership_id = active only), nur wenn Diagnose aktiv */
  legacyAssignedMembershipProbe?: TaskFetchDiagnostics | null;
};

const TASK_SELECT_COLUMNS =
  "id, organization_id, task_type, title, description, status, priority, assigned_membership_id, created_by_membership_id, source_object_type, source_object_id, routing_mode, routing_reason, due_at, completed_at, completed_by_membership_id, decision_comment, created_at, updated_at";

export async function fetchMembershipIdsForUserInOrganization(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .schema("app")
    .from("organization_memberships")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active");
  if (error || !data) return [];
  return data.map((r) => r.id as string);
}

function membershipOrFilter(membershipIds: string[]): string {
  const joined = membershipIds.join(",");
  return [
    `assigned_membership_id.in.(${joined})`,
    `created_by_membership_id.in.(${joined})`,
    `completed_by_membership_id.in.(${joined})`,
  ].join(",");
}

function applyStatusFilter(
  rows: TaskRow[],
  statusFilter: WorkItemStatusFilter,
  now: Date
): TaskRow[] {
  return rows.filter((r) => {
    const n = normalizeTaskStatus(r.status, r.completed_at, r.due_at, now);
    switch (statusFilter) {
      case "all":
        return true;
      case "completed":
        return n === "completed";
      case "open":
        return n === "open" || n === "overdue";
      case "current":
        return isCurrentWorkStatus(n);
      default:
        return true;
    }
  });
}

function buildCountsByMembership(
  rows: TaskRow[],
  membershipIds: string[]
): TaskRetrievalDiagnostics["taskCountsByMembership"] {
  const set = new Set(membershipIds);
  const init = () => ({
    assignedCount: 0,
    createdCount: 0,
    completedByCount: 0,
  });
  const byMid = new Map<string, ReturnType<typeof init>>();
  for (const mid of membershipIds) {
    byMid.set(mid, init());
  }
  for (const r of rows) {
    if (set.has(r.assigned_membership_id)) {
      const x = byMid.get(r.assigned_membership_id)!;
      x.assignedCount += 1;
    }
    if (r.created_by_membership_id && set.has(r.created_by_membership_id)) {
      const x = byMid.get(r.created_by_membership_id)!;
      x.createdCount += 1;
    }
    if (r.completed_by_membership_id && set.has(r.completed_by_membership_id)) {
      const x = byMid.get(r.completed_by_membership_id)!;
      x.completedByCount += 1;
    }
  }
  return membershipIds.map((membershipId) => ({
    membershipId,
    ...byMid.get(membershipId)!,
  }));
}

function aggregateRelationCounts(rows: TaskRow[], membershipIds: string[]): TaskRetrievalDiagnostics["countsByRelation"] {
  const set = new Set(membershipIds);
  let assigned = 0;
  let created = 0;
  let completedBy = 0;
  for (const r of rows) {
    if (set.has(r.assigned_membership_id)) assigned += 1;
    if (r.created_by_membership_id && set.has(r.created_by_membership_id)) created += 1;
    if (r.completed_by_membership_id && set.has(r.completed_by_membership_id)) completedBy += 1;
  }
  return { assigned, created, completedBy };
}

async function legacyProbeAssignedOnly(
  supabase: SupabaseClient,
  organizationId: string,
  activeMembershipId: string,
  statusFilter: WorkItemStatusFilter
): Promise<TaskFetchDiagnostics | null> {
  const mapFilter = (f: WorkItemStatusFilter): "open" | "completed" | "all" => {
    if (f === "completed") return "completed";
    if (f === "open" || f === "current") return "open";
    return "all";
  };
  const bundle = await fetchTasksForMembershipWithDiagnostics(
    organizationId,
    activeMembershipId,
    mapFilter(statusFilter),
    supabase
  );
  return bundle.diagnostics;
}

export async function fetchUserWorkItemsWithDiagnostics(
  supabase: SupabaseClient,
  params: {
    organizationId: string;
    authUserId: string;
    activeMembershipId: string;
    statusFilter: WorkItemStatusFilter;
    taskTypeFilter?: "approval" | null;
    excludeApproval?: boolean;
    requireOkrLink?: boolean;
    includeDiagnostics: boolean;
    /** Legacy-Ein-Membership-Vergleich für Debug */
    includeLegacyAssignedProbe?: boolean;
  }
): Promise<{ rows: TaskRow[]; diagnostics: TaskRetrievalDiagnostics | null }> {
  const now = new Date();
  const membershipIds = await fetchMembershipIdsForUserInOrganization(
    supabase,
    params.organizationId,
    params.authUserId
  );

  const emptyDiag = (): TaskRetrievalDiagnostics => ({
    authUserId: params.authUserId,
    activeMembershipId: params.activeMembershipId,
    organizationId: params.organizationId,
    allMembershipIdsForUserInOrganization: membershipIds,
    selectedTaskMembershipId: params.activeMembershipId,
    membershipSelectionReason:
      "Alle aktiven Memberships von auth.uid() in dieser organization_id werden fuer Work-Item-Queries beruecksichtigt (assigned | created_by | completed_by).",
    taskCountsByMembership: [],
    checkedMembershipIds: membershipIds,
    countsByRelation: { assigned: 0, created: 0, completedBy: 0 },
    rawTotalBeforeStatusFilter: 0,
    totalAfterStatusFilter: 0,
    statusFilter: params.statusFilter,
    taskTypeFilter: params.taskTypeFilter ?? null,
    sourceObjectTypeFilter: params.requireOkrLink ? "okr_objective|key_result|okr" : null,
  });

  if (membershipIds.length === 0) {
    return {
      rows: [],
      diagnostics: params.includeDiagnostics ? emptyDiag() : null,
    };
  }

  let q = supabase
    .schema("app")
    .from("tasks")
    .select(TASK_SELECT_COLUMNS)
    .eq("organization_id", params.organizationId)
    .or(membershipOrFilter(membershipIds))
    .order("created_at", { ascending: false });

  if (params.taskTypeFilter === "approval") {
    q = q.eq("task_type", "approval");
  } else if (params.excludeApproval) {
    q = q.neq("task_type", "approval");
  }

  if (params.requireOkrLink) {
    q = q.in("source_object_type", ["okr_objective", "key_result", "okr"]);
  }

  const { data, error } = await q;
  if (error || !data) {
    const base = emptyDiag();
    if (params.includeDiagnostics) {
      return {
        rows: [],
        diagnostics: {
          ...base,
          legacyAssignedMembershipProbe: params.includeLegacyAssignedProbe
            ? await legacyProbeAssignedOnly(
                supabase,
                params.organizationId,
                params.activeMembershipId,
                params.statusFilter
              )
            : null,
        },
      };
    }
    return { rows: [], diagnostics: null };
  }

  let candidates = data as TaskRow[];
  const rawTotalBeforeStatusFilter = candidates.length;
  const filtered = applyStatusFilter(candidates, params.statusFilter, now);
  const rows = filtered;

  if (!params.includeDiagnostics) {
    return { rows, diagnostics: null };
  }

  const taskCountsByMembership = buildCountsByMembership(candidates, membershipIds);
  const countsByRelation = aggregateRelationCounts(candidates, membershipIds);

  let legacyAssignedMembershipProbe: TaskFetchDiagnostics | null = null;
  if (params.includeLegacyAssignedProbe) {
    legacyAssignedMembershipProbe = await legacyProbeAssignedOnly(
      supabase,
      params.organizationId,
      params.activeMembershipId,
      params.statusFilter
    );
  }

  return {
    rows,
    diagnostics: {
      authUserId: params.authUserId,
      activeMembershipId: params.activeMembershipId,
      organizationId: params.organizationId,
      allMembershipIdsForUserInOrganization: membershipIds,
      selectedTaskMembershipId: params.activeMembershipId,
      membershipSelectionReason:
        "Alle aktiven Memberships von auth.uid() in dieser organization_id werden fuer Work-Item-Queries beruecksichtigt (assigned | created_by | completed_by).",
      taskCountsByMembership,
      checkedMembershipIds: membershipIds,
      countsByRelation,
      rawTotalBeforeStatusFilter,
      totalAfterStatusFilter: rows.length,
      statusFilter: params.statusFilter,
      taskTypeFilter: params.taskTypeFilter ?? null,
      sourceObjectTypeFilter: params.requireOkrLink ? "okr_objective|key_result|okr" : null,
      legacyAssignedMembershipProbe,
    },
  };
}
