import { after } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readAnalysisNetworkLlmPolicy, isLlmFeatureEnabled } from "@/lib/analysis-network/policy";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function platformKrInitiativeMatchingEnabled(): boolean {
  const raw = process.env.KR_INITIATIVE_MATCHING_ENABLED;
  if (raw === undefined || raw === "") return true;
  return raw.trim().toLowerCase() !== "false" && raw !== "0";
}

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
    console.warn("[kr-initiative-matching] worker kick failed", res.status, body.slice(0, 300));
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
      console.warn("[kr-initiative-matching] worker kick error", e);
    }
  });
}

async function readBrandingConfigSnapshot(
  supabase: Supabase,
  organizationId: string
): Promise<unknown> {
  const { data } = await supabase
    .schema("app")
    .from("tenant_branding")
    .select("branding_config")
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data?.branding_config ?? null;
}

export async function scheduleKrInitiativeMatchingIfEnabled(input: {
  supabase: Supabase;
  organizationId: string;
  cycleInstanceId: string;
  keyResultId: string;
  membershipId: string;
  trigger: string;
}): Promise<void> {
  if (!platformKrInitiativeMatchingEnabled()) return;

  const branding = await readBrandingConfigSnapshot(input.supabase, input.organizationId);
  const policy = readAnalysisNetworkLlmPolicy(branding);
  if (!isLlmFeatureEnabled(policy, "kr_initiative_matching")) return;

  const { error } = await input.supabase.schema("app").from("analysis_background_jobs").insert({
    organization_id: input.organizationId,
    cycle_instance_id: input.cycleInstanceId,
    job_type: "kr_initiative_matching",
    status: "pending",
    payload: {
      trigger: input.trigger,
      key_result_id: input.keyResultId,
    },
    created_by_membership_id: input.membershipId,
  });

  if (error) {
    console.error("[scheduleKrInitiativeMatchingIfEnabled]", error.message);
    return;
  }
  scheduleStrategyCycleWorkerKick();
}
