"use server";

import type { AnalysisNetworkLlmPolicy } from "@/lib/analysis-network/policy";

export type BudgetSupabaseClientLike = {
  schema: (name: string) => {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: unknown) => {
          gte: (column: string, value: string) => {
            order: (column: string, options?: { ascending?: boolean }) => {
              limit: (count: number) => Promise<{
                data: Array<{ total_tokens?: number | null; created_at?: string | null }> | null;
              }>;
            };
          };
        };
      };
    };
  };
};

export type LlmBudgetStatus = {
  allowed: boolean;
  dailyTokens: number;
  monthlyTokens: number;
  reason: "ok" | "daily_soft_limit" | "monthly_hard_limit";
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function evaluateLlmBudgetStatus(input: {
  supabase: BudgetSupabaseClientLike;
  organizationId: string;
  policy: AnalysisNetworkLlmPolicy;
}): Promise<LlmBudgetStatus> {
  const dailyLimit = Math.max(0, Math.round(input.policy.dailySoftTokenLimit));
  const monthlyLimit = Math.max(0, Math.round(input.policy.monthlyHardTokenLimit));
  if (dailyLimit === 0 && monthlyLimit === 0) {
    return { allowed: true, dailyTokens: 0, monthlyTokens: 0, reason: "ok" };
  }

  const now = Date.now();
  const sinceDailyIso = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const sinceMonthlyIso = new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await input.supabase
    .schema("app")
    .from("llm_usage_events")
    .select("total_tokens, created_at")
    .eq("organization_id", input.organizationId)
    .gte("created_at", sinceMonthlyIso)
    .order("created_at", { ascending: false })
    .limit(20000);

  const rows = data ?? [];
  let dailyTokens = 0;
  let monthlyTokens = 0;
  for (const row of rows) {
    const tokens = Math.max(0, toNumber(row.total_tokens));
    monthlyTokens += tokens;
    const createdAt = Date.parse(String(row.created_at ?? ""));
    if (Number.isFinite(createdAt) && createdAt >= Date.parse(sinceDailyIso)) {
      dailyTokens += tokens;
    }
  }

  if (monthlyLimit > 0 && monthlyTokens >= monthlyLimit) {
    return { allowed: false, dailyTokens, monthlyTokens, reason: "monthly_hard_limit" };
  }
  if (dailyLimit > 0 && dailyTokens >= dailyLimit) {
    return { allowed: false, dailyTokens, monthlyTokens, reason: "daily_soft_limit" };
  }
  return { allowed: true, dailyTokens, monthlyTokens, reason: "ok" };
}

