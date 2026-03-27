"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { getOrgOkrSettings } from "@/lib/okr/org-okr-settings";
import {
  canEditOkrKeyResultForUser,
  canEditOkrObjectiveForUser,
} from "@/lib/okr/okr-object-permissions";
import { getOkrCycleInstanceScopeIds } from "@/lib/okr/queries";

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
  return { error: "Keine Berechtigung: nur der Objective-Owner kann dies ändern." as const };
}

function keyResultWriteDeniedError() {
  return {
    error: "Keine Berechtigung: nur Objective- oder KR-Owner können dies ändern." as const,
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

  let ownerId: string | null = null;
  if (input.ownerMembershipId) {
    const memOk = await assertMembershipInOrg(
      supabase,
      auth.context.organizationId,
      input.ownerMembershipId
    );
    if (!memOk) return { error: "Ungültiger Owner (Membership)." };
    ownerId = input.ownerMembershipId;
  }

  const { data: inserted, error } = await supabase
    .schema("app")
    .from("objectives")
    .insert({
      organization_id: auth.context.organizationId,
      cycle_instance_id: input.cycleInstanceId,
      okr_cycle_id: input.okrCycleId,
      title,
      description: input.description?.trim() || null,
      status: "draft",
      importance_score: 3,
      owner_membership_id: ownerId,
      created_by_membership_id: auth.context.membershipId,
      created_by_source: "user",
    })
    .select("id")
    .single();

  if (error || !inserted?.id) return { error: error?.message ?? "Objective konnte nicht angelegt werden." };

  const linkErr = await replaceLeadingStrategicDirectionLink({
    supabase,
    organizationId: auth.context.organizationId,
    cycleInstanceId: input.cycleInstanceId,
    objectiveId: inserted.id,
    strategicDirectionId: input.strategicDirectionId,
    membershipId: auth.context.membershipId,
  });
  if (linkErr) {
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
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const title = input.title.trim();
  if (!title) return { error: "Titel fehlt." };
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
    .select("id, okr_cycle_id, owner_membership_id")
    .eq("id", input.objectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .maybeSingle();

  if (!existingObj?.okr_cycle_id) {
    return { error: "OKR-Objective nicht gefunden oder kein OKR-Zeitraum gesetzt." };
  }

  if (!canEditOkrObjectiveForUser(auth.context.membershipId, existingObj.owner_membership_id)) {
    return objectiveWriteDeniedError();
  }

  let ownerId: string | null | undefined = undefined;
  if (input.ownerMembershipId !== undefined) {
    if (input.ownerMembershipId === null || input.ownerMembershipId === "") {
      ownerId = null;
    } else {
      const memOk = await assertMembershipInOrg(
        supabase,
        auth.context.organizationId,
        input.ownerMembershipId
      );
      if (!memOk) return { error: "Ungültiger Owner (Membership)." };
      ownerId = input.ownerMembershipId;
    }
  }

  const patch: Record<string, unknown> = {
    title,
    description: input.description?.trim() || null,
  };
  if (input.status !== undefined) {
    patch.status = input.status?.trim() || "draft";
  }
  if (ownerId !== undefined) patch.owner_membership_id = ownerId;

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
    .select("owner_membership_id")
    .eq("id", input.objectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .not("okr_cycle_id", "is", null)
    .maybeSingle();

  if (!objMeta) {
    return { error: "OKR-Objective nicht gefunden." };
  }
  if (!canEditOkrObjectiveForUser(auth.context.membershipId, objMeta.owner_membership_id)) {
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
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const title = input.title.trim();
  if (!title) return { error: "Titel fehlt." };

  const supabase = await createSupabaseServerClient();
  const { data: obj } = await supabase
    .schema("app")
    .from("objectives")
    .select("id, okr_cycle_id, owner_membership_id")
    .eq("id", input.objectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .maybeSingle();

  if (!obj?.okr_cycle_id) return { error: "OKR-Objective nicht gefunden." };

  if (!canEditOkrObjectiveForUser(auth.context.membershipId, obj.owner_membership_id)) {
    return objectiveWriteDeniedError();
  }

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
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const title = input.title.trim();
  if (!title) return { error: "Titel fehlt." };

  const supabase = await createSupabaseServerClient();

  const { data: krContext } = await supabase
    .schema("app")
    .from("key_results")
    .select("objective_id, owner_membership_id")
    .eq("id", input.keyResultId)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();

  if (!krContext?.objective_id) return { error: "Key Result nicht gefunden." };

  const { data: objOwnRow } = await supabase
    .schema("app")
    .from("objectives")
    .select("owner_membership_id")
    .eq("id", krContext.objective_id)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();
  const objectiveOwnerId = objOwnRow?.owner_membership_id ?? null;

  if (
    !canEditOkrKeyResultForUser(
      auth.context.membershipId,
      objectiveOwnerId,
      krContext.owner_membership_id
    )
  ) {
    return keyResultWriteDeniedError();
  }

  const dueDate = await keyResultDueDateFromOkrCycleEnd(
    supabase,
    auth.context.organizationId,
    krContext.objective_id
  );

  const { okrKrOwnerMustMatchObjective } = await getOrgOkrSettings(auth.context.organizationId);

  let ownerPatch: string | null | undefined = undefined;
  if (okrKrOwnerMustMatchObjective) {
    ownerPatch = objectiveOwnerId;
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
    updateRow.owner_membership_id = ownerPatch ?? objectiveOwnerId;
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
    .select("objective_id, owner_membership_id")
    .eq("id", input.keyResultId)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();
  if (!krRow?.objective_id) return { error: "Key Result nicht gefunden." };

  const { data: objRow } = await supabase
    .schema("app")
    .from("objectives")
    .select("owner_membership_id")
    .eq("id", krRow.objective_id)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();
  const objectiveOwnerId = objRow?.owner_membership_id ?? null;
  if (
    !canEditOkrKeyResultForUser(
      auth.context.membershipId,
      objectiveOwnerId,
      krRow.owner_membership_id
    )
  ) {
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
    .select("id, objective_id, owner_membership_id")
    .eq("id", input.keyResultId)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();

  if (!kr) return { error: "Key Result nicht gefunden." };

  const { data: obj } = await supabase
    .schema("app")
    .from("objectives")
    .select("okr_cycle_id, cycle_instance_id, owner_membership_id")
    .eq("id", kr.objective_id)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();

  if (!obj?.okr_cycle_id || obj.cycle_instance_id !== input.cycleInstanceId) {
    return { error: "Key Result gehört nicht zu diesem Zyklus." };
  }

  if (
    !canEditOkrKeyResultForUser(
      auth.context.membershipId,
      obj.owner_membership_id ?? null,
      kr.owner_membership_id
    )
  ) {
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
    .select("owner_membership_id, objective_id")
    .eq("id", keyResultId)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();
  const { data: objPerm } = krPerm?.objective_id
    ? await supabase
        .schema("app")
        .from("objectives")
        .select("owner_membership_id")
        .eq("id", krPerm.objective_id)
        .eq("organization_id", auth.context.organizationId)
        .maybeSingle()
    : { data: null };
  if (
    !canEditOkrKeyResultForUser(
      auth.context.membershipId,
      objPerm?.owner_membership_id ?? null,
      krPerm?.owner_membership_id ?? null
    )
  ) {
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
    .select("owner_membership_id, objective_id")
    .eq("id", keyResultId)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();
  const { data: objPerm } = krPerm?.objective_id
    ? await supabase
        .schema("app")
        .from("objectives")
        .select("owner_membership_id")
        .eq("id", krPerm.objective_id)
        .eq("organization_id", auth.context.organizationId)
        .maybeSingle()
    : { data: null };
  if (
    !canEditOkrKeyResultForUser(
      auth.context.membershipId,
      objPerm?.owner_membership_id ?? null,
      krPerm?.owner_membership_id ?? null
    )
  ) {
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
    .select("owner_membership_id")
    .eq("id", objectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .not("okr_cycle_id", "is", null)
    .maybeSingle();

  if (!existingObjective) {
    return { error: "OKR-Objective nicht gefunden." };
  }

  const canEditObj = canEditOkrObjectiveForUser(
    auth.context.membershipId,
    existingObjective.owner_membership_id
  );

  const ownerRaw = String(formData.get("owner_membership_id") ?? "").trim();

  if (canEditObj) {
    const objRes = await updateOkrObjectiveAction({
      cycleInstanceId,
      objectiveId,
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? "") || null,
      strategicDirectionId: String(formData.get("strategic_direction_id") ?? ""),
      ownerMembershipId: ownerRaw || null,
    });
    if ("error" in objRes && objRes.error) return objRes;
  }

  const { data: objectiveAfter } = await supabase
    .schema("app")
    .from("objectives")
    .select("owner_membership_id")
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
    .select("id, objective_id, owner_membership_id")
    .eq("organization_id", auth.context.organizationId)
    .in("id", krIds);

  for (const krId of krIds) {
    const row = (krRows ?? []).find((r) => r.id === krId);
    if (!row || row.objective_id !== objectiveId) {
      return { error: "Ungültiges Key Result für dieses Objective." };
    }

    if (
      !canEditOkrKeyResultForUser(
        auth.context.membershipId,
        resolvedObjectiveOwner,
        row.owner_membership_id
      )
    ) {
      continue;
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

    const krRes = await updateKeyResultAction({
      keyResultId: krId,
      title: String(formData.get(`kr_${krId}_title`) ?? ""),
      metricType: String(formData.get(`kr_${krId}_metric_type`) ?? "boolean"),
      startValue: formDataOptionalNumber(formData.get(`kr_${krId}_start_value`)),
      targetValue: formDataOptionalNumber(formData.get(`kr_${krId}_target_value`)),
      measurementUnit: String(formData.get(`kr_${krId}_measurement_unit`) ?? "") || null,
      ownerMembershipId: ownerForKr,
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
    .select("id, objective_id, owner_membership_id")
    .eq("id", input.keyResultId)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();

  if (!kr) return { error: "Key Result nicht gefunden." };

  const { data: obj } = await supabase
    .schema("app")
    .from("objectives")
    .select("okr_cycle_id, cycle_instance_id, owner_membership_id")
    .eq("id", kr.objective_id)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();

  if (!obj?.okr_cycle_id || obj.okr_cycle_id !== input.okrCycleId || obj.cycle_instance_id !== input.cycleInstanceId) {
    return { error: "Key Result passt nicht zu OKR-Zyklus oder Instanz." };
  }

  if (
    !canEditOkrKeyResultForUser(
      auth.context.membershipId,
      obj.owner_membership_id ?? null,
      kr.owner_membership_id
    )
  ) {
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

export async function saveOkrReviewAction(input: {
  cycleInstanceId: string;
  okrCycleId: string;
  reviewType?: string;
  summary: string;
  successes: string;
  problems: string;
  lessonsLearned: string;
  nextActions: string;
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

  const reviewType = input.reviewType?.trim() || "quarterly_review";

  const row = {
    organization_id: auth.context.organizationId,
    cycle_instance_id: input.cycleInstanceId,
    okr_cycle_id: input.okrCycleId,
    review_type: reviewType,
    summary: input.summary,
    successes: input.successes,
    problems: input.problems,
    lessons_learned: input.lessonsLearned,
    next_actions: input.nextActions,
    created_by_membership_id: auth.context.membershipId,
  };

  const { error } = await supabase
    .schema("app")
    .from("okr_reviews")
    .upsert(row, {
      onConflict: "organization_id,okr_cycle_id,cycle_instance_id,review_type",
    });

  if (error) return { error: error.message };
  revalidateOkrPaths();
  return {};
}
