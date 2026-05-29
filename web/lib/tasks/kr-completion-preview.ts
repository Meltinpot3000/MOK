import { createSupabaseServerClient } from "@/lib/supabase/server";

export type KrCompletionTaskPreview = {
  keyResultId: string;
  keyResultTitle: string;
  objectiveTitle: string;
  checkInProgress: number | null;
  checkInComment: string | null;
  checkInAt: string | null;
  checkInConfidence: number | null;
  submitterMembershipId: string | null;
};

export async function fetchKrCompletionTaskPreview(
  organizationId: string,
  keyResultId: string,
  taskPayload: Record<string, unknown> | null
): Promise<KrCompletionTaskPreview | null> {
  const supabase = await createSupabaseServerClient();

  const { data: kr } = await supabase
    .schema("app")
    .from("key_results")
    .select("id, title, okr_objective_id")
    .eq("id", keyResultId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!kr) return null;

  const { data: obj } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("title")
    .eq("id", kr.okr_objective_id as string)
    .eq("organization_id", organizationId)
    .maybeSingle();

  const updateId =
    taskPayload && typeof taskPayload.okr_update_id === "string"
      ? taskPayload.okr_update_id
      : null;

  let checkInProgress: number | null = null;
  let checkInComment: string | null = null;
  let checkInAt: string | null = null;
  let checkInConfidence: number | null = null;
  let submitterMembershipId: string | null = null;

  if (updateId) {
    const { data: upd } = await supabase
      .schema("app")
      .from("okr_updates")
      .select(
        "progress_value, comment, created_at, confidence_level, created_by_membership_id, verification_status"
      )
      .eq("id", updateId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (upd) {
      checkInProgress = upd.progress_value != null ? Number(upd.progress_value) : null;
      checkInComment = (upd.comment as string | null) ?? null;
      checkInAt = (upd.created_at as string) ?? null;
      checkInConfidence =
        upd.confidence_level != null ? Number(upd.confidence_level) : null;
      submitterMembershipId = (upd.created_by_membership_id as string | null) ?? null;
    }
  }

  return {
    keyResultId,
    keyResultTitle: (kr.title as string) ?? "Key Result",
    objectiveTitle: (obj?.title as string) ?? "—",
    checkInProgress,
    checkInComment,
    checkInAt,
    checkInConfidence,
    submitterMembershipId,
  };
}
