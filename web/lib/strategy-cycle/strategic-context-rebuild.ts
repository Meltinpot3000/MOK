import { after } from "next/server";
import {
  evaluateLlmBudgetStatus,
  type BudgetSupabaseClientLike,
} from "@/lib/analysis-network/budget";
import {
  isLlmFeatureEnabled,
  readAnalysisNetworkLlmPolicy,
  resolveLlmMaxOutputTokens,
} from "@/lib/analysis-network/policy";
import { STRATEGIC_CONTEXT_PROMPT_VERSION } from "@/lib/analysis-network/objective-evaluation-providers";
import { writeAiStorageActionLog } from "@/lib/analysis-network/storage-log";
import { recordLlmUsageEvents } from "@/lib/analysis-network/usage";
import { GROQ_MODEL } from "@/lib/analysis-network/providers";
import { readCompanyKennzahlenFromBrandingConfig } from "@/lib/strategy-cycle/company-info";
import { readStrategyReferenceFieldsFromBrandingConfig } from "@/lib/strategy-cycle/strategy-reference";
import {
  buildCompanyProfileInput,
  getOrBuildStrategicContext,
  validateCompanyProfileForEvaluation,
} from "@/lib/strategy-cycle/objective-evaluation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  appendSentinelScheduleParams,
  formatMissingCompanyProfileFields,
  type StrategicContextScheduleResult,
} from "@/lib/strategy-cycle/strategic-context-rebuild-shared";

export type { StrategicContextScheduleResult };
export { appendSentinelScheduleParams, formatMissingCompanyProfileFields };

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function strategyCycleWorkerBaseUrl(): string {
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

async function postStrategyCycleWorkerKick(): Promise<void> {
  const url = `${strategyCycleWorkerBaseUrl()}/api/internal/strategy-cycle-jobs`;
  const secret = process.env.STRATEGY_CYCLE_JOBS_CRON_SECRET ?? process.env.CRON_SECRET ?? "";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (secret) headers.Authorization = `Bearer ${secret}`;
  const res = await fetch(url, { method: "POST", headers, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn("[strategic-context-rebuild] worker kick failed", res.status, body.slice(0, 300));
  }
}

function scheduleStrategyCycleWorkerKick(): void {
  const raw = process.env.ANALYSIS_JOB_WORKER_KICK_BURST ?? "4";
  const burst = Math.max(1, Math.min(12, Math.round(Number(raw)) || 4));
  after(async () => {
    try {
      for (let i = 0; i < burst; i += 1) {
        await postStrategyCycleWorkerKick();
        if (i + 1 < burst) await new Promise((r) => setTimeout(r, 250));
      }
    } catch (e) {
      console.warn("[strategic-context-rebuild] worker kick error", e);
    }
  });
}

async function hasActiveStrategicContextRebuildJob(input: {
  supabase: Supabase;
  organizationId: string;
}): Promise<boolean> {
  const { data } = await input.supabase
    .schema("app")
    .from("analysis_background_jobs")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("job_type", "strategic_context_rebuild")
    .in("status", ["pending", "running"])
    .limit(1)
    .maybeSingle();
  return Boolean(data?.id);
}

/**
 * Plant einen Background-Job zur Neuerzeugung der Sentinel-Zusammenfassung,
 * sofern LLM-Policy, Profil und Budget es erlauben.
 */
export async function scheduleStrategicContextRebuildJob(input: {
  supabase: Supabase;
  organizationId: string;
  cycleInstanceId: string;
  membershipId: string;
  trigger: string;
  brandingConfig?: unknown;
}): Promise<StrategicContextScheduleResult> {
  const branding =
    input.brandingConfig ??
    (
      await input.supabase
        .schema("app")
        .from("tenant_branding")
        .select("branding_config")
        .eq("organization_id", input.organizationId)
        .maybeSingle()
    ).data?.branding_config ??
    null;

  const policy = readAnalysisNetworkLlmPolicy(branding);
  if (!policy.llmEnabled || !isLlmFeatureEnabled(policy, "objective_evaluation")) {
    return { status: "skipped", reason: "llm_disabled" };
  }

  const kennzahlen = readCompanyKennzahlenFromBrandingConfig(branding);
  const missing = validateCompanyProfileForEvaluation(kennzahlen);
  if (missing.length > 0) {
    return { status: "skipped", reason: "profile_incomplete", missingFields: missing };
  }

  const budgetStatus = await evaluateLlmBudgetStatus({
    supabase: input.supabase as unknown as BudgetSupabaseClientLike,
    organizationId: input.organizationId,
    policy,
  });
  if (!budgetStatus.allowed) {
    return { status: "skipped", reason: "budget_exceeded" };
  }

  if (
    await hasActiveStrategicContextRebuildJob({
      supabase: input.supabase,
      organizationId: input.organizationId,
    })
  ) {
    return { status: "already_running" };
  }

  const { error } = await input.supabase.schema("app").from("analysis_background_jobs").insert({
    organization_id: input.organizationId,
    cycle_instance_id: input.cycleInstanceId,
    job_type: "strategic_context_rebuild",
    status: "pending",
    payload: { trigger: input.trigger },
    created_by_membership_id: input.membershipId,
  });

  if (error) {
    console.error("[scheduleStrategicContextRebuildJob]", error.message);
    return { status: "skipped", reason: "insert_failed" };
  }

  scheduleStrategyCycleWorkerKick();
  return { status: "scheduled" };
}

export async function executeStrategicContextRebuildJob(params: {
  supabase: Supabase;
  organizationId: string;
  cycleId: string;
  trigger: string;
}): Promise<{ rebuilt: boolean; fromCache: boolean }> {
  const startedAt = new Date().toISOString();

  const { data: brandingRow } = await params.supabase
    .schema("app")
    .from("tenant_branding")
    .select("branding_config")
    .eq("organization_id", params.organizationId)
    .maybeSingle();
  const branding = brandingRow?.branding_config ?? null;

  const policy = readAnalysisNetworkLlmPolicy(branding);
  if (!policy.llmEnabled || !isLlmFeatureEnabled(policy, "objective_evaluation")) {
    return { rebuilt: false, fromCache: false };
  }

  const kennzahlen = readCompanyKennzahlenFromBrandingConfig(branding);
  const strategyRef = readStrategyReferenceFieldsFromBrandingConfig(branding);
  const missing = validateCompanyProfileForEvaluation(kennzahlen);
  if (missing.length > 0) {
    return { rebuilt: false, fromCache: false };
  }

  const budgetStatus = await evaluateLlmBudgetStatus({
    supabase: params.supabase as unknown as BudgetSupabaseClientLike,
    organizationId: params.organizationId,
    policy,
  });
  if (!budgetStatus.allowed) {
    throw new Error("LLM budget exceeded");
  }

  const companyProfile = buildCompanyProfileInput(kennzahlen, strategyRef);
  const maxTokens = resolveLlmMaxOutputTokens(policy, "objective_evaluation");

  const result = await getOrBuildStrategicContext({
    supabase: params.supabase,
    organizationId: params.organizationId,
    companyProfile,
    maxOutputTokens: maxTokens,
  });

  if (!result.fromCache && result.usage) {
    await recordLlmUsageEvents(params.supabase, [
      {
        organizationId: params.organizationId,
        cycleInstanceId: params.cycleId,
        feature: "objective_evaluation",
        provider: result.provider ?? "groq",
        model: result.model ?? GROQ_MODEL,
        promptVersion: STRATEGIC_CONTEXT_PROMPT_VERSION,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        usageMissing: result.usage.usageMissing,
      },
    ]);
  }

  const logResult = await writeAiStorageActionLog({
    supabase: params.supabase,
    organizationId: params.organizationId,
    cycleInstanceId: params.cycleId,
    feature: "strategy_cycle",
    action: "strategic_context_rebuild",
    triggerType: "job",
    status: "success",
    startedAt,
    finishedAt: new Date().toISOString(),
    providerModels:
      result.provider && result.model ? [{ provider: result.provider, model: result.model }] : [],
    metadata: { trigger: params.trigger, fromCache: result.fromCache },
  });
  if (!logResult.ok) {
    console.warn("[strategic-context-rebuild] ai log write failed", logResult.error);
  }

  return { rebuilt: true, fromCache: result.fromCache };
}
