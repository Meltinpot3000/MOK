import type {

  StrategyChallengeLegacyRow,

  StrategyDirectionLegacyRow,

  StrategyObjectiveLegacyRow,

  StrategyObjectOperationalRow,

  StrategyObjectVersioningMeta,

} from "./types";



function asRecord(value: unknown): Record<string, unknown> {

  return value && typeof value === "object" && !Array.isArray(value)

    ? (value as Record<string, unknown>)

    : {};

}



function asNumber(value: unknown): number | null {

  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {

    return Number(value);

  }

  return null;

}



function asString(value: unknown): string | null {

  if (typeof value === "string") return value;

  return null;

}



function asBoolean(value: unknown): boolean | null {

  return typeof value === "boolean" ? value : null;

}



function toVersioningMeta(row: StrategyObjectOperationalRow): StrategyObjectVersioningMeta {

  return {

    object_identity_id: row.object_identity_id,

    revision_id: row.revision_id,

    revision_number: row.revision_number,

    revision_state: row.revision_state,

    identity_lifecycle_state: row.identity_lifecycle_state,

    definition_hash: row.definition_hash,

    operational_status: row.operational_status,

    latest_review_decision: row.latest_review_decision,

    latest_operational_signal: row.latest_operational_signal,

    latest_assessed_at: row.latest_assessed_at,

  };

}



export function adaptOperationalRowToChallengeLegacy(

  row: StrategyObjectOperationalRow

): StrategyChallengeLegacyRow {

  const payload = asRecord(row.definition_payload);

  return {

    id: row.revision_id,

    title: row.title,

    description: row.description,

    source_analysis_entry_id: asString(payload.source_analysis_entry_id),

    relevance_level: asNumber(payload.relevance_level),

    risk_level: asNumber(payload.risk_level),

    impact_score: asNumber(payload.impact_score),

    urgency_score: asNumber(payload.urgency_score),

    scope_score: asNumber(payload.scope_score),

    root_cause_score: asNumber(payload.root_cause_score),

    challenge_score: asNumber(payload.challenge_score),

    created_at: row.created_at,

    updated_at: row.updated_at,

    created_by_membership_id:
      asString(payload.created_by_membership_id) ?? row.created_by_membership_id ?? null,

    created_by_source: asString(payload.created_by_source),

    source_cluster_id: asString(payload.source_cluster_id),

    versioning: toVersioningMeta(row),

  };

}



export function adaptOperationalRowToDirectionLegacy(

  row: StrategyObjectOperationalRow

): StrategyDirectionLegacyRow {

  const payload = asRecord(row.definition_payload);

  return {

    id: row.revision_id,

    title: row.title,

    description: row.description,

    priority: asNumber(payload.priority),

    grouping: asString(payload.grouping),

    relevance_level: asNumber(payload.relevance_level),

    risk_level: asNumber(payload.risk_level),

    strategic_value_score: asNumber(payload.strategic_value_score),

    capability_fit_score: asNumber(payload.capability_fit_score),

    feasibility_score: asNumber(payload.feasibility_score),

    created_at: row.created_at,

    updated_at: row.updated_at,

    versioning: toVersioningMeta(row),

  };

}



export function adaptOperationalRowToObjectiveLegacy(

  row: StrategyObjectOperationalRow

): StrategyObjectiveLegacyRow {

  const payload = asRecord(row.definition_payload);

  const aiEvaluation = asRecord(payload.ai_evaluation);

  return {

    id: row.revision_id,

    title: row.title,

    description: row.description,

    importance_score: asNumber(payload.importance_score),

    time_horizon: asString(payload.time_horizon),

    created_by_membership_id:
      asString(payload.created_by_membership_id) ?? row.created_by_membership_id ?? null,

    created_by_source: asString(payload.created_by_source),

    ai_clarity_score: asNumber(aiEvaluation.clarity_score),

    ai_strategic_relevance_score: asNumber(aiEvaluation.strategic_relevance_score),

    ai_feasibility_score: asNumber(aiEvaluation.feasibility_score),

    ai_fit_to_company_score: asNumber(aiEvaluation.fit_to_company_score),

    ai_confidence_score: asNumber(aiEvaluation.confidence_score),

    ai_external_internal_classification: asString(aiEvaluation.external_internal_classification),

    ai_short_long_term_classification: asString(aiEvaluation.short_long_term_classification),

    ai_exploit_explore_classification: asString(aiEvaluation.exploit_explore_classification),

    ai_issues_json: aiEvaluation.issues_json ?? [],

    ai_improvement_suggestion: asString(aiEvaluation.suggestion),

    ai_summary: asString(aiEvaluation.summary),

    ai_objective_score: asNumber(aiEvaluation.objective_score),

    ai_evaluation_status: asString(aiEvaluation.status),

    ai_evaluated_at: asString(aiEvaluation.evaluated_at),

    ai_evaluation_version: asString(aiEvaluation.evaluation_version),

    ai_manual_override: asBoolean(aiEvaluation.manual_override),

    ai_manual_comment: asString(aiEvaluation.manual_comment),

    versioning: toVersioningMeta(row),

  };

}


