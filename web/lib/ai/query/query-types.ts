import type { AiToolDomain } from "@/lib/ai/types";
import type { StructuredAnswerContract } from "@/lib/ai/answers/answer-contracts";
import type { AiToolResult } from "@/lib/ai/tools/types";
import type { SentinelPlan } from "@/lib/ai/sentinel-core/schemas";

export const QUERY_CLASSES = [
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
] as const;

export type QueryClass = (typeof QUERY_CLASSES)[number];

export const GROUP_BY_KEYS = [
  "owner",
  "assignee",
  "responsible",
  "status",
  "cycle",
  "organization_unit",
  "none",
] as const;

export type GroupByKey = (typeof GROUP_BY_KEYS)[number];

export type QueryPlan = {
  queryClass: QueryClass;
  domain: AiToolDomain | null;
  domainCandidates: AiToolDomain[];
  optionalContextDomains: AiToolDomain[];
  queryText?: string;
  analysisOps: string[];
  targetEntity: string | null;
  metric: "count" | "share" | "duration" | "none";
  groupBy: GroupByKey;
  scope: SentinelPlan["scope"];
  /** Smoke/Debug: zweite DB-Abfrage fuer Task-Histogramm ohne Filter */
  taskFetchDiagnostics?: boolean;
};

export type EvidenceItem = {
  id: string;
  label?: string | null;
  objectType?: string;
};

export type QueryPipelineResult = {
  contract: StructuredAnswerContract;
  evidence: EvidenceItem[];
  warnings: string[];
  usedToolCalls: Array<{
    toolName: string;
    inputSummary: string;
    outputSummary: string;
    success: boolean;
  }>;
  contractSource: "pipeline";
};

export type ExecutePermissionedToolFn = (
  toolName: string,
  input: Record<string, unknown>
) => Promise<AiToolResult>;

const OWNER_ALIASES = new Set(["owner", "owners", "ownermembership", "owner_membership"]);
const ASSIGNEE_ALIASES = new Set([
  "assignee",
  "assignedto",
  "assigned_to",
  "assigned",
  "taskassignee",
]);
const RESPONSIBLE_ALIASES = new Set(["responsible", "verantwortlich", "ownerresponsible"]);
const STATUS_ALIASES = new Set(["status", "state"]);
const CYCLE_ALIASES = new Set(["cycle", "zyklus", "period"]);
const ORG_UNIT_ALIASES = new Set([
  "organization_unit",
  "organisationseinheit",
  "orgunit",
  "org_unit",
  "team",
  "bereich",
]);

export function normalizeGroupBy(input?: string | null): GroupByKey {
  if (!input) return "none";
  const normalized = input.toLowerCase().replace(/[^a-z_]/g, "");

  if (OWNER_ALIASES.has(normalized)) return "owner";
  if (ASSIGNEE_ALIASES.has(normalized)) return "assignee";
  if (RESPONSIBLE_ALIASES.has(normalized)) return "responsible";
  if (STATUS_ALIASES.has(normalized)) return "status";
  if (CYCLE_ALIASES.has(normalized)) return "cycle";
  if (ORG_UNIT_ALIASES.has(normalized)) return "organization_unit";

  return "none";
}

