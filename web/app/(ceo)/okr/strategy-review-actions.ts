"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUserId, getCeoAccessContext } from "@/lib/ceo/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireContext() {
  const userId = await getAuthenticatedUserId();
  if (!userId) throw new Error("Nicht angemeldet");
  const access = await getCeoAccessContext(userId);
  if (!access) throw new Error("Kein Zugriff");
  return access;
}

function revalidateStrategyReview() {
  revalidatePath("/okr/review");
  revalidatePath("/okr/strategy-review");
}

export async function ensureStrategyReviewAction(cycleInstanceId: string) {
  const access = await requireContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema("app").rpc("ensure_strategy_review", {
    p_cycle_instance_id: cycleInstanceId,
  });
  if (error) throw new Error(error.message);
  revalidateStrategyReview();
  return data as string;
}

export async function recordStrategyReviewAnnouncementAction(reviewId: string, payload: Record<string, unknown>) {
  await requireContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema("app").rpc("record_strategy_review_announcement", {
    p_review_id: reviewId,
    p_payload: payload,
  });
  if (error) throw new Error(error.message);
  revalidateStrategyReview();
}

export async function prepareStrategyReviewAction(reviewId: string) {
  await requireContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema("app").rpc("prepare_strategy_review", {
    p_review_id: reviewId,
  });
  if (error) throw new Error(error.message);
  revalidateStrategyReview();
}

export async function submitStakeholderFeedbackAction(
  reviewId: string,
  membershipId: string,
  entries: Array<{
    subject_type: string;
    subject_id: string;
    rating: string | null;
    comment: string | null;
  }>
) {
  const access = await requireContext();
  if (access.membershipId !== membershipId) {
    throw new Error("Abweichende Mitgliedschaft");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema("app").rpc("save_strategy_review_feedback", {
    p_review_id: reviewId,
    p_actor_membership_id: membershipId,
    p_feedback: { entries },
  });
  if (error) throw new Error(error.message);
  revalidateStrategyReview();
}

export async function computeReviewReadinessAction(reviewId: string) {
  await requireContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema("app").rpc("compute_review_readiness", {
    p_review_id: reviewId,
  });
  if (error) throw new Error(error.message);
  revalidateStrategyReview();
}

export async function forceReviewReadyAction(reviewId: string, reason: string) {
  await requireContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema("app").rpc("force_review_ready", {
    p_review_id: reviewId,
    p_reason: reason.trim(),
  });
  if (error) throw new Error(error.message);
  revalidateStrategyReview();
}

export async function startStrategyReviewMeetingAction(reviewId: string) {
  await requireContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema("app").rpc("start_strategy_review_meeting", {
    p_review_id: reviewId,
  });
  if (error) throw new Error(error.message);
  revalidateStrategyReview();
}

export async function saveStrategyReviewDecisionsAction(reviewId: string, decisions: Record<string, unknown>) {
  await requireContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema("app").rpc("capture_strategy_review_decisions", {
    p_review_id: reviewId,
    p_decisions: decisions,
  });
  if (error) throw new Error(error.message);
  revalidateStrategyReview();
}

export async function releaseStrategyReviewAction(reviewId: string) {
  await requireContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema("app").rpc("execute_strategy_review_release", {
    p_review_id: reviewId,
  });
  if (error) throw new Error(error.message);
  revalidateStrategyReview();
  return data as Record<string, unknown>;
}
