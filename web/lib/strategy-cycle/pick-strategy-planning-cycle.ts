import { getPlanningCycleAtLevel } from "@/lib/phase0/queries";
import type { PlanningCycleRecord } from "@/lib/planning/queries";

type ResolveOptions = {
  preferredCycleId?: string | null;
};

/** L1 — mehrjähriger Strategiezyklus (Herausforderungen, Stoßrichtungen, strategische Ziele, Analyse). */
export async function resolveStrategyPlanningCycle(
  organizationId: string,
  options: ResolveOptions = {}
): Promise<PlanningCycleRecord | null> {
  return getPlanningCycleAtLevel(organizationId, 1, options.preferredCycleId);
}

/** L2 — Jahres-/Reviewzyklus (Jahresziele, Programme, Initiativen). */
export async function resolveAnnualPlanningCycle(
  organizationId: string,
  options: ResolveOptions = {}
): Promise<PlanningCycleRecord | null> {
  return getPlanningCycleAtLevel(organizationId, 2, options.preferredCycleId);
}

/** L3 — OKR-Quartalszyklus. */
export async function resolveOkrPlanningCycle(
  organizationId: string,
  options: ResolveOptions = {}
): Promise<PlanningCycleRecord | null> {
  return getPlanningCycleAtLevel(organizationId, 3, options.preferredCycleId);
}
