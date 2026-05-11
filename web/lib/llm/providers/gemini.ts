import type { ZodTypeAny } from "zod";

import {
  GEMINI_MODEL_ASSIST,
  scoreWithGemini,
} from "@/lib/analysis-network/providers";

import { buildRepairUserPrompt, tryParseJson, validateAgainstSchema } from "./json-utils";
import {
  LlmProviderError,
  type LlmGenerateJsonArgs,
  type LlmGenerateJsonResult,
  type LlmGenerateTextArgs,
  type LlmGenerateTextResult,
  type LlmHealthResult,
  type LlmProvider,
  type LlmUsage,
} from "./types";

const PROVIDER_NAME = "gemini" as const;

function combinePrompts(systemPrompt: string | undefined, userPrompt: string): string {
  if (!systemPrompt || !systemPrompt.trim()) return userPrompt;
  return `${systemPrompt.trim()}\n\n${userPrompt}`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number | undefined, label: string): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return promise;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new LlmProviderError({
              provider: PROVIDER_NAME,
              code: "timeout",
              message: `${label} timed out after ${timeoutMs} ms`,
              retryable: true,
            })
          ),
        timeoutMs
      )
    ),
  ]);
}

async function callRaw(args: {
  prompt: string;
  model: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
}): Promise<{ text: string; usage: LlmUsage }> {
  const result = await withTimeout(
    scoreWithGemini(args.prompt, args.model, args.maxOutputTokens),
    args.timeoutMs,
    "gemini.generate"
  );
  if (!result) {
    if (!process.env.GEMINI_API_KEY) {
      throw new LlmProviderError({
        provider: PROVIDER_NAME,
        code: "missing_api_key",
        message: "GEMINI_API_KEY is not configured",
      });
    }
    throw new LlmProviderError({
      provider: PROVIDER_NAME,
      code: "request_failed",
      message: "Gemini returned no result",
      retryable: true,
    });
  }
  return result;
}

async function generateJson<TSchema extends ZodTypeAny>(
  args: LlmGenerateJsonArgs<TSchema>
): Promise<LlmGenerateJsonResult<TSchema>> {
  const model = args.model ?? GEMINI_MODEL_ASSIST;
  const prompt = combinePrompts(args.systemPrompt, args.userPrompt);
  const first = await callRaw({
    prompt,
    model,
    maxOutputTokens: args.maxOutputTokens,
    timeoutMs: args.timeoutMs,
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
  const second = await callRaw({
    prompt: combinePrompts(args.systemPrompt, repairPrompt),
    model,
    maxOutputTokens: args.maxOutputTokens,
    timeoutMs: args.timeoutMs,
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
  const model = args.model ?? GEMINI_MODEL_ASSIST;
  const prompt = combinePrompts(args.systemPrompt, args.userPrompt);
  const result = await callRaw({
    prompt,
    model,
    maxOutputTokens: args.maxOutputTokens,
    timeoutMs: args.timeoutMs,
  });
  return {
    text: result.text,
    usage: result.usage,
    provider: PROVIDER_NAME,
    model,
  };
}

async function health(): Promise<LlmHealthResult> {
  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, latencyMs: 0, error: "missing_api_key" };
  }
  const startedAt = Date.now();
  try {
    const result = await scoreWithGemini("ping", GEMINI_MODEL_ASSIST, 32);
    if (!result || !result.text) {
      return { ok: false, latencyMs: Date.now() - startedAt, error: "no_response" };
    }
    return { ok: true, latencyMs: Date.now() - startedAt };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export const geminiProvider: LlmProvider = {
  name: PROVIDER_NAME,
  defaultModel: GEMINI_MODEL_ASSIST,
  generateJson,
  generateText,
  health,
};
