"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildChallengeDefinitionPayload,
  buildDirectionDefinitionPayload,
  buildObjectiveDefinitionPayload,
  createStrategyObjectDraft,
  promoteStrategyObjectRevisionRpc,
  rejectStrategyObjectRevisionRpc,
  strategyObjectReturnPathForType,
  submitStrategyObjectRevisionRpc,
  updateStrategyObjectDraftRpc,
} from "@/lib/strategy-objects/write";
import { fetchRevisionById, fetchOpenDraftForIdentity } from "@/lib/strategy-objects/revision-queries";
import { normalizeStrategyRevisionErrorCode } from "@/lib/strategy-objects/revision-status-messages";
import {
  STRATEGY_OBJECT_ASSIGNMENT_LINK_CONFIG,
  assignmentKindsForObjectType,
  normalizeAssignmentKind,
  readAssignmentIds,
  toggleAssignmentId,
  writeAssignmentIds,
  type StrategyObjectAssignmentKind,
} from "@/lib/strategy-objects/assignments";
import type { StrategyObjectType } from "@/lib/strategy-objects/types";
import { getWorkspaceContextOrRedirectFromActions } from "@/app/(ceo)/strategy-cycle/action-context";
import {
  computeChallengeScore,
  computeDirectionPriorityFromAssessment,
} from "@/lib/strategy-cycle/scoring";

function readSmallIntField(formData: FormData, name: string, fallback: number): number {
  const raw = String(formData.get(name) ?? "").trim();
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(5, parsed));
}

function appendQuery(path: string, key: string, value: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}`;
}

function redirectWithResult(
  returnPath: string,
  result:
    | "draft-created"
    | "draft-updated"
    | "draft-promoted"
    | "draft-rejected"
    | "draft-submitted"
    | "draft-opened",
  draftId?: string
): never {
  let path = appendQuery(returnPath, "success", result);
  if (draftId && result !== "draft-promoted" && result !== "draft-rejected") {
    path = appendQuery(path, "strategy_draft", draftId);
  }
  redirect(path);
}

function redirectWithError(returnPath: string, error: string, fallbackCode = "draft-create-failed"): never {
  redirect(appendQuery(returnPath, "error", normalizeStrategyRevisionErrorCode(error, fallbackCode)));
}

type RevisionActionSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function readLiveAssignmentIds(
  supabase: RevisionActionSupabase,
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

async function syncChallengePrimaryAnalysisEntry(
  supabase: RevisionActionSupabase,
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

async function applyAnalysisEntryAssignments(
  supabase: RevisionActionSupabase,
  organizationId: string,
  cycleInstanceId: string,
  oldLegacyId: string | null,
  newLegacyId: string,
  entryIds: string[]
): Promise<void> {
  const clearIds = [...new Set([oldLegacyId, newLegacyId].filter((v): v is string => Boolean(v)))];
  for (const clearId of clearIds) {
    await supabase
      .schema("app")
      .from("strategic_challenge_analysis_entries")
      .delete()
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .eq("strategic_challenge_id", clearId);
  }

  const uniqueEntryIds = [...new Set(entryIds.filter(Boolean))];
  for (const entryId of uniqueEntryIds) {
    await supabase
      .schema("app")
      .from("strategic_challenge_analysis_entries")
      .delete()
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .eq("analysis_entry_id", entryId);
  }

  if (uniqueEntryIds.length > 0) {
    await supabase.schema("app").from("strategic_challenge_analysis_entries").insert(
      uniqueEntryIds.map((analysis_entry_id) => ({
        organization_id: organizationId,
        cycle_instance_id: cycleInstanceId,
        strategic_challenge_id: newLegacyId,
        analysis_entry_id,
      }))
    );
  }

  await syncChallengePrimaryAnalysisEntry(supabase, organizationId, cycleInstanceId, newLegacyId);
  if (oldLegacyId && oldLegacyId !== newLegacyId) {
    await syncChallengePrimaryAnalysisEntry(supabase, organizationId, cycleInstanceId, oldLegacyId);
  }
}

/** Beim Draft-Anlegen die aktuellen (Live-)Zuordnungen in den Draft-Payload einfrieren. */
async function snapshotLiveAssignmentsIntoPayload(
  supabase: RevisionActionSupabase,
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

/** Beim Promote die im Draft gesicherten Zuordnungen auf die neue Revision-ID anwenden. */
async function applyPayloadAssignmentsToLinkTables(
  supabase: RevisionActionSupabase,
  organizationId: string,
  objectType: StrategyObjectType,
  oldLegacyId: string | null,
  newLegacyId: string,
  cycleInstanceId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const cfg = STRATEGY_OBJECT_ASSIGNMENT_LINK_CONFIG[objectType];
  for (const kind of assignmentKindsForObjectType(objectType)) {
    if (kind === "analysis_entry" && objectType === "strategic_challenge") {
      const ids = readAssignmentIds(payload, kind);
      await applyAnalysisEntryAssignments(
        supabase,
        organizationId,
        cycleInstanceId,
        oldLegacyId,
        newLegacyId,
        ids
      );
      continue;
    }

    const tableCfg = cfg.tables[kind];
    if (!tableCfg) continue;
    const { table, valueColumn } = tableCfg;
    const ids = readAssignmentIds(payload, kind);
    const clearIds = [...new Set([oldLegacyId, newLegacyId].filter((v): v is string => Boolean(v)))];
    for (const clearId of clearIds) {
      await supabase
        .schema("app")
        .from(table)
        .delete()
        .eq("organization_id", organizationId)
        .eq("cycle_instance_id", cycleInstanceId)
        .eq(cfg.idColumn, clearId);
    }
    if (ids.length > 0) {
      await supabase
        .schema("app")
        .from(table)
        .insert(
          ids.map((value) => ({
            organization_id: organizationId,
            cycle_instance_id: cycleInstanceId,
            [cfg.idColumn]: newLegacyId,
            [valueColumn]: value,
          }))
        );
    }
  }
}

async function toggleStrategyObjectDraftAssignment(formData: FormData, op: "link" | "unlink") {
  const context = await getWorkspaceContextOrRedirectFromActions();
  const revisionId = String(formData.get("revision_id") ?? "").trim();
  const kind = normalizeAssignmentKind(formData.get("assignment_kind"));
  const assignmentId = String(formData.get("assignment_id") ?? "").trim();
  const returnPath =
    String(formData.get("return_path") ?? "/strategy-cycle").trim() || "/strategy-cycle";
  const noRedirect = formData.get("_noRedirect") === "1";

  if (!revisionId || !kind || !assignmentId) {
    if (noRedirect) return;
    redirectWithError(returnPath, "missing-assignment", "draft-update-failed");
  }

  const supabase = await createSupabaseServerClient();
  const revision = await fetchRevisionById(context.organizationId, revisionId, { supabase });
  if (!revision) {
    if (noRedirect) return;
    redirectWithError(returnPath, "revision-not-found", "draft-update-failed");
  }

  if (
    kind === "analysis_entry" &&
    revision.object_type !== "strategic_challenge"
  ) {
    if (noRedirect) return;
    redirectWithError(returnPath, "invalid-assignment-kind", "draft-update-failed");
  }

  const payload = toggleAssignmentId(revision.definition_payload, kind, assignmentId, op);
  const result = await updateStrategyObjectDraftRpc(
    supabase,
    revisionId,
    revision.title,
    revision.description,
    payload
  );

  revalidatePath("/strategy-cycle");
  revalidatePath("/strategy-matrix");
  if (noRedirect) return;
  if (!result.ok) {
    redirectWithError(returnPath, result.code ?? "draft-update-failed", "draft-update-failed");
  }
  redirectWithResult(returnPath, "draft-updated", revisionId);
}

export async function linkStrategyObjectDraftAssignment(formData: FormData) {
  return toggleStrategyObjectDraftAssignment(formData, "link");
}

export async function unlinkStrategyObjectDraftAssignment(formData: FormData) {
  return toggleStrategyObjectDraftAssignment(formData, "unlink");
}

export async function proposeStrategyObjectDraft(formData: FormData) {
  const context = await getWorkspaceContextOrRedirectFromActions();
  const baseRevisionId = String(formData.get("base_revision_id") ?? "").trim();
  const returnPath = String(formData.get("return_path") ?? "/strategy-cycle").trim() || "/strategy-cycle";

  if (!baseRevisionId) {
    redirectWithError(returnPath, "missing-revision-id");
  }

  const supabase = await createSupabaseServerClient();
  const baseRevision = await fetchRevisionById(context.organizationId, baseRevisionId, { supabase });
  const result = await createStrategyObjectDraft(supabase, baseRevisionId);
  if (!result.ok) {
    if (result.code === "strategy-object-draft-already-exists") {
      const openDraft =
        baseRevision != null
          ? await fetchOpenDraftForIdentity(
              context.organizationId,
              baseRevision.object_identity_id,
              baseRevision.cycle_instance_id,
              { supabase }
            )
          : null;
      if (openDraft) {
        revalidatePath("/strategy-cycle");
        redirectWithResult(returnPath, "draft-opened", openDraft.id);
      }
      redirectWithError(returnPath, "strategy-object-draft-already-exists", "draft-create-failed");
    }
    redirectWithError(returnPath, result.code ?? "draft-create-failed", "draft-create-failed");
  }

  const newDraftId = result.data;
  if (newDraftId && baseRevision) {
    const draft = await fetchRevisionById(context.organizationId, newDraftId, { supabase });
    if (draft) {
      const payloadWithAssignments = await snapshotLiveAssignmentsIntoPayload(
        supabase,
        context.organizationId,
        baseRevision.object_type,
        baseRevisionId,
        baseRevision.cycle_instance_id,
        draft.definition_payload
      );
      await updateStrategyObjectDraftRpc(
        supabase,
        newDraftId,
        draft.title,
        draft.description,
        payloadWithAssignments
      );
    }
  }

  revalidatePath("/strategy-cycle");
  redirectWithResult(returnPath, "draft-created", newDraftId);
}

export async function updateStrategyObjectDraft(formData: FormData) {
  const context = await getWorkspaceContextOrRedirectFromActions();
  const revisionId = String(formData.get("revision_id") ?? "").trim();
  const returnPath = String(formData.get("return_path") ?? "/strategy-cycle").trim() || "/strategy-cycle";
  const objectType = String(formData.get("object_type") ?? "").trim();

  if (!revisionId) {
    redirectWithError(returnPath, "missing-revision-id");
  }

  const supabase = await createSupabaseServerClient();
  const revision = await fetchRevisionById(context.organizationId, revisionId, { supabase });
  if (!revision) {
    redirectWithError(returnPath, "revision-not-found");
  }

  const title = String(formData.get("title") ?? revision.title).trim();
  if (!title) {
    redirectWithError(returnPath, "missing-title");
  }
  const description = String(formData.get("description") ?? "").trim() || null;

  let definitionPayload = revision.definition_payload;
  if (objectType === "strategic_objective" || revision.object_type === "strategic_objective") {
    definitionPayload = buildObjectiveDefinitionPayload(definitionPayload, {
      timeHorizon: String(formData.get("time_horizon") ?? "").trim() || null,
      importanceScore: readSmallIntField(formData, "importance_score", 3),
    });
  } else if (objectType === "strategic_challenge" || revision.object_type === "strategic_challenge") {
    const impactScore = readSmallIntField(formData, "impact_score", 3);
    const urgencyScore = readSmallIntField(formData, "urgency_score", 3);
    const scopeScore = readSmallIntField(formData, "scope_score", 3);
    const rootCauseScore = readSmallIntField(formData, "root_cause_score", 3);
    const challengeScore = computeChallengeScore({
      impactScore,
      urgencyScore,
      scopeScore,
      rootCauseScore,
    });
    definitionPayload = buildChallengeDefinitionPayload(definitionPayload, {
      impactScore,
      urgencyScore,
      scopeScore,
      rootCauseScore,
      challengeScore,
      relevanceLevel: impactScore,
      riskLevel: urgencyScore,
    });
  } else if (objectType === "strategic_direction" || revision.object_type === "strategic_direction") {
    const strategicValueScore = readSmallIntField(formData, "strategic_value_score", 3);
    const capabilityFitScore = readSmallIntField(formData, "capability_fit_score", 3);
    const feasibilityScore = readSmallIntField(formData, "feasibility_score", 3);
    const riskLevel = readSmallIntField(formData, "risk_score", 3);
    const priority = computeDirectionPriorityFromAssessment({
      strategicValueScore,
      capabilityFitScore,
      feasibilityScore,
      riskScore: riskLevel,
    });
    definitionPayload = buildDirectionDefinitionPayload(definitionPayload, {
      priority,
      grouping: String(formData.get("grouping") ?? "").trim() || null,
      strategicValueScore,
      capabilityFitScore,
      feasibilityScore,
      riskLevel,
      relevanceLevel: strategicValueScore,
    });
  }

  const result = await updateStrategyObjectDraftRpc(supabase, revisionId, title, description, definitionPayload);
  if (!result.ok) {
    redirectWithError(returnPath, result.code ?? "draft-update-failed", "draft-update-failed");
  }

  revalidatePath("/strategy-cycle");
  redirectWithResult(returnPath, "draft-updated", revisionId);
}

export async function submitStrategyObjectRevision(formData: FormData) {
  const context = await getWorkspaceContextOrRedirectFromActions();
  const revisionId = String(formData.get("revision_id") ?? "").trim();
  const returnPath = String(formData.get("return_path") ?? "/strategy-cycle").trim() || "/strategy-cycle";

  if (!revisionId) {
    redirectWithError(returnPath, "missing-revision-id");
  }

  const supabase = await createSupabaseServerClient();
  const result = await submitStrategyObjectRevisionRpc(supabase, revisionId);
  if (!result.ok) {
    redirectWithError(returnPath, result.code ?? "draft-submit-failed");
  }

  revalidatePath("/strategy-cycle");
  redirectWithResult(returnPath, "draft-submitted", revisionId);
}

export async function promoteStrategyObjectRevision(formData: FormData) {
  const context = await getWorkspaceContextOrRedirectFromActions();
  const revisionId = String(formData.get("revision_id") ?? "").trim();
  const returnPath = String(formData.get("return_path") ?? "/strategy-cycle").trim() || "/strategy-cycle";

  if (!revisionId) {
    redirectWithError(returnPath, "missing-revision-id");
  }

  const supabase = await createSupabaseServerClient();
  const revision = await fetchRevisionById(context.organizationId, revisionId, { supabase });

  let oldCurrentId: string | null = null;
  if (revision) {
    const { data: currentRow } = await supabase
      .schema("app")
      .from("strategy_object_revisions")
      .select("id")
      .eq("organization_id", context.organizationId)
      .eq("object_identity_id", revision.object_identity_id)
      .eq("cycle_instance_id", revision.cycle_instance_id)
      .eq("revision_state", "current")
      .maybeSingle();
    oldCurrentId = currentRow?.id ?? null;
  }

  const result = await promoteStrategyObjectRevisionRpc(supabase, revisionId);
  if (!result.ok) {
    redirectWithError(returnPath, result.code ?? "draft-promote-failed", "draft-promote-failed");
  }

  if (revision) {
    await applyPayloadAssignmentsToLinkTables(
      supabase,
      context.organizationId,
      revision.object_type,
      oldCurrentId,
      revisionId,
      revision.cycle_instance_id,
      revision.definition_payload
    );
  }

  revalidatePath("/strategy-cycle");
  let path =
    revision != null
      ? strategyObjectReturnPathForType(revision.object_type)
      : returnPath.split("&strategy_draft")[0].split("?strategy_draft")[0];
  // Nur Ziele haben eine Sentinel-LLM-Bewertung. Die neue aktive Legacy-Zeile hat id = revisionId.
  if (revision?.object_type === "strategic_objective") {
    path = appendQuery(path, "eval_objective", revisionId);
  }
  redirectWithResult(path, "draft-promoted");
}

export async function rejectStrategyObjectRevision(formData: FormData) {
  const context = await getWorkspaceContextOrRedirectFromActions();
  const revisionId = String(formData.get("revision_id") ?? "").trim();
  const returnPath = String(formData.get("return_path") ?? "/strategy-cycle").trim() || "/strategy-cycle";

  if (!revisionId) {
    redirectWithError(returnPath, "missing-revision-id");
  }

  const supabase = await createSupabaseServerClient();
  const revision = await fetchRevisionById(context.organizationId, revisionId, { supabase });
  const result = await rejectStrategyObjectRevisionRpc(supabase, revisionId);
  if (!result.ok) {
    redirectWithError(returnPath, result.code ?? "draft-reject-failed", "draft-reject-failed");
  }

  revalidatePath("/strategy-cycle");
  const path =
    revision != null
      ? strategyObjectReturnPathForType(revision.object_type)
      : returnPath.split("&strategy_draft")[0].split("?strategy_draft")[0];
  redirectWithResult(path, "draft-rejected");
}
