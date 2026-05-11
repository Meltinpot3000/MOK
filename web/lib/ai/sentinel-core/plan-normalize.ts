import { SENTINEL_PLAN_FALLBACK, sentinelPlanSchema, type SentinelPlan } from "./schemas";

const CYCLE_ALIAS: Record<string, SentinelPlan["scope"]["cycle"]> = {
  current_cycle: "current",
  currentcycle: "current",
  actual: "current",
};

const ORG_SCOPE_ALIAS: Record<string, SentinelPlan["scope"]["organizationScope"]> = {
  my: "own",
  mine: "own",
  personal: "own",
};

const METRIC_ALIAS: Record<string, SentinelPlan["metric"]> = {
  anzahl: "count",
};

function normalizeToken(input: unknown): string {
  return typeof input === "string" ? input.trim().toLowerCase().replace(/[\s-]+/g, "_") : "";
}

export function normalizePlanInput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const draft = { ...(raw as Record<string, unknown>) };
  const scope = draft.scope && typeof draft.scope === "object" ? { ...(draft.scope as Record<string, unknown>) } : {};

  const cycleKey = normalizeToken(scope.cycle);
  if (cycleKey && CYCLE_ALIAS[cycleKey]) scope.cycle = CYCLE_ALIAS[cycleKey];

  const orgScopeKey = normalizeToken(scope.organizationScope);
  if (orgScopeKey && ORG_SCOPE_ALIAS[orgScopeKey]) scope.organizationScope = ORG_SCOPE_ALIAS[orgScopeKey];

  const metricKey = normalizeToken(draft.metric);
  if (metricKey && METRIC_ALIAS[metricKey]) draft.metric = METRIC_ALIAS[metricKey];

  draft.scope = scope;
  return draft;
}

export function parseSentinelPlanWithNormalization(raw: unknown): {
  plan: SentinelPlan;
  degraded: boolean;
} {
  const normalized = normalizePlanInput(raw);
  const parsed = sentinelPlanSchema.safeParse(normalized);
  if (parsed.success) {
    return { plan: parsed.data, degraded: false };
  }

  if (!normalized || typeof normalized !== "object") {
    return { plan: SENTINEL_PLAN_FALLBACK, degraded: true };
  }

  const draft = {
    ...(normalized as Record<string, unknown>),
    scope: {
      ...((normalized as Record<string, unknown>).scope as Record<string, unknown> | undefined),
      cycle: "unspecified",
      organizationScope: "unspecified",
    },
    metric: "none",
    queryClass: "unknown",
    domainCandidates: [],
    optionalContextDomains: [],
    analysisOps: [],
  };
  const degradedParsed = sentinelPlanSchema.safeParse(draft);
  if (!degradedParsed.success) {
    return { plan: SENTINEL_PLAN_FALLBACK, degraded: true };
  }
  return { plan: degradedParsed.data, degraded: true };
}
