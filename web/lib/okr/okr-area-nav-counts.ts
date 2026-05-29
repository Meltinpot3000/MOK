import { cache } from "react";
import { getOkrCycleContext } from "@/lib/okr/okr-cycle-context";
import { getOkrPlanningWorkspaceData } from "@/lib/okr/planning-data";
import { okrObjectiveEditableInPlanning } from "@/lib/okr/okr-objective-lifecycle";
import {
  filterObjectiveViewsForTrackingLifecycle,
  filterObjectiveViewsForTrackingRead,
  filterPlanningObjectivesForRead,
  loadPlanningReadBulkContext,
  loadTrackingBulkContext,
} from "@/lib/okr/okr-tracking-filter";

export type OkrAreaNavTabCounts = {
  tracking: number;
  planning: number;
};

export const loadOkrAreaNavTabCounts = cache(
  async (
    organizationId: string,
    membershipId: string,
    cycleInstanceId: string,
    preferredOkrCycleId: string | null
  ): Promise<OkrAreaNavTabCounts> => {
    const [cycleCtx, planningWorkspace] = await Promise.all([
      getOkrCycleContext(organizationId, cycleInstanceId, preferredOkrCycleId),
      getOkrPlanningWorkspaceData(organizationId, cycleInstanceId, preferredOkrCycleId),
    ]);

    const trackingPool = filterObjectiveViewsForTrackingLifecycle(cycleCtx.objectiveViews);
    const trackingBulk = await loadTrackingBulkContext(membershipId, trackingPool);
    const trackingCount = filterObjectiveViewsForTrackingRead(trackingPool, trackingBulk).length;

    const draftObjectives = planningWorkspace.okrObjectives.filter((o) =>
      okrObjectiveEditableInPlanning(o.status)
    );
    const planningBulk = await loadPlanningReadBulkContext(membershipId, draftObjectives);
    const planningCount = filterPlanningObjectivesForRead(draftObjectives, planningBulk).length;

    return { tracking: trackingCount, planning: planningCount };
  }
);
