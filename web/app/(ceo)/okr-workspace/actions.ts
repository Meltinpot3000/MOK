"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";

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
  const { data } = await supabase
    .schema("app")
    .from("okr_cycles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .eq("id", okrCycleId)
    .maybeSingle();
  return Boolean(data?.id);
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
  status?: string;
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
      status: input.status?.trim() || "draft",
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
    .select("id, okr_cycle_id")
    .eq("id", input.objectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .maybeSingle();

  if (!existingObj?.okr_cycle_id) {
    return { error: "OKR-Objective nicht gefunden oder kein OKR-Zeitraum gesetzt." };
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
    status: input.status?.trim() || "draft",
  };
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

  revalidateOkrPaths();
  return {};
}

export async function deleteOkrObjectiveAction(input: { cycleInstanceId: string; objectiveId: string }) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const supabase = await createSupabaseServerClient();
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
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const title = input.title.trim();
  if (!title) return { error: "Titel fehlt." };

  const supabase = await createSupabaseServerClient();
  const { data: obj } = await supabase
    .schema("app")
    .from("objectives")
    .select("id, okr_cycle_id")
    .eq("id", input.objectiveId)
    .eq("organization_id", auth.context.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .maybeSingle();

  if (!obj?.okr_cycle_id) return { error: "OKR-Objective nicht gefunden." };

  const { data: inserted, error } = await supabase
    .schema("app")
    .from("key_results")
    .insert({
      organization_id: auth.context.organizationId,
      objective_id: input.objectiveId,
      title,
      metric_type: input.metricType?.trim() || "numeric",
      start_value: input.startValue ?? null,
      target_value: input.targetValue ?? null,
      current_value: input.currentValue ?? null,
      measurement_unit: input.measurementUnit?.trim() || null,
      status: "draft",
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
  dueDate?: string | null;
  ownerMembershipId?: string | null;
}) {
  const auth = await requireOkrWrite();
  if ("error" in auth) return auth;

  const title = input.title.trim();
  if (!title) return { error: "Titel fehlt." };

  const supabase = await createSupabaseServerClient();

  let ownerPatch: string | null | undefined = undefined;
  if (input.ownerMembershipId !== undefined) {
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
    metric_type: input.metricType?.trim() || "numeric",
    start_value: input.startValue ?? null,
    target_value: input.targetValue ?? null,
    current_value: input.currentValue ?? null,
    measurement_unit: input.measurementUnit?.trim() || null,
    status: input.status?.trim() || "draft",
  };
  if (input.dueDate !== undefined) {
    updateRow.due_date = input.dueDate && input.dueDate.trim() !== "" ? input.dueDate.trim() : null;
  }
  if (ownerPatch !== undefined) updateRow.owner_membership_id = ownerPatch;

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
    .select("id, objective_id")
    .eq("id", input.keyResultId)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();

  if (!kr) return { error: "Key Result nicht gefunden." };

  const { data: obj } = await supabase
    .schema("app")
    .from("objectives")
    .select("okr_cycle_id, cycle_instance_id")
    .eq("id", kr.objective_id)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();

  if (!obj?.okr_cycle_id || obj.cycle_instance_id !== input.cycleInstanceId) {
    return { error: "Key Result gehört nicht zu diesem Zyklus." };
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

export async function createOkrCheckInAction(input: {
  cycleInstanceId: string;
  keyResultId: string;
  okrCycleId: string;
  progressValue: number | null;
  confidenceLevel: number;
  comment?: string | null;
  updateCurrentValue?: number | null;
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
    .select("id, objective_id")
    .eq("id", input.keyResultId)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();

  if (!kr) return { error: "Key Result nicht gefunden." };

  const { data: obj } = await supabase
    .schema("app")
    .from("objectives")
    .select("okr_cycle_id, cycle_instance_id")
    .eq("id", kr.objective_id)
    .eq("organization_id", auth.context.organizationId)
    .maybeSingle();

  if (!obj?.okr_cycle_id || obj.okr_cycle_id !== input.okrCycleId || obj.cycle_instance_id !== input.cycleInstanceId) {
    return { error: "Key Result passt nicht zu OKR-Zyklus oder Instanz." };
  }

  const conf = Math.min(10, Math.max(1, Math.round(input.confidenceLevel)));

  const { error: insErr } = await supabase.schema("app").from("okr_updates").insert({
    organization_id: auth.context.organizationId,
    cycle_instance_id: input.cycleInstanceId,
    okr_cycle_id: input.okrCycleId,
    key_result_id: input.keyResultId,
    progress_value: input.progressValue,
    confidence_level: conf,
    comment: input.comment?.trim() || null,
    created_by_membership_id: auth.context.membershipId,
  });

  if (insErr) return { error: insErr.message };

  if (input.updateCurrentValue != null) {
    const { error: upErr } = await supabase
      .schema("app")
      .from("key_results")
      .update({ current_value: input.updateCurrentValue })
      .eq("id", input.keyResultId)
      .eq("organization_id", auth.context.organizationId);
    if (upErr) return { error: upErr.message };
  }

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
