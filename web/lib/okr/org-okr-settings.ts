import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OrgOkrSettings = {
  okrKrOwnerMustMatchObjective: boolean;
  okrReviewNotifyOwnersOnSchedule: boolean;
  okrSentinelCanBlockApprovalRequest: boolean;
  requireAnnualTargetsBeforeOkrs: boolean;
  annualTargetGateEnforcementMode: "off" | "warn_only" | "block_activation" | "block_creation";
  annualTargetGateScope: "all_employees" | "selected_roles";
  annualTargetGateAllowExceptions: boolean;
};

export async function getOrgOkrSettings(organizationId: string): Promise<OrgOkrSettings> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("app")
    .from("organizations")
    .select(
      "okr_kr_owner_must_match_objective, okr_review_notify_owners_on_schedule, okr_sentinel_can_block_approval_request, require_annual_targets_before_okrs, annual_target_gate_enforcement_mode, annual_target_gate_scope, annual_target_gate_allow_exceptions"
    )
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !data) {
    return {
      okrKrOwnerMustMatchObjective: false,
      okrReviewNotifyOwnersOnSchedule: false,
      okrSentinelCanBlockApprovalRequest: false,
      requireAnnualTargetsBeforeOkrs: false,
      annualTargetGateEnforcementMode: "block_activation",
      annualTargetGateScope: "all_employees",
      annualTargetGateAllowExceptions: true,
    };
  }
  const row = data as {
    okr_kr_owner_must_match_objective?: boolean;
    okr_review_notify_owners_on_schedule?: boolean;
    okr_sentinel_can_block_approval_request?: boolean;
    require_annual_targets_before_okrs?: boolean;
    annual_target_gate_enforcement_mode?: string;
    annual_target_gate_scope?: string;
    annual_target_gate_allow_exceptions?: boolean;
  };
  const enforcementMode =
    row.annual_target_gate_enforcement_mode === "off" ||
    row.annual_target_gate_enforcement_mode === "warn_only" ||
    row.annual_target_gate_enforcement_mode === "block_activation" ||
    row.annual_target_gate_enforcement_mode === "block_creation"
      ? row.annual_target_gate_enforcement_mode
      : "block_activation";
  const gateScope =
    row.annual_target_gate_scope === "selected_roles" ? "selected_roles" : "all_employees";
  return {
    okrKrOwnerMustMatchObjective: Boolean(row.okr_kr_owner_must_match_objective),
    okrReviewNotifyOwnersOnSchedule: Boolean(row.okr_review_notify_owners_on_schedule),
    okrSentinelCanBlockApprovalRequest: Boolean(row.okr_sentinel_can_block_approval_request),
    requireAnnualTargetsBeforeOkrs: Boolean(row.require_annual_targets_before_okrs),
    annualTargetGateEnforcementMode: enforcementMode,
    annualTargetGateScope: gateScope,
    annualTargetGateAllowExceptions:
      row.annual_target_gate_allow_exceptions === undefined
        ? true
        : Boolean(row.annual_target_gate_allow_exceptions),
  };
}
