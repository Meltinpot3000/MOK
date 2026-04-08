import type { SupabaseClient } from "@supabase/supabase-js";
import { assessKrInitiativeMatchingWithLlm } from "@/lib/analysis-network/providers";
import {
  evaluateLlmBudgetStatus,
  type BudgetSupabaseClientLike,
} from "@/lib/analysis-network/budget";
import {
  isLlmFeatureEnabled,
  readAnalysisNetworkLlmPolicy,
  resolveLlmMaxOutputTokens,
} from "@/lib/analysis-network/policy";
import { recordLlmUsageEvents } from "@/lib/analysis-network/usage";
import {
  buildKrInitiativeMatchingContext,
  contextToKrInitiativeMatchingPromptJson,
} from "@/lib/okr/kr-initiative-matching-context";
import { reconcileKrInitiativeMatching } from "@/lib/okr/kr-initiative-matching-reconcile";

type Supabase = SupabaseClient;

function platformKrInitiativeMatchingEnabled(): boolean {
  const raw = process.env.KR_INITIATIVE_MATCHING_ENABLED;
  if (raw === undefined || raw === "") return true;
  return raw.trim().toLowerCase() !== "false" && raw !== "0";
}

async function readBranding(supabase: Supabase, organizationId: string): Promise<unknown> {
  const { data } = await supabase
    .schema("app")
    .from("tenant_branding")
    .select("branding_config")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data?.branding_config ?? null;
}

async function writeRun(input: {
  supabase: Supabase;
  organizationId: string;
  cycleInstanceId: string;
  keyResultId: string;
  trigger: string;
  status: "ok" | "insufficient_context" | "failed";
  insufficientContextReason?: string | null;
  rawResponse?: unknown;
  lastError?: string | null;
}): Promise<string | null> {
  const { data, error } = await input.supabase
    .schema("app")
    .from("kr_initiative_matching_runs")
    .insert({
      organization_id: input.organizationId,
      cycle_instance_id: input.cycleInstanceId,
      key_result_id: input.keyResultId,
      trigger: input.trigger,
      status: input.status,
      insufficient_context_reason: input.insufficientContextReason ?? null,
      raw_response: input.rawResponse ?? null,
      last_error: input.lastError ?? null,
    })
    .select("id")
    .single();
  if (error || !data?.id) {
    console.error("[kr_initiative_matching] run insert failed", error?.message);
    return null;
  }
  return data.id as string;
}

export async function executeKrInitiativeMatchingJob(input: {
  supabase: Supabase;
  organizationId: string;
  cycleInstanceId: string;
  keyResultId: string;
  trigger: string;
}): Promise<void> {
  if (!platformKrInitiativeMatchingEnabled()) return;

  const branding = await readBranding(input.supabase, input.organizationId);
  const policy = readAnalysisNetworkLlmPolicy(branding);
  if (!isLlmFeatureEnabled(policy, "kr_initiative_matching")) return;

  const budget = await evaluateLlmBudgetStatus({
    supabase: input.supabase as unknown as BudgetSupabaseClientLike,
    organizationId: input.organizationId,
    policy,
  });
  if (!budget.allowed) {
    await writeRun({
      ...input,
      status: "failed",
      lastError: `budget_blocked:${budget.reason}`,
    });
    return;
  }

  const ctx = await buildKrInitiativeMatchingContext({
    supabase: input.supabase,
    organizationId: input.organizationId,
    cycleInstanceId: input.cycleInstanceId,
    keyResultId: input.keyResultId,
  });
  if (!ctx) {
    await writeRun({
      ...input,
      status: "failed",
      lastError: "context_not_found",
    });
    return;
  }

  const initiativeIds = ctx.initiatives.map((i) => i.id);
  if (initiativeIds.length === 0) {
    await writeRun({
      ...input,
      status: "insufficient_context",
      insufficientContextReason: "Keine Initiativen im Zyklus vorhanden.",
    });
    return;
  }

  const response = await assessKrInitiativeMatchingWithLlm({
    contextJson: contextToKrInitiativeMatchingPromptJson(ctx),
    keyResultId: input.keyResultId,
    initiativeIds,
    maxOutputTokens: resolveLlmMaxOutputTokens(policy, "kr_initiative_matching"),
  });

  const rawPayload = response.result
    ? {
        status: response.result.status,
        kr_id: response.result.krId,
        initiative_matches: response.result.initiativeMatches.map((m) => ({
          initiative_id: m.initiativeId,
          level: m.level,
          reason: m.reason,
          confidence: m.confidence,
        })),
        insufficient_context_reason: response.result.insufficientContextReason,
      }
    : null;

  if (response.usage && response.result) {
    await recordLlmUsageEvents(input.supabase, [
      {
        organizationId: input.organizationId,
        cycleInstanceId: input.cycleInstanceId,
        feature: "kr_initiative_matching",
        provider: response.result.provider,
        model: response.result.model,
        promptVersion: response.result.promptVersion,
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens,
        billableCost: response.usage.billableCost,
        usageMissing: response.usage.usageMissing,
        metadata: { key_result_id: input.keyResultId, trigger: input.trigger },
      },
    ]);
  }

  if (!response.result) {
    await writeRun({
      ...input,
      status: "failed",
      rawResponse: rawPayload,
      lastError: "llm_parse_or_empty",
    });
    return;
  }

  const confidenceThreshold = policy.krInitiativeMatchingConfidenceThreshold;
  const filteredMatches =
    response.result.status === "ok"
      ? response.result.initiativeMatches
          .filter((m) => m.confidence >= confidenceThreshold)
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 5)
      : [];

  const runId = await writeRun({
    ...input,
    status: response.result.status,
    insufficientContextReason: response.result.insufficientContextReason,
    rawResponse: rawPayload,
    lastError: null,
  });
  const effectiveRunId = runId ?? null;

  const { data: existingRows } = await input.supabase
    .schema("app")
    .from("initiative_key_result_links")
    .select("id, initiative_id, confirmation_status, confirmed_level")
    .eq("organization_id", input.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .eq("key_result_id", input.keyResultId);

  const ops = reconcileKrInitiativeMatching({
    runId: effectiveRunId,
    existingLinks: (existingRows ?? []).map((row) => ({
      id: row.id as string,
      initiativeId: row.initiative_id as string,
      confirmationStatus:
        ((row.confirmation_status as
          | "none"
          | "pending"
          | "accepted"
          | "rejected"
          | "manual"
          | null) ?? "none"),
      confirmedLevel: (row.confirmed_level as "low" | "medium" | "high" | null) ?? null,
    })),
    suggestedMatches: filteredMatches.map((m) => ({
      initiativeId: m.initiativeId,
      level: m.level,
      reason: m.reason,
    })),
  });

  for (const update of ops.updates) {
    await input.supabase
      .schema("app")
      .from("initiative_key_result_links")
      .update(update.patch)
      .eq("id", update.id);
  }

  for (const insert of ops.inserts) {
    await input.supabase.schema("app").from("initiative_key_result_links").insert({
      organization_id: input.organizationId,
      cycle_instance_id: input.cycleInstanceId,
      initiative_id: insert.initiativeId,
      key_result_id: input.keyResultId,
      llm_level: insert.llmLevel,
      llm_reason: insert.llmReason.slice(0, 2000),
      llm_run_id: effectiveRunId,
      confirmed_level: null,
      confirmation_status: insert.confirmationStatus,
      created_by_membership_id: null,
    });
  }
}
