/**
 * Muss mit app.approval_submit_for_review / app.tasks.source_object_type übereinstimmen.
 */
export const APPROVAL_SOURCE_OBJECT_TYPES = [
  "strategic_goal",
  "functional_strategy",
  "initiative",
  "strategic_direction",
  "strategy_program",
  "strategy_objective",
  "okr_objective",
] as const;

export type ApprovalSourceObjectType = (typeof APPROVAL_SOURCE_OBJECT_TYPES)[number];

export type ApprovalRoutingMode = "direct_manager" | "executive_fallback" | "admin_fallback";

export type ApprovalRoutingReason = "manager_not_found" | "executive_not_found" | null;
