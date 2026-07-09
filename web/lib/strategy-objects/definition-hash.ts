import { createHash } from "crypto";
import type { StrategyObjectType } from "./types";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const CANONICAL_PAYLOAD_FIELDS: Record<StrategyObjectType, string[]> = {
  strategic_challenge: [
    "priority",
    "visibility",
    "impact_score",
    "urgency_score",
    "scope_score",
    "root_cause_score",
    "challenge_score",
    "relevance_level",
    "risk_level",
    "source_cluster_id",
    "source_analysis_entry_id",
    "strategy_carry_metadata",
  ],
  strategic_direction: [
    "priority",
    "grouping",
    "relevance_level",
    "risk_level",
    "strategic_value_score",
    "capability_fit_score",
    "feasibility_score",
    "strategy_carry_metadata",
  ],
  strategic_objective: [
    "time_horizon",
    "importance_score",
    "deputy_membership_id",
    "owner_membership_id",
    "ai_evaluation",
    "strategy_carry_metadata",
  ],
};

function normalizeText(input: string | null | undefined): string {
  return String(input ?? "").trim().toLowerCase();
}

function normalizeJson(value: unknown): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => normalizeJson(item));
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b, "en"));
    const out: Record<string, JsonValue> = {};
    for (const [key, nested] of entries) out[key] = normalizeJson(nested);
    return out;
  }
  return String(value);
}

function selectCanonicalPayload(
  objectType: StrategyObjectType,
  payload: Record<string, unknown> | null | undefined
): JsonValue {
  const source = payload ?? {};
  const selected: Record<string, unknown> = {};
  for (const key of CANONICAL_PAYLOAD_FIELDS[objectType]) {
    if (key in source) selected[key] = source[key];
  }
  return normalizeJson(selected);
}

export function strategyObjectCanonicalDefinitionText(
  objectType: StrategyObjectType,
  title: string | null | undefined,
  description: string | null | undefined,
  payload: Record<string, unknown> | null | undefined
): string {
  const canonicalPayload = selectCanonicalPayload(objectType, payload);
  return [
    normalizeText(objectType),
    normalizeText(title),
    normalizeText(description),
    JSON.stringify(canonicalPayload),
  ].join("|");
}

export function strategyObjectDefinitionHash(
  objectType: StrategyObjectType,
  title: string | null | undefined,
  description: string | null | undefined,
  payload: Record<string, unknown> | null | undefined
): string {
  return createHash("sha256")
    .update(strategyObjectCanonicalDefinitionText(objectType, title, description, payload))
    .digest("hex");
}
