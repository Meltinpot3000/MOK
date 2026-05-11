import { z } from "zod";

export const SENTINEL_PLAN_SCHEMA_NAME = "sentinel_plan_v1" as const;

export const taskTypeEnum = z.enum([
  "direct_answer",
  "internal_lookup",
  "internal_analysis",
  "external_research",
  "mixed_research",
  "action_draft",
  "unknown",
]);

export const toolDomainEnum = z.enum([
  "strategy",
  "okr",
  "initiative",
  "review",
  "task",
  "policy",
  "organization",
  "market",
  "vendor",
  "system_help",
]);

export const cycleScopeEnum = z.enum([
  "current",
  "previous",
  "all",
  "unspecified",
]);

export const organizationScopeEnum = z.enum([
  "own",
  "team",
  "visible",
  "global",
  "unspecified",
]);

export const queryClassEnum = z.enum([
  "lookup",
  "ranking",
  "count",
  "distribution",
  "composite",
  "comparison",
  "coverage",
  "risk",
  "drilldown",
  "summary",
  "recommendation",
  "unknown",
]);

export const metricEnum = z.enum(["count", "share", "duration", "none"]);
export const analysisOpEnum = z.enum([
  "rank",
  "count_total",
  "share",
  "compare_periods",
  "distribution",
  "nested_distribution",
  "coverage",
  "anomaly_check",
  "strategy_join",
  "lookup",
  "exists",
  "join",
]);
export const optionalContextDomainEnum = z.enum([
  "strategy",
  "okr",
  "initiative",
  "review",
  "task",
  "policy",
  "organization",
  "market",
  "vendor",
  "system_help",
]);

const nullableTrimmedString = (max: number) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .optional()
    .transform((value) => (typeof value === "string" && value.length > 0 ? value : null));

export const sentinelScopeSchema = z.object({
  cycle: cycleScopeEnum.optional().default("unspecified"),
  organizationScope: organizationScopeEnum.optional().default("unspecified"),
  objectType: nullableTrimmedString(120),
  objectId: nullableTrimmedString(200),
  timeHorizon: nullableTrimmedString(120),
});

export const sentinelToolPlanItemSchema = z.object({
  toolName: z.string().trim().min(1).max(120),
  purpose: z.string().trim().min(1).max(400),
  input: z.record(z.string(), z.unknown()).default({}),
  required: z.boolean().default(true),
});

export const sentinelAnswerStrategySchema = z.object({
  canAnswerLocally: z.boolean(),
  needsInternalRetrieval: z.boolean(),
  needsWebSearch: z.boolean(),
  needsFrontierModel: z.boolean(),
  reason: z.string().trim().max(800),
});

export const sentinelSafetySchema = z.object({
  sensitiveDataLikely: z.boolean(),
  requiresRedaction: z.boolean(),
  writeActionRequested: z.boolean(),
  requiresHumanApproval: z.boolean(),
});

export const sentinelPlanSchema = z.object({
  taskType: taskTypeEnum,
  confidence: z.number().min(0).max(1),
  domains: z.array(toolDomainEnum).min(0).max(10),
  scope: sentinelScopeSchema,
  toolPlan: z.array(sentinelToolPlanItemSchema).max(16).default([]),
  answerStrategy: sentinelAnswerStrategySchema,
  safety: sentinelSafetySchema,
  // Phase 11: Query-Class-Pipeline-Felder. Optional/defaulted, damit
  // bestehende Konsumenten und Tests rueckwaertskompatibel bleiben.
  queryClass: queryClassEnum.optional().default("unknown"),
  targetEntity: nullableTrimmedString(120),
  metric: metricEnum.optional().default("none"),
  groupBy: nullableTrimmedString(80),
  domainCandidates: z.array(toolDomainEnum).max(10).default([]),
  optionalContextDomains: z.array(optionalContextDomainEnum).max(8).default([]),
  analysisOps: z.array(analysisOpEnum).max(20).default([]),
});

export type SentinelPlan = z.infer<typeof sentinelPlanSchema>;
export type SentinelToolPlanItem = z.infer<typeof sentinelToolPlanItemSchema>;
export type SentinelScope = z.infer<typeof sentinelScopeSchema>;
export type SentinelAnswerStrategy = z.infer<typeof sentinelAnswerStrategySchema>;
export type SentinelSafety = z.infer<typeof sentinelSafetySchema>;
export type SentinelQueryClass = z.infer<typeof queryClassEnum>;
export type SentinelMetric = z.infer<typeof metricEnum>;
export type SentinelOptionalContextDomain = z.infer<typeof optionalContextDomainEnum>;
export type SentinelAnalysisOp = z.infer<typeof analysisOpEnum>;

export const SENTINEL_PLAN_FALLBACK: SentinelPlan = {
  taskType: "unknown",
  confidence: 0,
  domains: [],
  scope: {
    cycle: "unspecified",
    organizationScope: "unspecified",
    objectType: null,
    objectId: null,
    timeHorizon: null,
  },
  toolPlan: [],
  answerStrategy: {
    canAnswerLocally: false,
    needsInternalRetrieval: false,
    needsWebSearch: false,
    needsFrontierModel: false,
    reason: "Anfrage konnte nicht sicher klassifiziert werden.",
  },
  safety: {
    sensitiveDataLikely: false,
    requiresRedaction: false,
    writeActionRequested: false,
    requiresHumanApproval: true,
  },
  queryClass: "unknown",
  targetEntity: null,
  metric: "none",
  groupBy: null,
  domainCandidates: [],
  optionalContextDomains: [],
  analysisOps: [],
};
