"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAnnualTargetsAccessContext } from "@/lib/rbac/page-access";
import { getPhase0Context, getPlanningCycleAtLevel } from "@/lib/phase0/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  assertCanAssignAnnualTargetOwner,
  type AnnualTargetOwnerOption,
} from "@/lib/annual-targets/eligible-memberships";
import { assertAnnualTargetAlignmentRefsEligible } from "@/lib/annual-targets/validate-alignment-refs";
import {
  hasBlockingIssues,
  validateAnnualTargetActivation,
  validateAnnualTargetDraft,
  type AnnualTargetFormPayload,
} from "@/lib/annual-targets/validation";
import {
  availableLifecycleActions,
  getNextStatusForAction,
  type LifecycleAction,
} from "@/lib/annual-targets/lifecycle";
import { getOrgAnnualTargetSignatureSettings } from "@/lib/annual-targets/org-settings";
import { buildAnnualTargetDocumentPayload } from "@/lib/annual-targets/document-payload";
import { resolveAnnualTargetSignatureProvider } from "@/lib/annual-targets/signature/registry";
import { improveAnnualTargetWithSmartLlm } from "@/lib/annual-targets/annual-target-smart-ai";
import { parseAnnualTargetSmartCheck } from "@/lib/annual-targets/smart-check";
import { readAnalysisNetworkLlmPolicy, isLlmFeatureEnabled } from "@/lib/analysis-network/policy";
import { getTenantBranding } from "@/lib/ceo/queries";
import type {
  AnnualTargetLifecycleStatus,
  AnnualTargetType,
  ProgressCalculationMode,
} from "@/lib/annual-targets/types";

type ActionContext = {
  organizationId: string;
  membershipId: string;
  cycleInstanceId: string;
};

async function getActionContextOrRedirect(): Promise<ActionContext> {
  const access = await getAnnualTargetsAccessContext();
  if (access.state !== "ok" || !access.canWrite) redirect("/no-access");
  const phase0 = await getPhase0Context();
  if (!phase0) redirect("/no-access");
  const cycle = await getPlanningCycleAtLevel(phase0.organizationId, 2);
  if (!cycle) redirect("/planning-cycles");
  return {
    organizationId: phase0.organizationId,
    membershipId: phase0.membershipId,
    cycleInstanceId: cycle.id,
  };
}

function done(path = "/annual-targets?tab=mine"): never {
  revalidatePath("/annual-targets");
  revalidatePath("/strategy-matrix");
  redirect(path);
}

function parseSmartCheckFromForm(formData: FormData): ReturnType<typeof parseAnnualTargetSmartCheck> {
  const raw = String(formData.get("smart_check_json") ?? "").trim();
  if (!raw) return null;
  try {
    return parseAnnualTargetSmartCheck(JSON.parse(raw));
  } catch {
    return null;
  }
}

function parsePayload(formData: FormData): AnnualTargetFormPayload {
  return {
    title: String(formData.get("title") ?? "").trim(),
    targetYear: Number(formData.get("target_year") ?? new Date().getUTCFullYear()),
    ownerMembershipId: String(formData.get("owner_membership_id") ?? "").trim(),
    strategicDirectionId: String(
      formData.get("strategic_direction_id") ?? formData.get("direction_id") ?? ""
    ).trim(),
    description: String(formData.get("description") ?? "").trim(),
    measurementLogic: String(formData.get("measurement_logic") ?? "").trim(),
    progressPercent: Number(formData.get("progress_percent") ?? 0),
    status: (String(formData.get("status") ?? "draft").trim() || "draft") as AnnualTargetLifecycleStatus,
    annualTargetType: (String(formData.get("annual_target_type") ?? "strategic_commitment").trim() ||
      "strategic_commitment") as AnnualTargetType,
    progressCalculationMode: (String(formData.get("progress_calculation_mode") ?? "manual").trim() ||
      "manual") as ProgressCalculationMode,
    derivationNote: String(formData.get("derivation_note") ?? "").trim(),
    strategicObjectiveId: String(formData.get("strategic_objective_id") ?? "").trim() || null,
    strategyProgramId: String(formData.get("strategy_program_id") ?? "").trim() || null,
    bonusWeight: formData.get("bonus_weight") ? Number(formData.get("bonus_weight")) : null,
    baseline: formData.get("baseline") ? Number(formData.get("baseline")) : null,
    currentMeasure: formData.get("current_measure") ? Number(formData.get("current_measure")) : null,
  };
}

async function loadResponsibles(organizationId: string): Promise<AnnualTargetOwnerOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("responsibles")
    .select("membership_id, full_name")
    .eq("organization_id", organizationId)
    .not("membership_id", "is", null);
  return (data ?? []).map((r) => ({
    membershipId: String(r.membership_id),
    fullName: String(r.full_name ?? r.membership_id),
  }));
}

async function upsertStrategicObjectiveLink(
  ctx: ActionContext,
  annualTargetId: string,
  objectiveId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const { error: deleteError } = await supabase
    .schema("app")
    .from("objective_target_links")
    .delete()
    .eq("organization_id", ctx.organizationId)
    .eq("cycle_instance_id", ctx.cycleInstanceId)
    .eq("annual_target_id", annualTargetId);

  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  if (!objectiveId) return { ok: true };

  const { error: insertError } = await supabase.schema("app").from("objective_target_links").insert({
    organization_id: ctx.organizationId,
    planning_cycle_id: ctx.cycleInstanceId,
    cycle_instance_id: ctx.cycleInstanceId,
    annual_target_id: annualTargetId,
    strategy_objective_id: objectiveId,
    contribution_level: "medium",
  });

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  return { ok: true };
}

export async function createAnnualTarget(formData: FormData) {
  const ctx = await getActionContextOrRedirect();
  const returnTab = String(formData.get("return_tab") ?? "mine") === "team" ? "team" : "mine";
  const payload = parsePayload(formData);
  if (returnTab === "mine") {
    payload.ownerMembershipId = ctx.membershipId;
  }
  const draftIssues = validateAnnualTargetDraft(payload);
  if (hasBlockingIssues(draftIssues)) done(`/annual-targets?tab=${returnTab}&error=validation`);

  const responsibles = await loadResponsibles(ctx.organizationId);
  const ownerCheck = await assertCanAssignAnnualTargetOwner({
    organizationId: ctx.organizationId,
    currentMembershipId: ctx.membershipId,
    targetOwnerMembershipId: payload.ownerMembershipId,
    responsibles,
  });
  if (!ownerCheck.ok) done(`/annual-targets?tab=${returnTab}&error=owner-forbidden`);

  const alignmentCheck = await assertAnnualTargetAlignmentRefsEligible({
    organizationId: ctx.organizationId,
    cycleInstanceId: ctx.cycleInstanceId,
    strategicDirectionId: payload.strategicDirectionId,
    strategyProgramId: payload.strategyProgramId,
    strategicObjectiveId: payload.strategicObjectiveId,
  });
  if (!alignmentCheck.ok) done(`/annual-targets?tab=${returnTab}&error=alignment-invalid`);

  const supabase = await createSupabaseServerClient();
  const signatureSettings = await getOrgAnnualTargetSignatureSettings(ctx.organizationId);

  const { data, error } = await supabase
    .schema("app")
    .from("annual_targets")
    .insert({
      organization_id: ctx.organizationId,
      planning_cycle_id: ctx.cycleInstanceId,
      cycle_instance_id: ctx.cycleInstanceId,
      strategic_direction_id: payload.strategicDirectionId,
      strategy_program_id: payload.strategyProgramId,
      title: payload.title,
      description: payload.description || null,
      measurement_logic: payload.measurementLogic,
      baseline: payload.baseline ?? 0,
      current_measure: payload.currentMeasure ?? 0,
      progress_percent: payload.progressPercent,
      target_year: payload.targetYear,
      annual_target_type: payload.annualTargetType,
      progress_calculation_mode: payload.progressCalculationMode,
      bonus_weight: payload.bonusWeight,
      owner_membership_id: payload.ownerMembershipId,
      derivation_note: payload.derivationNote || null,
      status: "draft",
      signature_status: signatureSettings.requireSignature ? "not_required" : "not_required",
      comment: String(formData.get("comment") ?? "").trim() || null,
      created_by_membership_id: ctx.membershipId,
      ai_assisted: formData.get("ai_assisted") === "1",
      ai_model_provider: formData.get("ai_assisted") === "1" ? "groq" : null,
      ai_generated_at: formData.get("ai_assisted") === "1" ? new Date().toISOString() : null,
      smart_check: parseSmartCheckFromForm(formData),
    })
    .select("id")
    .single();

  if (error || !data?.id) done(`/annual-targets?tab=${returnTab}&error=create-failed`);
  const linkResult = await upsertStrategicObjectiveLink(ctx, data.id, payload.strategicObjectiveId);
  if (!linkResult.ok) done(`/annual-targets?tab=${returnTab}&error=link-failed`);
  done(`/annual-targets?tab=${returnTab}&success=created`);
}

export async function updateAnnualTarget(formData: FormData) {
  const ctx = await getActionContextOrRedirect();
  const targetId = String(formData.get("target_id") ?? "");
  if (!targetId) done();

  const payload = parsePayload(formData);
  const responsibles = await loadResponsibles(ctx.organizationId);
  const ownerCheck = await assertCanAssignAnnualTargetOwner({
    organizationId: ctx.organizationId,
    currentMembershipId: ctx.membershipId,
    targetOwnerMembershipId: payload.ownerMembershipId,
    responsibles,
  });
  if (!ownerCheck.ok) done("/annual-targets?error=owner-forbidden");

  const alignmentCheck = await assertAnnualTargetAlignmentRefsEligible({
    organizationId: ctx.organizationId,
    cycleInstanceId: ctx.cycleInstanceId,
    strategicDirectionId: payload.strategicDirectionId,
    strategyProgramId: payload.strategyProgramId,
    strategicObjectiveId: payload.strategicObjectiveId,
  });
  if (!alignmentCheck.ok) done("/annual-targets?error=alignment-invalid");

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .schema("app")
    .from("annual_targets")
    .select("status, signature_status, ai_assisted, ai_model_provider, ai_generated_at, smart_check")
    .eq("id", targetId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  const signatureSettings = await getOrgAnnualTargetSignatureSettings(ctx.organizationId);
  const nextStatus = payload.status;
  if (nextStatus === "active") {
    const activationIssues = validateAnnualTargetActivation(
      payload,
      signatureSettings,
      String(existing?.signature_status ?? "not_required")
    );
    if (hasBlockingIssues(activationIssues)) done("/annual-targets?error=activation-validation");
  } else {
    const draftIssues = validateAnnualTargetDraft(payload);
    if (hasBlockingIssues(draftIssues)) done("/annual-targets?error=validation");
  }

  await supabase
    .schema("app")
    .from("annual_targets")
    .update({
      strategic_direction_id: payload.strategicDirectionId,
      strategy_program_id: payload.strategyProgramId,
      title: payload.title,
      description: payload.description || null,
      measurement_logic: payload.measurementLogic,
      baseline: payload.baseline ?? 0,
      current_measure: payload.currentMeasure ?? 0,
      progress_percent: payload.progressPercent,
      target_year: payload.targetYear,
      annual_target_type: payload.annualTargetType,
      progress_calculation_mode: payload.progressCalculationMode,
      bonus_weight: payload.bonusWeight,
      owner_membership_id: payload.ownerMembershipId,
      derivation_note: payload.derivationNote || null,
      status: nextStatus,
      comment: String(formData.get("comment") ?? "").trim() || null,
      activated_at: nextStatus === "active" ? new Date().toISOString() : undefined,
      activated_by_membership_id: nextStatus === "active" ? ctx.membershipId : undefined,
      ai_assisted: formData.get("ai_assisted") === "1" ? true : Boolean(existing?.ai_assisted),
      ai_model_provider:
        formData.get("ai_assisted") === "1"
          ? "groq"
          : (existing?.ai_model_provider as string | null) ?? null,
      ai_generated_at:
        formData.get("ai_assisted") === "1"
          ? new Date().toISOString()
          : (existing?.ai_generated_at as string | null) ?? null,
      smart_check:
        parseSmartCheckFromForm(formData) ?? parseAnnualTargetSmartCheck(existing?.smart_check),
    })
    .eq("id", targetId)
    .eq("organization_id", ctx.organizationId);

  const linkResult = await upsertStrategicObjectiveLink(ctx, targetId, payload.strategicObjectiveId);
  if (!linkResult.ok) done("/annual-targets?error=link-failed");
  done("/annual-targets?success=updated");
}

export async function deleteAnnualTarget(formData: FormData) {
  const ctx = await getActionContextOrRedirect();
  const targetId = String(formData.get("target_id") ?? "");
  if (!targetId) done();

  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("annual_targets")
    .delete()
    .eq("id", targetId)
    .eq("organization_id", ctx.organizationId)
    .eq("status", "draft");

  done("/annual-targets?success=deleted");
}

export async function transitionAnnualTargetLifecycle(formData: FormData) {
  const ctx = await getActionContextOrRedirect();
  const targetId = String(formData.get("target_id") ?? "");
  const action = String(formData.get("lifecycle_action") ?? "") as LifecycleAction;
  const returnTab = String(formData.get("return_tab") ?? "mine");
  if (!targetId || !action) done(`/annual-targets?tab=${returnTab}`);

  const supabase = await createSupabaseServerClient();
  const signatureSettings = await getOrgAnnualTargetSignatureSettings(ctx.organizationId);

  const { data: row } = await supabase
    .schema("app")
    .from("annual_targets")
    .select("*")
    .eq("id", targetId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (!row) done(`/annual-targets?tab=${returnTab}&error=not-found`);

  const current = row.status as AnnualTargetLifecycleStatus;
  const allowed = availableLifecycleActions(
    current,
    signatureSettings,
    String(row.signature_status ?? "not_required")
  );
  if (!allowed.includes(action)) done(`/annual-targets?tab=${returnTab}&error=invalid-transition`);

  const next = getNextStatusForAction(current, action, signatureSettings);
  if (!next) done(`/annual-targets?tab=${returnTab}&error=invalid-transition`);

  const patch: Record<string, unknown> = { status: next };
  const now = new Date().toISOString();

  if (next === "submitted_for_review") {
    patch.submitted_at = now;
    patch.submitted_by_membership_id = ctx.membershipId;
  }
  if (next === "reviewed") patch.reviewed_at = now;
  if (next === "approved") {
    patch.approved_at = now;
    patch.approved_by_membership_id = ctx.membershipId;
  }
  if (next === "sent_for_signature") {
    patch.signature_status = "sent";
  }
  if (next === "signed") {
    patch.signed_at = now;
    patch.signature_status = "signed";
  }
  if (next === "active") {
    const payload: AnnualTargetFormPayload = {
      title: String(row.title ?? ""),
      targetYear: Number(row.target_year),
      ownerMembershipId: String(row.owner_membership_id ?? ""),
      strategicDirectionId: String(row.strategic_direction_id ?? ""),
      description: String(row.description ?? ""),
      measurementLogic: String(row.measurement_logic ?? ""),
      progressPercent: Number(row.progress_percent ?? 0),
      status: "active",
      annualTargetType: row.annual_target_type as AnnualTargetType,
      progressCalculationMode: row.progress_calculation_mode as ProgressCalculationMode,
      derivationNote: String(row.derivation_note ?? ""),
      strategicObjectiveId: null,
      strategyProgramId: row.strategy_program_id as string | null,
      bonusWeight: row.bonus_weight as number | null,
      baseline: row.baseline as number | null,
      currentMeasure: row.current_measure as number | null,
    };
    const activationIssues = validateAnnualTargetActivation(
      payload,
      signatureSettings,
      String(row.signature_status ?? "not_required")
    );
    if (hasBlockingIssues(activationIssues)) {
      done(`/annual-targets?tab=${returnTab}&error=activation-validation`);
    }
    patch.activated_at = now;
    patch.activated_by_membership_id = ctx.membershipId;
  }
  if (next === "archived") patch.archived_at = now;

  await supabase
    .schema("app")
    .from("annual_targets")
    .update(patch)
    .eq("id", targetId)
    .eq("organization_id", ctx.organizationId);

  done(`/annual-targets?tab=${returnTab}&success=lifecycle`);
}

export async function sendAnnualTargetForSignature(formData: FormData) {
  const ctx = await getActionContextOrRedirect();
  const targetId = String(formData.get("target_id") ?? "");
  if (!targetId) done();

  const supabase = await createSupabaseServerClient();
  const signatureSettings = await getOrgAnnualTargetSignatureSettings(ctx.organizationId);
  const provider = resolveAnnualTargetSignatureProvider(signatureSettings.signatureMode);

  const { data: row } = await supabase
    .schema("app")
    .from("annual_targets")
    .select("*, strategic_direction_id")
    .eq("id", targetId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (!row || row.status !== "approved") done("/annual-targets?error=signature-not-ready");

  const { data: direction } = await supabase
    .schema("app")
    .from("strategic_directions")
    .select("title")
    .eq("id", row.strategic_direction_id)
    .maybeSingle();

  const documentPayload = buildAnnualTargetDocumentPayload({
    title: String(row.title),
    targetYear: Number(row.target_year),
    ownerDisplayName: "Owner",
    directionTitle: String(direction?.title ?? ""),
    strategicObjectiveTitle: null,
    programTitle: null,
    description: String(row.description ?? ""),
    measurementLogic: String(row.measurement_logic ?? ""),
    baseline: row.baseline as number | null,
    currentMeasure: row.current_measure as number | null,
    progressMode: String(row.progress_calculation_mode),
    annualTargetType: String(row.annual_target_type),
    bonusWeight: row.bonus_weight as number | null,
    derivationNote: row.derivation_note as string | null,
  });

  const signerIds = [String(row.owner_membership_id)].filter(Boolean);
  const result = await provider.createSignatureRequest({
    organizationId: ctx.organizationId,
    annualTargetId: targetId,
    signerMembershipIds: signerIds,
    documentPayload,
  });

  await supabase.schema("app").from("annual_target_signature_requests").insert({
    organization_id: ctx.organizationId,
    annual_target_id: targetId,
    provider: provider.providerId,
    provider_request_id: result.providerRequestId,
    status: result.signatureStatus,
    requested_by: ctx.membershipId,
    metadata: documentPayload,
  });

  const { data: sigReq } = await supabase
    .schema("app")
    .from("annual_target_signature_requests")
    .select("id")
    .eq("annual_target_id", targetId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sigReq?.id) {
    for (let i = 0; i < signerIds.length; i++) {
      await supabase.schema("app").from("annual_target_signers").insert({
        signature_request_id: sigReq.id,
        organization_id: ctx.organizationId,
        membership_id: signerIds[i],
        signer_role: i === 0 ? "employee" : "manager",
        signing_order: i + 1,
        status: "sent",
      });
    }
  }

  await supabase
    .schema("app")
    .from("annual_targets")
    .update({ status: "sent_for_signature", signature_status: "sent" })
    .eq("id", targetId);

  done("/annual-targets?success=signature-sent");
}

export async function improveAnnualTargetWithSentinelAction(formData: FormData) {
  const access = await getAnnualTargetsAccessContext();
  if (access.state !== "ok") redirect("/no-access");

  const phase0 = await getPhase0Context();
  if (!phase0) redirect("/no-access");
  const branding = await getTenantBranding(phase0.organizationId);
  const policy = readAnalysisNetworkLlmPolicy(branding?.branding_config);
  if (!isLlmFeatureEnabled(policy, "annual_target_smart_formulation")) {
    return { ok: false as const, error: "Sentinel für Jahresziele ist deaktiviert." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const measurementLogic = String(formData.get("measurement_logic") ?? "").trim();
  const derivationNote = String(formData.get("derivation_note") ?? "").trim();
  if (!title && !description && !measurementLogic) {
    return {
      ok: false as const,
      error: "Bitte zuerst Titel, Beschreibung oder Messlogik im Formular erfassen.",
    };
  }

  const result = await improveAnnualTargetWithSmartLlm({
    title,
    description,
    measurementLogic,
    derivationNote,
    targetYear: Number(formData.get("target_year") ?? new Date().getUTCFullYear()),
    directionTitle: String(formData.get("direction_title") ?? ""),
    strategicObjectiveTitle: String(formData.get("strategic_objective_title") ?? "") || null,
    programTitle: String(formData.get("program_title") ?? "") || null,
    annualTargetType: String(formData.get("annual_target_type") ?? "strategic_commitment"),
    measurementLogicHint: measurementLogic,
    baseline: formData.get("baseline") ? Number(formData.get("baseline")) : null,
    currentMeasure: formData.get("current_measure") ? Number(formData.get("current_measure")) : null,
  });

  return result;
}
