import type { ZodTypeAny } from "zod";

import { buildRepairUserPrompt, tryParseJson, validateAgainstSchema } from "./json-utils";
import {
  EMPTY_USAGE,
  LlmProviderError,
  type LlmGenerateJsonArgs,
  type LlmGenerateJsonResult,
  type LlmGenerateTextArgs,
  type LlmGenerateTextResult,
  type LlmHealthResult,
  type LlmProvider,
  type LlmUsage,
} from "./types";

const PROVIDER_NAME = "ollama" as const;

const OLLAMA_BASE_URL = (
  process.env.SENTINEL_LOCAL_LLM_BASE_URL ??
  process.env.OLLAMA_BASE_URL ??
  "http://localhost:11434"
).replace(/\/+$/, "");

const OLLAMA_DEFAULT_MODEL =
  process.env.SENTINEL_LOCAL_LLM_MODEL ?? process.env.OLLAMA_MODEL ?? "llama3.1:8b-instruct-q4_K_M";

const DEFAULT_TIMEOUT_MS = Number(process.env.SENTINEL_LOCAL_LLM_TIMEOUT_MS ?? 20000);

type OllamaChatMessage = { role: "system" | "user" | "assistant"; content: string };

type OllamaChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string };
};

function parseUsage(payload: OllamaChatCompletionResponse): LlmUsage {
  const usage = payload.usage;
  if (!usage) return EMPTY_USAGE;
  const prompt = typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : null;
  const completion = typeof usage.completion_tokens === "number" ? usage.completion_tokens : null;
  const total = typeof usage.total_tokens === "number" ? usage.total_tokens : null;
  const usageMissing = prompt === null && completion === null && total === null;
  return {
    promptTokens: prompt,
    completionTokens: completion,
    totalTokens: total,
    billableCost: 0,
    usageMissing,
  };
}

async function callChatCompletions(args: {
  model: string;
  messages: OllamaChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs: number;
  jsonMode: boolean;
}): Promise<{ text: string; usage: LlmUsage }> {
  const url = `${OLLAMA_BASE_URL}/v1/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: args.model,
        temperature: typeof args.temperature === "number" ? args.temperature : 0.1,
        ...(Number.isFinite(args.maxOutputTokens) && Number(args.maxOutputTokens) > 0
          ? { max_tokens: Math.round(Number(args.maxOutputTokens)) }
          : {}),
        ...(args.jsonMode ? { response_format: { type: "json_object" } } : {}),
        messages: args.messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const bodyText = await safeText(response);
      throw new LlmProviderError({
        provider: PROVIDER_NAME,
        code: response.status === 429 ? "rate_limited" : "request_failed",
        message: `HTTP ${response.status}: ${bodyText.slice(0, 400)}`,
        retryable: response.status >= 500 || response.status === 429,
      });
    }

    const data = (await response.json()) as OllamaChatCompletionResponse;
    if (data.error?.message) {
      throw new LlmProviderError({
        provider: PROVIDER_NAME,
        code: "request_failed",
        message: data.error.message,
      });
    }
    const text = data.choices?.[0]?.message?.content ?? "";
    return { text, usage: parseUsage(data) };
  } catch (error) {
    if (error instanceof LlmProviderError) throw error;
    if ((error as { name?: string } | null)?.name === "AbortError") {
      throw new LlmProviderError({
        provider: PROVIDER_NAME,
        code: "timeout",
        message: `Ollama request timed out after ${args.timeoutMs} ms`,
        retryable: true,
      });
    }
    throw new LlmProviderError({
      provider: PROVIDER_NAME,
      code: "request_failed",
      message: error instanceof Error ? error.message : String(error),
      retryable: true,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function buildMessages(
  systemPrompt: string | undefined,
  userPrompt: string
): OllamaChatMessage[] {
  const messages: OllamaChatMessage[] = [];
  if (systemPrompt && systemPrompt.trim()) {
    messages.push({ role: "system", content: systemPrompt.trim() });
  }
  messages.push({ role: "user", content: userPrompt });
  return messages;
}

async function generateJson<TSchema extends ZodTypeAny>(
  args: LlmGenerateJsonArgs<TSchema>
): Promise<LlmGenerateJsonResult<TSchema>> {
  const model = args.model ?? OLLAMA_DEFAULT_MODEL;
  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const jsonSystemAddon =
    "Du gibst ausschließlich valides JSON zurück, ohne Markdown, ohne Kommentare, ohne Erklärtext.";
  const combinedSystem = args.systemPrompt
    ? `${args.systemPrompt.trim()}\n\n${jsonSystemAddon}`
    : jsonSystemAddon;

  const first = await callChatCompletions({
    model,
    messages: buildMessages(combinedSystem, args.userPrompt),
    temperature: args.temperature,
    maxOutputTokens: args.maxOutputTokens,
    timeoutMs,
    jsonMode: true,
  });

  const parsedFirst = tryParseJson(first.text);
  if (parsedFirst !== null) {
    try {
      const data = validateAgainstSchema(parsedFirst, args.schema, PROVIDER_NAME);
      return {
        data,
        usage: first.usage,
        rawText: first.text,
        provider: PROVIDER_NAME,
        model,
        repaired: false,
      };
    } catch (error) {
      if (!(error instanceof LlmProviderError) || error.code !== "schema_validation_failed") {
        throw error;
      }
    }
  }

  const repairPrompt = buildRepairUserPrompt({
    schemaName: args.schemaName,
    schema: args.schema,
    previousText: first.text,
    validationError: parsedFirst === null ? "Antwort war kein gültiges JSON" : undefined,
  });
  const second = await callChatCompletions({
    model,
    messages: buildMessages(combinedSystem, repairPrompt),
    temperature: args.temperature,
    maxOutputTokens: args.maxOutputTokens,
    timeoutMs,
    jsonMode: true,
  });

  const parsedSecond = tryParseJson(second.text);
  if (parsedSecond === null) {
    throw new LlmProviderError({
      provider: PROVIDER_NAME,
      code: "invalid_json",
      message: "Repair attempt did not return valid JSON",
    });
  }
  const data = validateAgainstSchema(parsedSecond, args.schema, PROVIDER_NAME);
  return {
    data,
    usage: second.usage,
    rawText: second.text,
    provider: PROVIDER_NAME,
    model,
    repaired: true,
  };
}

async function generateText(args: LlmGenerateTextArgs): Promise<LlmGenerateTextResult> {
  const model = args.model ?? OLLAMA_DEFAULT_MODEL;
  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const result = await callChatCompletions({
    model,
    messages: buildMessages(args.systemPrompt, args.userPrompt),
    temperature: args.temperature,
    maxOutputTokens: args.maxOutputTokens,
    timeoutMs,
    jsonMode: false,
  });
  return {
    text: result.text,
    usage: result.usage,
    provider: PROVIDER_NAME,
    model,
  };
}

async function health(): Promise<LlmHealthResult> {
  const startedAt = Date.now();
  const url = `${OLLAMA_BASE_URL}/api/tags`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: `HTTP ${response.status}`,
      };
    }
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export const ollamaProvider: LlmProvider = {
  name: PROVIDER_NAME,
  defaultModel: OLLAMA_DEFAULT_MODEL,
  generateJson,
  generateText,
  health,
};

export const _internal = {
  buildMessages,
  parseUsage,
  baseUrl: OLLAMA_BASE_URL,
  defaultModel: OLLAMA_DEFAULT_MODEL,
};
