"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppShellAccess } from "@/lib/rbac/page-access";
import { getAuthenticatedUserId } from "@/lib/ceo/queries";
import { resolveApprovalAssignee, resolveOkrApprovalAssignee } from "@/lib/tasks/approval-routing";
import type { ApprovalSourceObjectType } from "@/lib/tasks/approval-source-types";
import { getApprovalLifecycleEntry } from "@/lib/tasks/approval-lifecycle-registry";
import { getOrgOkrSettings } from "@/lib/okr/org-okr-settings";
import { fetchOkrObjectiveSentinelApprovalBlockMessageDe } from "@/lib/okr/okr-approval-sentinel-gate";

function rpcErrorMessage(code: string): string {
  switch (code) {
    case "approval-invalid-object-type":
      return "Ungültiger Objekttyp.";
    case "approval-object-not-found":
      return "Objekt nicht gefunden.";
    case "approval-not-organization-member":
      return "Keine aktive Mitgliedschaft.";
    case "approval-forbidden":
      return "Keine Berechtigung zur Freigabe-Anfrage.";
    case "approval-not-draft":
      return "Nur Entwürfe können eingereicht werden.";
    case "approval-no-direct-manager":
      return "Kein Vorgesetzter hinterlegt. Bitte Responsible und Hierarchie unter Verantwortliche pflegen.";
    case "approval-invalid-routing":
      return "Ungültiges Routing für OKR-Freigabe.";
    case "approval-invalid-assignee":
      return "Ungültiger Approver.";
    case "approval-invalid-decision":
      return "Ungültige Entscheidung.";
    case "approval-task-not-open":
      return "Dieser Task ist nicht mehr offen.";
    case "approval-task-wrong-type":
      return "Ungültiger Task-Typ.";
    case "approval-decide-not-assignee":
      return "Nur der zugewiesene Approver darf entscheiden.";
    default:
      return "Vorgang fehlgeschlagen.";
  }
}

export async function submitForApprovalAction(input: {
  organizationId: string;
  sourceObjectType: ApprovalSourceObjectType;
  sourceObjectId: string;
  title: string;
  description?: string | null;
}): Promise<{ ok: true; taskId: string } | { ok: false; error: string }> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { ok: false, error: "Nicht angemeldet." };

  const shell = await getAppShellAccess(userId);
  if (!shell || shell.access.organizationId !== input.organizationId) {
    return { ok: false, error: "Kein Zugriff." };
  }

  const entry = getApprovalLifecycleEntry(input.sourceObjectType);
  if (!entry?.supportsSubmitForApproval) {
    return { ok: false, error: "Freigabe für diesen Typ nicht aktiviert." };
  }

  let resolution;
  try {
    resolution =
      input.sourceObjectType === "okr_objective"
        ? await resolveOkrApprovalAssignee(input.organizationId, shell.access.membershipId)
        : await resolveApprovalAssignee(input.organizationId, shell.access.membershipId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "approval-no-direct-manager") {
      return { ok: false, error: rpcErrorMessage("approval-no-direct-manager") };
    }
    return { ok: false, error: "Kein Approver ermittelbar." };
  }

  const supabase = await createSupabaseServerClient();

  if (input.sourceObjectType === "okr_objective") {
    const okrSettings = await getOrgOkrSettings(input.organizationId);
    if (okrSettings.okrSentinelCanBlockApprovalRequest) {
      const sentinelBlock = await fetchOkrObjectiveSentinelApprovalBlockMessageDe(
        supabase,
        input.organizationId,
        input.sourceObjectId
      );
      if (sentinelBlock) return { ok: false, error: sentinelBlock };
    }
  }

  const { data, error } = await supabase.schema("app").rpc("approval_submit_for_review", {
    p_source_object_type: input.sourceObjectType,
    p_source_object_id: input.sourceObjectId,
    p_assigned_membership_id: resolution.assigneeMembershipId,
    p_routing_mode: resolution.routingMode,
    p_routing_reason: resolution.routingReason,
    p_title: input.title,
    p_description: input.description ?? null,
  });

  if (error) {
    const code = error.message?.includes("approval-") ? error.message : "";
    return { ok: false, error: code ? rpcErrorMessage(code) : error.message };
  }

  const taskId = typeof data === "string" ? data : null;
  if (!taskId) return { ok: false, error: "Keine Task-ID zurückgegeben." };
  return { ok: true, taskId };
}

const APPROVAL_DECIDE_REVALIDATE_PATHS = [
  "/my-tasks",
  "/okr/planning",
  "/okr/tracking",
  "/okr/dashboard",
  "/okr/review",
] as const;

function revalidateAfterApprovalDecision(taskId: string) {
  for (const path of APPROVAL_DECIDE_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
  revalidatePath(`/my-tasks/${taskId}`);
}

export async function decideApprovalTaskAction(input: {
  taskId: string;
  decision: "approve" | "reject" | "request_changes";
  comment?: string | null;
}): Promise<{ ok: false; error: string } | void> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { ok: false, error: "Nicht angemeldet." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema("app").rpc("approval_decide_task", {
    p_task_id: input.taskId,
    p_decision: input.decision,
    p_comment: input.comment ?? null,
  });

  if (error) {
    const code = error.message?.includes("approval-") ? error.message : "";
    return { ok: false, error: code ? rpcErrorMessage(code) : error.message };
  }

  revalidateAfterApprovalDecision(input.taskId);
  redirect("/my-tasks?filter=completed");
}
