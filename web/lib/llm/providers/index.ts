import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";
import { groqProvider } from "./groq";
import { ollamaProvider } from "./ollama";
import { openAiCompatProvider } from "./openai-compat";
import type { LlmProvider, LlmProviderName } from "./types";

const REGISTRY: Record<LlmProviderName, LlmProvider> = {
  ollama: ollamaProvider,
  groq: groqProvider,
  gemini: geminiProvider,
  openai_compat: openAiCompatProvider,
  anthropic: anthropicProvider,
};

export function getProvider(name: LlmProviderName): LlmProvider {
  const provider = REGISTRY[name];
  if (!provider) {
    throw new Error(`Unknown LLM provider: ${String(name)}`);
  }
  return provider;
}

export function listProviderNames(): LlmProviderName[] {
  return Object.keys(REGISTRY) as LlmProviderName[];
}

export type { LlmProvider, LlmProviderName } from "./types";
export {
  EMPTY_USAGE,
  LlmProviderError,
  type LlmGenerateJsonArgs,
  type LlmGenerateJsonResult,
  type LlmGenerateTextArgs,
  type LlmGenerateTextResult,
  type LlmHealthResult,
  type LlmUsage,
} from "./types";
