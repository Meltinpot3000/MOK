import { createSupabaseServerClient } from "@/lib/supabase/server";
import { collectOkrCycleOwnerMembershipIds } from "@/lib/okr/review-session-tracking";

/**
 * Wird nach dem Planen einer Review-Session aufgerufen, wenn die Organisation das Flag gesetzt hat.
 * Aktuell ohne E-Mail-Provider: sammelt nur Ziel-Adressaten für spätere Anbindung.
 */
export async function planOkrReviewOwnerNotifications(input: {
  sessionId: string;
  organizationId: string;
  cycleInstanceId: string;
  okrCycleId: string;
}): Promise<void> {
  const ownerMembershipIds = await collectOkrCycleOwnerMembershipIds({
    organizationId: input.organizationId,
    cycleInstanceId: input.cycleInstanceId,
    okrCycleId: input.okrCycleId,
  });

  if (ownerMembershipIds.length === 0) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { data: rows } = await supabase
    .schema("app")
    .from("organization_memberships")
    .select("id, user_id")
    .eq("organization_id", input.organizationId)
    .in("id", ownerMembershipIds);

  const userIds = [...new Set((rows ?? []).map((r) => (r as { user_id: string }).user_id).filter(Boolean))];

  /** TODO: E-Mail-Versand sobald Provider (z. B. Resend/SMTP) angebunden ist. */
  void { sessionId: input.sessionId, recipientUserCount: userIds.length };
}
