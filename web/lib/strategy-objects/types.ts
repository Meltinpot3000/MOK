export type StrategyObjectType =
  | "strategic_challenge"
  | "strategic_direction"
  | "strategic_objective";

export type StrategyObjectIdentityLifecycleState =
  | "draft"
  | "active"
  | "inactive"
  | "retired"
  | "archived";

export type StrategyObjectRevisionState =
  | "draft"
  | "pending_approval"
  | "current"
  | "superseded"
  | "archived";

export type StrategyObjectReviewDecision =
  | "reconfirm"
  | "escalate"
  | "deprioritize"
  | "revise"
  | "complete"
  | "retire"
  | "remove";

export type StrategyObjectOperationalSignal =
  | "on_track"
  | "watch"
  | "at_risk"
  | "completed"
  | "retired"
  | "removed";

export type StrategyObjectOperationalStatus =
  | "active"
  | "at_risk"
  | "watch"
  | "completed"
  | "on_hold"
  | "needs_revision"
  | "pending_approval"
  | "retired"
  | "removed"
  | "archived";

export type StrategyObjectVersioningMeta = {
  object_identity_id: string;
  revision_id: string;
  revision_number: number;
  revision_state: StrategyObjectRevisionState;
  identity_lifecycle_state: StrategyObjectIdentityLifecycleState;
  definition_hash?: string | null;
  operational_status?: StrategyObjectOperationalStatus | null;
  latest_review_decision?: StrategyObjectReviewDecision | null;
  latest_operational_signal?: StrategyObjectOperationalSignal | null;
  latest_assessed_at?: string | null;
};

export type StrategyObjectOperationalRow = {
  object_identity_id: string;
  organization_id: string;
  cycle_instance_id: string;
  object_type: StrategyObjectType;
  identity_lifecycle_state: StrategyObjectIdentityLifecycleState;
  revision_id: string;
  revision_number: number;
  revision_state: StrategyObjectRevisionState;
  title: string;
  description: string | null;
  definition_payload: Record<string, unknown>;
  definition_hash: string;
  legacy_status: string | null;
  created_at: string;
  updated_at: string;
  created_by_membership_id?: string | null;
  latest_review_decision: StrategyObjectReviewDecision | null;
  latest_operational_signal: StrategyObjectOperationalSignal | null;
  latest_assessed_at: string | null;
  operational_status: StrategyObjectOperationalStatus | null;
};

export type StrategyObjectRevisionRow = {
  id: string;
  object_identity_id: string;
  organization_id: string;
  cycle_instance_id: string;
  revision_number: number;
  revision_state: StrategyObjectRevisionState;
  title: string;
  description: string | null;
  definition_payload: Record<string, unknown>;
  definition_hash: string;
  legacy_status: string | null;
  object_type: StrategyObjectType;
};

export type StrategyChallengeLegacyRow = {
  id: string;
  title: string;
  description: string | null;
  source_analysis_entry_id: string | null;
  relevance_level: number | null;
  risk_level: number | null;
  impact_score: number | null;
  urgency_score: number | null;
  scope_score: number | null;
  root_cause_score: number | null;
  challenge_score: number | null;
  created_at: string | null;
  updated_at: string | null;
  created_by_membership_id: string | null;
  created_by_source: string | null;
  source_cluster_id: string | null;
  versioning?: StrategyObjectVersioningMeta;
};

export type StrategyDirectionLegacyRow = {
  id: string;
  title: string;
  description: string | null;
  priority: number | null;
  grouping: string | null;
  relevance_level: number | null;
  risk_level: number | null;
  strategic_value_score: number | null;
  capability_fit_score: number | null;
  feasibility_score: number | null;
  created_at: string | null;
  updated_at: string | null;
  versioning?: StrategyObjectVersioningMeta;
};

export type StrategyObjectiveLegacyRow = {
  id: string;
  title: string;
  description: string | null;
  importance_score: number | null;
  time_horizon: string | null;
  created_by_membership_id: string | null;
  created_by_source: string | null;
  ai_clarity_score: number | null;
  ai_strategic_relevance_score: number | null;
  ai_feasibility_score: number | null;
  ai_fit_to_company_score: number | null;
  ai_confidence_score: number | null;
  ai_external_internal_classification: string | null;
  ai_short_long_term_classification: string | null;
  ai_exploit_explore_classification: string | null;
  ai_issues_json: unknown;
  ai_improvement_suggestion: string | null;
  ai_summary: string | null;
  ai_objective_score: number | null;
  ai_evaluation_status: string | null;
  ai_evaluated_at: string | null;
  ai_evaluation_version: string | null;
  ai_manual_override: boolean | null;
  ai_manual_comment: string | null;
  versioning?: StrategyObjectVersioningMeta;
};
