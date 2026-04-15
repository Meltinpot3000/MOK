import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchOkrObjectiveLeadingDirectionId(
  supabase: SupabaseClient,
  organizationId: string,
  cycleInstanceId: string,
  okrObjectiveId: string
): Promise<string | null> {
  const { data: j } = await supabase
    .schema("app")
    .from("okr_objective_strategy_objectives")
    .select("strategy_objective_id")
    .eq("okr_objective_id", okrObjectiveId)
    .maybeSingle();
  const sid = j?.strategy_objective_id as string | undefined;
  if (!sid) return null;
  const { data: l } = await supabase
    .schema("app")
    .from("strategic_direction_objective_links")
    .select("strategic_direction_id")
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .eq("strategy_objective_id", sid)
    .maybeSingle();
  return (l?.strategic_direction_id as string | undefined) ?? null;
}

export type OkrObjectiveHeadSnapshot = {
  title: string;
  description: string | null;
  leadingStrategicDirectionId: string | null;
  ownerMembershipId: string | null;
  deputyMembershipId: string | null;
};

export type KrDefinitionSnapshot = {
  id: string;
  title: string;
  metricType: string;
  startValue: number | null;
  targetValue: number | null;
  measurementUnit: string | null;
};

/** Objective-Kopf: Freigabe-relevante Felder (MVP gemäß Plan). */
export function isObjectiveChangeApprovalRelevant(
  prev: OkrObjectiveHeadSnapshot,
  next: OkrObjectiveHeadSnapshot
): boolean {
  const pt = prev.title.trim();
  const nt = next.title.trim();
  const pd = (prev.description ?? "").trim();
  const nd = (next.description ?? "").trim();
  const pDir = prev.leadingStrategicDirectionId ?? "";
  const nDir = next.leadingStrategicDirectionId ?? "";
  const po = prev.ownerMembershipId ?? "";
  const no = next.ownerMembershipId ?? "";
  const pdep = prev.deputyMembershipId ?? "";
  const ndep = next.deputyMembershipId ?? "";
  return pt !== nt || pd !== nd || pDir !== nDir || po !== no || pdep !== ndep;
}

/** KR-Definitionsfelder (nicht Fortschritt/Check-in/Kommentar). */
export function isKeyResultDefinitionChangeRelevant(
  prev: KrDefinitionSnapshot,
  next: {
    title: string;
    metricType: string;
    startValue: number | null;
    targetValue: number | null;
    measurementUnit: string | null;
  }
): boolean {
  return (
    prev.title.trim() !== next.title.trim() ||
    prev.metricType !== next.metricType ||
    prev.startValue !== next.startValue ||
    prev.targetValue !== next.targetValue ||
    (prev.measurementUnit ?? "") !== (next.measurementUnit ?? "")
  );
}

export async function invalidateOkrObjectiveApproval(params: {
  supabase: SupabaseClient;
  organizationId: string;
  objectiveId: string;
  membershipId: string;
  reason: string;
}): Promise<{ error?: string }> {
  const { supabase, organizationId, objectiveId, membershipId, reason } = params;
  const now = new Date().toISOString();
  const { error } = await supabase
    .schema("app")
    .from("okr_objectives")
    .update({
      status: "draft",
      approval_invalidated_at: now,
      approval_invalidated_by_membership_id: membershipId,
      approval_invalidation_reason: reason,
      updated_at: now,
    })
    .eq("id", objectiveId)
    .eq("organization_id", organizationId)
    .eq("status", "active");

  if (error) return { error: error.message };
  return {};
}

/** Strategie-Objective im Planungszyklus (Tabelle app.strategy_objectives). */
export type StrategyObjectiveHeadSnapshot = {
  title: string;
  description: string | null;
  time_horizon: string | null;
  importance_score: number | null;
};

export function isStrategyObjectiveChangeApprovalRelevant(
  prev: StrategyObjectiveHeadSnapshot,
  next: StrategyObjectiveHeadSnapshot
): boolean {
  const pt = prev.title.trim();
  const nt = next.title.trim();
  const pd = (prev.description ?? "").trim();
  const nd = (next.description ?? "").trim();
  const ph = (prev.time_horizon ?? "").trim();
  const nh = (next.time_horizon ?? "").trim();
  const pi = prev.importance_score ?? null;
  const ni = next.importance_score ?? null;
  return pt !== nt || pd !== nd || ph !== nh || pi !== ni;
}

export async function invalidateStrategyObjectiveApproval(params: {
  supabase: SupabaseClient;
  organizationId: string;
  cycleInstanceId: string;
  objectiveId: string;
  membershipId: string;
  reason: string;
}): Promise<{ error?: string }> {
  const { supabase, organizationId, cycleInstanceId, objectiveId, membershipId, reason } = params;
  const now = new Date().toISOString();
  const { error } = await supabase
    .schema("app")
    .from("strategy_objectives")
    .update({
      status: "draft",
      approval_invalidated_at: now,
      approval_invalidated_by_membership_id: membershipId,
      approval_invalidation_reason: reason,
      updated_at: now,
    })
    .eq("id", objectiveId)
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .eq("status", "active");

  if (error) return { error: error.message };
  return {};
}
