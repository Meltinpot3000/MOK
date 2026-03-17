"use server";

type SupabaseClientLike = {
  schema: (name: string) => {
    from: (table: string) => {
      insert: (values: unknown) => unknown;
    };
  };
};

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
  supabase: SupabaseClientLike,
  events: LlmUsageEventInput[]
): Promise<void> {
  if (events.length === 0) return;
  await supabase.schema("app").from("llm_usage_events").insert(
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
}
