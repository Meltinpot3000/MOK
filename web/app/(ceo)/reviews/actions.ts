"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import {
  ALLOWED_INITIATIVE_WEIGHTS,
  isAllowedInitiativeWeight,
} from "@/lib/review/initiative-review-fields";

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
    .update({
      review_comment: comment || null,
      last_review_update_at: new Date().toISOString(),
    })
    .eq("id", initiativeId)
    .eq("organization_id", context.organizationId);

  if (error) return { error: error.message };
  revalidatePath("/reviews");
  return {};
}

const INITIATIVE_STATUSES = [
  "draft",
  "planned",
  "active",
  "at_risk",
  "on_hold",
  "completed",
  "archived",
] as const;

function parseOptionalDate(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  return t;
}

/**
 * Gebuendeltes Review-Update: setzt last_review_update_at nur bei Aenderung review-relevanter Felder.
 */
export async function applyInitiativeReviewUpdate(formData: FormData) {
  const context = await getPhase0Context();
  if (!context) return { error: "Nicht authentifiziert" };
  const access = await getSidebarAccessContext("reviews");
  if (access.state !== "ok" || !access.canWrite) return { error: "Keine Berechtigung" };

  const initiativeId = String(formData.get("initiative_id") ?? "").trim();
  if (!initiativeId) return { error: "Initiative fehlt" };

  const statusRaw = String(formData.get("status") ?? "").trim();
  if (!INITIATIVE_STATUSES.includes(statusRaw as (typeof INITIATIVE_STATUSES)[number])) {
    return { error: "Ungueltiger Status" };
  }
  const status = statusRaw as (typeof INITIATIVE_STATUSES)[number];

  const progressRaw = Number(String(formData.get("progress_percent") ?? "").trim());
  if (!Number.isInteger(progressRaw) || progressRaw < 0 || progressRaw > 100) {
    return { error: "Fortschritt muss 0–100 (ganzzahlig) sein" };
  }

  const weightRaw = Number(String(formData.get("weight") ?? "").trim());
  if (!isAllowedInitiativeWeight(weightRaw)) {
    return { error: `Gewichtung muss eine der Werte ${ALLOWED_INITIATIVE_WEIGHTS.join(", ")} sein` };
  }

  const overrideRaw = String(formData.get("execution_health_override") ?? "").trim();
  let execution_health_override: ReviewStatus | null = null;
  if (overrideRaw === "on_track" || overrideRaw === "at_risk" || overrideRaw === "off_track") {
    execution_health_override = overrideRaw;
  } else if (overrideRaw !== "" && overrideRaw !== "none") {
    return { error: "Ungueltige Ampel-Override" };
  }

  const end_date = parseOptionalDate(String(formData.get("end_date") ?? ""));
  const review_comment = String(formData.get("review_comment") ?? "").trim() || null;

  const supabase = await createSupabaseServerClient();
  const { data: current, error: loadError } = await supabase
    .schema("app")
    .from("initiatives")
    .select(
      "status, progress_percent, weight, execution_health_override, end_date, review_comment"
    )
    .eq("id", initiativeId)
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (loadError) return { error: loadError.message };
  if (!current) return { error: "Initiative nicht gefunden" };

  const row = current as {
    status: string;
    progress_percent: number | null;
    weight: number | null;
    execution_health_override: string | null;
    end_date: string | null;
    review_comment: string | null;
  };

  const prevOverride = row.execution_health_override ?? null;
  const nextOverride = execution_health_override;
  const normalizedEnd = end_date;
  const prevEnd = row.end_date ?? null;

  const changed =
    row.status !== status ||
    (row.progress_percent ?? 0) !== progressRaw ||
    (row.weight ?? 3) !== weightRaw ||
    prevOverride !== nextOverride ||
    prevEnd !== normalizedEnd ||
    (row.review_comment ?? null) !== review_comment;

  const payload: Record<string, unknown> = {
    status,
    progress_percent: progressRaw,
    weight: weightRaw,
    execution_health_override: nextOverride,
    execution_health_override_by_membership_id: nextOverride ? context.membershipId : null,
    execution_health_override_at: nextOverride ? new Date().toISOString() : null,
    end_date: normalizedEnd,
    review_comment,
  };

  if (changed) {
    payload.last_review_update_at = new Date().toISOString();
  }

  const { error } = await supabase
    .schema("app")
    .from("initiatives")
    .update(payload)
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
