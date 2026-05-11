import type {
  AiContextObject,
  AiContextPackage,
  AiContextSource,
  AiDataClassification,
  AiToolDomain,
  AiTaskType,
} from "@/lib/ai/types";
import type { StructuredAnswerContract } from "@/lib/ai/answers/answer-contracts";
import type { AiToolResult } from "@/lib/ai/tools/types";
import type { RecentMessageForPrompt } from "@/lib/ai/sentinel-core/prompts";
import { buildConversationSummary } from "@/lib/ai/sentinel-core/prompts";
import { redactContextForExternalModel } from "@/lib/ai/security/redaction";

import { rankAndCapContextObjects } from "./context-ranking";

/**
 * Felder-Allowlist pro objectType. Felder, die nicht hier stehen, werden NICHT
 * in das Kontextpaket aufgenommen. Schuetzt vor versehentlichem Leak grosser
 * oder sensibler Felder.
 */
export const FIELD_ALLOWLIST_BY_OBJECT_TYPE: Record<string, ReadonlyArray<string>> = {
  okr_objective: [
    "id",
    "title",
    "status",
    "ownerMembershipId",
    "rollupProgressPercent",
    "rollupStatus",
    "keyResultCount",
    "warnings",
    "lastActivityAt",
  ],
  okr_cycle: ["id", "name", "code", "startDate", "endDate", "status", "isDefault"],
  key_result: [
    "id",
    "objectiveId",
    "title",
    "status",
    "metricType",
    "startValue",
    "targetValue",
    "currentValue",
    "unit",
  ],
  okr_owner_stats: [
    "id",
    "ownerMembershipId",
    "ownerDisplayName",
    "objectiveCount",
    "objectiveIds",
    "objectiveTitles",
    "rank",
    "topObjectiveCount",
    "noData",
    "cycleLabel",
  ],
  initiative: [
    "id",
    "title",
    "status",
    "ownerMembershipId",
    "programId",
    "startDate",
    "endDate",
    "weight",
    "progressPercent",
    "lastReviewUpdateAt",
  ],
  task: [
    "id",
    "type",
    "title",
    "status",
    "priority",
    "sourceObjectType",
    "sourceObjectId",
    "dueAt",
    "createdAt",
  ],
  review_snapshot: ["id", "type", "snapshotAt", "comment"],
  review_feedback: ["id", "feedbackType", "objectType", "objectId", "comment", "createdAt"],
  user: ["userId", "organizationId", "organizationName", "membershipId", "roleCodes"],
};

const DEFAULT_ALLOWLIST: ReadonlyArray<string> = ["id", "title", "name", "status"];

function pickAllowedFields(
  objectType: string,
  raw: Record<string, unknown>
): Record<string, unknown> {
  const allow = FIELD_ALLOWLIST_BY_OBJECT_TYPE[objectType] ?? DEFAULT_ALLOWLIST;
  const out: Record<string, unknown> = {};
  for (const key of allow) {
    if (key in raw) {
      out[key] = (raw as Record<string, unknown>)[key];
    }
  }
  return out;
}

function summarizeObject(objectType: string, fields: Record<string, unknown>): string {
  const title = (fields.title as string | undefined) ?? (fields.name as string | undefined) ?? "(ohne Titel)";
  const parts = [`${objectType}: ${title}`];
  if (typeof fields.status === "string") parts.push(`status=${fields.status}`);
  if (typeof fields.rollupStatus === "string") parts.push(`rollup=${fields.rollupStatus}`);
  if (typeof fields.rollupProgressPercent === "number")
    parts.push(`progress=${Math.round(fields.rollupProgressPercent)}%`);
  if (typeof fields.priority === "string") parts.push(`prio=${fields.priority}`);
  return parts.join(" | ");
}

/**
 * Sucht in einem Tool-`data`-Objekt nach Eintraegen, deren `id` zum
 * `contextSource.sourceId` passt (heuristisch ueber bekannte Listen-Keys).
 */
function findRecordById(
  data: unknown,
  sourceType: string,
  sourceId: string | null
): Record<string, unknown> | null {
  if (!sourceId || !data || typeof data !== "object") return null;
  const candidatesKeys = candidateKeysForSourceType(sourceType);
  const dataObj = data as Record<string, unknown>;
  for (const key of candidatesKeys) {
    const arr = dataObj[key];
    if (Array.isArray(arr)) {
      const match = arr.find(
        (entry) => entry && typeof entry === "object" && (entry as Record<string, unknown>).id === sourceId
      );
      if (match) return match as Record<string, unknown>;
    }
  }
  return null;
}

function candidateKeysForSourceType(sourceType: string): string[] {
  switch (sourceType) {
    case "okr_objective":
      return ["objectives", "okrObjectives"];
    case "okr_cycle":
      return ["okrCycles", "cycles"];
    case "key_result":
      return ["keyResults"];
    case "okr_owner_stats":
      return ["ownerRanking"];
    case "initiative":
      return ["initiatives"];
    case "task":
      return ["tasks"];
    case "review_snapshot":
      return ["snapshots"];
    case "review_feedback":
      return ["feedback"];
    default:
      return [];
  }
}

export type ContextAssemblerArgs = {
  question: string;
  taskType: AiTaskType;
  domains: AiToolDomain[];
  scope: Record<string, unknown>;
  toolResults: AiToolResult[];
  maxContextObjects: number;
  preferredObjectTypes?: string[];
  recentMessages?: RecentMessageForPrompt[];
  writeActionsAllowed: boolean;
  classificationCap?: AiDataClassification;
  modelTierForRedaction?: "local" | "fast_external" | "frontier";
  structuredContract?: StructuredAnswerContract | null;
};

export type AssembledContext = {
  contextPackage: AiContextPackage;
  contextSources: AiContextSource[];
  redactedFieldCount: number;
};

export function assembleContext(args: ContextAssemblerArgs): AssembledContext {
  const allObjects: AiContextObject[] = [];
  const allSources: AiContextSource[] = [];

  for (const result of args.toolResults) {
    if (!result.success) continue;
    const sources = result.contextSources ?? [];
    for (const source of sources) {
      allSources.push(source);
      const record = findRecordById(result.data, source.sourceType, source.sourceId);
      const baseFields = record ?? {};
      const fields = pickAllowedFields(source.sourceType, baseFields as Record<string, unknown>);
      allObjects.push({
        objectType: source.sourceType,
        objectId: source.sourceId,
        title: source.sourceTitle ?? (typeof fields.title === "string" ? fields.title : null),
        summary: summarizeObject(source.sourceType, fields),
        fields,
        relevanceScore: source.relevanceScore,
        classification: source.classification,
      });
    }
  }

  const ranked = rankAndCapContextObjects(allObjects, {
    maxObjects: Math.max(1, args.maxContextObjects),
    preferredObjectTypes: args.preferredObjectTypes,
  });

  const conversationSummary =
    args.recentMessages && args.recentMessages.length > 0
      ? buildConversationSummary({ recentMessages: args.recentMessages })
      : null;

  const basePackage: AiContextPackage = {
    question: args.question,
    taskType: args.taskType,
    domains: args.domains,
    scope: args.scope,
    internalContext: { objects: ranked },
    conversationSummary: conversationSummary ?? null,
    structuredContract: args.structuredContract ?? null,
    constraints: {
      doNotInventInternalFacts: true,
      citeInternalObjects: true,
      writeActionsAllowed: args.writeActionsAllowed,
    },
  };

  const tier = args.modelTierForRedaction ?? "local";
  const redaction = redactContextForExternalModel(basePackage, tier);

  return {
    contextPackage: redaction.contextPackage,
    contextSources: allSources,
    redactedFieldCount: redaction.redactedFieldCount,
  };
}
