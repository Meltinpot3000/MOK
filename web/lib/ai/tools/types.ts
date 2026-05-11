import type { ZodTypeAny } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AiContextSource,
  AiDataClassification,
  AiToolDomain,
  AiToolMode,
  AiUserContext,
  AssistantUiContext,
} from "@/lib/ai/types";

export type AiToolExecuteArgs<TInput> = {
  input: TInput;
  userContext: AiUserContext;
  uiContext: AssistantUiContext | null | undefined;
  supabase: SupabaseClient;
  signal?: AbortSignal;
};

export type AiToolResult<TData = unknown> = {
  toolName: string;
  success: boolean;
  data: TData | null;
  outputSummary: string;
  contextSources?: AiContextSource[];
  warnings?: string[];
  error?: string;
};

export type AiToolDefinition<TInputSchema extends ZodTypeAny = ZodTypeAny> = {
  name: string;
  description: string;
  domain: AiToolDomain;
  mode: AiToolMode;
  /** RBAC-Codes, die der User zusaetzlich zu `ai.assistant.use` haben muss. */
  requiredCapabilities: string[];
  /** Zod-Schema fuer den (bereits normalisierten) Tool-Input. */
  inputSchema: TInputSchema;
  /** Hint fuer den Plan-Prompt (kurze Beschreibung der Input-Form). */
  inputSchemaHint?: string;
  /** Datenklassifikation der typischen Tool-Outputs. */
  dataClassification: AiDataClassification;
  /** Optionale Tool-Abhaengigkeiten (Output eines Tools wird Input eines anderen). */
  dependsOnTools?: string[];
  /** Optional: Tool benoetigt objectId aus uiContext, wenn kein eigener Input geliefert wird. */
  requiresObjectId?: boolean;
  /** Optional: maximale Anzahl Treffer (defaults to provider-specific). */
  maxResults?: number;
  execute(args: AiToolExecuteArgs<unknown>): Promise<AiToolResult>;
};
