"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { getPermissionCodesForMembership } from "@/lib/rbac/permission-codes";

function reminderErrorMessage(code: string): string {
  switch (code) {
    case "okr-reminder-not-authenticated":
      return "Nicht angemeldet.";
    case "okr-reminder-forbidden":
      return "Keine Berechtigung zum Senden von Erinnerungen.";
    default:
      return "Erinnerungen konnten nicht gesendet werden.";
  }
}

export async function sendOkrBehindPlanRemindersAction(
  okrObjectiveIds: string[]
): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  const pageAccess = await getSidebarAccessContext("dashboard");
  if (pageAccess.state === "unauthenticated") return { ok: false, error: "Nicht angemeldet." };
  if (pageAccess.state === "forbidden") return { ok: false, error: "Kein Zugriff." };

  const codes = await getPermissionCodesForMembership(pageAccess.access.membershipId);
  if (!codes.has("okr.write")) {
    return { ok: false, error: "Keine Berechtigung (okr.write)." };
  }

  const ids = [...new Set(okrObjectiveIds.filter(Boolean))];
  if (ids.length === 0) {
    return { ok: false, error: "Keine OKRs ausgewählt." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema("app").rpc("send_okr_behind_plan_reminders", {
    p_organization_id: pageAccess.access.organizationId,
    p_okr_objective_ids: ids,
  });

  if (error) {
    const code = error.message?.includes("okr-reminder-") ? error.message : "";
    return { ok: false, error: code ? reminderErrorMessage(code) : error.message };
  }

  const sent = Number((data as { sent?: number } | null)?.sent ?? 0);
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
  return { ok: true, sent };
}
