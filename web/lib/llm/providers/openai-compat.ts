import type { ZodTypeAny } from "zod";

import {
  LlmProviderError,
  type LlmGenerateJsonArgs,
  type LlmGenerateJsonResult,
  type LlmGenerateTextArgs,
  type LlmGenerateTextResult,
  type LlmHealthResult,
  type LlmProvider,
} from "./types";

const PROVIDER_NAME = "openai_compat" as const;

const OPENAI_COMPAT_BASE_URL =
  process.env.SENTINEL_OPENAI_COMPAT_BASE_URL ?? process.env.OPENAI_COMPAT_BASE_URL ?? "";
const OPENAI_COMPAT_DEFAULT_MODEL =
  process.env.SENTINEL_OPENAI_COMPAT_MODEL ?? process.env.OPENAI_COMPAT_MODEL ?? "";

function notImplemented(method: string): never {
  throw new LlmProviderError({
    provider: PROVIDER_NAME,
    code: "not_implemented",
    message: `${method} is not implemented yet (Phase 2 stub for vLLM/OpenAI-compatible endpoints).`,
  });
}

async function generateJson<TSchema extends ZodTypeAny>(
  _args: LlmGenerateJsonArgs<TSchema>
): Promise<LlmGenerateJsonResult<TSchema>> {
  void _args;
  notImplemented("openai_compat.generateJson");
}

async function generateText(_args: LlmGenerateTextArgs): Promise<LlmGenerateTextResult> {
  void _args;
  notImplemented("openai_compat.generateText");
}

async function health(): Promise<LlmHealthResult> {
  if (!OPENAI_COMPAT_BASE_URL) {
    return { ok: false, latencyMs: 0, error: "openai_compat_base_url_not_configured" };
  }
  return { ok: false, latencyMs: 0, error: "not_implemented" };
}

export const openAiCompatProvider: LlmProvider = {
  name: PROVIDER_NAME,
  defaultModel: OPENAI_COMPAT_DEFAULT_MODEL,
  generateJson,
  generateText,
  health,
};
