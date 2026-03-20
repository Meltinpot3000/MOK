"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

export type LlmUsageEventInput = {
  organizationId: string;
  cycleInstanceId: string | null;
  feature: string;
  provider: string;
  model: string;
  promptVersion: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  billableCost?: number | null;
  usageMissing?: boolean;
  metadata?: Record<string, unknown> | null;
};

export async function recordLlmUsageEvents(
  supabase: SupabaseClient,
  events: LlmUsageEventInput[]
): Promise<void> {
  if (events.length === 0) return;
  const { error } = await supabase.schema("app").from("llm_usage_events").insert(
    events.map((event) => ({
      organization_id: event.organizationId,
      cycle_instance_id: event.cycleInstanceId,
      feature: event.feature,
      provider: event.provider,
      model: event.model,
      prompt_version: event.promptVersion,
      prompt_tokens: event.promptTokens,
      completion_tokens: event.completionTokens,
      total_tokens: event.totalTokens,
      billable_cost: event.billableCost ?? null,
      usage_missing: Boolean(event.usageMissing),
      metadata: event.metadata ?? {},
    }))
  );
  if (error) {
    console.error("[llm_usage_events] insert failed", error.message);
    throw new Error(`llm_usage_events: ${error.message}`);
  }
}
