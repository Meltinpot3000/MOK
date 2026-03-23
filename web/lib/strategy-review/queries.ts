import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ReviewTriggerState, StrategyReviewRow } from "@/lib/strategy-review/types";

export async function fetchReviewTriggerState(cycleInstanceId: string): Promise<ReviewTriggerState | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema("app").rpc("get_review_trigger_state", {
    p_cycle_instance_id: cycleInstanceId,
  });
  if (error) {
    console.error("get_review_trigger_state", error);
    return null;
  }
  return data as ReviewTriggerState;
}

export async function fetchStrategyReviewRow(
  organizationId: string,
  cycleInstanceId: string
): Promise<StrategyReviewRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("app")
    .from("okr_reviews")
    .select(
      "id, organization_id, cycle_instance_id, review_mode, procedure_status, review_lead_time_days, readiness_status, override_forced, override_reason, pre_read_payload, stakeholder_feedback_payload, decision_payload, release_summary, released_to_cycle_instance_id, released_at, announcement_sent_at, announcement_payload"
    )
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .eq("review_mode", "strategy_review")
    .maybeSingle();

  if (error) {
    console.error("fetchStrategyReviewRow", error);
    return null;
  }
  if (!data) return null;
  return {
    ...data,
    pre_read_payload: (data.pre_read_payload as Record<string, unknown>) ?? {},
    stakeholder_feedback_payload: (data.stakeholder_feedback_payload as Record<string, unknown>) ?? {},
    decision_payload: (data.decision_payload as Record<string, unknown>) ?? {},
    release_summary: (data.release_summary as Record<string, unknown>) ?? {},
    announcement_payload: (data.announcement_payload as Record<string, unknown>) ?? {},
  } as StrategyReviewRow;
}

export async function fetchStrategyReviewFeedbackEntries(reviewId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("app")
    .from("strategy_review_feedback_entries")
    .select("id, subject_type, subject_id, actor_id, rating, comment, created_at")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchStrategyReviewFeedbackEntries", error);
    return [];
  }
  return data ?? [];
}
