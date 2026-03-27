import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OkrReviewSessionRow = {
  id: string;
  title: string;
  session_type: string;
  status: string;
  scheduled_at: string | null;
  facilitator_membership_id: string | null;
  summary: string | null;
  meeting_notes: string | null;
  discussion_notes: string | null;
  decisions_next_steps: string | null;
  created_at: string;
  updated_at: string;
};

export async function listOkrReviewSessionsForCycle(
  organizationId: string,
  cycleInstanceId: string,
  okrCycleId: string
): Promise<OkrReviewSessionRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("app")
    .from("okr_review_sessions")
    .select(
      "id, title, session_type, status, scheduled_at, facilitator_membership_id, summary, meeting_notes, discussion_notes, decisions_next_steps, created_at, updated_at"
    )
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .eq("okr_cycle_id", okrCycleId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[listOkrReviewSessionsForCycle]", error.message);
    return [];
  }
  return (data ?? []) as OkrReviewSessionRow[];
}