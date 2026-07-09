import { redirect } from "next/navigation";
import { getPhase0Context } from "@/lib/phase0/queries";
import { resolveStrategyPlanningCycle } from "@/lib/strategy-cycle/pick-strategy-planning-cycle";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";

export type StrategyCycleWorkspaceContext = {
  organizationId: string;
  membershipId: string;
  cycleId: string;
};

export async function getWorkspaceContextOrRedirectFromActions(): Promise<StrategyCycleWorkspaceContext> {
  const context = await getPhase0Context();
  if (!context) redirect("/no-access");

  const access = await getSidebarAccessContext("strategy-cycle");
  if (access.state !== "ok" || !access.canWrite) redirect("/no-access");

  const cycle = await resolveStrategyPlanningCycle(context.organizationId);
  if (!cycle) redirect("/strategy-cycle");

  return {
    organizationId: context.organizationId,
    membershipId: context.membershipId,
    cycleId: cycle.id,
  };
}
