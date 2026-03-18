"use server";

import {
  GEMINI_MODEL_ASSIST,
  GEMINI_MODEL_LINKS,
  GEMINI_MODEL_QUALITY,
  GROQ_MODEL,
} from "@/lib/analysis-network/providers";
import {
  isLlmFeatureEnabled,
  readAnalysisNetworkLlmPolicy,
  resolveLlmMaxOutputTokens,
} from "@/lib/analysis-network/policy";
import { writeAiStorageActionLog } from "@/lib/analysis-network/storage-log";

type SupabaseClientLike = {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: Blob,
        options?: { upsert?: boolean; cacheControl?: string; contentType?: string }
      ) => Promise<{ error?: { message?: string | null } | null }>;
    };
  };
  schema: (name: string) => {
    from: (table: string) => {
      upsert: (values: unknown, options?: { onConflict?: string }) => unknown;
      select: (columns: string) => {
        eq: (column: string, value: unknown) => {
          maybeSingle: () => Promise<{ data: { branding_config?: unknown } | null }>;
        };
      };
    };
  };
};

export type ModelHealthStatus = "healthy" | "degraded" | "down";
export type FallbackMode = "none" | "groq" | "rule";

type ProbeResult = {
  provider: "gemini" | "groq";
  model: string;
  status: "healthy" | "down";
  latencyMs: number | null;
  httpStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
};

type FeatureTarget = {
  feature: string;
  provider: "gemini" | "groq";
  model: string;
};

const REQUEST_TIMEOUT_MS = Number(process.env.ANALYSIS_LLM_TIMEOUT_MS ?? 20000);

function getFeatureTargets(): FeatureTarget[] {
  return [
    { feature: "quality_scoring", provider: "gemini", model: GEMINI_MODEL_QUALITY },
    { feature: "graph_layout", provider: "gemini", model: GEMINI_MODEL_ASSIST },
    { feature: "link_draft_generation", provider: "gemini", model: GEMINI_MODEL_LINKS },
    { feature: "cluster_gap_assist", provider: "gemini", model: GEMINI_MODEL_ASSIST },
    { feature: "challenge_recommendation", provider: "gemini", model: GEMINI_MODEL_ASSIST },
    { feature: "llm_fallback", provider: "groq", model: GROQ_MODEL },
  ];
}

async function fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function parseErrorPayload(payload: unknown): { code: string | null; message: string | null } {
  if (!payload || typeof payload !== "object") return { code: null, message: null };
  const root = payload as { error?: { status?: unknown; message?: unknown; code?: unknown } };
  const status = root.error?.status;
  const code = root.error?.code;
  const message = root.error?.message;
  return {
    code:
      typeof status === "string"
        ? status
        : typeof code === "number"
          ? String(code)
          : typeof code === "string"
            ? code
            : null,
    message: typeof message === "string" ? message.slice(0, 500) : null,
  };
}

async function probeGeminiModel(model: string, maxOutputTokens: number): Promise<ProbeResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      provider: "gemini",
      model,
      status: "down",
      latencyMs: null,
      httpStatus: null,
      errorCode: "MISSING_API_KEY",
      errorMessage: "GEMINI_API_KEY ist nicht gesetzt.",
    };
  }

  const startedAt = Date.now();
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "health-check" }] }],
        generationConfig: { temperature: 0, maxOutputTokens: Math.max(8, Math.round(maxOutputTokens)) },
      }),
    }
  ).catch(() => null);
  const latencyMs = Date.now() - startedAt;

  if (!response) {
    return {
      provider: "gemini",
      model,
      status: "down",
      latencyMs,
      httpStatus: null,
      errorCode: "NETWORK_OR_TIMEOUT",
      errorMessage: "Netzwerkfehler oder Timeout beim Gemini-Health-Check.",
    };
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const parsed = parseErrorPayload(body);
    return {
      provider: "gemini",
      model,
      status: "down",
      latencyMs,
      httpStatus: response.status,
      errorCode: parsed.code ?? `HTTP_${response.status}`,
      errorMessage: parsed.message ?? `Gemini antwortete mit HTTP ${response.status}.`,
    };
  }

  return {
    provider: "gemini",
    model,
    status: "healthy",
    latencyMs,
    httpStatus: response.status,
    errorCode: null,
    errorMessage: null,
  };
}

async function probeGroqModel(model: string, maxOutputTokens: number): Promise<ProbeResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      provider: "groq",
      model,
      status: "down",
      latencyMs: null,
      httpStatus: null,
      errorCode: "MISSING_API_KEY",
      errorMessage: "GROQ_API_KEY ist nicht gesetzt.",
    };
  }

  const startedAt = Date.now();
  const response = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: Math.max(8, Math.round(maxOutputTokens)),
      messages: [{ role: "user", content: "health-check" }],
    }),
  }).catch(() => null);
  const latencyMs = Date.now() - startedAt;

  if (!response) {
    return {
      provider: "groq",
      model,
      status: "down",
      latencyMs,
      httpStatus: null,
      errorCode: "NETWORK_OR_TIMEOUT",
      errorMessage: "Netzwerkfehler oder Timeout beim Groq-Health-Check.",
    };
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const parsed = parseErrorPayload(body);
    return {
      provider: "groq",
      model,
      status: "down",
      latencyMs,
      httpStatus: response.status,
      errorCode: parsed.code ?? `HTTP_${response.status}`,
      errorMessage: parsed.message ?? `Groq antwortete mit HTTP ${response.status}.`,
    };
  }

  return {
    provider: "groq",
    model,
    status: "healthy",
    latencyMs,
    httpStatus: response.status,
    errorCode: null,
    errorMessage: null,
  };
}

function makeProbeKey(provider: "gemini" | "groq", model: string): string {
  return `${provider}:${model}`;
}

export async function runAndPersistModelHealthChecks(input: {
  supabase: SupabaseClientLike;
  organizationId: string;
  trigger: "manual" | "cron" | "auto";
}): Promise<void> {
  const { data: branding } = await input.supabase
    .schema("app")
    .from("tenant_branding")
    .select("branding_config")
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  const llmPolicy = readAnalysisNetworkLlmPolicy(branding?.branding_config ?? null);
  if (!isLlmFeatureEnabled(llmPolicy, "model_health_checks")) {
    return;
  }
  const targets = getFeatureTargets();
  const uniqueTargets = new Map<string, FeatureTarget>();
  for (const target of targets) {
    uniqueTargets.set(makeProbeKey(target.provider, target.model), target);
  }

  const probes = new Map<string, ProbeResult>();
  const healthMaxOutputTokens = resolveLlmMaxOutputTokens(llmPolicy, "model_health_checks");
  for (const target of uniqueTargets.values()) {
    const result =
      target.provider === "gemini"
        ? await probeGeminiModel(target.model, healthMaxOutputTokens)
        : await probeGroqModel(target.model, healthMaxOutputTokens);
    probes.set(makeProbeKey(target.provider, target.model), result);
  }

  const groqProbe = probes.get(makeProbeKey("groq", GROQ_MODEL));
  const checkedAtIso = new Date().toISOString();

  const rows = targets.map((target) => {
    const probe = probes.get(makeProbeKey(target.provider, target.model));
    const providerHealthy = probe?.status === "healthy";
    const fallbackByGroq = target.provider === "gemini" && !providerHealthy && groqProbe?.status === "healthy";

    const status: ModelHealthStatus = providerHealthy ? "healthy" : fallbackByGroq ? "degraded" : "down";
    const fallbackMode: FallbackMode = providerHealthy ? "none" : fallbackByGroq ? "groq" : "rule";

    return {
      organization_id: input.organizationId,
      feature: target.feature,
      provider: target.provider,
      model: target.model,
      status,
      fallback_active: fallbackMode !== "none",
      fallback_mode: fallbackMode,
      latency_ms: probe?.latencyMs ?? null,
      http_status: probe?.httpStatus ?? null,
      error_code: probe?.errorCode ?? null,
      error_message: probe?.errorMessage ?? null,
      checked_at: checkedAtIso,
      metadata: {
        trigger: input.trigger,
        groqFallbackHealthy: groqProbe?.status === "healthy",
      },
    };
  });

  await input.supabase
    .schema("app")
    .from("llm_model_health_status")
    .upsert(rows, { onConflict: "organization_id,feature" });

  const providerModels = rows.map((row) => ({
    provider: row.provider,
    model: row.model,
    promptVersion: "health-check-v1",
  }));
  const status =
    rows.some((row) => row.status === "down")
      ? "failed"
      : rows.some((row) => row.status === "degraded")
        ? "partial"
        : "success";
  const healthErrors = rows
    .filter((row) => row.error_code || row.error_message)
    .map((row) => ({
      feature: row.feature,
      code: row.error_code,
      message: row.error_message,
      httpStatus: row.http_status,
    }));
  const result = await writeAiStorageActionLog({
    supabase: input.supabase,
    organizationId: input.organizationId,
    cycleInstanceId: null,
    feature: "model_health_checks",
    action: "run_health_checks",
    triggerType: input.trigger,
    status,
    startedAt: checkedAtIso,
    finishedAt: new Date().toISOString(),
    providerModels,
    counts: {
      totalChecks: rows.length,
      healthy: rows.filter((row) => row.status === "healthy").length,
      degraded: rows.filter((row) => row.status === "degraded").length,
      down: rows.filter((row) => row.status === "down").length,
    },
    items: rows.map((row) => ({
      feature: row.feature,
      provider: row.provider,
      model: row.model,
      status: row.status,
      fallbackMode: row.fallback_mode,
      latencyMs: row.latency_ms,
      httpStatus: row.http_status,
    })),
    errors: healthErrors,
    metadata: {
      trigger: input.trigger,
      checkedAt: checkedAtIso,
    },
  });
  if (!result.ok) {
    console.warn("[ai-storage-log] health-check log write failed", {
      organizationId: input.organizationId,
      trigger: input.trigger,
      error: result.error,
    });
  }
}
