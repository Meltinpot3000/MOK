"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  runAndPersistModelHealthChecks,
  type SupabaseClientLike,
} from "@/lib/analysis-network/model-health";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function runLlmModelHealthCheckNow(formData: FormData) {
  const pageAccess = await getSidebarAccessContext("llm-usage");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");
  if (!pageAccess.canWrite) redirect("/llm-usage?error=read-only");

  const days = String(formData.get("days") ?? "30");
  const safeDays = ["7", "30", "90"].includes(days) ? days : "30";
  const supabase = await createSupabaseServerClient();

  await runAndPersistModelHealthChecks({
    supabase: supabase as unknown as SupabaseClientLike,
    organizationId: pageAccess.access.organizationId,
    trigger: "manual",
  });

  revalidatePath("/llm-usage");
  redirect(`/llm-usage?days=${safeDays}&success=health-checked`);
}

export async function saveLlmSystemConfiguration(formData: FormData) {
  const pageAccess = await getSidebarAccessContext("llm-usage");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");
  if (!pageAccess.canWrite) redirect("/llm-usage?error=read-only");

  function clampInt(value: number, fallback: number, min: number, max: number) {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(min, Math.min(max, Math.round(value)));
  }

  const days = String(formData.get("days") ?? "30");
  const safeDays = ["7", "30", "90"].includes(days) ? days : "30";

  const llmEnabled = String(formData.get("llm_enabled") ?? "off") === "on";
  const llmFeatureQualityScoring = String(formData.get("llm_feature_quality_scoring") ?? "off") === "on";
  const llmFeatureGraphLayout = String(formData.get("llm_feature_graph_layout") ?? "off") === "on";
  const llmFeatureLinkDraft = String(formData.get("llm_feature_link_draft_generation") ?? "off") === "on";
  const llmFeatureCluster = String(formData.get("llm_feature_cluster_assessment") ?? "off") === "on";
  const llmFeatureGap = String(formData.get("llm_feature_gap_assessment") ?? "off") === "on";
  const llmFeatureChallenge =
    String(formData.get("llm_feature_challenge_recommendation") ?? "off") === "on";
  const llmFeatureModelHealth = String(formData.get("llm_feature_model_health_checks") ?? "off") === "on";
  const llmFeatureObjectiveEvaluation =
    String(formData.get("llm_feature_objective_evaluation") ?? "off") === "on";
  const llmFeatureOkrContributionAssessment =
    String(formData.get("llm_feature_okr_contribution_assessment") ?? "off") === "on";
  const llmFeatureKrInitiativeMatching =
    String(formData.get("llm_feature_kr_initiative_matching") ?? "off") === "on";
  const llmDefaultMaxOutputTokens = Number(formData.get("llm_max_output_tokens_default") ?? 700);
  const llmMaxOutputQuality = Number(formData.get("llm_max_output_tokens_quality_scoring") ?? 500);
  const llmMaxOutputGraphLayout = Number(formData.get("llm_max_output_tokens_graph_layout") ?? 1000);
  const llmMaxOutputLink = Number(formData.get("llm_max_output_tokens_link_draft_generation") ?? 420);
  const llmMaxOutputCluster = Number(formData.get("llm_max_output_tokens_cluster_assessment") ?? 380);
  const llmMaxOutputGap = Number(formData.get("llm_max_output_tokens_gap_assessment") ?? 380);
  const llmMaxOutputChallenge = Number(
    formData.get("llm_max_output_tokens_challenge_recommendation") ?? 900
  );
  const llmMaxOutputHealth = Number(formData.get("llm_max_output_tokens_model_health_checks") ?? 128);
  const llmMaxOutputObjectiveEvaluation = Number(
    formData.get("llm_max_output_tokens_objective_evaluation") ?? 600
  );
  const llmMaxOutputOkrContributionAssessment = Number(
    formData.get("llm_max_output_tokens_okr_contribution_assessment") ?? 520
  );
  const llmMaxOutputKrInitiativeMatching = Number(
    formData.get("llm_max_output_tokens_kr_initiative_matching") ?? 700
  );
  const krInitiativeMatchingConfidenceThreshold = Number(
    formData.get("kr_initiative_matching_confidence_threshold") ?? 0.8
  );
  const llmDailySoftTokenLimit = Number(formData.get("llm_daily_soft_token_limit") ?? 150000);
  const llmMonthlyHardTokenLimit = Number(formData.get("llm_monthly_hard_token_limit") ?? 3000000);

  const supabase = await createSupabaseServerClient();
  const { data: branding } = await supabase
    .schema("app")
    .from("tenant_branding")
    .select("branding_config")
    .eq("organization_id", pageAccess.access.organizationId)
    .maybeSingle();
  const existingConfig =
    branding?.branding_config && typeof branding.branding_config === "object"
      ? (branding.branding_config as Record<string, unknown>)
      : {};
  const existingAnalysisNetwork =
    existingConfig.analysis_network && typeof existingConfig.analysis_network === "object"
      ? (existingConfig.analysis_network as Record<string, unknown>)
      : {};
  const prevFeatureFlags =
    existingAnalysisNetwork.llm_feature_flags &&
    typeof existingAnalysisNetwork.llm_feature_flags === "object"
      ? (existingAnalysisNetwork.llm_feature_flags as Record<string, unknown>)
      : {};
  const prevOutputByFeature =
    existingAnalysisNetwork.llm_max_output_tokens_by_feature &&
    typeof existingAnalysisNetwork.llm_max_output_tokens_by_feature === "object"
      ? (existingAnalysisNetwork.llm_max_output_tokens_by_feature as Record<string, unknown>)
      : {};
  const nextAnalysisNetwork = {
    ...existingAnalysisNetwork,
    llm_enabled: llmEnabled,
    llm_feature_flags: {
      ...prevFeatureFlags,
      quality_scoring: llmFeatureQualityScoring,
      graph_layout: llmFeatureGraphLayout,
      link_draft_generation: llmFeatureLinkDraft,
      cluster_assessment: llmFeatureCluster,
      gap_assessment: llmFeatureGap,
      challenge_recommendation: llmFeatureChallenge,
      model_health_checks: llmFeatureModelHealth,
      objective_evaluation: llmFeatureObjectiveEvaluation,
      okr_contribution_assessment: llmFeatureOkrContributionAssessment,
      kr_initiative_matching: llmFeatureKrInitiativeMatching,
    },
    llm_max_output_tokens_default: clampInt(llmDefaultMaxOutputTokens, 700, 64, 4096),
    llm_max_output_tokens_by_feature: {
      ...prevOutputByFeature,
      quality_scoring: clampInt(llmMaxOutputQuality, 500, 64, 4096),
      graph_layout: clampInt(llmMaxOutputGraphLayout, 1000, 64, 4096),
      link_draft_generation: clampInt(llmMaxOutputLink, 420, 64, 4096),
      cluster_assessment: clampInt(llmMaxOutputCluster, 380, 64, 4096),
      gap_assessment: clampInt(llmMaxOutputGap, 380, 64, 4096),
      challenge_recommendation: clampInt(llmMaxOutputChallenge, 900, 64, 4096),
      model_health_checks: clampInt(llmMaxOutputHealth, 128, 64, 4096),
      objective_evaluation: clampInt(llmMaxOutputObjectiveEvaluation, 600, 64, 4096),
      okr_contribution_assessment: clampInt(llmMaxOutputOkrContributionAssessment, 520, 64, 4096),
      kr_initiative_matching: clampInt(llmMaxOutputKrInitiativeMatching, 700, 64, 4096),
    },
    kr_initiative_matching_confidence_threshold: Math.max(
      0,
      Math.min(1, Number(krInitiativeMatchingConfidenceThreshold.toFixed(3)))
    ),
    llm_daily_soft_token_limit: clampInt(llmDailySoftTokenLimit, 150000, 0, 100000000),
    llm_monthly_hard_token_limit: clampInt(llmMonthlyHardTokenLimit, 3000000, 0, 1000000000),
  };

  await supabase
    .schema("app")
    .from("tenant_branding")
    .upsert(
      {
        organization_id: pageAccess.access.organizationId,
        branding_config: {
          ...existingConfig,
          analysis_network: nextAnalysisNetwork,
        },
      },
      { onConflict: "organization_id" }
    );

  revalidatePath("/llm-usage");
  redirect(`/llm-usage?days=${safeDays}&success=config-saved`);
}
