import { redirect } from "next/navigation";
import { getActivePlanningCycle, getPhase0Context } from "@/lib/phase0/queries";

export async function getMatrixCycleContextOrRedirect() {
  const localContext = await getPhase0Context();
  if (!localContext) redirect("/no-access");

  const cycle = await getActivePlanningCycle(localContext.organizationId);
  if (!cycle) redirect("/strategy-matrix");

  return { localContext, cycle };
}
