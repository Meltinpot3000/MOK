import type { SupabaseClient } from "@supabase/supabase-js";
import { readAnalysisNetworkLlmPolicy, isLlmFeatureEnabled, resolveLlmMaxOutputTokens } from "@/lib/analysis-network/policy";
import {
  evaluateLlmBudgetStatus,
  type BudgetSupabaseClientLike,
} from "@/lib/analysis-network/budget";
import { assessOkrContributionsWithLlm } from "@/lib/analysis-network/providers";
import { recordLlmUsageEvents } from "@/lib/analysis-network/usage";
import {
  buildOkrContributionAssessmentContext,
  contextToPromptJson,
} from "@/lib/okr/contribution-assessment-context";
import type { OkrContributionTier } from "@/lib/strategy-cycle/coverage-level";

function platformOkrContributionEnabled(): boolean {
  const raw = process.env.OKR_CONTRIBUTION_ASSESSMENT_ENABLED;
  if (raw === undefined || raw === "") return true;
  return raw.trim().toLowerCase() !== "false" && raw !== "0";
}

async function readBranding(supabase: SupabaseClient, organizationId: string): Promise<unknown> {
  const { data } = await supabase
    .schema("app")
    .from("tenant_branding")
    .select("branding_config")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data?.branding_config ?? null;
}

export async function executeOkrContributionAssessmentJob(input: {
  supabase: SupabaseClient;
  organizationId: string;
  cycleInstanceId: string;
  okrObjectiveId: string;
  trigger: string;
}): Promise<void> {
  if (!platformOkrContributionEnabled()) return;

  const branding = await readBranding(input.supabase, input.organizationId);
  const policy = readAnalysisNetworkLlmPolicy(branding);
  if (!isLlmFeatureEnabled(policy, "okr_contribution_assessment")) return;

  const budget = await evaluateLlmBudgetStatus({
    supabase: input.supabase as unknown as BudgetSupabaseClientLike,
    organizationId: input.organizationId,
    policy,
  });
  if (!budget.allowed) {
    console.warn("[okr_contribution_assessment] budget blocked", budget.reason);
    return;
  }

  const ctx = await buildOkrContributionAssessmentContext({
    supabase: input.supabase,
    organizationId: input.organizationId,
    cycleInstanceId: input.cycleInstanceId,
    okrObjectiveId: input.okrObjectiveId,
  });
  if (!ctx) return;

  const initiativeIds = [...new Set(ctx.keyResults.flatMap((kr) => kr.initiatives.map((i) => i.id)))];
  const strategyObjectiveIds = ctx.strategyObjectives.map((s) => s.id);

  const contextJson = contextToPromptJson(ctx);
  const maxTokens = resolveLlmMaxOutputTokens(policy, "okr_contribution_assessment");
  const response = await assessOkrContributionsWithLlm({
    contextJson,
    okrObjectiveId: input.okrObjectiveId,
    initiativeIds,
    strategyObjectiveIds,
    maxOutputTokens: maxTokens,
  });

  if (response.usage && response.result) {
    await recordLlmUsageEvents(input.supabase, [
      {
        organizationId: input.organizationId,
        cycleInstanceId: input.cycleInstanceId,
        feature: "okr_contribution_assessment",
        provider: response.result.provider,
        model: response.result.model,
        promptVersion: response.result.promptVersion,
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens,
        billableCost: response.usage.billableCost,
        usageMissing: response.usage.usageMissing,
        metadata: { okr_objective_id: input.okrObjectiveId, trigger: input.trigger },
      },
    ]);
  }

  const rawPayload = response.result
    ? {
        okr_id: response.result.okrId,
        initiative_contributions: response.result.initiativeContributions,
        strategy_objective_contributions: response.result.strategyObjectiveContributions,
      }
    : null;

  const { data: runRow, error: runErr } = await input.supabase
    .schema("app")
    .from("okr_contribution_assessment_runs")
    .insert({
      organization_id: input.organizationId,
      cycle_instance_id: input.cycleInstanceId,
      okr_objective_id: input.okrObjectiveId,
      trigger: input.trigger,
      status: response.result ? "completed" : "failed",
      raw_response: rawPayload,
      last_error: response.result ? null : "llm_parse_or_empty",
    })
    .select("id")
    .single();

  if (runErr || !runRow?.id) {
    console.error("[okr_contribution_assessment] run insert", runErr?.message);
    return;
  }

  const runId = runRow.id as string;
  if (!response.result) return;

  const byInitiative = new Map(
    response.result.initiativeContributions.map((x) => [x.initiativeId, x])
  );
  const bySo = new Map(
    response.result.strategyObjectiveContributions.map((x) => [x.objectiveId, x])
  );

  const upsertEdge = async (params: {
    targetType: "initiative" | "strategy_objective";
    targetId: string;
    level: OkrContributionTier;
    reason: string;
  }) => {
    const { data: existing } = await input.supabase
      .schema("app")
      .from("okr_contribution_edges")
      .select("id")
      .eq("okr_objective_id", input.okrObjectiveId)
      .eq("target_type", params.targetType)
      .eq("target_id", params.targetId)
      .maybeSingle();

    const patch = {
      llm_level: params.level,
      llm_reason: params.reason.slice(0, 2000),
      llm_assessment_run_id: runId,
      llm_suggestion_dismissed: false,
    };

    if (existing?.id) {
      await input.supabase
        .schema("app")
        .from("okr_contribution_edges")
        .update(patch)
        .eq("id", existing.id);
    } else {
      await input.supabase.schema("app").from("okr_contribution_edges").insert({
        organization_id: input.organizationId,
        cycle_instance_id: input.cycleInstanceId,
        okr_objective_id: input.okrObjectiveId,
        target_type: params.targetType,
        target_id: params.targetId,
        ...patch,
        confirmed_level: null,
        value_source: "none",
      });
    }
  };

  for (const iid of initiativeIds) {
    const row = byInitiative.get(iid);
    const level = row?.level ?? "insufficient";
    const reason =
      row?.reason ??
      "Kein Bewertungs-Eintrag aus dem Modell — als «unzureichend beschrieben» gespeichert.";
    await upsertEdge({ targetType: "initiative", targetId: iid, level, reason });
  }

  for (const soId of strategyObjectiveIds) {
    const row = bySo.get(soId);
    await upsertEdge({
      targetType: "strategy_objective",
      targetId: soId,
      level: row?.level ?? "insufficient",
      reason:
        row?.reason ??
        "Kein Bewertungs-Eintrag aus dem Modell — als «unzureichend beschrieben» gespeichert.",
    });
  }

  const initSet = new Set(initiativeIds);
  const { data: staleInitEdges } = await input.supabase
    .schema("app")
    .from("okr_contribution_edges")
    .select("id, target_id")
    .eq("okr_objective_id", input.okrObjectiveId)
    .eq("target_type", "initiative");
  for (const e of staleInitEdges ?? []) {
    if (!initSet.has(e.target_id as string)) {
      await input.supabase.schema("app").from("okr_contribution_edges").delete().eq("id", e.id);
    }
  }

  const soSet = new Set(strategyObjectiveIds);
  const { data: staleSoEdges } = await input.supabase
    .schema("app")
    .from("okr_contribution_edges")
    .select("id, target_id")
    .eq("okr_objective_id", input.okrObjectiveId)
    .eq("target_type", "strategy_objective");
  for (const e of staleSoEdges ?? []) {
    if (!soSet.has(e.target_id as string)) {
      await input.supabase.schema("app").from("okr_contribution_edges").delete().eq("id", e.id);
    }
  }
}
