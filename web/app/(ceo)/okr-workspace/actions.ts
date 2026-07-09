"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { getOrgOkrSettings } from "@/lib/okr/org-okr-settings";
import { isMissingReviewSessionMigrationColumns } from "@/lib/okr/review-sessions";
import { planOkrReviewOwnerNotifications } from "@/lib/okr/review-session-notifications";
import { getPermissionCodesForMembership } from "@/lib/rbac/permission-codes";
import {
  canAccessKeyResult,
  canAccessObjective,
  canCreateOkrKeyResult,
  canCreateOkrObjective,
  isExplicitKeyResultDeputyRemoval,
  isExplicitKeyResultOwnerRemoval,
  resolveKeyResultDeputyMembershipPatch,
  resolveKeyResultOwnerMembershipPatch,
} from "@/lib/okr/okr-object-access";
import { getOkrCycleInstanceScopeIds, getOkrCycles } from "@/lib/okr/queries";
import { resolveNextOkrCycleId } from "@/lib/okr/okr-cycle-nav";
import { scheduleOkrContributionAssessmentJob } from "@/lib/okr/contribution-assessment-schedule";
import { scheduleKrInitiativeMatchingIfEnabled } from "@/lib/okr/kr-initiative-matching-schedule";
import { fetchOkrContributionDirectionTargetForObjective } from "@/lib/okr/contribution-assessment-triggers";
import { readAnalysisNetworkLlmPolicy, isLlmFeatureEnabled } from "@/lib/analysis-network/policy";
import {
  normalizeOkrContributionTier,
  type OkrContributionTier,
} from "@/lib/strategy-cycle/coverage-level";
import { okrObjectiveAllowsCheckIn, okrCheckInBlockedMessageDe } from "@/lib/okr/okr-execution-gate";
import { okrPlanningEditBlockedMessageDe } from "@/lib/okr/okr-objective-lifecycle";
import { resolveApprovalAssignee } from "@/lib/tasks/approval-routing";
import {
  evaluateAnnualTargetGateForObjective,
  hasDirectAnnualTargetAlignment,
} from "@/lib/okr/annual-target-okr-gate";

const OKR_APP_PATHS = [
  "/okr-workspace",
  "/okr/dashboard",
  "/okr/tracking",
  "/okr/planning",
  "/okr/review",
] as const;

function revalidateOkrPaths() {
  for (const p of OKR_APP_PATHS) revalidatePath(p);
}

function blockOkrPlanningEdit(status: string | null | undefined): { error: string } | null {
  const msg = okrPlanningEditBlockedMessageDe(status ?? "");
  return msg ? { error: msg } : null;
}

/**
 * Server-Terminal: RSC-POST ist oft 200 + text/x-component — echte DB-Fehler hier lesbar machen.
 * `always`: z. B. Insert/RLS immer loggen; sonst nur in development (weniger Lärm bei erwarteten Denies).
 */
function logOkrSupabaseDiag(
  tag: string,
  err: { message?: string; code?: string; details?: string; hint?: string } | null | undefined,
  extra?: Record<string, unknown>,
  options?: { always?: boolean }
) {
  if (!options?.always && process.env.NODE_ENV !== "development") {
    return;
  }
  console.error("[okr-workspace]", {
    tag,
    message: err?.message,
    code: err?.code,
    details: err?.details,
    hint: err?.hint,
    ...extra,
  });
}

async function assertMembershipInOrg(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  membershipId: string
): Promise<boolean> {
  const { data } = await supabase
    .schema("app")
    .from("organization_memberships")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", membershipId)
    .maybeSingle();
  return Boolean(data?.id);
}

async function requireOkrWrite() {
  const pageAccess = await getSidebarAccessContext("okr-workspace");
  if (pageAccess.state !== "ok") {
    return { error: "Keine Schreibberechtigung für den OKR-Arbeitsbereich." as const };
  }
  const permissionCodes = await getPermissionCodesForMembership(pageAccess.access.membershipId);
  const moduleOkrWrite = permissionCodes.has("okr.write");
  if (!pageAccess.canWrite && !moduleOkrWrite) {
    return { error: "Keine Schreibberechtigung für den OKR-Arbeitsbereich." as const };
  }
  const context = await getPhase0Context();
  if (!context) return { error: "Nicht authentifiziert." as const };
  return { context, pageAccess };
}

function objectiveWriteDeniedError() {
  return {
    error: "Keine Berechtigung: Objective kann nur mit passender Relation und OKR-Object-Permission geändert werden." as const,
  };
}

function keyResultWriteDeniedError() {
  return {
    error: "Keine Berechtigung: Key Result kann nur mit passender Relation und OKR-KR-Permission geändert werden." as const,
  };
}

function keyResultMatchingRelevantChanged(input: {
  prev: {
    title: string;
    metric_type: string;
    start_value: number | null;
    target_value: number | null;
    measurement_unit: string | null;
  };
  next: {
    title: string;
    metric_type: string;
    start_value: number | null;
    target_value: number | null;
    measurement_unit: string | null;
  };
}): boolean {
  return (
    input.prev.title !== input.next.title ||
    input.prev.metric_type !== input.next.metric_type ||
    input.prev.start_value !== input.next.start_value ||
    input.prev.target_value !== input.next.target_value ||
    (input.prev.measurement_unit ?? null) !== (input.next.measurement_unit ?? null)
  );
}

async function assertStrategicDirectionInCycle(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  cycleInstanceId: string,
  strategicDirectionId: string
): Promise<boolean> {
  const { data } = await supabase
    .schema("app")
    .from("strategic_directions")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .eq("id", strategicDirectionId)
    .maybeSingle();
  return Boolean(data?.id);
}

async function assertOkrCycle(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  cycleInstanceId: string,
  okrCycleId: string
): Promise<boolean> {
  const { data: oc } = await supabase
    .schema("app")
    .from("okr_cycles")
    .select("id, cycle_instance_id")
    .eq("organization_id", organizationId)
    .eq("id", okrCycleId)
    .maybeSingle();

  if (!oc?.cycle_instance_id) return false;

  const scope = await getOkrCycleInstanceScopeIds(organizationId, cycleInstanceId);
  return scope.includes(oc.cycle_instance_id);
}

/** `YYYY-MM-DD` für key_results.due_date — Ende des am OKR-Objective hängenden OKR-Zyklus */
async function keyResultDueDateFromOkrCycleEnd(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  okrObjectiveId: string
): Promise<string | null> {
  const { data: obj } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("okr_cycle_id, cycle_instance_id")
    .eq("id", okrObjectiveId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!obj?.okr_cycle_id || !obj.cycle_instance_id) return null;

  const { data: oc } = await supabase
    .schema("app")
    .from("okr_cycles")
    .select("end_date")
    .eq("organization_id", organizationId)
    .eq("id", obj.okr_cycle_id)
    .maybeSingle();

  if (!oc?.end_date) return null;
  const raw = typeof oc.end_date === "string" ? oc.end_date : String(oc.end_date);
  return raw.length >= 10 ? raw.slice(0, 10) : raw;
}

export async function createOkrObjectiveAction(input: {
  cycleInstanceId: string;
  okrCycleId: string;
  title: string;
  description?: string | null;
  strategicDirectionId: string;
  ownerMembershipId?: string | null;
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const title = input.title.trim();
  if (!title) return { error: "Titel fehlt." };
  const description = (input.description ?? "").trim();
  if (!description) return { error: "Beschreibung fehlt." };
  if (!input.strategicDirectionId) return { error: "Stoßrichtung fehlt." };

  const supabase = await createSupabaseServerClient();
  const ok = await assertOkrCycle(
    supabase,
    auth.context.organizationId,
    input.cycleInstanceId,
    input.okrCycleId
  );
  if (!ok) return { error: "Ungültiger OKR-Zeitraum." };

  const dirOk = await assertStrategicDirectionInCycle(
    supabase,
    auth.context.organizationId,
    input.cycleInstanceId,
    input.strategicDirectionId
  );
  if (!dirOk) return { error: "Ungültige Stoßrichtung für diesen Zyklus." };

  const ownerRaw = (input.ownerMembershipId ?? "").trim();
  if (!ownerRaw) return { error: "OKR-Objective-Owner fehlt." };
  const memOkOwner = await assertMembershipInOrg(
    supabase,
    auth.context.organizationId,
    ownerRaw
  );
  if (!memOkOwner) return { error: "Ungültiger Owner (Membership)." };
  const ownerId = ownerRaw;
  const orgSettings = await getOrgOkrSettings(auth.context.organizationId);
  const gateOnCreate = await evaluateAnnualTargetGateForObjective({
    organizationId: auth.context.organizationId,
    cycleInstanceId: input.cycleInstanceId,
    okrCycleId: input.okrCycleId,
    objectiveOwnerMembershipId: ownerId,
    settings: orgSettings,
    onCreate: true,
    nextStatus: "draft",
  });
  if (gateOnCreate.blocked) {
    return {
      error:
        "OKR-Erstellung blockiert: Für den Objective-Owner existieren keine aktiven Jahresziele im Zieljahr.",
    };
  }

  const createDenied = {
    error:
      "Keine Berechtigung zum Anlegen: brauchst okr.objective.update.all oder okr.objective.update.own (für dich als Owner). Key-Result-Codes (okr.key_result.*) zählen hier nicht." as const,
  };

  const { data: dbCanModifyObjective, error: objectiveModifyRpcError } = await supabase
    .schema("app")
    .rpc("okr_can_modify_objective", {
      p_org: auth.context.organizationId,
      p_owner: ownerId,
      p_deputy: null,
    });

  if (objectiveModifyRpcError) {
    logOkrSupabaseDiag("createOkrObjectiveAction.okr_can_modify_objective", objectiveModifyRpcError, {
      organizationId: auth.context.organizationId,
      membershipId: auth.context.membershipId,
      ownerMembershipId: ownerId,
    });
  }

  const allowCreate =
    !objectiveModifyRpcError && typeof dbCanModifyObjective === "boolean"
      ? dbCanModifyObjective
      : canCreateOkrObjective({
          permissionCodes: await getPermissionCodesForMembership(auth.context.membershipId),
          currentMembershipId: auth.context.membershipId,
          requestedOwnerMembershipId: ownerId,
        });

  if (!allowCreate) {
    logOkrSupabaseDiag("createOkrObjectiveAction.denied_before_insert", null, {
      organizationId: auth.context.organizationId,
      membershipId: auth.context.membershipId,
      ownerMembershipId: ownerId,
      dbCanModifyObjective: typeof dbCanModifyObjective === "boolean" ? dbCanModifyObjective : null,
      hadRpcError: Boolean(objectiveModifyRpcError),
    });
    return createDenied;
  }

  const { data: inserted, error } = await supabase
    .schema("app")
    .from("okr_objectives")
    .insert({
      organization_id: auth.context.organizationId,
      cycle_instance_id: input.cycleInstanceId,
      okr_cycle_id: input.okrCycleId,
      leading_strategic_direction_id: input.strategicDirectionId,
      title,
      description,
      status: "draft",
      importance_score: 3,
      owner_membership_id: ownerId,
      created_by_membership_id: auth.context.membershipId,
      created_by_source: "user",
    })
    .select("id")
    .single();

  if (error || !inserted?.id) {
    logOkrSupabaseDiag(
      "createOkrObjectiveAction.okr_objectives_insert",
      error,
      {
        organizationId: auth.context.organizationId,
        membershipId: auth.context.membershipId,
        ownerMembershipId: ownerId,
        okrCycleId: input.okrCycleId,
        cycleInstanceId: input.cycleInstanceId,
      },
      { always: true }
    );
    return { error: error?.message ?? "OKR-Objective konnte nicht angelegt werden." };
  }

  revalidateOkrPaths();
  await scheduleOkrContributionAssessmentJob({
    supabase,
    organizationId: auth.context.organizationId,
    cycleInstanceId: input.cycleInstanceId,
    okrObjectiveId: inserted.id,
    membershipId: auth.context.membershipId,
    trigger: "okr_objective_create",
  });
  return { id: inserted.id, warning: gateOnCreate.warning ?? undefined };
}

export async function updateOkrObjectiveAction(input: {
  cycleInstanceId: string;
  objectiveId: string;
  title: string;
  description?: string | null;
  strategicDirectionId: string;
  status?: string;
  ownerMembershipId?: string | null;
  deputyMembershipId?: string | null;
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const title = input.title.trim();
  if (!title) return { error: "Titel fehlt." };
  const description = (input.description ?? "").trim();
  if (!description) return { error: "Beschreibung fehlt." };
  if (!input.strategicDirectionId) return { error: "Stoßrichtung fehlt." };

  const supabase = await createSupabaseServerClient();
  const dirOk = await assertStrategicDirectionInCycle(
    supabase,
    auth.context.organizationId,
    input.cycleInstanceId,
    input.strategicDirectionId
  );
  if (!dirOk) return { error: "Ungültige Stoßrichtung für diesen Zyklus." };

  const { data: existingObj } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id, okr_cycle_id, owner_membership_id, deputy_membership_id, status, title, description")
    .eq("id", input.objectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .maybeSingle();

  if (!existingObj?.okr_cycle_id) {
    return { error: "OKR-Objective nicht gefunden oder kein OKR-Zeitraum gesetzt." };
  }

  const planningBlock = blockOkrPlanningEdit(existingObj.status);
  if (planningBlock) return planningBlock;

  const existingRow = {
    id: existingObj.id,
    owner_membership_id: existingObj.owner_membership_id ?? null,
    deputy_membership_id: existingObj.deputy_membership_id ?? null,
  };
  if (!(await canAccessObjective({
    currentMembershipId: auth.context.membershipId,
    action: "update",
    objective: existingRow,
  }))) {
    return objectiveWriteDeniedError();
  }

  const permissionCodesForClear = await getPermissionCodesForMembership(auth.context.membershipId);

  let ownerId: string | null | undefined = undefined;
  if (input.ownerMembershipId !== undefined) {
    const raw = (input.ownerMembershipId ?? "").trim();
    if (!raw) {
      return { error: "OKR-Objective-Owner fehlt." };
    }
    const memOk = await assertMembershipInOrg(supabase, auth.context.organizationId, raw);
    if (!memOk) return { error: "Ungültiger Owner (Membership)." };
    ownerId = raw;
  }

  let deputyId: string | null | undefined = undefined;
  if (input.deputyMembershipId !== undefined) {
    if (input.deputyMembershipId === null || input.deputyMembershipId === "") {
      deputyId = null;
    } else {
      const memOk = await assertMembershipInOrg(
        supabase,
        auth.context.organizationId,
        input.deputyMembershipId
      );
      if (!memOk) return { error: "Ungültiger Deputy (Membership)." };
      deputyId = input.deputyMembershipId;
    }
  }

  if (deputyId === null && input.deputyMembershipId !== undefined) {
    if (!permissionCodesForClear.has("okr.objective.update.all")) {
      const mid = auth.context.membershipId;
      const isOwner = existingObj.owner_membership_id === mid;
      const wasDeputy = existingObj.deputy_membership_id === mid;
      if (!isOwner && !wasDeputy) {
        return { error: "Deputy entfernen ist nur mit okr.objective.update.all erlaubt." };
      }
    }
  }

  const patch: Record<string, unknown> = {
    title,
    description,
    leading_strategic_direction_id: input.strategicDirectionId,
  };
  if (input.status !== undefined) {
    patch.status = input.status?.trim() || "draft";
  }
  if (ownerId !== undefined) patch.owner_membership_id = ownerId;
  if (deputyId !== undefined) patch.deputy_membership_id = deputyId;
  const nextStatus =
    input.status !== undefined ? (input.status?.trim() || "draft") : (existingObj.status ?? "draft");
  const nextOwnerId = ownerId !== undefined ? ownerId : (existingObj.owner_membership_id ?? "");
  const orgSettings = await getOrgOkrSettings(auth.context.organizationId);
  const gateOnUpdate = await evaluateAnnualTargetGateForObjective({
    organizationId: auth.context.organizationId,
    cycleInstanceId: input.cycleInstanceId,
    okrCycleId: existingObj.okr_cycle_id,
    objectiveOwnerMembershipId: nextOwnerId,
    settings: orgSettings,
    onCreate: false,
    nextStatus,
  });
  if (gateOnUpdate.blocked) {
    return {
      error:
        "Aktivierung blockiert: Keine aktiven Jahresziele für den Objective-Owner im relevanten Zieljahr.",
    };
  }
  const activatingNow = (existingObj.status ?? "draft") === "draft" && nextStatus !== "draft";
  if (activatingNow) {
    const hasAlignment = await hasDirectAnnualTargetAlignment({
      organizationId: auth.context.organizationId,
      cycleInstanceId: input.cycleInstanceId,
      objectiveId: input.objectiveId,
    });
    if (!hasAlignment) {
      return {
        error:
          "Aktivierung blockiert: Objective muss mindestens einem Jahresziel zugeordnet sein oder eine genehmigte Ausnahme besitzen.",
      };
    }
  }

  const { error } = await supabase
    .schema("app")
    .from("okr_objectives")
    .update(patch)
    .eq("id", input.objectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId);

  if (error) return { error: error.message };

  const resolvedObjectiveOwner =
    ownerId !== undefined ? ownerId : existingObj.owner_membership_id;
  const { okrKrOwnerMustMatchObjective } = await getOrgOkrSettings(auth.context.organizationId);
  if (okrKrOwnerMustMatchObjective) {
    const { error: cascadeErr } = await supabase
      .schema("app")
      .from("key_results")
      .update({ owner_membership_id: resolvedObjectiveOwner })
      .eq("okr_objective_id", input.objectiveId)
      .eq("organization_id", auth.context.organizationId);
    if (cascadeErr) return { error: cascadeErr.message };
  }

  revalidateOkrPaths();
  return { warning: gateOnUpdate.warning ?? undefined };
}

export async function deleteOkrObjectiveAction(input: { cycleInstanceId: string; objectiveId: string }) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const supabase = await createSupabaseServerClient();
  const { data: objMeta } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id, owner_membership_id, deputy_membership_id, status")
    .eq("id", input.objectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .maybeSingle();

  if (!objMeta) {
    return { error: "OKR-Objective nicht gefunden." };
  }

  const planningBlock = blockOkrPlanningEdit(objMeta.status);
  if (planningBlock) return planningBlock;

  if (!(await canAccessObjective({
    currentMembershipId: auth.context.membershipId,
    action: "update",
    objective: {
      id: objMeta.id,
      owner_membership_id: objMeta.owner_membership_id ?? null,
      deputy_membership_id: objMeta.deputy_membership_id ?? null,
    },
  }))) {
    return objectiveWriteDeniedError();
  }

  const { error } = await supabase
    .schema("app")
    .from("okr_objectives")
    .delete()
    .eq("id", input.objectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId);

  if (error) return { error: error.message };

  revalidateOkrPaths();
  return {};
}

export async function upsertAnnualTargetObjectiveLinkAction(input: {
  cycleInstanceId: string;
  objectiveId: string;
  annualTargetId: string;
  alignmentType?: "direct" | "indirect" | "exception" | "operational_necessity";
  weight?: number | null;
  comment?: string | null;
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const supabase = await createSupabaseServerClient();
  const { data: objective } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id, owner_membership_id, deputy_membership_id, status")
    .eq("id", input.objectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .maybeSingle();
  if (!objective?.id) return { error: "Objective nicht gefunden." };

  const planningBlock = blockOkrPlanningEdit(objective.status);
  if (planningBlock) return planningBlock;
  if (
    !(await canAccessObjective({
      currentMembershipId: auth.context.membershipId,
      action: "update",
      objective: {
        id: objective.id,
        owner_membership_id: objective.owner_membership_id ?? null,
        deputy_membership_id: objective.deputy_membership_id ?? null,
      },
    }))
  ) {
    return objectiveWriteDeniedError();
  }

  const { data: target } = await supabase
    .schema("app")
    .from("annual_targets")
    .select("id")
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .eq("id", input.annualTargetId)
    .maybeSingle();
  if (!target?.id) return { error: "Jahresziel nicht gefunden." };

  const { error } = await supabase
    .schema("app")
    .from("annual_target_okr_objective_links")
    .upsert(
      {
        organization_id: auth.context.organizationId,
        cycle_instance_id: input.cycleInstanceId,
        annual_target_id: input.annualTargetId,
        okr_objective_id: input.objectiveId,
        alignment_type: input.alignmentType ?? "direct",
        weight: input.weight ?? null,
        comment: (input.comment ?? "").trim() || null,
        created_by_membership_id: auth.context.membershipId,
      },
      { onConflict: "cycle_instance_id,annual_target_id,okr_objective_id" }
    );
  if (error) return { error: error.message };
  revalidateOkrPaths();
  return {};
}

export async function removeAnnualTargetObjectiveLinkAction(input: {
  cycleInstanceId: string;
  objectiveId: string;
  annualTargetId: string;
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .schema("app")
    .from("annual_target_okr_objective_links")
    .delete()
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .eq("okr_objective_id", input.objectiveId)
    .eq("annual_target_id", input.annualTargetId);
  if (error) return { error: error.message };
  revalidateOkrPaths();
  return {};
}

export async function upsertAnnualTargetObjectiveExceptionAction(input: {
  cycleInstanceId: string;
  objectiveId: string;
  annualTargetId?: string | null;
  exceptionReason: string;
  approvalStatus?: "pending" | "approved" | "rejected";
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;
  const reason = input.exceptionReason.trim();
  if (!reason) return { error: "Ausnahmebegründung fehlt." };

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .schema("app")
    .from("annual_target_okr_objective_exceptions")
    .select("id")
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .eq("okr_objective_id", input.objectiveId)
    .is("annual_target_id", input.annualTargetId ?? null)
    .maybeSingle();

  const payload = {
    organization_id: auth.context.organizationId,
    cycle_instance_id: input.cycleInstanceId,
    okr_objective_id: input.objectiveId,
    annual_target_id: input.annualTargetId ?? null,
    exception_reason: reason,
    approval_status: input.approvalStatus ?? "pending",
    approved_by:
      input.approvalStatus === "approved" ? auth.context.membershipId : null,
    approved_at:
      input.approvalStatus === "approved" ? new Date().toISOString() : null,
    created_by_membership_id: auth.context.membershipId,
  };
  const { error } = existing?.id
    ? await supabase
        .schema("app")
        .from("annual_target_okr_objective_exceptions")
        .update(payload)
        .eq("id", existing.id)
    : await supabase.schema("app").from("annual_target_okr_objective_exceptions").insert(payload);
  if (error) return { error: error.message };
  revalidateOkrPaths();
  return {};
}

export async function createKeyResultAction(input: {
  cycleInstanceId: string;
  objectiveId: string;
  title: string;
  metricType?: string;
  startValue?: number | null;
  targetValue?: number | null;
  currentValue?: number | null;
  measurementUnit?: string | null;
  ownerMembershipId?: string | null;
  deputyMembershipId?: string | null;
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const title = input.title.trim();
  if (!title) return { error: "Titel fehlt." };

  const supabase = await createSupabaseServerClient();
  const { data: obj } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id, okr_cycle_id, cycle_instance_id, owner_membership_id, deputy_membership_id, status")
    .eq("id", input.objectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .maybeSingle();

  if (!obj?.okr_cycle_id) return { error: "OKR-Objective nicht gefunden." };

  const planningBlock = blockOkrPlanningEdit(obj.status);
  if (planningBlock) return planningBlock;

  const parentObjective = {
    id: obj.id,
    owner_membership_id: obj.owner_membership_id ?? null,
    deputy_membership_id: obj.deputy_membership_id ?? null,
  };

  const { okrKrOwnerMustMatchObjective } = await getOrgOkrSettings(auth.context.organizationId);
  let krOwnerId: string | null = null;
  if (okrKrOwnerMustMatchObjective) {
    krOwnerId = obj.owner_membership_id ?? null;
  } else if (input.ownerMembershipId) {
    const raw = String(input.ownerMembershipId).trim();
    if (raw) {
      const memOk = await assertMembershipInOrg(supabase, auth.context.organizationId, raw);
      if (!memOk) return { error: "Ungültiger Owner (Membership)." };
      krOwnerId = raw;
    }
  }
  /** Ohne UI-Owner: wie fachlich üblich Objective-Owner (sonst bleibt null → canCreateOkrKeyResult lehnt ab). */
  if (!krOwnerId) {
    krOwnerId = obj.owner_membership_id ?? null;
  }

  if (!(await canCreateOkrKeyResult({
    currentMembershipId: auth.context.membershipId,
    requestedKrOwnerMembershipId: krOwnerId,
    parentObjective,
  }))) {
    return { error: "Keine Berechtigung: Key Result anlegen nur mit okr.key_result.update.all oder als Owner mit Parent-Schreibrecht." };
  }

  let krDeputyId: string | null = null;
  if (input.deputyMembershipId) {
    const memOk = await assertMembershipInOrg(
      supabase,
      auth.context.organizationId,
      input.deputyMembershipId
    );
    if (!memOk) return { error: "Ungültiger Deputy (Membership)." };
    krDeputyId = input.deputyMembershipId;
  }

  const dueDate = await keyResultDueDateFromOkrCycleEnd(
    supabase,
    auth.context.organizationId,
    input.objectiveId
  );

  const { data: inserted, error } = await supabase
    .schema("app")
    .from("key_results")
    .insert({
      organization_id: auth.context.organizationId,
      okr_objective_id: input.objectiveId,
      title,
      metric_type: input.metricType?.trim() || "boolean",
      start_value: input.startValue ?? null,
      target_value: input.targetValue ?? null,
      current_value: input.currentValue ?? null,
      measurement_unit: input.measurementUnit?.trim() || null,
      status: "draft",
      due_date: dueDate,
      owner_membership_id: krOwnerId,
      deputy_membership_id: krDeputyId,
    })
    .select("id")
    .single();

  if (error || !inserted?.id) return { error: error?.message ?? "Key Result konnte nicht angelegt werden." };
  revalidateOkrPaths();
  if (obj?.cycle_instance_id) {
    await scheduleOkrContributionAssessmentJob({
      supabase,
      organizationId: auth.context.organizationId,
      cycleInstanceId: obj.cycle_instance_id,
      okrObjectiveId: input.objectiveId,
      membershipId: auth.context.membershipId,
      trigger: "key_result_create",
    });
    await scheduleKrInitiativeMatchingIfEnabled({
      supabase,
      organizationId: auth.context.organizationId,
      cycleInstanceId: obj.cycle_instance_id,
      keyResultId: inserted.id,
      membershipId: auth.context.membershipId,
      trigger: "key_result_create",
    });
  }
  return { id: inserted.id };
}

export async function updateKeyResultAction(input: {
  keyResultId: string;
  title: string;
  metricType?: string;
  startValue?: number | null;
  targetValue?: number | null;
  currentValue?: number | null;
  measurementUnit?: string | null;
  status?: string;
  ownerMembershipId?: string | null;
  deputyMembershipId?: string | null;
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const title = input.title.trim();
  if (!title) return { error: "Titel fehlt." };

  const supabase = await createSupabaseServerClient();

  const { data: krContext } = await supabase
    .schema("app")
    .from("key_results")
    .select(
      "id, okr_objective_id, owner_membership_id, deputy_membership_id, title, metric_type, start_value, target_value, measurement_unit, status"
    )
    .eq("id", input.keyResultId)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();

  if (!krContext?.okr_objective_id) return { error: "Key Result nicht gefunden." };

  const { data: objOwnRow } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id, owner_membership_id, deputy_membership_id, status, cycle_instance_id")
    .eq("id", krContext.okr_objective_id)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();
  if (!objOwnRow?.id) return { error: "Objective nicht gefunden." };

  const planningBlock = blockOkrPlanningEdit(objOwnRow.status);
  if (planningBlock) return planningBlock;

  const objectiveRow = {
    id: objOwnRow.id,
    owner_membership_id: objOwnRow.owner_membership_id ?? null,
    deputy_membership_id: objOwnRow.deputy_membership_id ?? null,
  };
  const krRow = {
    id: krContext.id,
    owner_membership_id: krContext.owner_membership_id ?? null,
    deputy_membership_id: krContext.deputy_membership_id ?? null,
  };

  if (!(await canAccessKeyResult({
    currentMembershipId: auth.context.membershipId,
    action: "update",
    keyResult: krRow,
    objective: objectiveRow,
  }))) {
    return keyResultWriteDeniedError();
  }

  const krPermissionCodes = await getPermissionCodesForMembership(auth.context.membershipId);

  const dueDate = await keyResultDueDateFromOkrCycleEnd(
    supabase,
    auth.context.organizationId,
    krContext.okr_objective_id
  );

  const { okrKrOwnerMustMatchObjective } = await getOrgOkrSettings(auth.context.organizationId);

  let ownerPatch: string | null | undefined = undefined;
  if (okrKrOwnerMustMatchObjective) {
    ownerPatch = objectiveRow.owner_membership_id;
  } else {
    ownerPatch = resolveKeyResultOwnerMembershipPatch(
      krRow.owner_membership_id,
      input.ownerMembershipId
    );
    if (typeof ownerPatch === "string") {
      const memOk = await assertMembershipInOrg(
        supabase,
        auth.context.organizationId,
        ownerPatch
      );
      if (!memOk) return { error: "Ungültiger Owner (Membership)." };
    }
  }

  if (
    isExplicitKeyResultOwnerRemoval(krRow.owner_membership_id, ownerPatch) &&
    !krPermissionCodes.has("okr.key_result.update.all")
  ) {
    return { error: "KR-Owner entfernen ist nur mit okr.key_result.update.all erlaubt." };
  }

  const deputyPatch = resolveKeyResultDeputyMembershipPatch(
    krRow.deputy_membership_id,
    input.deputyMembershipId
  );
  if (typeof deputyPatch === "string") {
    const memOk = await assertMembershipInOrg(
      supabase,
      auth.context.organizationId,
      deputyPatch
    );
    if (!memOk) return { error: "Ungültiger Deputy (Membership)." };
  }

  if (
    isExplicitKeyResultDeputyRemoval(krRow.deputy_membership_id, deputyPatch) &&
    !krPermissionCodes.has("okr.key_result.update.all")
  ) {
    const mid = auth.context.membershipId;
    const effOwner = krRow.owner_membership_id ?? objectiveRow.owner_membership_id ?? null;
    const isEffOwner = effOwner === mid;
    const wasKrDeputy = krRow.deputy_membership_id === mid;
    if (!isEffOwner && !wasKrDeputy) {
      return { error: "KR-Deputy entfernen ist nur mit okr.key_result.update.all erlaubt." };
    }
  }

  const updateRow: Record<string, unknown> = {
    title,
    metric_type: input.metricType?.trim() || "boolean",
    due_date: dueDate,
  };
  if (input.status !== undefined) {
    updateRow.status = input.status?.trim() || "draft";
  }
  if (input.startValue !== undefined) updateRow.start_value = input.startValue;
  if (input.targetValue !== undefined) updateRow.target_value = input.targetValue;
  if (input.currentValue !== undefined) updateRow.current_value = input.currentValue;
  if (input.measurementUnit !== undefined) {
    updateRow.measurement_unit = input.measurementUnit?.trim() || null;
  }
  if (okrKrOwnerMustMatchObjective || ownerPatch !== undefined) {
    updateRow.owner_membership_id = ownerPatch ?? objectiveRow.owner_membership_id;
  }
  if (deputyPatch !== undefined) {
    updateRow.deputy_membership_id = deputyPatch;
  }

  const { error } = await supabase
    .schema("app")
    .from("key_results")
    .update(updateRow)
    .eq("id", input.keyResultId)
    .eq("organization_id", auth.context.organizationId);

  if (error) return { error: error.message };
  const shouldRunKrMatching = keyResultMatchingRelevantChanged({
    prev: {
      title: krContext.title,
      metric_type: krContext.metric_type,
      start_value: krContext.start_value,
      target_value: krContext.target_value,
      measurement_unit: krContext.measurement_unit,
    },
    next: {
      title,
      metric_type: input.metricType?.trim() || "boolean",
      start_value: input.startValue ?? krContext.start_value,
      target_value: input.targetValue ?? krContext.target_value,
      measurement_unit:
        input.measurementUnit !== undefined
          ? input.measurementUnit?.trim() || null
          : (krContext.measurement_unit ?? null),
    },
  });
  revalidateOkrPaths();
  if (objOwnRow.cycle_instance_id && shouldRunKrMatching) {
    await scheduleKrInitiativeMatchingIfEnabled({
      supabase,
      organizationId: auth.context.organizationId,
      cycleInstanceId: objOwnRow.cycle_instance_id,
      keyResultId: input.keyResultId,
      membershipId: auth.context.membershipId,
      trigger: "key_result_update",
    });
  }
  return {};
}

export async function deleteKeyResultAction(input: { keyResultId: string }) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const supabase = await createSupabaseServerClient();
  const { data: krRow } = await supabase
    .schema("app")
    .from("key_results")
    .select("id, okr_objective_id, owner_membership_id, deputy_membership_id")
    .eq("id", input.keyResultId)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();
  if (!krRow?.okr_objective_id) return { error: "Key Result nicht gefunden." };

  const { data: objRow } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id, owner_membership_id, deputy_membership_id, status, cycle_instance_id")
    .eq("id", krRow.okr_objective_id)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();
  if (!objRow?.id) return { error: "Objective nicht gefunden." };
  const planningBlock = blockOkrPlanningEdit(objRow.status);
  if (planningBlock) return planningBlock;

  if (!(await canAccessKeyResult({
    currentMembershipId: auth.context.membershipId,
    action: "update",
    keyResult: {
      id: krRow.id,
      owner_membership_id: krRow.owner_membership_id ?? null,
      deputy_membership_id: krRow.deputy_membership_id ?? null,
    },
    objective: {
      id: objRow.id,
      owner_membership_id: objRow.owner_membership_id ?? null,
      deputy_membership_id: objRow.deputy_membership_id ?? null,
    },
  }))) {
    return keyResultWriteDeniedError();
  }

  const { error } = await supabase
    .schema("app")
    .from("key_results")
    .delete()
    .eq("id", input.keyResultId)
    .eq("organization_id", auth.context.organizationId);

  if (error) return { error: error.message };
  revalidateOkrPaths();
  if (objRow.cycle_instance_id) {
    await scheduleOkrContributionAssessmentJob({
      supabase,
      organizationId: auth.context.organizationId,
      cycleInstanceId: objRow.cycle_instance_id,
      okrObjectiveId: krRow.okr_objective_id,
      membershipId: auth.context.membershipId,
      trigger: "key_result_delete",
    });
  }
  return {};
}

function parseKrInitiativeIdsFromForm(formData: FormData, krId: string): string[] {
  const raw = String(formData.get(`kr_${krId}_initiative_ids_json`) ?? "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((x): x is string => typeof x === "string" && x.trim() !== ""))];
  } catch {
    return [];
  }
}

async function replaceKeyResultInitiativeLinks(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  organizationId: string;
  cycleInstanceId: string;
  keyResultId: string;
  okrObjectiveId: string;
  initiativeIds: string[];
  membershipId: string;
}): Promise<{ error?: string }> {
  const wanted = [...new Set(input.initiativeIds.filter(Boolean))];
  if (wanted.length > 0) {
    const { data: inits } = await input.supabase
      .schema("app")
      .from("initiatives")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("cycle_instance_id", input.cycleInstanceId)
      .in("id", wanted);
    const valid = new Set((inits ?? []).map((r: { id: string }) => r.id));
    for (const id of wanted) {
      if (!valid.has(id)) return { error: "Ungültige Initiative für diesen Zyklus." };
    }
  }

  const { error: delErr } = await input.supabase
    .schema("app")
    .from("initiative_key_result_links")
    .delete()
    .eq("organization_id", input.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .eq("key_result_id", input.keyResultId);

  if (delErr) return { error: delErr.message };

  if (wanted.length > 0) {
    const rows = wanted.map((initiative_id) => ({
      organization_id: input.organizationId,
      cycle_instance_id: input.cycleInstanceId,
      initiative_id,
      key_result_id: input.keyResultId,
      created_by_membership_id: input.membershipId,
    }));
    const { error: insErr } = await input.supabase.schema("app").from("initiative_key_result_links").insert(rows);
    if (insErr) return { error: insErr.message };
  }

  return {};
}

export async function setKeyResultInitiativeLinksAction(input: {
  cycleInstanceId: string;
  keyResultId: string;
  initiativeIds: string[];
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const supabase = await createSupabaseServerClient();
  const { data: kr } = await supabase
    .schema("app")
    .from("key_results")
    .select("id, okr_objective_id, owner_membership_id, deputy_membership_id")
    .eq("id", input.keyResultId)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();

  if (!kr) return { error: "Key Result nicht gefunden." };

  const { data: obj } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id, okr_cycle_id, cycle_instance_id, owner_membership_id, deputy_membership_id")
    .eq("id", kr.okr_objective_id)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();

  if (!obj?.okr_cycle_id || obj.cycle_instance_id !== input.cycleInstanceId) {
    return { error: "Key Result gehört nicht zu diesem Zyklus." };
  }

  if (!(await canAccessKeyResult({
    currentMembershipId: auth.context.membershipId,
    action: "update",
    keyResult: {
      id: kr.id,
      owner_membership_id: kr.owner_membership_id ?? null,
      deputy_membership_id: kr.deputy_membership_id ?? null,
    },
    objective: {
      id: obj.id,
      owner_membership_id: obj.owner_membership_id ?? null,
      deputy_membership_id: obj.deputy_membership_id ?? null,
    },
  }))) {
    return keyResultWriteDeniedError();
  }

  const linkRes = await replaceKeyResultInitiativeLinks({
    supabase,
    organizationId: auth.context.organizationId,
    cycleInstanceId: input.cycleInstanceId,
    keyResultId: input.keyResultId,
    okrObjectiveId: kr.okr_objective_id,
    initiativeIds: input.initiativeIds,
    membershipId: auth.context.membershipId,
  });
  if (linkRes.error) return linkRes;

  revalidateOkrPaths();
  await scheduleOkrContributionAssessmentJob({
    supabase,
    organizationId: auth.context.organizationId,
    cycleInstanceId: input.cycleInstanceId,
    okrObjectiveId: kr.okr_objective_id,
    membershipId: auth.context.membershipId,
    trigger: "initiative_links_replace",
  });
  return {};
}

async function assertKeyResultAndInitiativeInCycleForLink(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  organizationId: string;
  cycleInstanceId: string;
  keyResultId: string;
  initiativeId: string;
}): Promise<{ error: string } | { ok: true }> {
  const { supabase, organizationId, cycleInstanceId, keyResultId, initiativeId } = params;

  const { data: kr } = await supabase
    .schema("app")
    .from("key_results")
    .select("id, okr_objective_id")
    .eq("id", keyResultId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!kr) return { error: "Key Result nicht gefunden." };

  const { data: obj } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("okr_cycle_id, cycle_instance_id")
    .eq("id", kr.okr_objective_id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!obj?.okr_cycle_id || obj.cycle_instance_id !== cycleInstanceId) {
    return { error: "Key Result gehört nicht zu diesem Zyklus." };
  }

  const { data: init } = await supabase
    .schema("app")
    .from("initiatives")
    .select("id")
    .eq("id", initiativeId)
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .maybeSingle();

  if (!init) return { error: "Initiative gehört nicht zu diesem Planungszyklus." };

  return { ok: true };
}

export async function linkKeyResultInitiativeAction(input: {
  cycleInstanceId: string;
  keyResultId: string;
  initiativeId: string;
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const { cycleInstanceId, keyResultId, initiativeId } = input;
  if (!cycleInstanceId || !keyResultId || !initiativeId) {
    return { error: "Ungültige Anfrage." };
  }

  const supabase = await createSupabaseServerClient();
  const gate = await assertKeyResultAndInitiativeInCycleForLink({
    supabase,
    organizationId: auth.context.organizationId,
    cycleInstanceId,
    keyResultId,
    initiativeId,
  });
  if ("error" in gate) return gate;

  const { data: krPerm } = await supabase
    .schema("app")
    .from("key_results")
    .select("id, owner_membership_id, deputy_membership_id, okr_objective_id")
    .eq("id", keyResultId)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();
  const { data: objPerm } = krPerm?.okr_objective_id
    ? await supabase
        .schema("app")
        .from("okr_objectives")
        .select("id, owner_membership_id, deputy_membership_id, status")
        .eq("id", krPerm.okr_objective_id)
        .eq("organization_id", auth.context.organizationId)
        .maybeSingle()
    : { data: null };
  if (!krPerm?.id || !objPerm?.id) return { error: "Key Result nicht gefunden." };
  const planningBlockLink = blockOkrPlanningEdit(objPerm.status);
  if (planningBlockLink) return planningBlockLink;

  if (!(await canAccessKeyResult({
    currentMembershipId: auth.context.membershipId,
    action: "update",
    keyResult: {
      id: krPerm.id,
      owner_membership_id: krPerm.owner_membership_id ?? null,
      deputy_membership_id: krPerm.deputy_membership_id ?? null,
    },
    objective: {
      id: objPerm.id,
      owner_membership_id: objPerm.owner_membership_id ?? null,
      deputy_membership_id: objPerm.deputy_membership_id ?? null,
    },
  }))) {
    return keyResultWriteDeniedError();
  }

  const { error } = await supabase.schema("app").from("initiative_key_result_links").insert({
    organization_id: auth.context.organizationId,
    cycle_instance_id: cycleInstanceId,
    initiative_id: initiativeId,
    key_result_id: keyResultId,
    created_by_membership_id: auth.context.membershipId,
  });

  if (error) {
    if (error.code === "23505") {
      revalidateOkrPaths();
      return {};
    }
    return { error: error.message };
  }

  revalidateOkrPaths();
  return {};
}

export async function unlinkKeyResultInitiativeAction(input: {
  cycleInstanceId: string;
  keyResultId: string;
  initiativeId: string;
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const { cycleInstanceId, keyResultId, initiativeId } = input;
  if (!cycleInstanceId || !keyResultId || !initiativeId) {
    return { error: "Ungültige Anfrage." };
  }

  const supabase = await createSupabaseServerClient();
  const gate = await assertKeyResultAndInitiativeInCycleForLink({
    supabase,
    organizationId: auth.context.organizationId,
    cycleInstanceId,
    keyResultId,
    initiativeId,
  });
  if ("error" in gate) return gate;

  const { data: krPerm } = await supabase
    .schema("app")
    .from("key_results")
    .select("id, owner_membership_id, deputy_membership_id, okr_objective_id")
    .eq("id", keyResultId)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();
  const { data: objPerm } = krPerm?.okr_objective_id
    ? await supabase
        .schema("app")
        .from("okr_objectives")
        .select("id, owner_membership_id, deputy_membership_id, status")
        .eq("id", krPerm.okr_objective_id)
        .eq("organization_id", auth.context.organizationId)
        .maybeSingle()
    : { data: null };
  if (!krPerm?.id || !objPerm?.id) return { error: "Key Result nicht gefunden." };
  const planningBlockUnlink = blockOkrPlanningEdit(objPerm.status);
  if (planningBlockUnlink) return planningBlockUnlink;

  if (!(await canAccessKeyResult({
    currentMembershipId: auth.context.membershipId,
    action: "update",
    keyResult: {
      id: krPerm.id,
      owner_membership_id: krPerm.owner_membership_id ?? null,
      deputy_membership_id: krPerm.deputy_membership_id ?? null,
    },
    objective: {
      id: objPerm.id,
      owner_membership_id: objPerm.owner_membership_id ?? null,
      deputy_membership_id: objPerm.deputy_membership_id ?? null,
    },
  }))) {
    return keyResultWriteDeniedError();
  }

  const { error } = await supabase
    .schema("app")
    .from("initiative_key_result_links")
    .delete()
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .eq("key_result_id", keyResultId)
    .eq("initiative_id", initiativeId);

  if (error) return { error: error.message };
  revalidateOkrPaths();
  return {};
}

async function loadKrSuggestionPermissionContext(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  organizationId: string;
  cycleInstanceId: string;
  keyResultId: string;
}) {
  const { supabase, organizationId, cycleInstanceId, keyResultId } = params;
  const { data: kr } = await supabase
    .schema("app")
    .from("key_results")
    .select("id, okr_objective_id, owner_membership_id, deputy_membership_id")
    .eq("id", keyResultId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!kr?.id || !kr.okr_objective_id) return { error: "Key Result nicht gefunden." as const };
  const { data: obj } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id, owner_membership_id, deputy_membership_id, status, cycle_instance_id")
    .eq("id", kr.okr_objective_id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!obj?.id || obj.cycle_instance_id !== cycleInstanceId) {
    return { error: "Key Result gehört nicht zu diesem Zyklus." as const };
  }
  const planningBlock = blockOkrPlanningEdit(obj.status);
  if (planningBlock) return { error: planningBlock.error as string };
  return { kr, obj };
}

export async function acceptKrInitiativeSuggestionAction(input: {
  cycleInstanceId: string;
  keyResultId: string;
  initiativeId: string;
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;
  const supabase = await createSupabaseServerClient();
  const loaded = await loadKrSuggestionPermissionContext({
    supabase,
    organizationId: auth.context.organizationId,
    cycleInstanceId: input.cycleInstanceId,
    keyResultId: input.keyResultId,
  });
  if ("error" in loaded) return loaded;
  if (
    !(await canAccessKeyResult({
      currentMembershipId: auth.context.membershipId,
      action: "update",
      keyResult: {
        id: loaded.kr.id,
        owner_membership_id: loaded.kr.owner_membership_id ?? null,
        deputy_membership_id: loaded.kr.deputy_membership_id ?? null,
      },
      objective: {
        id: loaded.obj.id,
        owner_membership_id: loaded.obj.owner_membership_id ?? null,
        deputy_membership_id: loaded.obj.deputy_membership_id ?? null,
      },
    }))
  ) {
    return keyResultWriteDeniedError();
  }
  const { data: link } = await supabase
    .schema("app")
    .from("initiative_key_result_links")
    .select("id, llm_level")
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .eq("key_result_id", input.keyResultId)
    .eq("initiative_id", input.initiativeId)
    .maybeSingle();
  if (!link?.id || !link.llm_level) {
    return { error: "Kein LLM-Vorschlag zum Übernehmen." };
  }
  const { error } = await supabase
    .schema("app")
    .from("initiative_key_result_links")
    .update({
      confirmed_level: link.llm_level,
      confirmation_status: "accepted",
    })
    .eq("id", link.id);
  if (error) return { error: error.message };
  revalidateOkrPaths();
  return {};
}

export async function rejectKrInitiativeSuggestionAction(input: {
  cycleInstanceId: string;
  keyResultId: string;
  initiativeId: string;
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;
  const supabase = await createSupabaseServerClient();
  const loaded = await loadKrSuggestionPermissionContext({
    supabase,
    organizationId: auth.context.organizationId,
    cycleInstanceId: input.cycleInstanceId,
    keyResultId: input.keyResultId,
  });
  if ("error" in loaded) return loaded;
  if (
    !(await canAccessKeyResult({
      currentMembershipId: auth.context.membershipId,
      action: "update",
      keyResult: {
        id: loaded.kr.id,
        owner_membership_id: loaded.kr.owner_membership_id ?? null,
        deputy_membership_id: loaded.kr.deputy_membership_id ?? null,
      },
      objective: {
        id: loaded.obj.id,
        owner_membership_id: loaded.obj.owner_membership_id ?? null,
        deputy_membership_id: loaded.obj.deputy_membership_id ?? null,
      },
    }))
  ) {
    return keyResultWriteDeniedError();
  }
  const { data: link } = await supabase
    .schema("app")
    .from("initiative_key_result_links")
    .select("id")
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .eq("key_result_id", input.keyResultId)
    .eq("initiative_id", input.initiativeId)
    .maybeSingle();
  if (!link?.id) return { error: "Kein Vorschlag gefunden." };
  const { error } = await supabase
    .schema("app")
    .from("initiative_key_result_links")
    .update({
      confirmation_status: "rejected",
      confirmed_level: null,
    })
    .eq("id", link.id);
  if (error) return { error: error.message };
  revalidateOkrPaths();
  return {};
}

export async function overrideKrInitiativeLevelAction(input: {
  cycleInstanceId: string;
  keyResultId: string;
  initiativeId: string;
  level: "low" | "medium" | "high";
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;
  const supabase = await createSupabaseServerClient();
  const loaded = await loadKrSuggestionPermissionContext({
    supabase,
    organizationId: auth.context.organizationId,
    cycleInstanceId: input.cycleInstanceId,
    keyResultId: input.keyResultId,
  });
  if ("error" in loaded) return loaded;
  if (
    !(await canAccessKeyResult({
      currentMembershipId: auth.context.membershipId,
      action: "update",
      keyResult: {
        id: loaded.kr.id,
        owner_membership_id: loaded.kr.owner_membership_id ?? null,
        deputy_membership_id: loaded.kr.deputy_membership_id ?? null,
      },
      objective: {
        id: loaded.obj.id,
        owner_membership_id: loaded.obj.owner_membership_id ?? null,
        deputy_membership_id: loaded.obj.deputy_membership_id ?? null,
      },
    }))
  ) {
    return keyResultWriteDeniedError();
  }
  const { data: link } = await supabase
    .schema("app")
    .from("initiative_key_result_links")
    .select("id")
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .eq("key_result_id", input.keyResultId)
    .eq("initiative_id", input.initiativeId)
    .maybeSingle();
  if (!link?.id) {
    const gate = await assertKeyResultAndInitiativeInCycleForLink({
      supabase,
      organizationId: auth.context.organizationId,
      cycleInstanceId: input.cycleInstanceId,
      keyResultId: input.keyResultId,
      initiativeId: input.initiativeId,
    });
    if ("error" in gate) return gate;
    const { error: insErr } = await supabase.schema("app").from("initiative_key_result_links").insert({
      organization_id: auth.context.organizationId,
      cycle_instance_id: input.cycleInstanceId,
      key_result_id: input.keyResultId,
      initiative_id: input.initiativeId,
      created_by_membership_id: auth.context.membershipId,
      confirmed_level: input.level,
      confirmation_status: "manual",
    });
    if (insErr) return { error: insErr.message };
    revalidateOkrPaths();
    return {};
  }
  const { error } = await supabase
    .schema("app")
    .from("initiative_key_result_links")
    .update({
      confirmed_level: input.level,
      confirmation_status: "manual",
    })
    .eq("id", link.id);
  if (error) return { error: error.message };
  revalidateOkrPaths();
  return {};
}

function formDataOptionalNumber(entry: FormDataEntryValue | null): number | null {
  if (entry == null || entry === "") return null;
  const n = Number(entry);
  return Number.isFinite(n) ? n : null;
}

async function applyOkrObjectiveUnifiedManualContributionLevel(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  organizationId: string;
  membershipId: string;
  cycleInstanceId: string;
  okrObjectiveId: string;
  level: OkrContributionTier | null;
}): Promise<{ error?: string }> {
  const { supabase, organizationId, membershipId, cycleInstanceId, okrObjectiveId, level } = input;

  const { data: obj } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id, organization_id, status, owner_membership_id, deputy_membership_id")
    .eq("id", okrObjectiveId)
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .maybeSingle();

  if (!obj?.id) return { error: "Objective nicht gefunden." };
  const planningBlock = blockOkrPlanningEdit(obj.status);
  if (planningBlock) return planningBlock;

  if (
    !(await canAccessObjective({
      currentMembershipId: membershipId,
      action: "update",
      objective: {
        id: obj.id,
        owner_membership_id: obj.owner_membership_id ?? null,
        deputy_membership_id: obj.deputy_membership_id ?? null,
      },
    }))
  ) {
    return objectiveWriteDeniedError();
  }

  const directionTarget = await fetchOkrContributionDirectionTargetForObjective(
    supabase,
    organizationId,
    cycleInstanceId,
    okrObjectiveId
  );
  if (!directionTarget) {
    return { error: "Stoßrichtung fehlt — manuelle Einstufung nicht möglich." };
  }

  const targets = [directionTarget];

  for (const t of targets) {
    const { data: existing } = await supabase
      .schema("app")
      .from("okr_contribution_edges")
      .select("id")
      .eq("okr_objective_id", okrObjectiveId)
      .eq("target_type", t.targetType)
      .eq("target_id", t.targetId)
      .maybeSingle();

    if (level === null) {
      if (existing?.id) {
        const { error } = await supabase
          .schema("app")
          .from("okr_contribution_edges")
          .update({
            confirmed_level: null,
            value_source: "none",
          })
          .eq("id", existing.id);
        if (error) return { error: error.message };
      }
    } else if (existing?.id) {
      const { error } = await supabase
        .schema("app")
        .from("okr_contribution_edges")
        .update({
          confirmed_level: level,
          value_source: "manual",
          llm_suggestion_dismissed: false,
        })
        .eq("id", existing.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.schema("app").from("okr_contribution_edges").insert({
        organization_id: obj.organization_id,
        cycle_instance_id: cycleInstanceId,
        okr_objective_id: okrObjectiveId,
        target_type: t.targetType,
        target_id: t.targetId,
        confirmed_level: level,
        value_source: "manual",
        llm_suggestion_dismissed: false,
      });
      if (error) return { error: error.message };
    }
  }

  revalidateOkrPaths();
  return {};
}

async function runOkrPlanningPanelContributionFollowUp(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  organizationId: string;
  membershipId: string;
  cycleInstanceId: string;
  objectiveId: string;
  canEditObjectiveFields: boolean;
  formData: FormData;
}): Promise<{ error?: string }> {
  const { data: brandingRow } = await input.supabase
    .schema("app")
    .from("tenant_branding")
    .select("branding_config")
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  const policy = readAnalysisNetworkLlmPolicy(brandingRow?.branding_config ?? null);
  const contribLlmOn = isLlmFeatureEnabled(policy, "okr_contribution_assessment");

  if (input.canEditObjectiveFields && !contribLlmOn) {
    if (input.formData.has("objective_contribution_level")) {
      const raw = String(input.formData.get("objective_contribution_level") ?? "").trim();
      if (raw !== "") {
        let level: OkrContributionTier | null;
        if (raw === "clear") {
          level = null;
        } else if (
          raw === "low" ||
          raw === "medium" ||
          raw === "high" ||
          raw === "insufficient"
        ) {
          level = raw;
        } else {
          return { error: "Ungültige Einstufung." };
        }
        const r = await applyOkrObjectiveUnifiedManualContributionLevel({
          supabase: input.supabase,
          organizationId: input.organizationId,
          membershipId: input.membershipId,
          cycleInstanceId: input.cycleInstanceId,
          okrObjectiveId: input.objectiveId,
          level,
        });
        if (r.error) return r;
      }
    }
  }

  const runContributionAssessment =
    String(input.formData.get("run_contribution_assessment") ?? "").trim() === "1";

  if (contribLlmOn && runContributionAssessment) {
    await scheduleOkrContributionAssessmentJob({
      supabase: input.supabase,
      organizationId: input.organizationId,
      cycleInstanceId: input.cycleInstanceId,
      okrObjectiveId: input.objectiveId,
      membershipId: input.membershipId,
      trigger: "okr_planning_panel_save",
    });
  }

  return {};
}

/**
 * Ein Speichern für Objective + alle Key Results inkl. Initiative-Links (OKR-Planung).
 */
export async function saveOkrPlanningPanelAction(formData: FormData) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const cycleInstanceId = String(formData.get("cycle_instance_id") ?? "").trim();
  const objectiveId = String(formData.get("objective_id") ?? "").trim();
  const krIdsRaw = String(formData.get("kr_ids_json") ?? "").trim();
  if (!cycleInstanceId || !objectiveId) {
    return { error: "Ungültige Anfrage (Zyklus oder Objective fehlt)." };
  }

  let krIds: string[] = [];
  try {
    krIds = krIdsRaw ? (JSON.parse(krIdsRaw) as string[]) : [];
  } catch {
    return { error: "Ungültige Key-Result-Liste." };
  }
  if (!Array.isArray(krIds)) return { error: "Ungültige Key-Result-Liste." };

  const supabase = await createSupabaseServerClient();
  const { data: existingObjective } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id, owner_membership_id, deputy_membership_id, status")
    .eq("id", objectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .maybeSingle();

  if (!existingObjective?.id) {
    return { error: "OKR-Objective nicht gefunden." };
  }

  const planningBlock = blockOkrPlanningEdit(existingObjective.status);
  if (planningBlock) return planningBlock;

  const objectiveForAccess = {
    id: existingObjective.id,
    owner_membership_id: existingObjective.owner_membership_id ?? null,
    deputy_membership_id: existingObjective.deputy_membership_id ?? null,
  };

  const canEditObj = await canAccessObjective({
    currentMembershipId: auth.context.membershipId,
    action: "update",
    objective: objectiveForAccess,
  });

  const ownerRaw = String(formData.get("owner_membership_id") ?? "").trim();
  const deputyRaw = String(formData.get("deputy_membership_id") ?? "").trim();

  if (canEditObj) {
    const strategicDirectionId = String(formData.get("strategic_direction_id") ?? "").trim();
    if (!strategicDirectionId) {
      return { error: "Stoßrichtung fehlt." };
    }
    const objRes = await updateOkrObjectiveAction({
      cycleInstanceId,
      objectiveId,
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      strategicDirectionId,
      ownerMembershipId: ownerRaw,
      deputyMembershipId: deputyRaw || null,
    });
    if ("error" in objRes && objRes.error) return objRes;
  }

  const { data: objectiveAfter } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id, owner_membership_id, deputy_membership_id")
    .eq("id", objectiveId)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();
  const resolvedObjectiveOwner = objectiveAfter?.owner_membership_id ?? null;

  const settings = await getOrgOkrSettings(auth.context.organizationId);

  if (krIds.length === 0) {
    const fin = await runOkrPlanningPanelContributionFollowUp({
      supabase,
      organizationId: auth.context.organizationId,
      membershipId: auth.context.membershipId,
      cycleInstanceId,
      objectiveId,
      canEditObjectiveFields: canEditObj,
      formData,
    });
    if (fin.error) return { error: fin.error };
    return {};
  }

  const { data: krRows } = await supabase
    .schema("app")
    .from("key_results")
    .select("id, okr_objective_id, owner_membership_id, deputy_membership_id")
    .eq("organization_id", auth.context.organizationId)
    .in("id", krIds);

  const parentObjectiveRow = {
    id: objectiveAfter?.id ?? existingObjective.id,
    owner_membership_id: objectiveAfter?.owner_membership_id ?? null,
    deputy_membership_id: objectiveAfter?.deputy_membership_id ?? null,
  };

  for (const krId of krIds) {
    const row = (krRows ?? []).find((r) => r.id === krId);
    if (!row || row.okr_objective_id !== objectiveId) {
      return { error: "Ungültiges Key Result für dieses Objective." };
    }

    if (
      !(await canAccessKeyResult({
        currentMembershipId: auth.context.membershipId,
        action: "update",
        keyResult: {
          id: row.id,
          owner_membership_id: row.owner_membership_id ?? null,
          deputy_membership_id: row.deputy_membership_id ?? null,
        },
        objective: parentObjectiveRow,
      }))
    ) {
      return keyResultWriteDeniedError();
    }

    const krTitle = String(formData.get(`kr_${krId}_title`) ?? "").trim();
    if (!krTitle) {
      return { error: "Jedes Key Result braucht einen Titel." };
    }

    let ownerForKr: string | null | undefined = undefined;
    if (settings.okrKrOwnerMustMatchObjective) {
      ownerForKr = resolvedObjectiveOwner;
    } else if (formData.has(`kr_${krId}_owner_membership_id`)) {
      const krOwnerRaw = String(formData.get(`kr_${krId}_owner_membership_id`) ?? "").trim();
      ownerForKr = resolveKeyResultOwnerMembershipPatch(
        row.owner_membership_id ?? null,
        krOwnerRaw || null
      );
    }

    const krDeputyFieldPresent = formData.has(`kr_${krId}_deputy_membership_id`);
    const krDeputyRaw = krDeputyFieldPresent
      ? String(formData.get(`kr_${krId}_deputy_membership_id`) ?? "").trim()
      : undefined;
    const deputyForKr = resolveKeyResultDeputyMembershipPatch(
      row.deputy_membership_id ?? null,
      krDeputyFieldPresent ? krDeputyRaw || null : undefined
    );

    const krRes = await updateKeyResultAction({
      keyResultId: krId,
      title: String(formData.get(`kr_${krId}_title`) ?? ""),
      metricType: String(formData.get(`kr_${krId}_metric_type`) ?? "boolean"),
      startValue: formDataOptionalNumber(formData.get(`kr_${krId}_start_value`)),
      targetValue: formDataOptionalNumber(formData.get(`kr_${krId}_target_value`)),
      measurementUnit: String(formData.get(`kr_${krId}_measurement_unit`) ?? "") || null,
      ownerMembershipId: ownerForKr,
      deputyMembershipId: deputyForKr,
    });
    if ("error" in krRes && krRes.error) return krRes;

    if (formData.has(`kr_${krId}_initiative_ids_json`)) {
      const linkRes = await replaceKeyResultInitiativeLinks({
        supabase,
        organizationId: auth.context.organizationId,
        cycleInstanceId,
        keyResultId: krId,
        okrObjectiveId: objectiveId,
        initiativeIds: parseKrInitiativeIdsFromForm(formData, krId),
        membershipId: auth.context.membershipId,
      });
      if (linkRes.error) return { error: linkRes.error };
    }
  }

  const fin = await runOkrPlanningPanelContributionFollowUp({
    supabase,
    organizationId: auth.context.organizationId,
    membershipId: auth.context.membershipId,
    cycleInstanceId,
    objectiveId,
    canEditObjectiveFields: canEditObj,
    formData,
  });
  if (fin.error) return { error: fin.error };
  return {};
}

/**
 * Check-in: `progress_value` ist subjektiver Fortschritt in % (0–100), unabhängig von KR-Metrik.
 * `key_results.current_value` wird nicht angepasst.
 */
export async function createOkrCheckInAction(input: {
  cycleInstanceId: string;
  keyResultId: string;
  okrCycleId: string;
  /** Subjektiver Fortschritt 0–100 (Pflicht) */
  progressValue: number | null;
  /** Subjektive Zuversicht 1–10 (Pflicht) */
  confidenceLevel: number;
  /** Kurzkommentar (Pflicht) */
  comment?: string | null;
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const commentTrimmed = (input.comment ?? "").trim();
  if (!commentTrimmed) {
    return { error: "Kommentar ist Pflicht." };
  }
  if (input.progressValue == null || !Number.isFinite(Number(input.progressValue))) {
    return { error: "Fortschritt (0–100 %) ist Pflicht." };
  }
  const progressClamped = Math.min(100, Math.max(0, Number(input.progressValue)));

  const supabase = await createSupabaseServerClient();
  const ok = await assertOkrCycle(
    supabase,
    auth.context.organizationId,
    input.cycleInstanceId,
    input.okrCycleId
  );
  if (!ok) return { error: "Ungültiger OKR-Zeitraum." };

  const { data: kr } = await supabase
    .schema("app")
    .from("key_results")
    .select("id, okr_objective_id, owner_membership_id, deputy_membership_id")
    .eq("id", input.keyResultId)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();

  if (!kr) return { error: "Key Result nicht gefunden." };

  const { data: obj } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id, okr_cycle_id, cycle_instance_id, owner_membership_id, deputy_membership_id, status")
    .eq("id", kr.okr_objective_id)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();

  if (!obj?.okr_cycle_id || obj.okr_cycle_id !== input.okrCycleId || obj.cycle_instance_id !== input.cycleInstanceId) {
    return { error: "Key Result passt nicht zu OKR-Zyklus oder Instanz." };
  }

  if (obj.status === "shifted") {
    return { error: "Check-in nicht möglich: Objective ist als verschoben markiert." };
  }

  if (!okrObjectiveAllowsCheckIn(obj.status)) {
    return { error: okrCheckInBlockedMessageDe(obj.status) };
  }

  if (!(await canAccessKeyResult({
    currentMembershipId: auth.context.membershipId,
    action: "update",
    keyResult: {
      id: kr.id,
      owner_membership_id: kr.owner_membership_id ?? null,
      deputy_membership_id: kr.deputy_membership_id ?? null,
    },
    objective: {
      id: obj.id,
      owner_membership_id: obj.owner_membership_id ?? null,
      deputy_membership_id: obj.deputy_membership_id ?? null,
    },
  }))) {
    return keyResultWriteDeniedError();
  }

  const conf = Math.min(10, Math.max(1, Math.round(input.confidenceLevel)));
  const isHundred = progressClamped >= 100;

  if (!isHundred) {
    await supabase.schema("app").rpc("completion_review_cancel_open_for_key_result", {
      p_organization_id: auth.context.organizationId,
      p_key_result_id: input.keyResultId,
      p_cancel_reason: "superseded_by_new_checkin",
    });
  }

  const { data: insertedUpdate, error: insErr } = await supabase
    .schema("app")
    .from("okr_updates")
    .insert({
      organization_id: auth.context.organizationId,
      cycle_instance_id: input.cycleInstanceId,
      okr_cycle_id: input.okrCycleId,
      key_result_id: input.keyResultId,
      progress_value: progressClamped,
      confidence_level: conf,
      comment: commentTrimmed,
      created_by_membership_id: auth.context.membershipId,
      verification_status: isHundred ? "pending" : null,
    })
    .select("id")
    .single();

  if (insErr) return { error: insErr.message };

  if (isHundred) {
    let assigneeResolution;
    try {
      assigneeResolution = await resolveApprovalAssignee(
        auth.context.organizationId,
        auth.context.membershipId
      );
    } catch {
      await supabase
        .schema("app")
        .from("okr_updates")
        .update({ verification_status: "superseded" })
        .eq("id", insertedUpdate.id);
      return {
        error:
          "Kein Vorgesetzter für die 100-%-Bestätigung ermittelbar. Bitte Hierarchie unter Verantwortliche pflegen.",
      };
    }

    const { data: krTitleRow } = await supabase
      .schema("app")
      .from("key_results")
      .select("title")
      .eq("id", input.keyResultId)
      .maybeSingle();
    const krTitle = (krTitleRow?.title as string | undefined)?.trim() || "Key Result";

    const { error: submitErr } = await supabase.schema("app").rpc("completion_review_submit", {
      p_okr_update_id: insertedUpdate.id,
      p_key_result_id: input.keyResultId,
      p_assigned_membership_id: assigneeResolution.assigneeMembershipId,
      p_routing_mode: assigneeResolution.routingMode,
      p_routing_reason: assigneeResolution.routingReason,
      p_title: `Abschluss bestätigen: ${krTitle}`,
      p_description: commentTrimmed,
    });

    if (submitErr) {
      await supabase
        .schema("app")
        .from("okr_updates")
        .update({ verification_status: "superseded" })
        .eq("id", insertedUpdate.id);
      return {
        error: submitErr.message.includes("completion-")
          ? "Bestätigungs-Task konnte nicht erstellt werden."
          : submitErr.message,
      };
    }
  }

  revalidateOkrPaths();
  revalidatePath("/my-tasks");
  return {};
}

export async function shiftOkrObjectiveToNextCycleAction(input: {
  cycleInstanceId: string;
  objectiveId: string;
  fromOkrCycleId: string;
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const fromId = input.fromOkrCycleId.trim();
  if (!fromId) return { error: "OKR-Zeitraum fehlt." };

  const supabase = await createSupabaseServerClient();

  const fromOk = await assertOkrCycle(
    supabase,
    auth.context.organizationId,
    input.cycleInstanceId,
    fromId
  );
  if (!fromOk) return { error: "Ungültiger OKR-Zeitraum." };

  const cycles = await getOkrCycles(auth.context.organizationId, input.cycleInstanceId);
  const toId = resolveNextOkrCycleId(
    cycles.map((c) => ({ id: c.id, start_date: c.start_date })),
    fromId
  );
  if (!toId) return { error: "Es gibt keinen nächsten OKR-Zeitraum im aktuellen Scope." };

  const { data: obj } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id, owner_membership_id, deputy_membership_id, status, okr_cycle_id")
    .eq("id", input.objectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .maybeSingle();

  if (!obj?.okr_cycle_id || obj.okr_cycle_id !== fromId) {
    return { error: "OKR-Objective passt nicht zum gewählten Zeitraum." };
  }

  if (obj.status === "shifted") {
    return { error: "Objective wurde bereits verschoben." };
  }

  if (
    !(await canAccessObjective({
      currentMembershipId: auth.context.membershipId,
      action: "update",
      objective: {
        id: obj.id,
        owner_membership_id: obj.owner_membership_id ?? null,
        deputy_membership_id: obj.deputy_membership_id ?? null,
      },
    }))
  ) {
    return objectiveWriteDeniedError();
  }

  const { data: rpcRaw, error: rpcErr } = await supabase.schema("app").rpc("okr_shift_objective_to_next_cycle", {
    p_organization_id: auth.context.organizationId,
    p_cycle_instance_id: input.cycleInstanceId,
    p_objective_id: input.objectiveId,
    p_from_okr_cycle_id: fromId,
    p_to_okr_cycle_id: toId,
  });

  if (rpcErr) return { error: rpcErr.message };

  const payload = rpcRaw as { error?: string; new_objective_id?: string; new_okr_cycle_id?: string };
  if (payload && typeof payload === "object" && "error" in payload && payload.error) {
    return { error: String(payload.error) };
  }

  revalidateOkrPaths();
  return {
    newObjectiveId: payload.new_objective_id as string,
    newOkrCycleId: payload.new_okr_cycle_id as string,
  };
}

export type OkrReviewSessionType = "mid_cycle" | "end_of_cycle";
export type OkrReviewSessionStatus =
  | "draft"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

async function assertOkrReviewSessionEditAllowed(
  membershipId: string,
  session: { facilitator_membership_id: string | null }
): Promise<boolean> {
  const codes = await getPermissionCodesForMembership(membershipId);
  if (codes.has("okr.review.session.manage")) return true;
  if (session.facilitator_membership_id != null && session.facilitator_membership_id === membershipId) {
    return true;
  }
  return false;
}

export async function createOkrReviewSessionAction(input: {
  cycleInstanceId: string;
  okrCycleId: string;
  title: string;
  sessionType: OkrReviewSessionType;
  scheduledAtIso: string;
  facilitatorMembershipId: string;
}) {
  const pageAccess = await getSidebarAccessContext("okr-workspace");
  if (pageAccess.state !== "ok") {
    return { error: "Kein Zugriff auf den OKR-Arbeitsbereich." as const };
  }
  const context = await getPhase0Context();
  if (!context) return { error: "Nicht authentifiziert." as const };

  const codes = await getPermissionCodesForMembership(context.membershipId);
  if (!codes.has("okr.review.session.manage")) {
    return { error: "Keine Berechtigung: Review-Sessions anlegen." as const };
  }

  const supabase = await createSupabaseServerClient();
  const ok = await assertOkrCycle(
    supabase,
    context.organizationId,
    input.cycleInstanceId,
    input.okrCycleId
  );
  if (!ok) return { error: "Ungültiger OKR-Zeitraum." as const };

  const title = input.title.trim();
  if (!title) {
    return { error: "Titel ist erforderlich." as const };
  }

  const scheduledRaw = input.scheduledAtIso.trim();
  if (!scheduledRaw) {
    return { error: "Termin ist erforderlich." as const };
  }
  const scheduledParsed = new Date(scheduledRaw);
  if (Number.isNaN(scheduledParsed.getTime())) {
    return { error: "Ungültiger Termin." as const };
  }
  const scheduledAt = scheduledParsed.toISOString();

  const rawFacilitator = input.facilitatorMembershipId.trim();
  if (!rawFacilitator) {
    return { error: "Facilitator ist erforderlich." as const };
  }
  const memOkFac = await assertMembershipInOrg(supabase, context.organizationId, rawFacilitator);
  if (!memOkFac) {
    return { error: "Facilitator nicht in dieser Organisation." as const };
  }
  if (rawFacilitator !== context.membershipId && !codes.has("okr.review.facilitator.assign")) {
    return {
      error:
        "Einen anderen Facilitator zu wählen erfordert die Berechtigung okr.review.facilitator.assign." as const,
    };
  }
  const facilitator = rawFacilitator;

  const { data, error } = await supabase
    .schema("app")
    .from("okr_review_sessions")
    .insert({
      organization_id: context.organizationId,
      cycle_instance_id: input.cycleInstanceId,
      okr_cycle_id: input.okrCycleId,
      title,
      session_type: input.sessionType,
      status: "draft",
      scheduled_at: scheduledAt,
      facilitator_membership_id: facilitator,
      created_by_membership_id: context.membershipId,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidateOkrPaths();
  return { sessionId: data!.id as string };
}

export async function updateOkrReviewSessionAction(input: {
  sessionId: string;
  title?: string;
  sessionType?: OkrReviewSessionType;
  status?: OkrReviewSessionStatus;
  scheduledAtIso?: string | null;
  facilitatorMembershipId?: string | null;
  summary?: string;
  meetingNotes?: string;
  discussionNotes?: string;
  decisionsNextSteps?: string;
}) {
  const pageAccess = await getSidebarAccessContext("okr-workspace");
  if (pageAccess.state !== "ok") {
    return { error: "Kein Zugriff auf den OKR-Arbeitsbereich." as const };
  }
  const context = await getPhase0Context();
  if (!context) return { error: "Nicht authentifiziert." as const };

  const supabase = await createSupabaseServerClient();
  const sessionRowSelectFull =
    "id, organization_id, cycle_instance_id, okr_cycle_id, facilitator_membership_id, status, check_in_tracking_baseline_at, started_at";
  const sessionRowSelectLegacy =
    "id, organization_id, cycle_instance_id, okr_cycle_id, facilitator_membership_id, status";

  let rowLoad = await supabase
    .schema("app")
    .from("okr_review_sessions")
    .select(sessionRowSelectFull)
    .eq("id", input.sessionId)
    .maybeSingle();

  if (
    rowLoad.error &&
    isMissingReviewSessionMigrationColumns(String(rowLoad.error.message ?? ""))
  ) {
    rowLoad = await supabase
      .schema("app")
      .from("okr_review_sessions")
      .select(sessionRowSelectLegacy)
      .eq("id", input.sessionId)
      .maybeSingle();
  }

  const { data: row, error: loadErr } = rowLoad;

  if (loadErr) return { error: loadErr.message };
  if (!row || row.organization_id !== context.organizationId) {
    return { error: "Review-Session nicht gefunden." as const };
  }

  const codes = await getPermissionCodesForMembership(context.membershipId);
  const hasAssign = codes.has("okr.review.facilitator.assign");

  const facilitatorTouched = input.facilitatorMembershipId !== undefined;
  const otherTouched =
    input.title !== undefined ||
    input.sessionType !== undefined ||
    input.status !== undefined ||
    input.scheduledAtIso !== undefined ||
    input.summary !== undefined ||
    input.meetingNotes !== undefined ||
    input.discussionNotes !== undefined ||
    input.decisionsNextSteps !== undefined;

  const assignOnly = facilitatorTouched && !otherTouched;

  if (assignOnly) {
    if (!hasAssign) {
      return {
        error: "Keine Berechtigung: Facilitator zuweisen (okr.review.facilitator.assign)." as const,
      };
    }
  } else {
    const allowed = await assertOkrReviewSessionEditAllowed(context.membershipId, {
      facilitator_membership_id: (row.facilitator_membership_id as string | null),
    });
    if (!allowed) return { error: "Keine Berechtigung: diese Session bearbeiten." as const };
  }

  const prevStatus = String(row.status);
  const patch: Record<string, unknown> = {};
  if (!assignOnly) {
    if (input.title !== undefined) patch.title = input.title.trim();
    if (input.sessionType !== undefined) patch.session_type = input.sessionType;
    if (input.status !== undefined) {
      patch.status = input.status;
      if (input.status === "scheduled" && prevStatus !== "scheduled") {
        patch.check_in_tracking_baseline_at = new Date().toISOString();
      }
      if (input.status === "in_progress" && prevStatus !== "in_progress") {
        patch.started_at = new Date().toISOString();
      }
    }
    if (input.scheduledAtIso !== undefined) {
      patch.scheduled_at = input.scheduledAtIso?.trim() || null;
    }
    if (input.summary !== undefined) patch.summary = input.summary;
    if (input.meetingNotes !== undefined) patch.meeting_notes = input.meetingNotes;
    if (input.discussionNotes !== undefined) patch.discussion_notes = input.discussionNotes;
    if (input.decisionsNextSteps !== undefined) patch.decisions_next_steps = input.decisionsNextSteps;
  }

  if (input.facilitatorMembershipId !== undefined) {
    if (!hasAssign) {
      return { error: "Facilitator zuweisen erfordert okr.review.facilitator.assign." as const };
    }
    let facilitator = input.facilitatorMembershipId?.trim() || null;
    if (facilitator) {
      const memOk = await assertMembershipInOrg(supabase, context.organizationId, facilitator);
      if (!memOk) return { error: "Facilitator nicht in dieser Organisation." as const };
    }
    patch.facilitator_membership_id = facilitator;
  }

  if (Object.keys(patch).length === 0) {
    return {};
  }

  let { error: updErr } = await supabase
    .schema("app")
    .from("okr_review_sessions")
    .update(patch)
    .eq("id", input.sessionId);

  if (
    updErr &&
    isMissingReviewSessionMigrationColumns(String(updErr.message ?? "")) &&
    ("check_in_tracking_baseline_at" in patch || "started_at" in patch)
  ) {
    const retryPatch = { ...patch };
    delete retryPatch.check_in_tracking_baseline_at;
    delete retryPatch.started_at;
    if (Object.keys(retryPatch).length > 0) {
      const second = await supabase
        .schema("app")
        .from("okr_review_sessions")
        .update(retryPatch)
        .eq("id", input.sessionId);
      updErr = second.error;
    } else {
      updErr = null;
    }
  }

  if (updErr) return { error: updErr.message };

  const newStatus = input.status !== undefined ? input.status : prevStatus;
  if (newStatus === "scheduled" && prevStatus !== "scheduled") {
    const orgSettings = await getOrgOkrSettings(context.organizationId);
    if (orgSettings.okrReviewNotifyOwnersOnSchedule) {
      await planOkrReviewOwnerNotifications({
        sessionId: input.sessionId,
        organizationId: context.organizationId,
        cycleInstanceId: row.cycle_instance_id as string,
        okrCycleId: row.okr_cycle_id as string,
      });
    }
  }

  revalidateOkrPaths();
  return {};
}

function parseReviewTaskDueAtIso(
  raw: string | undefined,
  emptyMessage: string
): { ok: true; iso: string } | { ok: false; error: string } {
  const t = raw?.trim() ?? "";
  if (!t) return { ok: false, error: emptyMessage };
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) return { ok: false, error: "Ungültiger Termin." as const };
  return { ok: true, iso: new Date(ms).toISOString() };
}

export async function createOkrReviewSessionTaskAction(input: {
  sessionId: string;
  title: string;
  assigneeMembershipId: string;
  /** ISO-String (z. B. aus datetime-local via `Date`/`toISOString`). */
  dueAtIso: string;
}) {
  const pageAccess = await getSidebarAccessContext("okr-workspace");
  if (pageAccess.state !== "ok") {
    return { error: "Kein Zugriff auf den OKR-Arbeitsbereich." as const };
  }
  const context = await getPhase0Context();
  if (!context) return { error: "Nicht authentifiziert." as const };

  const title = input.title.trim();
  if (!title) return { error: "Titel ist erforderlich." as const };
  const assigneeRaw = input.assigneeMembershipId.trim();
  if (!assigneeRaw) return { error: "Verantwortliche Person ist erforderlich." as const };
  const dueParse = parseReviewTaskDueAtIso(input.dueAtIso, "Termin ist erforderlich.");
  if (!dueParse.ok) return { error: dueParse.error };

  const supabase = await createSupabaseServerClient();
  const assigneeOk = await assertMembershipInOrg(supabase, context.organizationId, assigneeRaw);
  if (!assigneeOk) return { error: "Ungültige Verantwortliche (Membership)." as const };
  const { data: session, error: sErr } = await supabase
    .schema("app")
    .from("okr_review_sessions")
    .select("id, organization_id, facilitator_membership_id, status")
    .eq("id", input.sessionId)
    .maybeSingle();

  if (sErr) return { error: sErr.message };
  if (!session || session.organization_id !== context.organizationId) {
    return { error: "Review-Session nicht gefunden." as const };
  }
  const st = String(session.status);
  if (st !== "in_progress" && st !== "completed") {
    return { error: "Aufgaben nur während oder nach der Session." as const };
  }

  const allowed = await assertOkrReviewSessionEditAllowed(context.membershipId, {
    facilitator_membership_id: (session.facilitator_membership_id as string | null),
  });
  if (!allowed) return { error: "Keine Berechtigung: diese Session bearbeiten." as const };

  const { data: sortRows } = await supabase
    .schema("app")
    .from("okr_review_session_tasks")
    .select("sort_order")
    .eq("okr_review_session_id", input.sessionId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const maxOrder = sortRows?.[0]
    ? (sortRows[0] as { sort_order: number }).sort_order
    : undefined;
  const nextOrder = typeof maxOrder === "number" ? maxOrder + 1 : 0;

  const { data: ins, error: insErr } = await supabase
    .schema("app")
    .from("okr_review_session_tasks")
    .insert({
      organization_id: context.organizationId,
      okr_review_session_id: input.sessionId,
      title,
      sort_order: nextOrder,
      created_by_membership_id: context.membershipId,
      assignee_membership_id: assigneeRaw,
      due_at: dueParse.iso,
    })
    .select("id")
    .single();

  if (insErr) {
    const insMsg = String(insErr.message ?? "");
    if (
      insMsg.includes("assignee_membership_id") ||
      (insMsg.includes("column") && insMsg.toLowerCase().includes("assignee"))
    ) {
      return {
        error:
          "Datenbank: Spalte Verantwortliche fehlt — bitte Migration 0112 anwenden (npm run db:migrate)." as const,
      };
    }
    if (insMsg.includes("due_at") || (insMsg.includes("column") && insMsg.toLowerCase().includes("due"))) {
      return {
        error:
          "Datenbank: Spalte Termin (due_at) fehlt — bitte Migration 0113 anwenden (npm run db:migrate)." as const,
      };
    }
    return { error: insErr.message };
  }
  revalidateOkrPaths();
  return { taskId: (ins as { id: string }).id };
}

export async function updateOkrReviewSessionTaskAction(input: {
  taskId: string;
  title?: string;
  isDone?: boolean;
  dueAtIso?: string;
}) {
  const pageAccess = await getSidebarAccessContext("okr-workspace");
  if (pageAccess.state !== "ok") {
    return { error: "Kein Zugriff auf den OKR-Arbeitsbereich." as const };
  }
  const context = await getPhase0Context();
  if (!context) return { error: "Nicht authentifiziert." as const };

  const supabase = await createSupabaseServerClient();
  const { data: task, error: tErr } = await supabase
    .schema("app")
    .from("okr_review_session_tasks")
    .select("id, organization_id, okr_review_session_id")
    .eq("id", input.taskId)
    .maybeSingle();

  if (tErr) return { error: tErr.message };
  if (!task || task.organization_id !== context.organizationId) {
    return { error: "Aufgabe nicht gefunden." as const };
  }

  const { data: session } = await supabase
    .schema("app")
    .from("okr_review_sessions")
    .select("facilitator_membership_id, status")
    .eq("id", task.okr_review_session_id)
    .maybeSingle();

  if (!session) return { error: "Review-Session nicht gefunden." as const };
  const st = String(session.status);
  if (st !== "in_progress" && st !== "completed") {
    return { error: "Aufgaben nur während oder nach der Session." as const };
  }

  const allowed = await assertOkrReviewSessionEditAllowed(context.membershipId, {
    facilitator_membership_id: (session.facilitator_membership_id as string | null),
  });
  if (!allowed) return { error: "Keine Berechtigung: diese Session bearbeiten." as const };

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.isDone !== undefined) patch.is_done = input.isDone;
  if (input.dueAtIso !== undefined) {
    const d = parseReviewTaskDueAtIso(input.dueAtIso, "Termin ist erforderlich.");
    if (!d.ok) return { error: d.error };
    patch.due_at = d.iso;
  }

  if (Object.keys(patch).length === 0) return {};

  const { error } = await supabase
    .schema("app")
    .from("okr_review_session_tasks")
    .update(patch)
    .eq("id", input.taskId);

  if (error) return { error: error.message };
  revalidateOkrPaths();
  return {};
}

export async function deleteOkrReviewSessionTaskAction(input: { taskId: string }) {
  const pageAccess = await getSidebarAccessContext("okr-workspace");
  if (pageAccess.state !== "ok") {
    return { error: "Kein Zugriff auf den OKR-Arbeitsbereich." as const };
  }
  const context = await getPhase0Context();
  if (!context) return { error: "Nicht authentifiziert." as const };

  const supabase = await createSupabaseServerClient();
  const { data: task, error: tErr } = await supabase
    .schema("app")
    .from("okr_review_session_tasks")
    .select("id, organization_id, okr_review_session_id")
    .eq("id", input.taskId)
    .maybeSingle();

  if (tErr) return { error: tErr.message };
  if (!task || task.organization_id !== context.organizationId) {
    return { error: "Aufgabe nicht gefunden." as const };
  }

  const { data: session } = await supabase
    .schema("app")
    .from("okr_review_sessions")
    .select("facilitator_membership_id, status")
    .eq("id", task.okr_review_session_id)
    .maybeSingle();

  if (!session) return { error: "Review-Session nicht gefunden." as const };
  const st = String(session.status);
  if (st !== "in_progress" && st !== "completed") {
    return { error: "Aufgaben nur während oder nach der Session." as const };
  }

  const allowed = await assertOkrReviewSessionEditAllowed(context.membershipId, {
    facilitator_membership_id: (session.facilitator_membership_id as string | null),
  });
  if (!allowed) return { error: "Keine Berechtigung: diese Session bearbeiten." as const };

  const { error } = await supabase.schema("app").from("okr_review_session_tasks").delete().eq("id", input.taskId);

  if (error) return { error: error.message };
  revalidateOkrPaths();
  return {};
}

export async function deleteOkrReviewSessionAction(input: { sessionId: string }) {
  const pageAccess = await getSidebarAccessContext("okr-workspace");
  if (pageAccess.state !== "ok") {
    return { error: "Kein Zugriff auf den OKR-Arbeitsbereich." as const };
  }
  const context = await getPhase0Context();
  if (!context) return { error: "Nicht authentifiziert." as const };

  const codes = await getPermissionCodesForMembership(context.membershipId);
  if (!codes.has("okr.review.session.manage")) {
    return { error: "Keine Berechtigung: Review-Sessions löschen." as const };
  }

  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase
    .schema("app")
    .from("okr_review_sessions")
    .select("id, organization_id, status")
    .eq("id", input.sessionId)
    .maybeSingle();

  if (!row || row.organization_id !== context.organizationId) {
    return { error: "Review-Session nicht gefunden." as const };
  }
  const status = String(row.status);
  if (status === "in_progress" || status === "completed") {
    return {
      error:
        "Löschen nur möglich, solange die Review nicht gestartet oder abgeschlossen ist (z. B. Entwurf oder geplant)." as const,
    };
  }

  const { error } = await supabase.schema("app").from("okr_review_sessions").delete().eq("id", input.sessionId);
  if (error) return { error: error.message };
  revalidateOkrPaths();
  return {};
}

export async function acceptOkrContributionEdgeAction(input: {
  cycleInstanceId: string;
  okrObjectiveId: string;
  targetType: "initiative" | "strategy_objective" | "strategic_direction";
  targetId: string;
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const supabase = await createSupabaseServerClient();
  const { data: obj } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id, status, owner_membership_id, deputy_membership_id")
    .eq("id", input.okrObjectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .maybeSingle();
  if (!obj?.id) return { error: "Objective nicht gefunden." };
  const planningBlockAccept = blockOkrPlanningEdit(obj.status);
  if (planningBlockAccept) return planningBlockAccept;
  if (
    !(await canAccessObjective({
      currentMembershipId: auth.context.membershipId,
      action: "update",
      objective: {
        id: obj.id,
        owner_membership_id: obj.owner_membership_id ?? null,
        deputy_membership_id: obj.deputy_membership_id ?? null,
      },
    }))
  ) {
    return objectiveWriteDeniedError();
  }

  const { data: edge } = await supabase
    .schema("app")
    .from("okr_contribution_edges")
    .select("id, llm_level")
    .eq("okr_objective_id", input.okrObjectiveId)
    .eq("target_type", input.targetType)
    .eq("target_id", input.targetId)
    .maybeSingle();

  if (!edge?.id || !edge.llm_level) {
    return { error: "Kein LLM-Vorschlag zum Übernehmen." };
  }

  const { error } = await supabase
    .schema("app")
    .from("okr_contribution_edges")
    .update({
      confirmed_level: edge.llm_level,
      value_source: "llm_accepted",
      llm_suggestion_dismissed: false,
    })
    .eq("id", edge.id);

  if (error) return { error: error.message };
  revalidateOkrPaths();
  return {};
}

export async function dismissOkrContributionSuggestionAction(input: {
  cycleInstanceId: string;
  okrObjectiveId: string;
  targetType: "initiative" | "strategy_objective" | "strategic_direction";
  targetId: string;
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const supabase = await createSupabaseServerClient();
  const { data: obj } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id, status, owner_membership_id, deputy_membership_id")
    .eq("id", input.okrObjectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .maybeSingle();
  if (!obj?.id) return { error: "Objective nicht gefunden." };
  const planningBlockDismiss = blockOkrPlanningEdit(obj.status);
  if (planningBlockDismiss) return planningBlockDismiss;
  if (
    !(await canAccessObjective({
      currentMembershipId: auth.context.membershipId,
      action: "update",
      objective: {
        id: obj.id,
        owner_membership_id: obj.owner_membership_id ?? null,
        deputy_membership_id: obj.deputy_membership_id ?? null,
      },
    }))
  ) {
    return objectiveWriteDeniedError();
  }

  const { data: edge } = await supabase
    .schema("app")
    .from("okr_contribution_edges")
    .select("id")
    .eq("okr_objective_id", input.okrObjectiveId)
    .eq("target_type", input.targetType)
    .eq("target_id", input.targetId)
    .maybeSingle();

  if (!edge?.id) return { error: "Kein Eintrag." };

  const { error } = await supabase
    .schema("app")
    .from("okr_contribution_edges")
    .update({
      llm_suggestion_dismissed: true,
      llm_level: null,
      llm_alignment_level: null,
      llm_ambition_level: null,
      llm_formulation_level: null,
      llm_scope_fit_level: null,
      llm_reason: null,
      llm_tension_note: null,
      llm_assessment_run_id: null,
    })
    .eq("id", edge.id);

  if (error) return { error: error.message };
  revalidateOkrPaths();
  return {};
}

export async function setOkrContributionManualAction(input: {
  cycleInstanceId: string;
  okrObjectiveId: string;
  targetType: "initiative" | "strategy_objective" | "strategic_direction";
  targetId: string;
  level: string;
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const lvl = normalizeOkrContributionTier(input.level);
  const supabase = await createSupabaseServerClient();

  const { data: obj } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id, organization_id, status, owner_membership_id, deputy_membership_id")
    .eq("id", input.okrObjectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .maybeSingle();
  if (!obj?.id) return { error: "Objective nicht gefunden." };
  const planningBlockManual = blockOkrPlanningEdit(obj.status);
  if (planningBlockManual) return planningBlockManual;
  if (
    !(await canAccessObjective({
      currentMembershipId: auth.context.membershipId,
      action: "update",
      objective: {
        id: obj.id,
        owner_membership_id: obj.owner_membership_id ?? null,
        deputy_membership_id: obj.deputy_membership_id ?? null,
      },
    }))
  ) {
    return objectiveWriteDeniedError();
  }

  const { data: existing } = await supabase
    .schema("app")
    .from("okr_contribution_edges")
    .select("id")
    .eq("okr_objective_id", input.okrObjectiveId)
    .eq("target_type", input.targetType)
    .eq("target_id", input.targetId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .schema("app")
      .from("okr_contribution_edges")
      .update({
        confirmed_level: lvl,
        value_source: "manual",
        llm_suggestion_dismissed: false,
      })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.schema("app").from("okr_contribution_edges").insert({
      organization_id: obj.organization_id,
      cycle_instance_id: input.cycleInstanceId,
      okr_objective_id: input.okrObjectiveId,
      target_type: input.targetType,
      target_id: input.targetId,
      confirmed_level: lvl,
      value_source: "manual",
      llm_suggestion_dismissed: false,
    });
    if (error) return { error: error.message };
  }

  revalidateOkrPaths();
  return {};
}

export async function recalculateOkrContributionAssessmentAction(input: {
  cycleInstanceId: string;
  okrObjectiveId: string;
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const supabase = await createSupabaseServerClient();
  const { data: obj } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id, status, owner_membership_id, deputy_membership_id")
    .eq("id", input.okrObjectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .maybeSingle();
  if (!obj?.id) return { error: "Objective nicht gefunden." };
  const planningBlockRecalc = blockOkrPlanningEdit(obj.status);
  if (planningBlockRecalc) return planningBlockRecalc;
  if (
    !(await canAccessObjective({
      currentMembershipId: auth.context.membershipId,
      action: "update",
      objective: {
        id: obj.id,
        owner_membership_id: obj.owner_membership_id ?? null,
        deputy_membership_id: obj.deputy_membership_id ?? null,
      },
    }))
  ) {
    return objectiveWriteDeniedError();
  }

  await scheduleOkrContributionAssessmentJob({
    supabase,
    organizationId: auth.context.organizationId,
    cycleInstanceId: input.cycleInstanceId,
    okrObjectiveId: input.okrObjectiveId,
    membershipId: auth.context.membershipId,
    trigger: "manual_recalculate",
  });
  revalidateOkrPaths();
  return {};
}
