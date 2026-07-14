import type { OrgAnnualTargetSignatureSettings } from "@/lib/annual-targets/types";

export type AnnualTargetOkrValidityInput = {
  status: string;
  targetYear: number | null;
  ownerMembershipId: string | null;
  signatureStatus: string;
  /** Change-Jahresziele (strategy_program_id gesetzt) sind OKR-fähig; Run-JZ nicht. */
  strategyProgramId: string | null;
};

/**
 * Ein Jahresziel ist OKR-gültig, wenn alle Bedingungen erfüllt sind.
 */
export function isAnnualTargetOkrValid(
  row: AnnualTargetOkrValidityInput,
  objectiveOwnerMembershipId: string,
  okrCycleTargetYear: number,
  signatureSettings: OrgAnnualTargetSignatureSettings
): boolean {
  if (!row.strategyProgramId) return false;
  if (row.status !== "active") return false;
  if (row.targetYear !== okrCycleTargetYear) return false;
  if (!row.ownerMembershipId || row.ownerMembershipId !== objectiveOwnerMembershipId) {
    return false;
  }
  if (signatureSettings.requireSignature && signatureSettings.activationRequiresSignedStatus) {
    return row.signatureStatus === "signed";
  }
  return true;
}
