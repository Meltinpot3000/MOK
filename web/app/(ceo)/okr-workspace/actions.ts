"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { getOrgOkrSettings } from "@/lib/okr/org-okr-settings";
import { getPermissionCodesForMembership } from "@/lib/rbac/permission-codes";
import {
  canAccessKeyResult,
  canAccessObjective,
  canCreateOkrKeyResult,
  canCreateOkrObjective,
} from "@/lib/okr/okr-object-access";
import { getOkrCycleInstanceScopeIds, getOkrCycles } from "@/lib/okr/queries";
import { resolveNextOkrCycleId } from "@/lib/okr/okr-cycle-nav";

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
  if (pageAccess.state !== "ok" || !pageAccess.canWrite) {
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

/** `YYYY-MM-DD` für key_results.due_date — Ende des am Objective hängenden OKR-Zyklus */
async function keyResultDueDateFromOkrCycleEnd(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  objectiveId: string
): Promise<string | null> {
  const { data: obj } = await supabase
    .schema("app")
    .from("objectives")
    .select("okr_cycle_id, cycle_instance_id")
    .eq("id", objectiveId)
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

async function replaceLeadingStrategicDirectionLink(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  organizationId: string;
  cycleInstanceId: string;
  objectiveId: string;
  strategicDirectionId: string;
  membershipId: string;
}) {
  const { supabase, organizationId, cycleInstanceId, objectiveId, strategicDirectionId, membershipId } = params;
  const { error: delErr } = await supabase
    .schema("app")
    .from("strategic_direction_objective_links")
    .delete()
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .eq("objective_id", objectiveId);
  if (delErr) return delErr.message;

  const { error: insErr } = await supabase
    .schema("app")
    .from("strategic_direction_objective_links")
    .insert({
      organization_id: organizationId,
      cycle_instance_id: cycleInstanceId,
      objective_id: objectiveId,
      strategic_direction_id: strategicDirectionId,
      created_by_membership_id: membershipId,
      contribution_level: "medium",
    });
  return insErr?.message ?? null;
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
    .from("objectives")
    .insert({
      organization_id: auth.context.organizationId,
      cycle_instance_id: input.cycleInstanceId,
      okr_cycle_id: input.okrCycleId,
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
      "createOkrObjectiveAction.objectives_insert",
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
    return { error: error?.message ?? "Objective konnte nicht angelegt werden." };
  }

  const linkErr = await replaceLeadingStrategicDirectionLink({
    supabase,
    organizationId: auth.context.organizationId,
    cycleInstanceId: input.cycleInstanceId,
    objectiveId: inserted.id,
    strategicDirectionId: input.strategicDirectionId,
    membershipId: auth.context.membershipId,
  });
  if (linkErr) {
    logOkrSupabaseDiag(
      "createOkrObjectiveAction.strategic_direction_link",
      null,
      {
        organizationId: auth.context.organizationId,
        objectiveId: inserted.id,
        message: linkErr,
      },
      { always: true }
    );
    await supabase.schema("app").from("objectives").delete().eq("id", inserted.id);
    return { error: linkErr };
  }

  revalidateOkrPaths();
  return { id: inserted.id };
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
    .from("objectives")
    .select("id, okr_cycle_id, owner_membership_id, deputy_membership_id, status")
    .eq("id", input.objectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .maybeSingle();

  if (!existingObj?.okr_cycle_id) {
    return { error: "OKR-Objective nicht gefunden oder kein OKR-Zeitraum gesetzt." };
  }

  if (existingObj.status === "shifted") {
    return {
      error:
        "Dieses Objective wurde in einen späteren OKR-Zeitraum verschoben und ist hier schreibgeschützt.",
    };
  }

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
      return { error: "Deputy entfernen ist nur mit okr.objective.update.all erlaubt." };
    }
  }

  const patch: Record<string, unknown> = {
    title,
    description,
  };
  if (input.status !== undefined) {
    patch.status = input.status?.trim() || "draft";
  }
  if (ownerId !== undefined) patch.owner_membership_id = ownerId;
  if (deputyId !== undefined) patch.deputy_membership_id = deputyId;

  const { error } = await supabase
    .schema("app")
    .from("objectives")
    .update(patch)
    .eq("id", input.objectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .not("okr_cycle_id", "is", null);

  if (error) return { error: error.message };

  const linkErr = await replaceLeadingStrategicDirectionLink({
    supabase,
    organizationId: auth.context.organizationId,
    cycleInstanceId: input.cycleInstanceId,
    objectiveId: input.objectiveId,
    strategicDirectionId: input.strategicDirectionId,
    membershipId: auth.context.membershipId,
  });
  if (linkErr) return { error: linkErr };

  const resolvedObjectiveOwner =
    ownerId !== undefined ? ownerId : existingObj.owner_membership_id;
  const { okrKrOwnerMustMatchObjective } = await getOrgOkrSettings(auth.context.organizationId);
  if (okrKrOwnerMustMatchObjective) {
    const { error: cascadeErr } = await supabase
      .schema("app")
      .from("key_results")
      .update({ owner_membership_id: resolvedObjectiveOwner })
      .eq("objective_id", input.objectiveId)
      .eq("organization_id", auth.context.organizationId);
    if (cascadeErr) return { error: cascadeErr.message };
  }

  revalidateOkrPaths();
  return {};
}

export async function deleteOkrObjectiveAction(input: { cycleInstanceId: string; objectiveId: string }) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const supabase = await createSupabaseServerClient();
  const { data: objMeta } = await supabase
    .schema("app")
    .from("objectives")
    .select("id, owner_membership_id, deputy_membership_id, status")
    .eq("id", input.objectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .not("okr_cycle_id", "is", null)
    .maybeSingle();

  if (!objMeta) {
    return { error: "OKR-Objective nicht gefunden." };
  }

  if (objMeta.status === "shifted") {
    return {
      error:
        "Verschobene Objectives können hier nicht gelöscht werden (nur lesen / Historie).",
    };
  }
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
    .from("objectives")
    .delete()
    .eq("id", input.objectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .not("okr_cycle_id", "is", null);

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
    .from("objectives")
    .select("id, okr_cycle_id, owner_membership_id, deputy_membership_id, status")
    .eq("id", input.objectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .maybeSingle();

  if (!obj?.okr_cycle_id) return { error: "OKR-Objective nicht gefunden." };

  if (obj.status === "shifted") {
    return {
      error:
        "Unter einem verschobenen Objective können keine neuen Key Results angelegt werden.",
    };
  }

  const parentObjective = {
    id: obj.id,
    owner_membership_id: obj.owner_membership_id ?? null,
    deputy_membership_id: obj.deputy_membership_id ?? null,
  };

  const { okrKrOwnerMustMatchObjective } = await getOrgOkrSettings(auth.context.organizationId);
  let krOwnerId: string | null = null;
  if (okrKrOwnerMustMatchObjective) {
    krOwnerId = obj.owner_membership_id;
  } else if (input.ownerMembershipId) {
    const memOk = await assertMembershipInOrg(
      supabase,
      auth.context.organizationId,
      input.ownerMembershipId
    );
    if (!memOk) return { error: "Ungültiger Owner (Membership)." };
    krOwnerId = input.ownerMembershipId;
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
      objective_id: input.objectiveId,
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
    .select("id, objective_id, owner_membership_id, deputy_membership_id")
    .eq("id", input.keyResultId)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();

  if (!krContext?.objective_id) return { error: "Key Result nicht gefunden." };

  const { data: objOwnRow } = await supabase
    .schema("app")
    .from("objectives")
    .select("id, owner_membership_id, deputy_membership_id, status")
    .eq("id", krContext.objective_id)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();
  if (!objOwnRow?.id) return { error: "Objective nicht gefunden." };

  if (objOwnRow.status === "shifted") {
    return {
      error:
        "Key Results eines verschobenen Objectives können nicht bearbeitet werden.",
    };
  }

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
    krContext.objective_id
  );

  const { okrKrOwnerMustMatchObjective } = await getOrgOkrSettings(auth.context.organizationId);

  let ownerPatch: string | null | undefined = undefined;
  if (okrKrOwnerMustMatchObjective) {
    ownerPatch = objectiveRow.owner_membership_id;
  } else if (input.ownerMembershipId !== undefined) {
    if (input.ownerMembershipId === null || input.ownerMembershipId === "") {
      ownerPatch = null;
    } else {
      const memOk = await assertMembershipInOrg(
        supabase,
        auth.context.organizationId,
        input.ownerMembershipId
      );
      if (!memOk) return { error: "Ungültiger Owner (Membership)." };
      ownerPatch = input.ownerMembershipId;
    }
  }

  if (ownerPatch === null && input.ownerMembershipId !== undefined) {
    if (!krPermissionCodes.has("okr.key_result.update.all")) {
      return { error: "KR-Owner entfernen ist nur mit okr.key_result.update.all erlaubt." };
    }
  }

  let deputyPatch: string | null | undefined = undefined;
  if (input.deputyMembershipId !== undefined) {
    if (input.deputyMembershipId === null || input.deputyMembershipId === "") {
      deputyPatch = null;
    } else {
      const memOk = await assertMembershipInOrg(
        supabase,
        auth.context.organizationId,
        input.deputyMembershipId
      );
      if (!memOk) return { error: "Ungültiger Deputy (Membership)." };
      deputyPatch = input.deputyMembershipId;
    }
  }

  if (deputyPatch === null && input.deputyMembershipId !== undefined) {
    if (!krPermissionCodes.has("okr.key_result.update.all")) {
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
  revalidateOkrPaths();
  return {};
}

export async function deleteKeyResultAction(input: { keyResultId: string }) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const supabase = await createSupabaseServerClient();
  const { data: krRow } = await supabase
    .schema("app")
    .from("key_results")
    .select("id, objective_id, owner_membership_id, deputy_membership_id")
    .eq("id", input.keyResultId)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();
  if (!krRow?.objective_id) return { error: "Key Result nicht gefunden." };

  const { data: objRow } = await supabase
    .schema("app")
    .from("objectives")
    .select("id, owner_membership_id, deputy_membership_id, status")
    .eq("id", krRow.objective_id)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();
  if (!objRow?.id) return { error: "Objective nicht gefunden." };
  if (objRow.status === "shifted") {
    return { error: "Key Results eines verschobenen Objectives können nicht gelöscht werden." };
  }
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
    .select("id, objective_id, owner_membership_id, deputy_membership_id")
    .eq("id", input.keyResultId)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();

  if (!kr) return { error: "Key Result nicht gefunden." };

  const { data: obj } = await supabase
    .schema("app")
    .from("objectives")
    .select("id, okr_cycle_id, cycle_instance_id, owner_membership_id, deputy_membership_id")
    .eq("id", kr.objective_id)
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

  const wanted = [...new Set(input.initiativeIds.filter(Boolean))];
  if (wanted.length > 0) {
    const { data: inits } = await supabase
      .schema("app")
      .from("initiatives")
      .select("id")
      .eq("organization_id", auth.context.organizationId)
      .eq("cycle_instance_id", input.cycleInstanceId)
      .in("id", wanted);
    const valid = new Set((inits ?? []).map((r: { id: string }) => r.id));
    for (const id of wanted) {
      if (!valid.has(id)) return { error: "Ungültige Initiative für diesen Zyklus." };
    }
  }

  const { error: delErr } = await supabase
    .schema("app")
    .from("initiative_key_result_links")
    .delete()
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .eq("key_result_id", input.keyResultId);

  if (delErr) return { error: delErr.message };

  if (wanted.length > 0) {
    const rows = wanted.map((initiative_id) => ({
      organization_id: auth.context.organizationId,
      cycle_instance_id: input.cycleInstanceId,
      initiative_id,
      key_result_id: input.keyResultId,
      created_by_membership_id: auth.context.membershipId,
    }));
    const { error: insErr } = await supabase.schema("app").from("initiative_key_result_links").insert(rows);
    if (insErr) return { error: insErr.message };
  }

  revalidateOkrPaths();
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
    .select("id, objective_id")
    .eq("id", keyResultId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!kr) return { error: "Key Result nicht gefunden." };

  const { data: obj } = await supabase
    .schema("app")
    .from("objectives")
    .select("okr_cycle_id, cycle_instance_id")
    .eq("id", kr.objective_id)
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
    .select("id, owner_membership_id, deputy_membership_id, objective_id")
    .eq("id", keyResultId)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();
  const { data: objPerm } = krPerm?.objective_id
    ? await supabase
        .schema("app")
        .from("objectives")
        .select("id, owner_membership_id, deputy_membership_id, status")
        .eq("id", krPerm.objective_id)
        .eq("organization_id", auth.context.organizationId)
        .maybeSingle()
    : { data: null };
  if (!krPerm?.id || !objPerm?.id) return { error: "Key Result nicht gefunden." };
  if (objPerm.status === "shifted") {
    return { error: "Initiative-Verknüpfung für verschobenes Objective nicht änderbar." };
  }
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
    .select("id, owner_membership_id, deputy_membership_id, objective_id")
    .eq("id", keyResultId)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();
  const { data: objPerm } = krPerm?.objective_id
    ? await supabase
        .schema("app")
        .from("objectives")
        .select("id, owner_membership_id, deputy_membership_id, status")
        .eq("id", krPerm.objective_id)
        .eq("organization_id", auth.context.organizationId)
        .maybeSingle()
    : { data: null };
  if (!krPerm?.id || !objPerm?.id) return { error: "Key Result nicht gefunden." };
  if (objPerm.status === "shifted") {
    return { error: "Initiative-Verknüpfung für verschobenes Objective nicht änderbar." };
  }
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

function formDataOptionalNumber(entry: FormDataEntryValue | null): number | null {
  if (entry == null || entry === "") return null;
  const n = Number(entry);
  return Number.isFinite(n) ? n : null;
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
    .from("objectives")
    .select("id, owner_membership_id, deputy_membership_id, status")
    .eq("id", objectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .not("okr_cycle_id", "is", null)
    .maybeSingle();

  if (!existingObjective?.id) {
    return { error: "OKR-Objective nicht gefunden." };
  }

  if (existingObjective.status === "shifted") {
    return {
      error:
        "Dieses Objective wurde verschoben — Bearbeitung im alten Zeitraum ist deaktiviert.",
    };
  }

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
    const objRes = await updateOkrObjectiveAction({
      cycleInstanceId,
      objectiveId,
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      strategicDirectionId: String(formData.get("strategic_direction_id") ?? ""),
      ownerMembershipId: ownerRaw,
      deputyMembershipId: deputyRaw || null,
    });
    if ("error" in objRes && objRes.error) return objRes;
  }

  const { data: objectiveAfter } = await supabase
    .schema("app")
    .from("objectives")
    .select("id, owner_membership_id, deputy_membership_id")
    .eq("id", objectiveId)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();
  const resolvedObjectiveOwner = objectiveAfter?.owner_membership_id ?? null;

  const settings = await getOrgOkrSettings(auth.context.organizationId);

  if (krIds.length === 0) {
    return {};
  }

  const { data: krRows } = await supabase
    .schema("app")
    .from("key_results")
    .select("id, objective_id, owner_membership_id, deputy_membership_id")
    .eq("organization_id", auth.context.organizationId)
    .in("id", krIds);

  const parentObjectiveRow = {
    id: objectiveAfter?.id ?? existingObjective.id,
    owner_membership_id: objectiveAfter?.owner_membership_id ?? null,
    deputy_membership_id: objectiveAfter?.deputy_membership_id ?? null,
  };

  for (const krId of krIds) {
    const row = (krRows ?? []).find((r) => r.id === krId);
    if (!row || row.objective_id !== objectiveId) {
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
    } else {
      const krOwnerRaw = String(formData.get(`kr_${krId}_owner_membership_id`) ?? "").trim();
      ownerForKr = krOwnerRaw || null;
    }

    const krDeputyFieldPresent = formData.has(`kr_${krId}_deputy_membership_id`);
    const krDeputyRaw = String(formData.get(`kr_${krId}_deputy_membership_id`) ?? "").trim();

    const krRes = await updateKeyResultAction({
      keyResultId: krId,
      title: String(formData.get(`kr_${krId}_title`) ?? ""),
      metricType: String(formData.get(`kr_${krId}_metric_type`) ?? "boolean"),
      startValue: formDataOptionalNumber(formData.get(`kr_${krId}_start_value`)),
      targetValue: formDataOptionalNumber(formData.get(`kr_${krId}_target_value`)),
      measurementUnit: String(formData.get(`kr_${krId}_measurement_unit`) ?? "") || null,
      ownerMembershipId: ownerForKr,
      deputyMembershipId: krDeputyFieldPresent ? krDeputyRaw || null : undefined,
    });
    if ("error" in krRes && krRes.error) return krRes;
  }

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
  /** Subjektiver Fortschritt 0–100 oder null wenn nicht angegeben */
  progressValue: number | null;
  /** Subjektive Confidence 1–10 (unabhängig von Metrik) */
  confidenceLevel: number;
  comment?: string | null;
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

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
    .select("id, objective_id, owner_membership_id, deputy_membership_id")
    .eq("id", input.keyResultId)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();

  if (!kr) return { error: "Key Result nicht gefunden." };

  const { data: obj } = await supabase
    .schema("app")
    .from("objectives")
    .select("id, okr_cycle_id, cycle_instance_id, owner_membership_id, deputy_membership_id, status")
    .eq("id", kr.objective_id)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();

  if (!obj?.okr_cycle_id || obj.okr_cycle_id !== input.okrCycleId || obj.cycle_instance_id !== input.cycleInstanceId) {
    return { error: "Key Result passt nicht zu OKR-Zyklus oder Instanz." };
  }

  if (obj.status === "shifted") {
    return { error: "Check-in nicht möglich: Objective ist als verschoben markiert." };
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
  let progressStored: number | null = null;
  if (input.progressValue != null && Number.isFinite(Number(input.progressValue))) {
    progressStored = Math.min(100, Math.max(0, Number(input.progressValue)));
  }

  const { error: insErr } = await supabase.schema("app").from("okr_updates").insert({
    organization_id: auth.context.organizationId,
    cycle_instance_id: input.cycleInstanceId,
    okr_cycle_id: input.okrCycleId,
    key_result_id: input.keyResultId,
    progress_value: progressStored,
    confidence_level: conf,
    comment: input.comment?.trim() || null,
    created_by_membership_id: auth.context.membershipId,
  });

  if (insErr) return { error: insErr.message };

  revalidateOkrPaths();
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
    .from("objectives")
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
  title?: string;
  sessionType: OkrReviewSessionType;
  scheduledAtIso?: string | null;
  facilitatorMembershipId?: string | null;
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

  let facilitator: string | null = null;
  const rawFacilitator = input.facilitatorMembershipId?.trim();
  if (rawFacilitator) {
    if (!codes.has("okr.review.facilitator.assign")) {
      return { error: "Facilitator beim Anlegen erfordert okr.review.facilitator.assign." as const };
    }
    const memOk = await assertMembershipInOrg(supabase, context.organizationId, rawFacilitator);
    if (!memOk) return { error: "Facilitator nicht in dieser Organisation." as const };
    facilitator = rawFacilitator;
  }

  const title = input.title?.trim() || "Review";
  const scheduledAt = input.scheduledAtIso?.trim() || null;

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
  const { data: row, error: loadErr } = await supabase
    .schema("app")
    .from("okr_review_sessions")
    .select(
      "id, organization_id, cycle_instance_id, okr_cycle_id, facilitator_membership_id, status"
    )
    .eq("id", input.sessionId)
    .maybeSingle();

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

  const patch: Record<string, unknown> = {};
  if (!assignOnly) {
    if (input.title !== undefined) patch.title = input.title.trim();
    if (input.sessionType !== undefined) patch.session_type = input.sessionType;
    if (input.status !== undefined) patch.status = input.status;
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

  const { error } = await supabase
    .schema("app")
    .from("okr_review_sessions")
    .update(patch)
    .eq("id", input.sessionId);

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
  if (row.status !== "draft") {
    return { error: "Nur Sessions im Status Entwurf können gelöscht werden." as const };
  }

  const { error } = await supabase.schema("app").from("okr_review_sessions").delete().eq("id", input.sessionId);
  if (error) return { error: error.message };
  revalidateOkrPaths();
  return {};
}

