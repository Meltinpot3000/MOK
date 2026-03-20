"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPhase0Context } from "@/lib/phase0/queries";

type ReviewStatus = "on_track" | "at_risk" | "off_track";
type FeedbackType =
  | "continue"
  | "adjust"
  | "stop"
  | "escalate"
  | "revisit_direction"
  | "revisit_objective";
type ObjectType = "objective" | "strategic_direction" | "strategy_program" | "initiative" | "key_result";

export async function updateObjectiveHealthOverride(
  objectiveId: string,
  override: ReviewStatus | null,
  cycleInstanceId: string
) {
  const context = await getPhase0Context();
  if (!context) return { error: "Nicht authentifiziert" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .schema("app")
    .from("objectives")
    .update({
      objective_health_override: override,
      objective_health_override_by_membership_id: override ? context.membershipId : null,
      objective_health_override_at: override ? new Date().toISOString() : null,
    })
    .eq("id", objectiveId)
    .eq("organization_id", context.organizationId);

  if (error) return { error: error.message };
  revalidatePath("/reviews");
  return {};
}

export async function updateObjectiveReviewComment(
  objectiveId: string,
  comment: string | null,
  cycleInstanceId: string
) {
  const context = await getPhase0Context();
  if (!context) return { error: "Nicht authentifiziert" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .schema("app")
    .from("objectives")
    .update({ objective_review_comment: comment || null })
    .eq("id", objectiveId)
    .eq("organization_id", context.organizationId);

  if (error) return { error: error.message };
  revalidatePath("/reviews");
  return {};
}

export async function updateInitiativeExecutionHealthOverride(
  initiativeId: string,
  override: ReviewStatus | null,
  cycleInstanceId: string
) {
  const context = await getPhase0Context();
  if (!context) return { error: "Nicht authentifiziert" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .schema("app")
    .from("initiatives")
    .update({
      execution_health_override: override,
      execution_health_override_by_membership_id: override ? context.membershipId : null,
      execution_health_override_at: override ? new Date().toISOString() : null,
    })
    .eq("id", initiativeId)
    .eq("organization_id", context.organizationId);

  if (error) return { error: error.message };
  revalidatePath("/reviews");
  return {};
}

export async function updateInitiativeReviewComment(
  initiativeId: string,
  comment: string | null,
  cycleInstanceId: string
) {
  const context = await getPhase0Context();
  if (!context) return { error: "Nicht authentifiziert" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .schema("app")
    .from("initiatives")
    .update({ review_comment: comment || null })
    .eq("id", initiativeId)
    .eq("organization_id", context.organizationId);

  if (error) return { error: error.message };
  revalidatePath("/reviews");
  return {};
}

export async function createReviewSnapshot(
  cycleInstanceId: string,
  snapshotType: "periodic" | "ad_hoc" | "quarterly",
  summaryJson: Record<string, unknown>,
  comment?: string | null
) {
  const context = await getPhase0Context();
  if (!context) return { error: "Nicht authentifiziert" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .schema("app")
    .from("review_snapshots")
    .insert({
      organization_id: context.organizationId,
      cycle_instance_id: cycleInstanceId,
      snapshot_type: snapshotType,
      summary_json: summaryJson,
      comment: comment || null,
      created_by_membership_id: context.membershipId,
    });

  if (error) return { error: error.message };
  revalidatePath("/reviews");
  return {};
}

export async function createReviewFeedback(
  cycleInstanceId: string,
  feedbackType: FeedbackType,
  objectType: ObjectType,
  objectId: string,
  comment?: string | null
) {
  const context = await getPhase0Context();
  if (!context) return { error: "Nicht authentifiziert" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .schema("app")
    .from("review_feedback")
    .insert({
      organization_id: context.organizationId,
      cycle_instance_id: cycleInstanceId,
      feedback_type: feedbackType,
      object_type: objectType,
      object_id: objectId,
      comment: comment || null,
      created_by_membership_id: context.membershipId,
    });

  if (error) return { error: error.message };
  revalidatePath("/reviews");
  return {};
}
