import { readAnalysisNetworkLlmPolicy, type AnalysisNetworkLlmPolicy } from "@/lib/analysis-network/policy";

export type SharedLlmPolicy = AnalysisNetworkLlmPolicy;

export { readAnalysisNetworkLlmPolicy } from "@/lib/analysis-network/policy";

export function getSharedLlmPolicy(brandingConfig: unknown): SharedLlmPolicy {
  return readAnalysisNetworkLlmPolicy(brandingConfig);
}

export type SharedLlmProviderAvailability = {
  groq: boolean;
  gemini: boolean;
  openaiCompat: boolean;
  anthropic: boolean;
  ollama: boolean;
};

export function detectProviderAvailability(): SharedLlmProviderAvailability {
  return {
    groq: Boolean(process.env.GROQ_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    openaiCompat: Boolean(
      process.env.SENTINEL_OPENAI_COMPAT_BASE_URL ?? process.env.OPENAI_COMPAT_BASE_URL
    ),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    ollama: true,
  };
}
