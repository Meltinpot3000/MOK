import type { OkrObjectiveView } from "@/lib/okr/okr-cycle-view-model";
import type { OkrPlanningObjectiveRow } from "@/lib/okr/planning-data";
import {
  canReadKeyResultFromBulk,
  canReadObjectiveFromBulk,
  canUpdateKeyResultFromBulk,
  collectMembershipIdsForOkrBulk,
  loadOkrBulkAccessContext,
  type OkrKeyResultAccessRow,
  type OkrObjectiveAccessRow,
  type OkrBulkAccessContext,
} from "@/lib/okr/okr-object-access";

/** Gleiche Leseregel wie Tracking: Objective lesbar oder mindestens ein Key Result lesbar. */
export function canReadOkrObjectiveTreeFromBulk(
  bulk: OkrBulkAccessContext,
  objective: Pick<OkrObjectiveAccessRow, "owner_membership_id" | "deputy_membership_id">,
  keyResults: Array<Pick<OkrKeyResultAccessRow, "owner_membership_id" | "deputy_membership_id">>
): boolean {
  if (canReadObjectiveFromBulk(bulk, objective)) return true;
  return keyResults.some((kr) => canReadKeyResultFromBulk(bulk, kr, objective));
}

export async function loadTrackingBulkContext(
  membershipId: string,
  views: OkrObjectiveView[]
): Promise<OkrBulkAccessContext> {
  const objectivesAccess: OkrObjectiveAccessRow[] = views.map((ov) => ({
    id: ov.objective.id,
    owner_membership_id: ov.objective.ownerMembershipId,
    deputy_membership_id: ov.objective.deputyMembershipId ?? null,
  }));
  const keyResultsAccess: OkrKeyResultAccessRow[] = views.flatMap((ovObj) =>
    ovObj.keyResults.map((kv) => ({
      id: kv.keyResult.id,
      owner_membership_id: kv.keyResult.ownerMembershipId,
      deputy_membership_id: kv.keyResult.deputyMembershipId ?? null,
    }))
  );
  return loadOkrBulkAccessContext({
    currentMembershipId: membershipId,
    referencedMembershipIds: collectMembershipIdsForOkrBulk(objectivesAccess, keyResultsAccess),
  });
}

/** Bulk-Kontext fuer Planungszeilen (identisch zu Tracking, andere Eingabeform). */
export async function loadPlanningReadBulkContext(
  membershipId: string,
  objectives: OkrPlanningObjectiveRow[]
): Promise<OkrBulkAccessContext> {
  const objectivesAccess: OkrObjectiveAccessRow[] = objectives.map((o) => ({
    id: o.id,
    owner_membership_id: o.ownerMembershipId,
    deputy_membership_id: o.deputyMembershipId ?? null,
  }));
  const keyResultsAccess: OkrKeyResultAccessRow[] = objectives.flatMap((o) =>
    o.keyResults.map((kr) => ({
      id: kr.id,
      owner_membership_id: kr.ownerMembershipId,
      deputy_membership_id: kr.deputyMembershipId ?? null,
    }))
  );
  return loadOkrBulkAccessContext({
    currentMembershipId: membershipId,
    referencedMembershipIds: collectMembershipIdsForOkrBulk(objectivesAccess, keyResultsAccess),
  });
}

export function filterPlanningObjectivesForRead(
  objectives: OkrPlanningObjectiveRow[],
  bulk: OkrBulkAccessContext
): OkrPlanningObjectiveRow[] {
  return objectives.filter((o) =>
    canReadOkrObjectiveTreeFromBulk(
      bulk,
      {
        owner_membership_id: o.ownerMembershipId,
        deputy_membership_id: o.deputyMembershipId ?? null,
      },
      o.keyResults.map((kr) => ({
        owner_membership_id: kr.ownerMembershipId,
        deputy_membership_id: kr.deputyMembershipId ?? null,
      }))
    )
  );
}

export function filterObjectiveViewsForTrackingRead(
  views: OkrObjectiveView[],
  bulk: OkrBulkAccessContext
): OkrObjectiveView[] {
  return views.filter((ov) =>
    canReadOkrObjectiveTreeFromBulk(
      bulk,
      {
        owner_membership_id: ov.objective.ownerMembershipId,
        deputy_membership_id: ov.objective.deputyMembershipId ?? null,
      },
      ov.keyResults.map((kv) => ({
        owner_membership_id: kv.keyResult.ownerMembershipId,
        deputy_membership_id: kv.keyResult.deputyMembershipId ?? null,
      }))
    )
  );
}

export function buildKeyResultUpdateFlagsForTracking(
  views: OkrObjectiveView[],
  bulk: OkrBulkAccessContext
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const ov of views) {
    const objRow = {
      owner_membership_id: ov.objective.ownerMembershipId,
      deputy_membership_id: ov.objective.deputyMembershipId ?? null,
    };
    for (const kv of ov.keyResults) {
      out[kv.keyResult.id] = canUpdateKeyResultFromBulk(
        bulk,
        {
          owner_membership_id: kv.keyResult.ownerMembershipId,
          deputy_membership_id: kv.keyResult.deputyMembershipId ?? null,
        },
        objRow
      );
    }
  }
  return out;
}
