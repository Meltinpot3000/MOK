import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiContextSource } from "@/lib/ai/types";

export type PersistContextSourcesArgs = {
  supabase: SupabaseClient;
  agentRunId: string;
  organizationId: string;
  sources: AiContextSource[];
};

/**
 * Persistiert ContextSources fuer einen Agent-Run. `source_id` ist als TEXT
 * gespeichert (siehe Migration 0131), damit auch zusammengesetzte oder externe
 * IDs (z. B. URLs) abgelegt werden koennen.
 */
export async function persistContextSources(args: PersistContextSourcesArgs): Promise<void> {
  if (args.sources.length === 0) return;
  const rows = args.sources.map((source) => ({
    agent_run_id: args.agentRunId,
    organization_id: args.organizationId,
    source_type: source.sourceType,
    source_id: source.sourceId ?? null,
    source_title: source.sourceTitle ?? null,
    relevance_score: clamp01(source.relevanceScore),
    classification: source.classification,
    source_reason: source.sourceReason ?? null,
  }));
  const { error } = await args.supabase
    .schema("app")
    .from("ai_context_sources")
    .insert(rows);
  if (error) {
    console.error("[ai_context_sources] insert failed", error.message);
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
