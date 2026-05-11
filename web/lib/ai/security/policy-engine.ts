import type { SupabaseClient } from "@supabase/supabase-js";

import {
  detectProviderAvailability,
  getSharedLlmPolicy,
  type SharedLlmPolicy,
  type SharedLlmProviderAvailability,
} from "@/lib/llm/policy";

export type AiAdminSettingsRow = {
  organizationId: string;
  aiEnabled: boolean;
  localLlmEnabled: boolean;
  externalModelsEnabled: boolean;
  webSearchEnabled: boolean;
  writeActionsEnabled: boolean;
  requireHumanApproval: boolean;
  defaultLocalModel: string | null;
  defaultFastModel: string | null;
  defaultFrontierModel: string | null;
  maxToolCallsPerRun: number;
  maxContextObjects: number;
  logPrompts: boolean;
  logResponses: boolean;
  logToolCalls: boolean;
};

export const DEFAULT_AI_ADMIN_SETTINGS: AiAdminSettingsRow = {
  organizationId: "",
  aiEnabled: false,
  localLlmEnabled: true,
  externalModelsEnabled: false,
  webSearchEnabled: false,
  writeActionsEnabled: false,
  requireHumanApproval: true,
  defaultLocalModel: null,
  defaultFastModel: null,
  defaultFrontierModel: null,
  maxToolCallsPerRun: 8,
  maxContextObjects: 30,
  logPrompts: true,
  logResponses: true,
  logToolCalls: true,
};

export type EffectivePolicy = {
  organizationId: string;
  aiEnabled: boolean;
  localLlmEnabled: boolean;
  externalModelsEnabled: boolean;
  webSearchEnabled: boolean;
  writeActionsEnabled: boolean;
  requireHumanApproval: boolean;
  allowRestrictedClassification: boolean;
  maxToolCallsPerRun: number;
  maxContextObjects: number;
  defaultLocalModel: string | null;
  defaultFastModel: string | null;
  defaultFrontierModel: string | null;
  logPrompts: boolean;
  logResponses: boolean;
  logToolCalls: boolean;
  /** Provider, die laut Env-Konfiguration prinzipiell verfuegbar sind. */
  providerAvailability: SharedLlmProviderAvailability;
  /** Tenant-LLM-Policy (analysis-network), z. B. fuer Token-Limits. */
  sharedLlmPolicy: SharedLlmPolicy;
  /** Auflistung aktivierter Downgrade-Gruende (User-sichtbar). */
  blockedReasons: string[];
};

async function readAdminSettings(
  supabase: SupabaseClient,
  organizationId: string
): Promise<AiAdminSettingsRow> {
  const { data } = await supabase
    .schema("app")
    .from("ai_admin_settings")
    .select(
      "organization_id, ai_enabled, local_llm_enabled, external_models_enabled, web_search_enabled, write_actions_enabled, require_human_approval, default_local_model, default_fast_model, default_frontier_model, max_tool_calls_per_run, max_context_objects, log_prompts, log_responses, log_tool_calls"
    )
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!data) return { ...DEFAULT_AI_ADMIN_SETTINGS, organizationId };
  return {
    organizationId: data.organization_id ?? organizationId,
    aiEnabled: Boolean(data.ai_enabled),
    localLlmEnabled: Boolean(data.local_llm_enabled),
    externalModelsEnabled: Boolean(data.external_models_enabled),
    webSearchEnabled: Boolean(data.web_search_enabled),
    writeActionsEnabled: Boolean(data.write_actions_enabled),
    requireHumanApproval: Boolean(data.require_human_approval),
    defaultLocalModel: data.default_local_model ?? null,
    defaultFastModel: data.default_fast_model ?? null,
    defaultFrontierModel: data.default_frontier_model ?? null,
    maxToolCallsPerRun: Number(data.max_tool_calls_per_run ?? 8),
    maxContextObjects: Number(data.max_context_objects ?? 30),
    logPrompts: Boolean(data.log_prompts),
    logResponses: Boolean(data.log_responses),
    logToolCalls: Boolean(data.log_tool_calls),
  };
}

async function readBrandingConfig(
  supabase: SupabaseClient,
  organizationId: string
): Promise<unknown> {
  const { data } = await supabase
    .schema("app")
    .from("organizations")
    .select("branding_config")
    .eq("id", organizationId)
    .maybeSingle();
  return data?.branding_config ?? null;
}

/**
 * Strengste-Regel-gewinnt-Logik: kombiniert Sentinel-spezifische Admin-Settings
 * mit der gemeinsamen LLM-Policy aus `branding_config.analysis_network`.
 *
 * - aiEnabled: nur true, wenn Admin explizit aktiviert UND Provider verfuegbar.
 * - externalModelsEnabled: nur true, wenn beides true.
 * - webSearchEnabled: nur true, wenn Admin explizit gesetzt UND keine globale Sperre.
 */
export async function loadEffectivePolicy(
  supabase: SupabaseClient,
  organizationId: string
): Promise<EffectivePolicy> {
  const [admin, brandingConfig] = await Promise.all([
    readAdminSettings(supabase, organizationId),
    readBrandingConfig(supabase, organizationId),
  ]);
  const sharedLlmPolicy = getSharedLlmPolicy(brandingConfig);
  const availability = detectProviderAvailability();

  const blockedReasons: string[] = [];
  const localLlmEnabled = admin.localLlmEnabled && availability.ollama;
  if (admin.localLlmEnabled && !availability.ollama) {
    blockedReasons.push("Lokales LLM nicht erreichbar.");
  }
  const anyExternalProvider = availability.groq || availability.gemini || availability.anthropic;
  const externalModelsEnabled = admin.externalModelsEnabled && anyExternalProvider;
  if (admin.externalModelsEnabled && !anyExternalProvider) {
    blockedReasons.push("Keine externen LLM-Provider konfiguriert (Env-Keys fehlen).");
  }
  const webSearchEnabled = admin.webSearchEnabled && externalModelsEnabled;
  if (admin.webSearchEnabled && !externalModelsEnabled) {
    blockedReasons.push("Web-Suche benoetigt aktivierte externe Modelle, aber diese sind blockiert.");
  }

  const aiEnabled = admin.aiEnabled && (localLlmEnabled || externalModelsEnabled);
  if (admin.aiEnabled && !aiEnabled) {
    blockedReasons.push("Kein LLM verfuegbar (lokal + extern blockiert).");
  }

  return {
    organizationId,
    aiEnabled,
    localLlmEnabled,
    externalModelsEnabled,
    webSearchEnabled,
    writeActionsEnabled: admin.writeActionsEnabled,
    requireHumanApproval: admin.requireHumanApproval,
    allowRestrictedClassification: false,
    maxToolCallsPerRun: admin.maxToolCallsPerRun,
    maxContextObjects: admin.maxContextObjects,
    defaultLocalModel: admin.defaultLocalModel,
    defaultFastModel: admin.defaultFastModel,
    defaultFrontierModel: admin.defaultFrontierModel,
    logPrompts: admin.logPrompts,
    logResponses: admin.logResponses,
    logToolCalls: admin.logToolCalls,
    providerAvailability: availability,
    sharedLlmPolicy,
    blockedReasons,
  };
}

/**
 * Pure-Function-Variante (testbar): kombiniert bereits geladene Inputs nach
 * der gleichen Logik wie `loadEffectivePolicy`.
 */
export function combinePolicy(args: {
  organizationId: string;
  adminSettings: AiAdminSettingsRow;
  sharedLlmPolicy: SharedLlmPolicy;
  providerAvailability: SharedLlmProviderAvailability;
}): EffectivePolicy {
  const blockedReasons: string[] = [];
  const localLlmEnabled = args.adminSettings.localLlmEnabled && args.providerAvailability.ollama;
  if (args.adminSettings.localLlmEnabled && !args.providerAvailability.ollama) {
    blockedReasons.push("Lokales LLM nicht erreichbar.");
  }
  const anyExternalProvider =
    args.providerAvailability.groq ||
    args.providerAvailability.gemini ||
    args.providerAvailability.anthropic;
  const externalModelsEnabled = args.adminSettings.externalModelsEnabled && anyExternalProvider;
  if (args.adminSettings.externalModelsEnabled && !anyExternalProvider) {
    blockedReasons.push("Keine externen LLM-Provider konfiguriert (Env-Keys fehlen).");
  }
  const webSearchEnabled = args.adminSettings.webSearchEnabled && externalModelsEnabled;
  if (args.adminSettings.webSearchEnabled && !externalModelsEnabled) {
    blockedReasons.push("Web-Suche benoetigt aktivierte externe Modelle, aber diese sind blockiert.");
  }
  const aiEnabled = args.adminSettings.aiEnabled && (localLlmEnabled || externalModelsEnabled);
  if (args.adminSettings.aiEnabled && !aiEnabled) {
    blockedReasons.push("Kein LLM verfuegbar (lokal + extern blockiert).");
  }
  return {
    organizationId: args.organizationId,
    aiEnabled,
    localLlmEnabled,
    externalModelsEnabled,
    webSearchEnabled,
    writeActionsEnabled: args.adminSettings.writeActionsEnabled,
    requireHumanApproval: args.adminSettings.requireHumanApproval,
    allowRestrictedClassification: false,
    maxToolCallsPerRun: args.adminSettings.maxToolCallsPerRun,
    maxContextObjects: args.adminSettings.maxContextObjects,
    defaultLocalModel: args.adminSettings.defaultLocalModel,
    defaultFastModel: args.adminSettings.defaultFastModel,
    defaultFrontierModel: args.adminSettings.defaultFrontierModel,
    logPrompts: args.adminSettings.logPrompts,
    logResponses: args.adminSettings.logResponses,
    logToolCalls: args.adminSettings.logToolCalls,
    providerAvailability: args.providerAvailability,
    sharedLlmPolicy: args.sharedLlmPolicy,
    blockedReasons,
  };
}
