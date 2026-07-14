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
    .from("strategy_objectives")
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
    .from("strategy_objectives")
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
    return { error: "Ung\u00FCltiger Status" };
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
    return { error: "Ung\u00FCltige Ampel-Override" };
  }

  const end_date = parseOptionalDate(String(formData.get("end_date") ?? ""));
  const review_comment = String(formData.get("review_comment") ?? "").trim() || null;
  const ownerRaw = String(formData.get("owner_membership_id") ?? "").trim();
  const owner_membership_id = ownerRaw.length > 0 ? ownerRaw : null;

  const supabase = await createSupabaseServerClient();
  const { data: current, error: loadError } = await supabase
    .schema("app")
    .from("initiatives")
    .select(
      "status, progress_percent, weight, execution_health_override, end_date, review_comment, owner_membership_id"
    )
    .eq("id", initiativeId)
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (loadError) return { error: loadError.message };
  if (!current) return { error: "Initiative nicht gefunden" };

  if (owner_membership_id) {
    const { data: ownerRow } = await supabase
      .schema("app")
      .from("organization_memberships")
      .select("id")
      .eq("organization_id", context.organizationId)
      .eq("id", owner_membership_id)
      .maybeSingle();
    if (!ownerRow) return { error: "Ung\u00FCltiger Owner" };
  }

  const row = current as {
    status: string;
    progress_percent: number | null;
    weight: number | null;
    execution_health_override: string | null;
    end_date: string | null;
    review_comment: string | null;
    owner_membership_id: string | null;
  };

  const prevOverride = row.execution_health_override ?? null;
  const nextOverride = execution_health_override;
  const normalizedEnd = end_date;
  const prevEnd = row.end_date ?? null;

  const prevOwner = row.owner_membership_id ?? null;

  const changed =
    row.status !== status ||
    (row.progress_percent ?? 0) !== progressRaw ||
    (row.weight ?? 3) !== weightRaw ||
    prevOverride !== nextOverride ||
    prevEnd !== normalizedEnd ||
    (row.review_comment ?? null) !== review_comment ||
    prevOwner !== owner_membership_id;

  const payload: Record<string, unknown> = {
    status,
    progress_percent: progressRaw,
    weight: weightRaw,
    execution_health_override: nextOverride,
    execution_health_override_by_membership_id: nextOverride ? context.membershipId : null,
    execution_health_override_at: nextOverride ? new Date().toISOString() : null,
    end_date: normalizedEnd,
    review_comment,
    owner_membership_id,
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

export async function createReviewMeasureFromContext(formData: FormData) {
  const context = await getPhase0Context();
  if (!context) return { error: "Nicht authentifiziert" };
  const access = await getSidebarAccessContext("reviews");
  if (access.state !== "ok" || !access.canWrite) return { error: "Keine Berechtigung" };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Titel fehlt" };

  const programId = String(formData.get("program_id") ?? "").trim();
  if (!programId) return { error: "Programm fehlt" };

  const cycleInstanceId = String(formData.get("cycle_instance_id") ?? "").trim();
  if (!cycleInstanceId) return { error: "Zyklus fehlt" };

  const directionId = String(formData.get("origin_strategic_direction_id") ?? "").trim() || null;
  const signalType = String(formData.get("origin_review_signal_type") ?? "").trim() || null;
  const sourceObjectType = String(formData.get("origin_source_object_type") ?? "").trim() || null;
  const sourceObjectId = String(formData.get("origin_source_object_id") ?? "").trim() || null;
  const reviewNote = String(formData.get("origin_review_note") ?? "").trim() || null;
  const annualTargetId = String(formData.get("annual_target_id") ?? "").trim() || null;

  const supabase = await createSupabaseServerClient();

  const { data: prog, error: progErr } = await supabase
    .schema("app")
    .from("strategy_programs")
    .select("id, status")
    .eq("id", programId)
    .eq("organization_id", context.organizationId)
    .maybeSingle();
  if (progErr || !prog) return { error: "Ungültiges Programm" };
  if (prog.status === "closed" || prog.status === "archived") {
    return { error: "Programm nicht aktiv" };
  }

  const { data: created, error: insErr } = await supabase
    .schema("app")
    .from("initiatives")
    .insert({
      organization_id: context.organizationId,
      cycle_instance_id: cycleInstanceId,
      program_id: programId,
      title,
      description: reviewNote,
      priority: 3,
      status: "planned",
      progress_percent: 0,
      weight: 3,
      owner_membership_id: context.membershipId,
      linked_okrs: [],
      deliverables: [],
      created_by_membership_id: context.membershipId,
      origin_type: "review_measure",
      origin_review_signal_type: signalType,
      origin_review_cycle_id: cycleInstanceId,
      origin_source_object_type: sourceObjectType,
      origin_source_object_id: sourceObjectId,
      origin_strategic_direction_id: directionId,
      origin_review_note: reviewNote,
    })
    .select("id")
    .single();

  if (insErr || !created?.id) return { error: insErr?.message ?? "Insert fehlgeschlagen" };

  revalidatePath("/reviews");
  return { ok: true, initiativeId: created.id };
}

export async function createReviewImpulseFromContext(formData: FormData) {
  const context = await getPhase0Context();
  if (!context) return { error: "Nicht authentifiziert" };
  const access = await getSidebarAccessContext("reviews");
  if (access.state !== "ok" || !access.canWrite) return { error: "Keine Berechtigung" };

  const cycleInstanceId = String(formData.get("cycle_instance_id") ?? "").trim();
  const feedbackType = String(formData.get("feedback_type") ?? "").trim() as FeedbackType;
  const objectType = String(formData.get("object_type") ?? "").trim() as ObjectType;
  const objectId = String(formData.get("object_id") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim() || null;

  const validFeedback: FeedbackType[] = [
    "continue",
    "adjust",
    "stop",
    "escalate",
    "revisit_direction",
    "revisit_objective",
  ];
  const validObject: ObjectType[] = [
    "objective",
    "strategic_direction",
    "strategy_program",
    "initiative",
    "key_result",
  ];
  if (!validFeedback.includes(feedbackType)) return { error: "Ungültiger Impuls-Typ" };
  if (!validObject.includes(objectType)) return { error: "Ungültiges Objekt" };
  if (!objectId) return { error: "Objekt fehlt" };
  if (!cycleInstanceId) return { error: "Zyklus fehlt" };

  const result = await createReviewFeedback(
    cycleInstanceId,
    feedbackType,
    objectType,
    objectId,
    comment
  );
  if (result.error) return result;

  let strategyHref = "/strategy-cycle?l1=strategic-directions";
  if (objectType === "strategic_direction") {
    strategyHref = `/strategy-cycle?l1=strategic-directions&focus=${objectId}`;
  } else if (objectType === "objective") {
    strategyHref = `/strategy-cycle?l1=objectives&focus=${objectId}`;
  } else if (objectType === "strategy_program") {
    strategyHref = `/strategy-cycle?l1=pips&l2=programme&focus=${objectId}`;
  }

  return { ok: true, strategyHref };
}
