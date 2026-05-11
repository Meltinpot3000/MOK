import type { TaskRow } from "@/lib/tasks/approval-queries";

export type TaskUserRelation =
  | "assigned"
  | "created"
  | "completed_by"
  | "responsible"
  | "owned"
  | "visible";

/** Relationen eines Tasks relativ zu allen geprüften Memberships desselben Users. */
export function relationsForTask(row: TaskRow, checkedMembershipIds: Set<string>): TaskUserRelation[] {
  const rel: TaskUserRelation[] = [];
  if (checkedMembershipIds.has(row.assigned_membership_id)) rel.push("assigned");
  if (row.created_by_membership_id && checkedMembershipIds.has(row.created_by_membership_id)) rel.push("created");
  if (row.completed_by_membership_id && checkedMembershipIds.has(row.completed_by_membership_id)) {
    rel.push("completed_by");
  }
  if (rel.includes("assigned")) rel.push("responsible");
  rel.push("visible");
  return [...new Set(rel)];
}

export function isLinkedToOkrSource(sourceObjectType: string | null | undefined): boolean {
  if (!sourceObjectType) return false;
  return ["okr_objective", "key_result", "okr"].includes(sourceObjectType);
}
