import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StrategyObjectType } from "./types";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type StrategyObjectWriteResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export function strategyObjectRpcErrorMessage(code: string): string {
  switch (code) {
    case "strategy-object-auth-required":
      return "Nicht angemeldet.";
    case "strategy-object-write-forbidden":
      return "Keine Berechtigung für Strategieobjekt-Änderungen.";
    case "strategy-object-revision-not-found":
      return "Revision nicht gefunden.";
    case "strategy-object-definition-locked":
      return "Definition ist gesperrt. Bitte einen Revisionsvorschlag erstellen.";
    case "strategy-object-draft-base-not-current":
      return "Nur von der aktuellen Revision kann ein Entwurf erstellt werden.";
    case "strategy-object-draft-already-exists":
      return "Es existiert bereits ein offener Revisionsentwurf.";
    case "strategy-object-revision-not-editable":
      return "Diese Revision ist nicht bearbeitbar.";
    case "strategy-object-revision-not-submittable":
      return "Diese Revision kann nicht eingereicht werden.";
    case "strategy-object-revision-not-rejectable":
      return "Diese Revision kann nicht abgelehnt werden.";
    case "strategy-object-revision-not-promotable":
      return "Diese Revision kann nicht freigegeben werden.";
    case "strategy-object-current-revision-missing":
      return "Aktuelle Revision fehlt.";
    case "strategy-object-identity-not-found":
      return "Objekt-Identität nicht gefunden.";
    case "draft-create-failed":
      return "Revisionsentwurf konnte nicht erstellt werden.";
    case "draft-update-failed":
      return "Revisionsentwurf konnte nicht gespeichert werden.";
    case "draft-submit-failed":
      return "Revision konnte nicht eingereicht werden.";
    case "draft-promote-failed":
      return "Revision konnte nicht freigegeben werden.";
    case "draft-reject-failed":
      return "Revisionsentwurf konnte nicht verworfen werden.";
    default:
      return "Vorgang fehlgeschlagen.";
  }
}

function parseRpcError(error: { message?: string } | null): { code: string; message: string } {
  const raw = String(error?.message ?? "").trim();
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as { message?: string };
      const inner = String(parsed.message ?? "").trim();
      if (inner.includes("strategy-object-")) {
        const code = inner.split("\n")[0]?.trim() ?? inner;
        return { code, message: strategyObjectRpcErrorMessage(code) };
      }
    } catch {
      // ignore JSON parse errors
    }
  }
  const code = raw.includes("strategy-object-") ? raw.split("\n")[0]?.trim() ?? raw : raw;
  return {
    code,
    message: code.startsWith("strategy-object-")
      ? strategyObjectRpcErrorMessage(code)
      : raw || strategyObjectRpcErrorMessage("unknown"),
  };
}

export async function assertStrategyObjectDefinitionEditableRpc(
  supabase: SupabaseClient,
  revisionId: string
): Promise<StrategyObjectWriteResult<null>> {
  const { error } = await supabase.schema("app").rpc("assert_strategy_object_definition_editable", {
    p_revision_id: revisionId,
  });
  if (error) {
    const parsed = parseRpcError(error);
    return { ok: false, error: parsed.message, code: parsed.code };
  }
  return { ok: true, data: null };
}

export async function createStrategyObjectDraft(
  supabase: SupabaseClient,
  baseRevisionId: string
): Promise<StrategyObjectWriteResult<string>> {
  const { data, error } = await supabase.schema("app").rpc("create_strategy_object_draft", {
    p_base_revision_id: baseRevisionId,
  });
  if (error) {
    const parsed = parseRpcError(error);
    return { ok: false, error: parsed.message, code: parsed.code };
  }
  if (typeof data !== "string" || !data) {
    return { ok: false, error: "Keine Draft-Revision-ID zurückgegeben." };
  }
  return { ok: true, data };
}

export async function updateStrategyObjectDraftRpc(
  supabase: SupabaseClient,
  revisionId: string,
  title: string,
  description: string | null,
  definitionPayload: Record<string, unknown>
): Promise<StrategyObjectWriteResult<null>> {
  const { error } = await supabase.schema("app").rpc("update_strategy_object_draft", {
    p_revision_id: revisionId,
    p_title: title,
    p_description: description,
    p_definition_payload: definitionPayload,
  });
  if (error) {
    const parsed = parseRpcError(error);
    return { ok: false, error: parsed.message, code: parsed.code };
  }
  return { ok: true, data: null };
}

export async function submitStrategyObjectRevisionRpc(
  supabase: SupabaseClient,
  revisionId: string
): Promise<StrategyObjectWriteResult<null>> {
  const { error } = await supabase.schema("app").rpc("submit_strategy_object_revision", {
    p_revision_id: revisionId,
  });
  if (error) {
    const parsed = parseRpcError(error);
    return { ok: false, error: parsed.message, code: parsed.code };
  }
  return { ok: true, data: null };
}

export async function promoteStrategyObjectRevisionRpc(
  supabase: SupabaseClient,
  revisionId: string
): Promise<StrategyObjectWriteResult<string>> {
  const { data, error } = await supabase.schema("app").rpc("promote_strategy_object_revision", {
    p_revision_id: revisionId,
  });
  if (error) {
    const parsed = parseRpcError(error);
    return { ok: false, error: parsed.message, code: parsed.code };
  }
  if (typeof data !== "string" || !data) {
    return { ok: false, error: "Keine Revisions-ID nach Promotion zurückgegeben." };
  }
  return { ok: true, data };
}

export async function rejectStrategyObjectRevisionRpc(
  supabase: SupabaseClient,
  revisionId: string
): Promise<StrategyObjectWriteResult<null>> {
  const { error } = await supabase.schema("app").rpc("reject_strategy_object_revision", {
    p_revision_id: revisionId,
  });
  if (error) {
    const parsed = parseRpcError(error);
    return { ok: false, error: parsed.message, code: parsed.code };
  }
  return { ok: true, data: null };
}

export function buildObjectiveDefinitionPayload(
  existing: Record<string, unknown>,
  fields: {
    timeHorizon: string | null;
    importanceScore: number;
  }
): Record<string, unknown> {
  return {
    ...existing,
    time_horizon: fields.timeHorizon,
    importance_score: fields.importanceScore,
  };
}

export function buildChallengeDefinitionPayload(
  existing: Record<string, unknown>,
  fields: {
    impactScore: number;
    urgencyScore: number;
    scopeScore: number;
    rootCauseScore: number;
    challengeScore: number;
    relevanceLevel: number;
    riskLevel: number;
  }
): Record<string, unknown> {
  return {
    ...existing,
    impact_score: fields.impactScore,
    urgency_score: fields.urgencyScore,
    scope_score: fields.scopeScore,
    root_cause_score: fields.rootCauseScore,
    challenge_score: fields.challengeScore,
    relevance_level: fields.relevanceLevel,
    risk_level: fields.riskLevel,
  };
}

export function buildDirectionDefinitionPayload(
  existing: Record<string, unknown>,
  fields: {
    priority: number;
    grouping: string | null;
    strategicValueScore: number;
    capabilityFitScore: number;
    feasibilityScore: number;
    riskLevel: number;
    relevanceLevel: number;
  }
): Record<string, unknown> {
  return {
    ...existing,
    priority: fields.priority,
    grouping: fields.grouping,
    strategic_value_score: fields.strategicValueScore,
    capability_fit_score: fields.capabilityFitScore,
    feasibility_score: fields.feasibilityScore,
    risk_level: fields.riskLevel,
    relevance_level: fields.relevanceLevel,
  };
}

export function strategyObjectReturnPathForType(objectType: StrategyObjectType): string {
  if (objectType === "strategic_objective") return "/strategy-cycle?l1=objectives";
  if (objectType === "strategic_challenge") {
    return "/strategy-cycle?l1=strategic-directions&l2=challenges";
  }
  return "/strategy-cycle?l1=strategic-directions&l2=design";
}
