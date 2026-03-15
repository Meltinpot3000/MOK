import { redirect } from "next/navigation";
import { getPhase0Context, getPlanningCycles } from "@/lib/phase0/queries";

export async function getMatrixCycleContextOrRedirect() {
  const localContext = await getPhase0Context();
  if (!localContext) redirect("/no-access");

  const localCycles = await getPlanningCycles(localContext.organizationId);
  const cycle = localCycles[0];
  if (!cycle) redirect("/strategy-matrix");

  return { localContext, cycle };
}
