import type { OkrPlanningWorkspaceData } from "@/lib/okr/planning-data";
import {
  canCreateKeyResultOnObjectiveFromBulk,
  canUpdateKeyResultFromBulk,
  canUpdateObjectiveFromBulk,
  collectMembershipIdsForOkrBulk,
  loadOkrBulkAccessContext,
  type OkrKeyResultAccessRow,
  type OkrObjectiveAccessRow,
} from "@/lib/okr/okr-object-access";

export type OkrPlanningEditFlags = {
  objectiveEditById: Record<string, boolean>;
  keyResultEditById: Record<string, boolean>;
  canCreateKeyResultByObjectiveId: Record<string, boolean>;
};

export async function buildOkrPlanningEditFlags(
  membershipId: string,
  workspace: OkrPlanningWorkspaceData
): Promise<OkrPlanningEditFlags> {
  const objectivesAccess: OkrObjectiveAccessRow[] = workspace.okrObjectives.map((o) => ({
    id: o.id,
    owner_membership_id: o.ownerMembershipId,
    deputy_membership_id: o.deputyMembershipId ?? null,
  }));
  const keyResultsAccess: OkrKeyResultAccessRow[] = workspace.okrObjectives.flatMap((o) =>
    o.keyResults.map((kr) => ({
      id: kr.id,
      owner_membership_id: kr.ownerMembershipId,
      deputy_membership_id: kr.deputyMembershipId ?? null,
    }))
  );

  const bulk = await loadOkrBulkAccessContext({
    currentMembershipId: membershipId,
    referencedMembershipIds: collectMembershipIdsForOkrBulk(objectivesAccess, keyResultsAccess),
  });

  const objectiveEditById: Record<string, boolean> = {};
  const keyResultEditById: Record<string, boolean> = {};
  const canCreateKeyResultByObjectiveId: Record<string, boolean> = {};

  for (const o of workspace.okrObjectives) {
    const row = {
      owner_membership_id: o.ownerMembershipId,
      deputy_membership_id: o.deputyMembershipId ?? null,
    };
    objectiveEditById[o.id] = canUpdateObjectiveFromBulk(bulk, row);
    canCreateKeyResultByObjectiveId[o.id] = canCreateKeyResultOnObjectiveFromBulk(bulk, row);
    for (const kr of o.keyResults) {
      keyResultEditById[kr.id] = canUpdateKeyResultFromBulk(
        bulk,
        {
          owner_membership_id: kr.ownerMembershipId,
          deputy_membership_id: kr.deputyMembershipId ?? null,
        },
        row
      );
    }
  }

  return { objectiveEditById, keyResultEditById, canCreateKeyResultByObjectiveId };
}
