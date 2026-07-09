import type { StrategyObjectVersioningMeta } from "@/lib/strategy-objects";
import { isObjectiveEligibleForDirectionLink } from "@/lib/strategy-cycle/objective-direction-link-eligibility";
import { isStrategicDirectionEligibleForPrograms } from "@/lib/strategy-objects/direction-program-eligibility";

/** Stoßrichtung: aktive Identität mit gültiger Fassung. */
export function isStrategicDirectionEligibleForAnnualTargetLink(
  versioning?: StrategyObjectVersioningMeta | null
): boolean {
  return isStrategicDirectionEligibleForPrograms(versioning);
}

/** Programme: nur Status «aktiv». */
export function isStrategyProgramEligibleForAnnualTargetLink(
  status: string | null | undefined
): boolean {
  return String(status ?? "").trim() === "active";
}

export function isStrategicObjectiveEligibleForAnnualTargetLink(
  versioning?: StrategyObjectVersioningMeta | null
): boolean {
  return isObjectiveEligibleForDirectionLink(versioning);
}

export function filterDirectionsForAnnualTargetSelect<
  T extends { id: string; versioning?: StrategyObjectVersioningMeta | null },
>(items: T[], preserveId?: string | null): T[] {
  return items.filter(
    (item) =>
      isStrategicDirectionEligibleForAnnualTargetLink(item.versioning) ||
      (preserveId != null && preserveId !== "" && item.id === preserveId)
  );
}

export function filterProgramsForAnnualTargetSelect<
  T extends { id: string; status?: string | null },
>(items: T[], preserveId?: string | null): T[] {
  return items.filter(
    (item) =>
      isStrategyProgramEligibleForAnnualTargetLink(item.status) ||
      (preserveId != null && preserveId !== "" && item.id === preserveId)
  );
}

export function filterObjectivesForAnnualTargetSelect<
  T extends { id: string; versioning?: StrategyObjectVersioningMeta | null },
>(items: T[], preserveId?: string | null): T[] {
  return items.filter(
    (item) =>
      isStrategicObjectiveEligibleForAnnualTargetLink(item.versioning) ||
      (preserveId != null && preserveId !== "" && item.id === preserveId)
  );
}
