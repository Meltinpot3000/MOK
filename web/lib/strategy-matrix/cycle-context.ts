import { redirect } from "next/navigation";
import { getPhase0Context } from "@/lib/phase0/queries";
import { resolveStrategyPlanningCycle } from "@/lib/strategy-cycle/pick-strategy-planning-cycle";

export async function getMatrixCycleContextOrRedirect() {
  const localContext = await getPhase0Context();
  if (!localContext) redirect("/no-access");

  const cycle = await resolveStrategyPlanningCycle(localContext.organizationId);
  if (!cycle) redirect("/strategy-matrix");

  return { localContext, cycle };
}
