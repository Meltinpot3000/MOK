"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUserId, getCeoAccessContext } from "@/lib/ceo/queries";
import { isStrategyReviewParticipantRole } from "@/lib/strategy-review/participants";
import { isStrategyReviewDevToolsAllowed } from "@/lib/strategy-review/dev-tools-access";
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
  revalidatePath("/reviews/strategy-review");
  revalidatePath("/reviews");
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

export type StrategyReviewDevPhase =
  | "announcement"
  | "pre_read"
  | "meeting"
  | "release";

/** Nur Development: Verfahrensphase springen (UI-Tests). */
export async function devSetStrategyReviewPhaseAction(
  reviewId: string,
  phase: StrategyReviewDevPhase
) {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Nur in der Entwicklungsumgebung verfügbar");
  }
  await requireContext();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isStrategyReviewDevToolsAllowed(user?.email)) {
    throw new Error("Dev-Phasenwechsel nicht freigeschaltet für diesen Benutzer");
  }

  const { data: row, error: readErr } = await supabase
    .schema("app")
    .from("okr_reviews")
    .select("id, readiness_status, procedure_status, review_mode")
    .eq("id", reviewId)
    .maybeSingle();

  if (readErr) throw new Error(readErr.message);
  if (!row || row.review_mode !== "strategy_review") {
    throw new Error("Strategy Review nicht gefunden");
  }

  let procedure_status: string;
  const patch: Record<string, unknown> = {};

  switch (phase) {
    case "announcement":
      procedure_status = "announcement_sent";
      patch.decision_payload = {};
      break;
    case "pre_read":
      procedure_status =
        row.readiness_status === "ready" ? "ready_for_review" : "pre_read_open";
      patch.decision_payload = {};
      break;
    case "meeting":
      procedure_status = "review_in_progress";
      break;
    case "release":
      procedure_status = "decision_captured";
      break;
    default:
      throw new Error(`Unbekannte Dev-Phase: ${phase}`);
  }

  patch.procedure_status = procedure_status;

  const { error: updErr } = await supabase
    .schema("app")
    .from("okr_reviews")
    .update(patch)
    .eq("id", reviewId);

  if (updErr) throw new Error(updErr.message);
  revalidateStrategyReview();
}

/** @deprecated Nutze devSetStrategyReviewPhaseAction('pre_read'). */
export async function devRewindStrategyReviewToPreReadAction(reviewId: string) {
  await devSetStrategyReviewPhaseAction(reviewId, "pre_read");
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

export async function saveStrategyReviewMeetingNotesAction(reviewId: string, notes: string) {
  await requireContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema("app").rpc("save_strategy_review_meeting_notes", {
    p_review_id: reviewId,
    p_notes: notes,
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

export async function inviteStrategyReviewParticipantAction(
  reviewId: string,
  membershipId: string,
  reviewRole: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await requireContext();
  if (!isStrategyReviewParticipantRole(reviewRole)) {
    return { ok: false, error: "Ungültige Review-Rolle." };
  }
  const supabase = await createSupabaseServerClient();

  const { data: review, error: reviewErr } = await supabase
    .schema("app")
    .from("okr_reviews")
    .select("id, organization_id, review_mode")
    .eq("id", reviewId)
    .maybeSingle();

  if (reviewErr || !review) {
    return { ok: false, error: reviewErr?.message ?? "Review nicht gefunden." };
  }
  if (review.organization_id !== access.organizationId) {
    return { ok: false, error: "Kein Zugriff auf dieses Review." };
  }
  if (review.review_mode !== "strategy_review") {
    return { ok: false, error: "Nur für Strategie-Reviews zulässig." };
  }

  const { error } = await supabase.schema("app").from("strategy_review_participants").upsert(
    {
      review_id: reviewId,
      organization_id: review.organization_id,
      membership_id: membershipId,
      review_role: reviewRole,
      invited_by_membership_id: access.membershipId,
      invited_at: new Date().toISOString(),
    },
    { onConflict: "review_id,membership_id" }
  );

  if (error) {
    return { ok: false, error: error.message };
  }
  revalidateStrategyReview();
  return { ok: true };
}

export async function removeStrategyReviewParticipantAction(
  participantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await requireContext();
  const supabase = await createSupabaseServerClient();

  const { data: row, error: loadErr } = await supabase
    .schema("app")
    .from("strategy_review_participants")
    .select("id, organization_id")
    .eq("id", participantId)
    .maybeSingle();

  if (loadErr || !row) {
    return { ok: false, error: loadErr?.message ?? "Teilnehmer nicht gefunden." };
  }
  if (row.organization_id !== access.organizationId) {
    return { ok: false, error: "Kein Zugriff." };
  }

  const { error } = await supabase
    .schema("app")
    .from("strategy_review_participants")
    .delete()
    .eq("id", participantId);

  if (error) {
    return { ok: false, error: error.message };
  }
  revalidateStrategyReview();
  return { ok: true };
}
