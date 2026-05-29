import type { OkrPlanningObjectiveRow } from "@/lib/okr/planning-data";
import { getOkrPlanningObjectiveSentinelApprovalBlockMessageDe } from "@/lib/okr/okr-approval-sentinel-gate";
import { tryResolveDirectManagerAssignee } from "@/lib/tasks/approval-routing";

export type OkrApprovalSubmitEligibility = {
  canSubmit: boolean;
  disabledReason: string | null;
  managerDisplayName: string | null;
};

export async function getOkrApprovalSubmitEligibility(
  organizationId: string,
  submitterMembershipId: string,
  objective: Pick<OkrPlanningObjectiveRow, "status" | "contributionEdges" | "keyResults">
): Promise<OkrApprovalSubmitEligibility> {
  const status = objective.status?.trim() ?? "draft";

  if (status === "pending_approval") {
    return {
      canSubmit: false,
      disabledReason:
        "Freigabe ausstehend — dein Vorgesetzter muss das OKR in «Meine Aufgaben» bearbeiten.",
      managerDisplayName: null,
    };
  }

  if (status === "active" || status === "at_risk") {
    return {
      canSubmit: false,
      disabledReason: "Bereits freigegeben. Fortschritt erfasst du unter OKR-Tracking.",
      managerDisplayName: null,
    };
  }

  if (status === "completed" || status === "archived" || status === "shifted") {
    return {
      canSubmit: false,
      disabledReason: `Freigabe nicht möglich (Status: ${status}).`,
      managerDisplayName: null,
    };
  }

  if (status !== "draft") {
    return {
      canSubmit: false,
      disabledReason: `Freigabe nur im Status Entwurf möglich (aktuell: ${status}).`,
      managerDisplayName: null,
    };
  }

  const sentinelBlock = getOkrPlanningObjectiveSentinelApprovalBlockMessageDe(
    objective as OkrPlanningObjectiveRow
  );
  if (sentinelBlock) {
    return {
      canSubmit: false,
      disabledReason: sentinelBlock,
      managerDisplayName: null,
    };
  }

  const manager = await tryResolveDirectManagerAssignee(organizationId, submitterMembershipId);
  if (!manager) {
    return {
      canSubmit: false,
      disabledReason:
        "Kein Vorgesetzter hinterlegt. Bitte unter Verantwortliche deinen Responsible und die Hierarchie (Report → Manager) pflegen.",
      managerDisplayName: null,
    };
  }

  return {
    canSubmit: true,
    disabledReason: null,
    managerDisplayName: manager.managerDisplayName,
  };
}

export async function buildOkrApprovalSubmitEligibilityByObjectiveId(
  organizationId: string,
  submitterMembershipId: string,
  objectives: OkrPlanningObjectiveRow[]
): Promise<Record<string, OkrApprovalSubmitEligibility>> {
  const out: Record<string, OkrApprovalSubmitEligibility> = {};
  await Promise.all(
    objectives.map(async (o) => {
      out[o.id] = await getOkrApprovalSubmitEligibility(organizationId, submitterMembershipId, o);
    })
  );
  return out;
}
