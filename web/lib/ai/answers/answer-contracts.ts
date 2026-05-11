import { z } from "zod";

const confidenceEnum = z.enum(["high", "medium", "low"]);
const retrievalStatusEnum = z.enum(["ok", "partial", "failed"]);
const retrievalMetaSchema = z.object({
  retrievalStatus: retrievalStatusEnum,
  missingCapabilities: z.array(z.string()).default([]),
  missingTools: z.array(z.string()).default([]),
  requestedOps: z.array(z.string()).default([]),
  coveredOps: z.array(z.string()).default([]),
  missingOps: z.array(z.string()).default([]),
});

export const rankingContractSchema = retrievalMetaSchema.extend({
  queryClass: z.literal("ranking"),
  domain: z.string().min(1),
  metric: z.string().min(1),
  groupBy: z.string().min(1),
  scope: z.object({
    cycleId: z.string().nullable().optional(),
    cycleLabel: z.string().nullable().optional(),
  }),
  totalItems: z.number().int().min(0).nullable(),
  top: z.array(
    z.object({
      rank: z.number().int().min(1),
      label: z.string().min(1),
      count: z.number().int().min(0),
      evidenceIds: z.array(z.string()),
    })
  ),
  evidenceSummary: z.string().default(""),
  confidence: confidenceEnum,
});

export const countContractSchema = retrievalMetaSchema.extend({
  queryClass: z.literal("count"),
  domain: z.string().min(1),
  metric: z.string().min(1),
  scope: z.record(z.string(), z.unknown()).default({}),
  value: z.number().int().min(0).nullable(),
  evidenceIds: z.array(z.string()),
  confidence: confidenceEnum,
});

export const distributionContractSchema = retrievalMetaSchema.extend({
  queryClass: z.literal("distribution"),
  domain: z.string().min(1),
  metric: z.string().min(1),
  groupBy: z.string().min(1),
  scope: z.record(z.string(), z.unknown()).default({}),
  total: z.number().int().min(0).nullable(),
  buckets: z.array(
    z.object({
      label: z.string().min(1),
      count: z.number().int().min(0),
      share: z.number().min(0).max(1),
      evidenceIds: z.array(z.string()),
    })
  ),
  confidence: confidenceEnum,
});

const taskDiagnosticsSchema = z
  .object({
    authUserId: z.string(),
    activeMembershipId: z.string(),
    organizationId: z.string(),
    allMembershipIdsForUserInOrganization: z.array(z.string()),
    selectedTaskMembershipId: z.string(),
    membershipSelectionReason: z.string(),
    checkedMembershipIds: z.array(z.string()),
    countsByRelation: z.object({
      assigned: z.number(),
      created: z.number(),
      completedBy: z.number(),
    }),
    rawTotalBeforeStatusFilter: z.number(),
    totalAfterStatusFilter: z.number(),
    statusFilter: z.enum(["open", "completed", "all", "current"]),
    taskTypeFilter: z.string().nullable().optional(),
    sourceObjectTypeFilter: z.string().nullable().optional(),
  })
  .passthrough();

export const lookupContractSchema = retrievalMetaSchema.extend({
  queryClass: z.literal("lookup"),
  domain: z.string().min(1),
  scope: z.record(z.string(), z.unknown()).default({}),
  totalItems: z.number().int().min(0).nullable(),
  items: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      evidenceId: z.string(),
      details: z.record(z.string(), z.unknown()).default({}),
    })
  ),
  confidence: confidenceEnum,
  taskDiagnostics: taskDiagnosticsSchema.optional(),
});

const compositeDiagnosticsSchema = z
  .object({
    pipelineVariant: z.string(),
    rawTotal: z.number().nullable(),
    afterScopeFilter: z.number().nullable(),
    afterStatusOrTypeFilter: z.number().nullable(),
    afterJoinFilter: z.number().nullable(),
    finalTotal: z.number().nullable(),
    checkedMembershipIds: z.array(z.string()).optional(),
    checkedScopeIds: z.array(z.string()).optional(),
    retrievalStatusReason: z.string(),
  })
  .passthrough();

export const compositeContractSchema = retrievalMetaSchema.extend({
  queryClass: z.literal("composite"),
  domain: z.string().min(1),
  targetEntity: z.string().nullable().optional(),
  scope: z.record(z.string(), z.unknown()).default({}),
  metrics: z.record(z.string(), z.unknown()).default({}),
  coveredItems: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      evidenceIds: z.array(z.string()).default([]),
    })
  ).default([]),
  uncoveredItems: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      reason: z.string().default("uncovered"),
      evidenceIds: z.array(z.string()).default([]),
    })
  ).default([]),
  relationPath: z.array(z.string()).default([]),
  anomalies: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      ruleId: z.string(),
      violatedCondition: z.string(),
      evidenceIds: z.array(z.string()).default([]),
    })
  ).default([]),
  insights: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  confidence: confidenceEnum,
  compositeDiagnostics: compositeDiagnosticsSchema.optional(),
  compositeDiagnosticsSteps: z.array(compositeDiagnosticsSchema).optional(),
});

export const structuredAnswerContractSchema = z.discriminatedUnion("queryClass", [
  rankingContractSchema,
  countContractSchema,
  distributionContractSchema,
  lookupContractSchema,
  compositeContractSchema,
]);

export type RankingContract = z.infer<typeof rankingContractSchema>;
export type CountContract = z.infer<typeof countContractSchema>;
export type DistributionContract = z.infer<typeof distributionContractSchema>;
export type LookupContract = z.infer<typeof lookupContractSchema>;
export type CompositeContract = z.infer<typeof compositeContractSchema>;
export type StructuredAnswerContract = z.infer<typeof structuredAnswerContractSchema>;

