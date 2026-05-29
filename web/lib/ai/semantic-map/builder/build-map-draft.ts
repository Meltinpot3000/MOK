import { getProvider, type LlmProviderName } from "@/lib/llm/providers";

import { getInventoryScopeCaps } from "../inventory/scope-caps";
import { resolveSemanticMapBuildScope } from "../inventory/build-scope";
import { logSemanticMapBuildPreflight } from "./log-build-preflight";
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
  scope?: string | null;
  inventoryTableCount?: number;
  inventoryToolCount?: number;
  inventoryUiRouteCount?: number;
  inventoryForeignKeyCount?: number;
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
  const scope = resolveSemanticMapBuildScope({
    scopeArg: options.scope ?? null,
    envScope: process.env.AI_SEMANTIC_MAP_BUILD_SCOPE,
  });
  const caps = getInventoryScopeCaps(scope);
  const providerName = (options.model?.provider as LlmProviderName | undefined) ?? resolveProviderName();
  const provider = getProvider(providerName);
  const model = options.model?.name?.trim() || provider.defaultModel;
  let inv = options.inventoryJson;
  if (inv.length > caps.maxPromptChars) {
    inv = inv.slice(0, caps.maxPromptChars);
  }
  const timeoutMs = Number(process.env.SEMANTIC_MAP_LLM_TIMEOUT_MS ?? 120000);
  logSemanticMapBuildPreflight({
    scope,
    inventoryTableCount: options.inventoryTableCount ?? 0,
    inventoryToolCount: options.inventoryToolCount ?? 0,
    inventoryUiRouteCount: options.inventoryUiRouteCount ?? 0,
    inventoryForeignKeyCount: options.inventoryForeignKeyCount ?? 0,
    promptChars: inv.length,
    model,
    provider: providerName,
    timeoutMs,
  });
  const userPrompt = buildSemanticMapDraftUserPrompt({ inventoryJson: inv });
  const maxOutputTokens =
    scope === "strategy"
      ? Number(process.env.SEMANTIC_MAP_BUILD_MAX_OUTPUT_TOKENS ?? 2400)
      : 4000;

  const result = await provider.generateJson({
    systemPrompt: buildSemanticMapDraftSystemPrompt(),
    userPrompt,
    schemaName: SEMANTIC_MAP_DRAFT_SCHEMA_NAME,
    schema: semanticMapDraftLlmSchema,
    temperature: scope === "strategy" ? 0.1 : 0.15,
    maxOutputTokens,
    timeoutMs,
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
