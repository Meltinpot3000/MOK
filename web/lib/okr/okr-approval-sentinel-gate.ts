import type { SupabaseClient } from "@supabase/supabase-js";
import type { OkrContributionEdgePlanningRow, OkrPlanningObjectiveRow } from "@/lib/okr/planning-data";

type ContributionEdgeLike = Pick<
  OkrContributionEdgePlanningRow,
  "targetType" | "confirmedLevel" | "llmLevel" | "llmSuggestionDismissed"
>;

/** Wirksame Stufe für Freigabe-Prüfung: bestätigter Wert schlägt LLM; abgelehnte LLM-Vorschläge zählen nicht. */
export function effectiveOkrContributionEdgeTier(edge: ContributionEdgeLike): string | null {
  if (edge.confirmedLevel) return edge.confirmedLevel;
  if (edge.llmSuggestionDismissed) return null;
  return edge.llmLevel ?? null;
}

const MSG_CONTRIBUTION = `Freigabe wurde nicht angefragt: Sentinel✨ stuft die Stoßrichtungs-Einstufung (Alignment, Ambition oder Gesamt) als «unzureichend» ein. Bitte Objective und Key Results schärfen, speichern und die Freigabe erneut anfragen.`;

const MSG_KR_CONTEXT = `Freigabe wurde nicht angefragt: Für mindestens ein Key Result meldet Sentinel✨ unzureichenden Kontext (Treiber-/Matching). Bitte KR und Beschreibungen ergänzen, speichern und die Freigabe erneut anfragen.`;

export function getOkrPlanningObjectiveSentinelApprovalBlockMessageDe(
  objective: OkrPlanningObjectiveRow
): string | null {
  let hasContribution = false;
  for (const e of objective.contributionEdges) {
    if (e.targetType !== "strategic_direction") continue;
    const t = effectiveOkrContributionEdgeTier(e);
    if (t === "insufficient") hasContribution = true;
  }
  let hasKrContext = false;
  for (const kr of objective.keyResults) {
    if (kr.latestMatchingRun?.status === "insufficient_context") hasKrContext = true;
  }
  if (hasContribution && hasKrContext) {
    return `${MSG_CONTRIBUTION} ${MSG_KR_CONTEXT}`;
  }
  if (hasContribution) return MSG_CONTRIBUTION;
  if (hasKrContext) return MSG_KR_CONTEXT;
  return null;
}

export async function fetchOkrObjectiveSentinelApprovalBlockMessageDe(
  supabase: SupabaseClient,
  organizationId: string,
  okrObjectiveId: string
): Promise<string | null> {
  const { data: obj } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id")
    .eq("id", okrObjectiveId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!obj?.id) return null;

  const { data: edgeRows } = await supabase
    .schema("app")
    .from("okr_contribution_edges")
    .select("target_type, confirmed_level, llm_level, llm_suggestion_dismissed")
    .eq("organization_id", organizationId)
    .eq("okr_objective_id", okrObjectiveId);

  let hasContribution = false;
  for (const row of edgeRows ?? []) {
    if ((row.target_type as string) !== "strategic_direction") continue;
    const e: ContributionEdgeLike = {
      targetType: "strategic_direction",
      confirmedLevel: (row.confirmed_level as ContributionEdgeLike["confirmedLevel"]) ?? null,
      llmLevel: (row.llm_level as ContributionEdgeLike["llmLevel"]) ?? null,
      llmSuggestionDismissed: Boolean(row.llm_suggestion_dismissed),
    };
    if (effectiveOkrContributionEdgeTier(e) === "insufficient") hasContribution = true;
  }

  const { data: krRows } = await supabase
    .schema("app")
    .from("key_results")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("okr_objective_id", okrObjectiveId);
  const krIds = (krRows ?? []).map((r) => r.id as string);
  let hasKrContext = false;
  if (krIds.length > 0) {
    const { data: runs } = await supabase
      .schema("app")
      .from("kr_initiative_matching_runs")
      .select("key_result_id, status, created_at")
      .eq("organization_id", organizationId)
      .in("key_result_id", krIds)
      .order("created_at", { ascending: false });
    const seen = new Set<string>();
    for (const run of runs ?? []) {
      const kid = run.key_result_id as string;
      if (seen.has(kid)) continue;
      seen.add(kid);
      if ((run.status as string) === "insufficient_context") hasKrContext = true;
    }
  }

  if (hasContribution && hasKrContext) {
    return `${MSG_CONTRIBUTION} ${MSG_KR_CONTEXT}`;
  }
  if (hasContribution) return MSG_CONTRIBUTION;
  if (hasKrContext) return MSG_KR_CONTEXT;
  return null;
}
