export type ReviewTriggerState = {
  visible: boolean;
  state: string;
  label: string;
  days_to_end: number | null;
  is_override?: boolean;
  procedure_status?: string;
  readiness_status?: string;
  review_id?: string;
};

export type StrategyReviewRow = {
  id: string;
  organization_id: string;
  cycle_instance_id: string;
  review_mode: string;
  procedure_status: string;
  review_lead_time_days: number;
  readiness_status: string;
  override_forced: boolean;
  override_reason: string | null;
  pre_read_payload: Record<string, unknown>;
  stakeholder_feedback_payload: Record<string, unknown>;
  decision_payload: Record<string, unknown>;
  release_summary: Record<string, unknown>;
  released_to_cycle_instance_id: string | null;
  released_at: string | null;
  announcement_sent_at: string | null;
  announcement_payload: Record<string, unknown>;
  meeting_notes: string;
};
