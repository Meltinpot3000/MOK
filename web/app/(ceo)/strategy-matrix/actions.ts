"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { getMatrixCycleContextOrRedirect } from "@/lib/strategy-matrix/cycle-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type MatrixContext = {
  localContext: { organizationId: string; membershipId: string };
  cycle: { id: string };
};

async function getMatrixContextOrRedirect(): Promise<MatrixContext> {
  const access = await getSidebarAccessContext("strategy-matrix");
  if (access.state !== "ok" || !access.canWrite) redirect("/no-access");
  return getMatrixCycleContextOrRedirect();
}

function done(path = "/strategy-matrix"): never {
  revalidatePath("/strategy-matrix");
  redirect(path);
}

export async function createChallenge(formData: FormData) {
  const { localContext, cycle } = await getMatrixContextOrRedirect();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) done();

  const supabase = await createSupabaseServerClient();
  const { data: challenge } = await supabase
    .schema("app")
    .from("strategic_challenges")
    .insert({
      organization_id: localContext.organizationId,
      planning_cycle_id: cycle.id,
      title,
      priority: Number(formData.get("priority") ?? 3),
      visibility: String(formData.get("visibility") ?? "internal"),
      created_by_membership_id: localContext.membershipId,
    })
    .select("id")
    .single();

  if (challenge) {
    await supabase.schema("app").from("dashboard_column_config").upsert(
      {
        organization_id: localContext.organizationId,
        planning_cycle_id: cycle.id,
        challenge_id: challenge.id,
        display_order: Number(formData.get("display_order") ?? 999),
      },
      { onConflict: "planning_cycle_id,challenge_id" }
    );
  }

  done();
}

export async function importExistingChallenge(formData: FormData) {
  const { localContext, cycle } = await getMatrixContextOrRedirect();
  const challengeId = String(formData.get("challenge_id") ?? "");
  if (!challengeId) done();

  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("dashboard_column_config").upsert(
    {
      organization_id: localContext.organizationId,
      planning_cycle_id: cycle.id,
      challenge_id: challengeId,
      display_order: Number(formData.get("display_order") ?? 999),
    },
    { onConflict: "planning_cycle_id,challenge_id" }
  );

  done();
}

export async function updateChallenge(formData: FormData) {
  const { localContext, cycle } = await getMatrixContextOrRedirect();
  const challengeId = String(formData.get("challenge_id") ?? "");

  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("strategic_challenges")
    .update({
      title: String(formData.get("title") ?? "").trim(),
      priority: Number(formData.get("priority") ?? 3),
      visibility: String(formData.get("visibility") ?? "internal"),
    })
    .eq("id", challengeId)
    .eq("organization_id", localContext.organizationId)
    .eq("planning_cycle_id", cycle.id);

  await supabase.schema("app").from("dashboard_column_config").upsert(
    {
      organization_id: localContext.organizationId,
      planning_cycle_id: cycle.id,
      challenge_id: challengeId,
      display_order: Number(formData.get("display_order") ?? 999),
    },
    { onConflict: "planning_cycle_id,challenge_id" }
  );

  done();
}

export async function removeChallengeFromDashboard(formData: FormData) {
  const { localContext, cycle } = await getMatrixContextOrRedirect();
  const challengeId = String(formData.get("challenge_id") ?? "");
  if (!challengeId) done();

  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .schema("app")
    .from("dashboard_column_config")
    .select("challenge_id", { count: "exact", head: true })
    .eq("organization_id", localContext.organizationId)
    .eq("planning_cycle_id", cycle.id);

  if (!count) {
    const { data: challenges } = await supabase
      .schema("app")
      .from("strategic_challenges")
      .select("id")
      .eq("organization_id", localContext.organizationId)
      .eq("planning_cycle_id", cycle.id)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true });

    const entries = (challenges ?? []).map((challenge, idx) => ({
      organization_id: localContext.organizationId,
      planning_cycle_id: cycle.id,
      challenge_id: challenge.id,
      display_order: idx + 1,
    }));
    if (entries.length > 0) {
      await supabase
        .schema("app")
        .from("dashboard_column_config")
        .upsert(entries, { onConflict: "planning_cycle_id,challenge_id" });
    }
  }

  await supabase
    .schema("app")
    .from("dashboard_column_config")
    .delete()
    .eq("organization_id", localContext.organizationId)
    .eq("planning_cycle_id", cycle.id)
    .eq("challenge_id", challengeId);

  done();
}

export async function promoteAnalysisToChallenge(formData: FormData) {
  const { localContext, cycle } = await getMatrixContextOrRedirect();
  const analysisEntryId = String(formData.get("analysis_entry_id") ?? "");
  if (!analysisEntryId) done();

  const supabase = await createSupabaseServerClient();
  const { data: analysisEntry } = await supabase
    .schema("app")
    .from("analysis_entries")
    .select("id, title, impact_level")
    .eq("id", analysisEntryId)
    .eq("organization_id", localContext.organizationId)
    .eq("planning_cycle_id", cycle.id)
    .single();

  if (!analysisEntry) done();

  const { data: challenge } = await supabase
    .schema("app")
    .from("strategic_challenges")
    .insert({
      organization_id: localContext.organizationId,
      planning_cycle_id: cycle.id,
      title: analysisEntry.title,
      priority: analysisEntry.impact_level ?? 3,
      visibility: "internal",
      source_analysis_entry_id: analysisEntry.id,
      created_by_membership_id: localContext.membershipId,
    })
    .select("id")
    .single();

  if (challenge) {
    await supabase.schema("app").from("dashboard_column_config").upsert(
      {
        organization_id: localContext.organizationId,
        planning_cycle_id: cycle.id,
        challenge_id: challenge.id,
        display_order: Number(formData.get("display_order") ?? 999),
      },
      { onConflict: "planning_cycle_id,challenge_id" }
    );
  }

  done();
}

export async function createDirection(formData: FormData) {
  const { localContext, cycle } = await getMatrixContextOrRedirect();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) done();

  const ownerMembershipId = String(formData.get("owner_membership_id") ?? "").trim();
  const supabase = await createSupabaseServerClient();
  const { data: direction } = await supabase
    .schema("app")
    .from("strategic_directions")
    .insert({
      organization_id: localContext.organizationId,
      planning_cycle_id: cycle.id,
      title,
      owner_membership_id: ownerMembershipId || null,
      priority: Number(formData.get("priority") ?? 3),
      status: String(formData.get("status") ?? "draft"),
      grouping: String(formData.get("grouping") ?? "").trim() || null,
      created_by_membership_id: localContext.membershipId,
    })
    .select("id")
    .single();

  if (direction) {
    await supabase.schema("app").from("dashboard_row_config").upsert(
      {
        organization_id: localContext.organizationId,
        planning_cycle_id: cycle.id,
        direction_id: direction.id,
        display_order: Number(formData.get("display_order") ?? 999),
      },
      { onConflict: "planning_cycle_id,direction_id" }
    );
  }

  done();
}

export async function importExistingDirection(formData: FormData) {
  const { localContext, cycle } = await getMatrixContextOrRedirect();
  const directionId = String(formData.get("direction_id") ?? "");
  if (!directionId) done();

  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("dashboard_row_config").upsert(
    {
      organization_id: localContext.organizationId,
      planning_cycle_id: cycle.id,
      direction_id: directionId,
      display_order: Number(formData.get("display_order") ?? 999),
    },
    { onConflict: "planning_cycle_id,direction_id" }
  );

  done();
}

export async function updateDirection(formData: FormData) {
  const { localContext, cycle } = await getMatrixContextOrRedirect();
  const directionId = String(formData.get("direction_id") ?? "");
  const ownerMembershipId = String(formData.get("owner_membership_id") ?? "").trim();

  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("strategic_directions")
    .update({
      title: String(formData.get("title") ?? "").trim(),
      owner_membership_id: ownerMembershipId || null,
      priority: Number(formData.get("priority") ?? 3),
      status: String(formData.get("status") ?? "draft"),
      grouping: String(formData.get("grouping") ?? "").trim() || null,
    })
    .eq("id", directionId)
    .eq("organization_id", localContext.organizationId)
    .eq("planning_cycle_id", cycle.id);

  await supabase.schema("app").from("dashboard_row_config").upsert(
    {
      organization_id: localContext.organizationId,
      planning_cycle_id: cycle.id,
      direction_id: directionId,
      display_order: Number(formData.get("display_order") ?? 999),
    },
    { onConflict: "planning_cycle_id,direction_id" }
  );

  done();
}

export async function removeDirectionFromDashboard(formData: FormData) {
  const { localContext, cycle } = await getMatrixContextOrRedirect();
  const directionId = String(formData.get("direction_id") ?? "");
  if (!directionId) done();

  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .schema("app")
    .from("dashboard_row_config")
    .select("direction_id", { count: "exact", head: true })
    .eq("organization_id", localContext.organizationId)
    .eq("planning_cycle_id", cycle.id);

  if (!count) {
    const { data: directions } = await supabase
      .schema("app")
      .from("strategic_directions")
      .select("id")
      .eq("organization_id", localContext.organizationId)
      .eq("planning_cycle_id", cycle.id)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true });

    const entries = (directions ?? []).map((direction, idx) => ({
      organization_id: localContext.organizationId,
      planning_cycle_id: cycle.id,
      direction_id: direction.id,
      display_order: idx + 1,
    }));
    if (entries.length > 0) {
      await supabase
        .schema("app")
        .from("dashboard_row_config")
        .upsert(entries, { onConflict: "planning_cycle_id,direction_id" });
    }
  }

  await supabase
    .schema("app")
    .from("dashboard_row_config")
    .delete()
    .eq("organization_id", localContext.organizationId)
    .eq("planning_cycle_id", cycle.id)
    .eq("direction_id", directionId);

  done();
}

export async function upsertCell(formData: FormData) {
  const { localContext, cycle } = await getMatrixContextOrRedirect();
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("challenge_direction_links").upsert(
    {
      organization_id: localContext.organizationId,
      planning_cycle_id: cycle.id,
      strategic_direction_id: String(formData.get("direction_id")),
      strategic_challenge_id: String(formData.get("challenge_id")),
      contribution_level: String(formData.get("contribution_level") ?? "medium"),
      note: String(formData.get("note") ?? "").trim() || null,
      created_by_membership_id: localContext.membershipId,
    },
    { onConflict: "planning_cycle_id,strategic_direction_id,strategic_challenge_id" }
  );
  done();
}

export async function deleteCell(formData: FormData) {
  const { localContext, cycle } = await getMatrixContextOrRedirect();
  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("challenge_direction_links")
    .delete()
    .eq("organization_id", localContext.organizationId)
    .eq("planning_cycle_id", cycle.id)
    .eq("strategic_direction_id", String(formData.get("direction_id")))
    .eq("strategic_challenge_id", String(formData.get("challenge_id")));
  done();
}

export async function createAnnualTarget(formData: FormData) {
  const { localContext, cycle } = await getMatrixContextOrRedirect();
  const directionId = String(formData.get("direction_id") ?? "");

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .schema("app")
    .from("annual_targets")
    .select("id")
    .eq("organization_id", localContext.organizationId)
    .eq("planning_cycle_id", cycle.id)
    .eq("strategic_direction_id", directionId)
    .limit(1);

  await supabase.schema("app").from("annual_targets").insert({
    organization_id: localContext.organizationId,
    planning_cycle_id: cycle.id,
    strategic_direction_id: directionId,
    title: String(formData.get("title") ?? "").trim(),
    baseline: Number(formData.get("baseline") ?? 0),
    current_measure: Number(formData.get("current_measure") ?? 0),
    progress_percent: Number(formData.get("progress_percent") ?? 0),
    comment: String(formData.get("comment") ?? "").trim() || null,
    is_primary: !existing || existing.length === 0,
    created_by_membership_id: localContext.membershipId,
  });
  done();
}

export async function updateAnnualTarget(formData: FormData) {
  const { localContext, cycle } = await getMatrixContextOrRedirect();
  const targetId = String(formData.get("target_id") ?? "");

  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("annual_targets")
    .update({
      title: String(formData.get("title") ?? "").trim(),
      baseline: Number(formData.get("baseline") ?? 0),
      current_measure: Number(formData.get("current_measure") ?? 0),
      progress_percent: Number(formData.get("progress_percent") ?? 0),
      comment: String(formData.get("comment") ?? "").trim() || null,
    })
    .eq("id", targetId)
    .eq("organization_id", localContext.organizationId)
    .eq("planning_cycle_id", cycle.id);
  done();
}

export async function setPrimaryAnnualTarget(formData: FormData) {
  const { localContext, cycle } = await getMatrixContextOrRedirect();
  const directionId = String(formData.get("direction_id") ?? "");
  const targetId = String(formData.get("target_id") ?? "");

  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("annual_targets")
    .update({ is_primary: false })
    .eq("organization_id", localContext.organizationId)
    .eq("planning_cycle_id", cycle.id)
    .eq("strategic_direction_id", directionId);

  await supabase
    .schema("app")
    .from("annual_targets")
    .update({ is_primary: true })
    .eq("id", targetId)
    .eq("organization_id", localContext.organizationId)
    .eq("planning_cycle_id", cycle.id);

  done();
}

export async function addComment(formData: FormData) {
  const { localContext, cycle } = await getMatrixContextOrRedirect();
  const commentText = String(formData.get("comment_text") ?? "").trim();
  if (!commentText) done();

  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("dashboard_comments").insert({
    organization_id: localContext.organizationId,
    planning_cycle_id: cycle.id,
    object_type: String(formData.get("object_type") ?? "direction"),
    object_id: String(formData.get("object_id") ?? ""),
    comment_text: commentText,
    created_by_membership_id: localContext.membershipId,
  });
  done();
}
