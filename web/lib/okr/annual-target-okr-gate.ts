import { isAnnualTargetOkrValid } from "@/lib/annual-targets/okr-validity";
import { getOrgAnnualTargetSignatureSettings } from "@/lib/annual-targets/org-settings";
import type { OrgOkrSettings } from "@/lib/okr/org-okr-settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AnnualTargetGateResult = {
  blocked: boolean;
  warning: string | null;
  activeAnnualTargetsCount: number;
  gateApplied: boolean;
};

function isActivationStatus(status: string | null | undefined): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  return s !== "" && s !== "draft";
}

export async function evaluateAnnualTargetGateForObjective(input: {
  organizationId: string;
  cycleInstanceId: string;
  okrCycleId: string;
  objectiveOwnerMembershipId: string;
  settings: OrgOkrSettings;
  onCreate: boolean;
  nextStatus?: string | null;
}): Promise<AnnualTargetGateResult> {
  const {
    organizationId,
    objectiveOwnerMembershipId,
    okrCycleId,
    settings,
    onCreate,
    nextStatus,
  } = input;
  const mode = settings.annualTargetGateEnforcementMode;
  if (!settings.requireAnnualTargetsBeforeOkrs || mode === "off") {
    return { blocked: false, warning: null, activeAnnualTargetsCount: 0, gateApplied: false };
  }

  const supabase = await createSupabaseServerClient();

  const { data: ownerMembership } = await supabase
    .schema("app")
    .from("organization_memberships")
    .select("id, requires_annual_targets")
    .eq("organization_id", organizationId)
    .eq("id", objectiveOwnerMembershipId)
    .maybeSingle();

  if (!ownerMembership?.id) {
    return { blocked: true, warning: "Owner-Membership ist ungültig.", activeAnnualTargetsCount: 0, gateApplied: true };
  }

  const gateApplies =
    settings.annualTargetGateScope === "all_employees" ? true : Boolean(ownerMembership.requires_annual_targets);

  if (!gateApplies) {
    return { blocked: false, warning: null, activeAnnualTargetsCount: 0, gateApplied: false };
  }

  const { data: okrCycle } = await supabase
    .schema("app")
    .from("okr_cycles")
    .select("id, start_date")
    .eq("organization_id", organizationId)
    .eq("id", okrCycleId)
    .maybeSingle();

  const targetYear = okrCycle?.start_date ? new Date(okrCycle.start_date).getUTCFullYear() : Number.NaN;
  if (!Number.isFinite(targetYear)) {
    return { blocked: true, warning: "Zieljahr aus OKR-Zyklus konnte nicht ermittelt werden.", activeAnnualTargetsCount: 0, gateApplied: true };
  }

  const signatureSettings = await getOrgAnnualTargetSignatureSettings(organizationId);

  const { data: annualRows } = await supabase
    .schema("app")
    .from("annual_targets")
    .select("id, status, target_year, owner_membership_id, signature_status, strategy_program_id")
    .eq("organization_id", organizationId)
    .eq("owner_membership_id", objectiveOwnerMembershipId)
    .eq("target_year", targetYear)
    .eq("status", "active")
    .not("strategy_program_id", "is", null);

  const activeAnnualTargetsCount = (annualRows ?? []).filter((row) =>
    isAnnualTargetOkrValid(
      {
        status: String(row.status),
        targetYear: (row.target_year as number | null) ?? null,
        ownerMembershipId: (row.owner_membership_id as string | null) ?? null,
        signatureStatus: String(row.signature_status ?? "not_required"),
        strategyProgramId: (row.strategy_program_id as string | null) ?? null,
      },
      objectiveOwnerMembershipId,
      targetYear,
      signatureSettings
    )
  ).length;
  if (activeAnnualTargetsCount > 0) {
    return { blocked: false, warning: null, activeAnnualTargetsCount, gateApplied: true };
  }

  const baseMessage =
    "Keine aktiven Jahresziele für den Objective-Owner im relevanten Zieljahr. Bitte zuerst Jahresziele aktivieren.";

  if (mode === "warn_only") {
    return { blocked: false, warning: baseMessage, activeAnnualTargetsCount, gateApplied: true };
  }
  if (mode === "block_creation" && onCreate) {
    return { blocked: true, warning: null, activeAnnualTargetsCount, gateApplied: true };
  }
  if (mode === "block_activation" && isActivationStatus(nextStatus)) {
    return { blocked: true, warning: null, activeAnnualTargetsCount, gateApplied: true };
  }

  return { blocked: false, warning: baseMessage, activeAnnualTargetsCount, gateApplied: true };
}

export async function hasDirectAnnualTargetAlignment(input: {
  organizationId: string;
  cycleInstanceId: string;
  objectiveId: string;
}): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data: links } = await supabase
    .schema("app")
    .from("annual_target_okr_objective_links")
    .select("id, annual_target_id, annual_targets(strategy_program_id)")
    .eq("organization_id", input.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .eq("okr_objective_id", input.objectiveId);
  const hasChangeLink = (links ?? []).some((row) => {
    const at = row.annual_targets as { strategy_program_id: string | null } | null;
    return Boolean(at?.strategy_program_id);
  });
  if (hasChangeLink) return true;

  const { count: exCount } = await supabase
    .schema("app")
    .from("annual_target_okr_objective_exceptions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .eq("okr_objective_id", input.objectiveId)
    .eq("approval_status", "approved");
  return (exCount ?? 0) > 0;
}
