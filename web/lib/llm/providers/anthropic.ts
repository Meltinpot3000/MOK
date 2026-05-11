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

const PROVIDER_NAME = "anthropic" as const;

const ANTHROPIC_DEFAULT_MODEL =
  process.env.SENTINEL_ANTHROPIC_MODEL ?? process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet";

function notImplemented(method: string): never {
  throw new LlmProviderError({
    provider: PROVIDER_NAME,
    code: "not_implemented",
    message: `${method} is not implemented yet (Phase 2 stub – Anthropic Messages API).`,
  });
}

async function generateJson<TSchema extends ZodTypeAny>(
  _args: LlmGenerateJsonArgs<TSchema>
): Promise<LlmGenerateJsonResult<TSchema>> {
  void _args;
  notImplemented("anthropic.generateJson");
}

async function generateText(_args: LlmGenerateTextArgs): Promise<LlmGenerateTextResult> {
  void _args;
  notImplemented("anthropic.generateText");
}

async function health(): Promise<LlmHealthResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, latencyMs: 0, error: "missing_api_key" };
  }
  return { ok: false, latencyMs: 0, error: "not_implemented" };
}

export const anthropicProvider: LlmProvider = {
  name: PROVIDER_NAME,
  defaultModel: ANTHROPIC_DEFAULT_MODEL,
  generateJson,
  generateText,
  health,
};
