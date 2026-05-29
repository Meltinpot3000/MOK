"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId } from "@/lib/ceo/queries";
import { getAppShellAccess } from "@/lib/rbac/page-access";

function rpcErrorMessage(code: string): string {
  switch (code) {
    case "completion-invalid-decision":
      return "Ungültige Entscheidung.";
    case "completion-task-not-open":
      return "Dieser Task ist nicht mehr offen.";
    case "completion-task-wrong-type":
      return "Ungültiger Task-Typ.";
    case "completion-decide-not-assignee":
      return "Nur der zugewiesene Vorgesetzte darf entscheiden.";
    case "completion-reject-comment-required":
      return "Kommentar ist bei Ablehnung Pflicht.";
    default:
      return "Vorgang fehlgeschlagen.";
  }
}

const COMPLETION_DECIDE_REVALIDATE_PATHS = [
  "/my-tasks",
  "/okr/tracking",
  "/okr/dashboard",
  "/okr/review",
  "/dashboard",
] as const;

function revalidateAfterCompletionDecision(taskId: string) {
  for (const path of COMPLETION_DECIDE_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
  revalidatePath(`/my-tasks/${taskId}`);
}

export async function decideCompletionReviewTaskAction(input: {
  taskId: string;
  decision: "approve" | "reject";
  comment?: string | null;
}): Promise<{ ok: false; error: string } | void> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { ok: false, error: "Nicht angemeldet." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema("app").rpc("completion_review_decide_task", {
    p_task_id: input.taskId,
    p_decision: input.decision,
    p_comment: input.comment ?? null,
  });

  if (error) {
    const code = error.message?.includes("completion-") ? error.message : "";
    return { ok: false, error: code ? rpcErrorMessage(code) : error.message };
  }

  revalidateAfterCompletionDecision(input.taskId);
  redirect("/my-tasks?filter=completed");
}

export async function markMemberNotificationsReadAction(
  notificationIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await getAuthenticatedUserId();
  if (!userId) return { ok: false, error: "Nicht angemeldet." };

  const shell = await getAppShellAccess(userId);
  if (!shell) return { ok: false, error: "Kein Zugriff." };

  const ids = [...new Set(notificationIds.filter(Boolean))];
  if (ids.length === 0) return { ok: true };

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .schema("app")
    .from("member_notifications")
    .update({ read_at: now })
    .eq("organization_id", shell.access.organizationId)
    .eq("recipient_membership_id", shell.access.membershipId)
    .in("id", ids)
    .is("read_at", null);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
