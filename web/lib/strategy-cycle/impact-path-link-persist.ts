import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { isObjectiveEligibleForDirectionLink } from "@/lib/strategy-cycle/objective-direction-link-eligibility";
import {
  assignmentKindsForObjectType,
  readAssignmentIds,
  STRATEGY_OBJECT_ASSIGNMENT_LINK_CONFIG,
  toggleAssignmentId,
  writeAssignmentIds,
  type StrategyObjectAssignmentKind,
} from "@/lib/strategy-objects/assignments";
import { assertStrategyObjectDefinitionEditable } from "@/lib/strategy-objects/governance-server";
import {
  fetchOpenDraftForIdentity,
  fetchRevisionById,
} from "@/lib/strategy-objects/revision-queries";
import type { StrategyObjectType } from "@/lib/strategy-objects/types";
import {
  createStrategyObjectDraft,
  updateStrategyObjectDraftRpc,
} from "@/lib/strategy-objects/write";
import { fetchVersioningMetaForRevisionId } from "@/lib/strategy-objects/queries";

function logPersistError(table: string, error: { message?: string } | null): void {
  if (error?.message) {
    console.error(`[impact-path-link-persist] ${table}:`, error.message);
  }
}

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type PersistPathLinkResult =
  | { ok: true; viaDraft: boolean }
  | { ok: false; error: string };

type WorkspaceContext = {
  organizationId: string;
  cycleId: string;
  membershipId: string;
};

async function readLiveAssignmentIds(
  supabase: SupabaseClient,
  organizationId: string,
  objectType: StrategyObjectType,
  legacyObjectId: string,
  cycleInstanceId: string,
  kind: StrategyObjectAssignmentKind
): Promise<string[]> {
  const tableCfg = STRATEGY_OBJECT_ASSIGNMENT_LINK_CONFIG[objectType].tables[kind];
  if (!tableCfg) return [];
  const cfg = STRATEGY_OBJECT_ASSIGNMENT_LINK_CONFIG[objectType];
  const { table, valueColumn } = tableCfg;
  const { data } = await supabase
    .schema("app")
    .from(table)
    .select(valueColumn)
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .eq(cfg.idColumn, legacyObjectId);
  return (data ?? [])
    .map((row) => (row as unknown as Record<string, unknown>)[valueColumn])
    .filter((value): value is string => typeof value === "string");
}

async function snapshotLiveAssignmentsIntoPayload(
  supabase: SupabaseClient,
  organizationId: string,
  objectType: StrategyObjectType,
  legacyObjectId: string,
  cycleInstanceId: string,
  basePayload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  let payload = basePayload;
  for (const kind of assignmentKindsForObjectType(objectType)) {
    const ids = await readLiveAssignmentIds(
      supabase,
      organizationId,
      objectType,
      legacyObjectId,
      cycleInstanceId,
      kind
    );
    payload = writeAssignmentIds(payload, kind, ids);
  }
  return payload;
}

async function resolveRevisionForPathLinkEdit(
  supabase: SupabaseClient,
  context: WorkspaceContext,
  baseRevisionId: string
): Promise<{ ok: true; revisionId: string; viaDraft: boolean } | { ok: false; error: string }> {
  const lockCheck = await assertStrategyObjectDefinitionEditable(supabase, baseRevisionId);
  if (lockCheck.ok) {
    return { ok: true, revisionId: baseRevisionId, viaDraft: false };
  }

  const currentRevision = await fetchRevisionById(context.organizationId, baseRevisionId, {
    supabase,
  });
  if (!currentRevision) {
    return { ok: false, error: "revision-not-found" };
  }

  let draftRevision =
    (await fetchOpenDraftForIdentity(
      context.organizationId,
      currentRevision.object_identity_id,
      context.cycleId,
      { supabase }
    )) ?? null;

  if (!draftRevision) {
    const created = await createStrategyObjectDraft(supabase, baseRevisionId);
    if (!created.ok) {
      if (created.code === "strategy-object-draft-already-exists") {
        draftRevision = await fetchOpenDraftForIdentity(
          context.organizationId,
          currentRevision.object_identity_id,
          context.cycleId,
          { supabase }
        );
      }
      if (!draftRevision) {
        return { ok: false, error: created.code ?? "draft-create-failed" };
      }
    } else if (created.data) {
      draftRevision = await fetchRevisionById(context.organizationId, created.data, { supabase });
      if (draftRevision) {
        const payloadWithAssignments = await snapshotLiveAssignmentsIntoPayload(
          supabase,
          context.organizationId,
          currentRevision.object_type,
          baseRevisionId,
          context.cycleId,
          draftRevision.definition_payload
        );
        const updateResult = await updateStrategyObjectDraftRpc(
          supabase,
          draftRevision.id,
          draftRevision.title,
          draftRevision.description,
          payloadWithAssignments
        );
        if (!updateResult.ok) {
          return { ok: false, error: updateResult.code ?? "draft-update-failed" };
        }
      }
    }
  }

  if (!draftRevision) {
    return { ok: false, error: "draft-create-failed" };
  }

  return { ok: true, revisionId: draftRevision.id, viaDraft: true };
}

/** Link-Tabellen verweisen auf strategic_directions.id — immer die Live-ID aus dem Graph. */
async function ensureDirectionDraftIfDefinitionLocked(
  supabase: SupabaseClient,
  context: WorkspaceContext,
  directionId: string
): Promise<{ ok: true; viaDraft: boolean } | { ok: false; error: string }> {
  const lockCheck = await assertStrategyObjectDefinitionEditable(supabase, directionId);
  if (lockCheck.ok) return { ok: true, viaDraft: false };
  const resolved = await resolveRevisionForPathLinkEdit(supabase, context, directionId);
  if (!resolved.ok) return resolved;
  return { ok: true, viaDraft: resolved.viaDraft };
}

async function assertLiveDirectionInCycle(
  supabase: SupabaseClient,
  context: WorkspaceContext,
  directionId: string
): Promise<PersistPathLinkResult | null> {
  const { data } = await supabase
    .schema("app")
    .from("strategic_directions")
    .select("id")
    .eq("id", directionId)
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .maybeSingle();
  if (!data) return { ok: false, error: "direction-not-found" };
  return null;
}

async function assertLiveChallengeInCycle(
  supabase: SupabaseClient,
  context: WorkspaceContext,
  challengeId: string
): Promise<PersistPathLinkResult | null> {
  const { data } = await supabase
    .schema("app")
    .from("strategic_challenges")
    .select("id")
    .eq("id", challengeId)
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .maybeSingle();
  if (!data) return { ok: false, error: "revision-not-found" };
  return null;
}

async function syncChallengePrimaryAnalysisEntry(
  supabase: SupabaseClient,
  organizationId: string,
  cycleId: string,
  challengeId: string
): Promise<void> {
  const { data: rows } = await supabase
    .schema("app")
    .from("strategic_challenge_analysis_entries")
    .select("analysis_entry_id")
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleId)
    .eq("strategic_challenge_id", challengeId)
    .order("created_at", { ascending: true });
  const primary = (rows?.[0] as { analysis_entry_id?: string } | undefined)?.analysis_entry_id ?? null;
  await supabase
    .schema("app")
    .from("strategic_challenges")
    .update({ source_analysis_entry_id: primary })
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleId)
    .eq("id", challengeId);
}

export async function persistAnalysisToChallengePathLink(
  supabase: SupabaseClient,
  context: WorkspaceContext,
  analysisEntryId: string,
  challengeId: string
): Promise<PersistPathLinkResult> {
  const { data: entryRow } = await supabase
    .schema("app")
    .from("analysis_entries")
    .select("id")
    .eq("id", analysisEntryId)
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .maybeSingle();
  if (!entryRow) return { ok: false, error: "analysis-entry-not-found" };

  const resolved = await resolveRevisionForPathLinkEdit(supabase, context, challengeId);
  if (!resolved.ok) return resolved;

  if (resolved.viaDraft) {
    const draft = await fetchRevisionById(context.organizationId, resolved.revisionId, { supabase });
    if (!draft || draft.object_type !== "strategic_challenge") {
      return { ok: false, error: "revision-not-found" };
    }
    const currentIds = readAssignmentIds(draft.definition_payload, "analysis_entry");
    if (currentIds.includes(analysisEntryId)) {
      return { ok: true, viaDraft: true };
    }
    const payload = toggleAssignmentId(draft.definition_payload, "analysis_entry", analysisEntryId, "link");
    const updateResult = await updateStrategyObjectDraftRpc(
      supabase,
      draft.id,
      draft.title,
      draft.description,
      payload
    );
    if (!updateResult.ok) {
      return { ok: false, error: updateResult.code ?? "draft-update-failed" };
    }
    return { ok: true, viaDraft: true };
  }

  const { data: existing } = await supabase
    .schema("app")
    .from("strategic_challenge_analysis_entries")
    .select("strategic_challenge_id")
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("analysis_entry_id", analysisEntryId)
    .maybeSingle();
  const prevChallengeId = existing?.strategic_challenge_id as string | undefined;
  if (prevChallengeId && prevChallengeId !== challengeId) {
    await supabase
      .schema("app")
      .from("strategic_challenge_analysis_entries")
      .delete()
      .eq("organization_id", context.organizationId)
      .eq("cycle_instance_id", context.cycleId)
      .eq("analysis_entry_id", analysisEntryId);
    await syncChallengePrimaryAnalysisEntry(
      supabase,
      context.organizationId,
      context.cycleId,
      prevChallengeId
    );
  }
  if (prevChallengeId !== challengeId) {
    const { error } = await supabase.schema("app").from("strategic_challenge_analysis_entries").insert({
      organization_id: context.organizationId,
      cycle_instance_id: context.cycleId,
      strategic_challenge_id: challengeId,
      analysis_entry_id: analysisEntryId,
    });
    if (error) {
      logPersistError("strategic_challenge_analysis_entries", error);
      return { ok: false, error: "link-failed" };
    }
    await syncChallengePrimaryAnalysisEntry(
      supabase,
      context.organizationId,
      context.cycleId,
      challengeId
    );
  }
  return { ok: true, viaDraft: false };
}

export async function persistChallengeToDirectionPathLink(
  supabase: SupabaseClient,
  context: WorkspaceContext,
  challengeId: string,
  directionId: string
): Promise<PersistPathLinkResult> {
  const challengeCheck = await assertLiveChallengeInCycle(supabase, context, challengeId);
  if (challengeCheck) return challengeCheck;
  const directionCheck = await assertLiveDirectionInCycle(supabase, context, directionId);
  if (directionCheck) return directionCheck;

  const draftState = await ensureDirectionDraftIfDefinitionLocked(supabase, context, directionId);
  if (!draftState.ok) return draftState;

  const { error } = await supabase.schema("app").from("challenge_direction_links").upsert(
    {
      organization_id: context.organizationId,
      cycle_instance_id: context.cycleId,
      strategic_direction_id: directionId,
      strategic_challenge_id: challengeId,
      contribution_level: "medium",
      created_by_membership_id: context.membershipId,
    },
    { onConflict: "cycle_instance_id,strategic_direction_id,strategic_challenge_id" }
  );
  if (error) {
    logPersistError("challenge_direction_links", error);
    return { ok: false, error: "link-failed" };
  }
  return { ok: true, viaDraft: draftState.viaDraft };
}

export async function persistDirectionToObjectivePathLink(
  supabase: SupabaseClient,
  context: WorkspaceContext,
  directionId: string,
  objectiveId: string
): Promise<PersistPathLinkResult> {
  const directionCheck = await assertLiveDirectionInCycle(supabase, context, directionId);
  if (directionCheck) return directionCheck;

  const draftState = await ensureDirectionDraftIfDefinitionLocked(supabase, context, directionId);
  if (!draftState.ok) return draftState;

  const { data: objective } = await supabase
    .schema("app")
    .from("strategy_objectives")
    .select("id")
    .eq("id", objectiveId)
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .maybeSingle();
  if (!objective) return { ok: false, error: "objective-not-linkable" };

  const { data: existingLink } = await supabase
    .schema("app")
    .from("strategic_direction_objective_links")
    .select("strategic_direction_id")
    .eq("organization_id", context.organizationId)
    .eq("cycle_instance_id", context.cycleId)
    .eq("strategic_direction_id", directionId)
    .eq("strategy_objective_id", objectiveId)
    .maybeSingle();

  const objectiveVersioning = await fetchVersioningMetaForRevisionId(
    context.organizationId,
    context.cycleId,
    objectiveId,
    { supabase }
  );
  if (!isObjectiveEligibleForDirectionLink(objectiveVersioning) && !existingLink) {
    return { ok: false, error: "objective-not-linkable" };
  }

  const { error } = await supabase.schema("app").from("strategic_direction_objective_links").upsert(
    {
      organization_id: context.organizationId,
      cycle_instance_id: context.cycleId,
      strategic_direction_id: directionId,
      strategy_objective_id: objectiveId,
      contribution_level: "medium",
      created_by_membership_id: context.membershipId,
    },
    { onConflict: "cycle_instance_id,strategic_direction_id,strategy_objective_id" }
  );
  if (error) {
    logPersistError("strategic_direction_objective_links", error);
    return { ok: false, error: "link-failed" };
  }
  return { ok: true, viaDraft: draftState.viaDraft };
}
