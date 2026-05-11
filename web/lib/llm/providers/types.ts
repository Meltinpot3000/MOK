import type { ZodTypeAny, z } from "zod";

export type LlmProviderName = "ollama" | "groq" | "gemini" | "openai_compat" | "anthropic";

export type LlmUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  billableCost: number | null;
  usageMissing: boolean;
};

export type LlmGenerateJsonArgs<TSchema extends ZodTypeAny> = {
  systemPrompt?: string;
  userPrompt: string;
  schemaName: string;
  schema: TSchema;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  model?: string;
};

export type LlmGenerateJsonResult<TSchema extends ZodTypeAny> = {
  data: z.infer<TSchema>;
  usage: LlmUsage;
  rawText: string;
  provider: LlmProviderName;
  model: string;
  repaired: boolean;
};

export type LlmGenerateTextArgs = {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  model?: string;
};

export type LlmGenerateTextResult = {
  text: string;
  usage: LlmUsage;
  provider: LlmProviderName;
  model: string;
};

export type LlmHealthResult = {
  ok: boolean;
  latencyMs: number;
  error?: string;
};

export type LlmProvider = {
  name: LlmProviderName;
  defaultModel: string;
  generateJson<TSchema extends ZodTypeAny>(
    args: LlmGenerateJsonArgs<TSchema>
  ): Promise<LlmGenerateJsonResult<TSchema>>;
  generateText(args: LlmGenerateTextArgs): Promise<LlmGenerateTextResult>;
  health(): Promise<LlmHealthResult>;
};

export class LlmProviderError extends Error {
  readonly provider: LlmProviderName;
  readonly code:
    | "missing_api_key"
    | "request_failed"
    | "schema_validation_failed"
    | "invalid_json"
    | "timeout"
    | "rate_limited"
    | "not_implemented";
  readonly retryable: boolean;

  constructor(args: {
    provider: LlmProviderName;
    code: LlmProviderError["code"];
    message: string;
    retryable?: boolean;
  }) {
    super(`[${args.provider}] ${args.code}: ${args.message}`);
    this.name = "LlmProviderError";
    this.provider = args.provider;
    this.code = args.code;
    this.retryable = args.retryable ?? false;
  }
}

export const EMPTY_USAGE: LlmUsage = {
  promptTokens: null,
  completionTokens: null,
  totalTokens: null,
  billableCost: null,
  usageMissing: true,
};
