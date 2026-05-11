import {
  LlmProviderError,
  getProvider,
  type LlmGenerateTextResult,
  type LlmProvider,
  type LlmProviderName,
} from "@/lib/llm/providers";
import { tryParseJson } from "@/lib/llm/providers/json-utils";

import { SENTINEL_PLAN_FALLBACK, type SentinelPlan } from "./schemas";
import { parseSentinelPlanWithNormalization } from "./plan-normalize";

export type SentinelLocalProviderName = Extract<LlmProviderName, "ollama" | "openai_compat">;

const DEFAULT_TIMEOUT_MS = Number(process.env.SENTINEL_LOCAL_LLM_TIMEOUT_MS ?? 60000);
const TIMEOUT_RETRY_BACKOFF_MS = 30000;

function resolveLocalProvider(): { provider: LlmProvider; name: SentinelLocalProviderName } {
  const configured = (process.env.SENTINEL_LOCAL_LLM_PROVIDER ?? "ollama").trim().toLowerCase();
  if (configured === "openai_compat" || configured === "vllm") {
    return { provider: getProvider("openai_compat"), name: "openai_compat" };
  }
  return { provider: getProvider("ollama"), name: "ollama" };
}

export type SentinelPlanCallResult = {
  plan: SentinelPlan;
  usedFallback: boolean;
  fallbackReason?: string;
  rawText?: string;
  usage: LlmGenerateTextResult["usage"] | null;
  provider: LlmProviderName;
  model: string;
  repaired: boolean;
};

/**
 * Plan-Mode-Aufruf an Sentinel Core. Liefert immer einen gueltigen SentinelPlan;
 * bei Fehlern wird der `unknown`-Fallback verwendet (Spec §23.1).
 */
export async function callSentinelPlanMode(args: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  model?: string;
}): Promise<SentinelPlanCallResult> {
  const { provider, name } = resolveLocalProvider();
  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    let result: LlmGenerateTextResult;
    try {
      result = await provider.generateText({
        systemPrompt: args.systemPrompt,
        userPrompt: args.userPrompt,
        temperature: args.temperature ?? 0.1,
        maxOutputTokens: args.maxOutputTokens ?? 800,
        timeoutMs,
        model: args.model,
      });
    } catch (error) {
      if (!(error instanceof LlmProviderError) || error.code !== "timeout") {
        throw error;
      }
      result = await provider.generateText({
        systemPrompt: args.systemPrompt,
        userPrompt: args.userPrompt,
        temperature: args.temperature ?? 0.1,
        maxOutputTokens: args.maxOutputTokens ?? 800,
        timeoutMs: timeoutMs + TIMEOUT_RETRY_BACKOFF_MS,
        model: args.model,
      });
    }
    const parsedJson = tryParseJson(result.text);
    const normalized = parseSentinelPlanWithNormalization(parsedJson);
    return {
      plan: normalized.plan,
      usedFallback: false,
      rawText: result.text,
      usage: result.usage,
      provider: result.provider,
      model: result.model,
      repaired: normalized.degraded,
    };
  } catch (error) {
    const reason =
      error instanceof LlmProviderError
        ? `${error.code}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
    console.warn(`[sentinel-core] plan mode fallback (${name}): ${reason}`);
    return {
      plan: SENTINEL_PLAN_FALLBACK,
      usedFallback: true,
      fallbackReason: reason,
      usage: null,
      provider: name,
      model: provider.defaultModel,
      repaired: false,
    };
  }
}

export type SentinelSynthesisResult = {
  text: string;
  usage: LlmGenerateTextResult["usage"];
  provider: LlmProviderName;
  model: string;
  errorMessage?: string;
};

/**
 * Synthesis-Mode-Aufruf an Sentinel Core (lokales Modell). Wird nur verwendet,
 * wenn der Model Router auf `local` entschieden hat.
 */
export async function callSentinelSynthesisMode(args: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  model?: string;
}): Promise<SentinelSynthesisResult> {
  const { provider, name } = resolveLocalProvider();
  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    let result: LlmGenerateTextResult;
    try {
      result = await provider.generateText({
        systemPrompt: args.systemPrompt,
        userPrompt: args.userPrompt,
        temperature: args.temperature ?? 0.2,
        maxOutputTokens: args.maxOutputTokens ?? 1200,
        timeoutMs,
        model: args.model,
      });
    } catch (error) {
      if (!(error instanceof LlmProviderError) || error.code !== "timeout") {
        throw error;
      }
      result = await provider.generateText({
        systemPrompt: args.systemPrompt,
        userPrompt: args.userPrompt,
        temperature: args.temperature ?? 0.2,
        maxOutputTokens: args.maxOutputTokens ?? 1200,
        timeoutMs: timeoutMs + TIMEOUT_RETRY_BACKOFF_MS,
        model: args.model,
      });
    }
    return {
      text: result.text,
      usage: result.usage,
      provider: result.provider,
      model: result.model,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      text: "",
      usage: {
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        billableCost: null,
        usageMissing: true,
      },
      provider: name,
      model: provider.defaultModel,
      errorMessage: message,
    };
  }
}

export async function checkSentinelCoreHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
  provider: SentinelLocalProviderName;
  error?: string;
}> {
  const { provider, name } = resolveLocalProvider();
  const result = await provider.health();
  return { ...result, provider: name };
}
