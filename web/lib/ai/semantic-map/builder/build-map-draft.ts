import { getProvider, type LlmProviderName } from "@/lib/llm/providers";

import { INVENTORY_JSON_MAX_CHARS } from "../inventory/caps";
import {
  SEMANTIC_MAP_DRAFT_SCHEMA_NAME,
  semanticMapDraftLlmSchema,
  type SemanticMapDraft,
} from "../types";
import { buildSemanticMapDraftSystemPrompt, buildSemanticMapDraftUserPrompt } from "./map-draft-prompt";
import { normalizeMapDraft } from "./normalize-map-draft";

export type BuildMapDraftLlmOptions = {
  inventoryJson: string;
  model?: { provider: string; name: string };
};

function resolveProviderName(): LlmProviderName {
  const raw = (
    process.env.SEMANTIC_MAP_LLM_PROVIDER ??
    process.env.SENTINEL_LOCAL_LLM_PROVIDER ??
    "ollama"
  )
    .trim()
    .toLowerCase();
  if (raw === "openai_compat" || raw === "vllm") return "openai_compat";
  if (raw === "groq") return "groq";
  if (raw === "gemini") return "gemini";
  if (raw === "anthropic") return "anthropic";
  return "ollama";
}

export async function buildMapDraftWithLlm(
  options: BuildMapDraftLlmOptions
): Promise<{
  draft: SemanticMapDraft;
  rawText: string;
  provider: LlmProviderName;
  model: string;
}> {
  const providerName = (options.model?.provider as LlmProviderName | undefined) ?? resolveProviderName();
  const provider = getProvider(providerName);
  const model = options.model?.name?.trim() || provider.defaultModel;
  let inv = options.inventoryJson;
  if (inv.length > INVENTORY_JSON_MAX_CHARS) {
    inv = inv.slice(0, INVENTORY_JSON_MAX_CHARS);
  }
  const userPrompt = buildSemanticMapDraftUserPrompt({ inventoryJson: inv });
  const result = await provider.generateJson({
    systemPrompt: buildSemanticMapDraftSystemPrompt(),
    userPrompt,
    schemaName: SEMANTIC_MAP_DRAFT_SCHEMA_NAME,
    schema: semanticMapDraftLlmSchema,
    temperature: 0.15,
    maxOutputTokens: 4000,
    timeoutMs: Number(process.env.SEMANTIC_MAP_LLM_TIMEOUT_MS ?? 120000),
    model,
  });
  const draft = normalizeMapDraft(result.data);
  return {
    draft,
    rawText: result.rawText,
    provider: result.provider,
    model: result.model,
  };
}
