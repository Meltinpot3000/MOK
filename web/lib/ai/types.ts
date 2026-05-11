import type { UserAccessContext } from "@/lib/rbac/user-access-context";
import type { StructuredAnswerContract } from "@/lib/ai/answers/answer-contracts";

export type AiTaskType =
  | "direct_answer"
  | "internal_lookup"
  | "internal_analysis"
  | "external_research"
  | "mixed_research"
  | "action_draft"
  | "unknown";

export type AiToolDomain =
  | "strategy"
  | "okr"
  | "initiative"
  | "review"
  | "task"
  | "policy"
  | "organization"
  | "market"
  | "vendor"
  | "system_help";

export type AiDataClassification = "public" | "internal" | "confidential" | "restricted";

export type AiToolMode = "read" | "write" | "draft";

export type AssistantUiContext = {
  page?: string | null;
  objectType?: string | null;
  objectId?: string | null;
  cycleId?: string | null;
  organizationUnitId?: string | null;
};

export type AiUserContext = UserAccessContext;

export type AiContextSource = {
  sourceType: string;
  sourceId: string | null;
  sourceTitle: string | null;
  classification: AiDataClassification;
  relevanceScore: number;
  sourceReason?: string | null;
};

export type AiContextObject = {
  objectType: string;
  objectId: string | null;
  title?: string | null;
  summary: string;
  fields: Record<string, unknown>;
  relevanceScore: number;
  classification: AiDataClassification;
};

export type AiDocumentChunk = {
  sourceId: string;
  title: string;
  excerpt: string;
  relevanceScore: number;
  classification: AiDataClassification;
};

export type AiExternalSource = {
  title: string;
  url?: string | null;
  summary: string;
  trustLevel: "high" | "medium" | "low";
};

export type AiContextPackage = {
  question: string;
  taskType: AiTaskType;
  domains: AiToolDomain[];
  scope: Record<string, unknown>;
  internalContext: { objects: AiContextObject[] };
  documentContext?: { chunks: AiDocumentChunk[] };
  externalContext?: { sources: AiExternalSource[] };
  conversationSummary?: string | null;
  structuredContract?: StructuredAnswerContract | null;
  constraints: {
    doNotInventInternalFacts: boolean;
    citeInternalObjects: boolean;
    writeActionsAllowed: boolean;
  };
};

export type AiSuggestedAction = {
  type: string;
  label: string;
  description?: string | null;
  payload?: Record<string, unknown>;
};

export type ModelTier = "local" | "fast_external" | "frontier";

export type ModelRouteDecision = {
  modelTier: ModelTier;
  provider: "ollama" | "groq" | "gemini" | "openai_compat" | "anthropic";
  reason: string;
  downgrade?: {
    from: ModelTier;
    to: ModelTier;
    userMessage: string;
  };
};
