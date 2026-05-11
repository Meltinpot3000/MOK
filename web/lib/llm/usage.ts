import type { SupabaseClient } from "@supabase/supabase-js";

import type { LlmUsageEventInput } from "@/lib/analysis-network/usage";

export { recordLlmUsageEvents } from "@/lib/analysis-network/usage";
export type { LlmUsageEventInput } from "@/lib/analysis-network/usage";

/**
 * Sentinel-spezifischer Usage-Event mit zusätzlichen Korrelationsfeldern
 * (sub_feature, related_entity_type, related_entity_id, agent_run_id).
 *
 * Setzt voraus, dass Migration 0131_ai_assistant_core.sql ausgeführt wurde.
 */
export type SentinelUsageEventInput = LlmUsageEventInput & {
  subFeature?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  agentRunId?: string | null;
};

export async function recordSentinelUsageEvents(
  supabase: SupabaseClient,
  events: SentinelUsageEventInput[]
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
      sub_feature: event.subFeature ?? null,
      related_entity_type: event.relatedEntityType ?? null,
      related_entity_id: event.relatedEntityId ?? null,
      agent_run_id: event.agentRunId ?? null,
    }))
  );
  if (error) {
    console.error("[llm_usage_events:sentinel] insert failed", error.message);
    throw new Error(`llm_usage_events: ${error.message}`);
  }
}
