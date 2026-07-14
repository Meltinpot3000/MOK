import type { StrategyObjectVersioningMeta } from "@/lib/strategy-objects";
import { isObjectiveEligibleForDirectionLink } from "@/lib/strategy-cycle/objective-direction-link-eligibility";
import { PROGRAM_STATUSES_FOR_PLANNING } from "@/lib/change-run/change-run-model";

/**
 * Stoßrichtung für Jahresziel-Planung (Run): draft oder active mit aktueller Fassung.
 * Strenger als Programm-Anlage (dort nur fully active) — analog Draft-Programme.
 */
export function isStrategicDirectionEligibleForAnnualTargetLink(
  versioning?: StrategyObjectVersioningMeta | null
): boolean {
  if (!versioning) return false;
  const lifecycle = versioning.identity_lifecycle_state;
  if (lifecycle !== "draft" && lifecycle !== "active") return false;
  if (versioning.revision_state !== "current") return false;
  const signal = versioning.latest_operational_signal;
  const operationalStatus = versioning.operational_status;
  if (
    operationalStatus === "completed" ||
    operationalStatus === "retired" ||
    operationalStatus === "removed" ||
    operationalStatus === "archived"
  ) {
    return false;
  }
  if (signal === "completed" || signal === "retired" || signal === "removed") return false;
  return true;
}

/** Programme: planungsrelevante Status (Draft bis Aktiv). */
export function isStrategyProgramEligibleForAnnualTargetLink(
  status: string | null | undefined
): boolean {
  return (PROGRAM_STATUSES_FOR_PLANNING as readonly string[]).includes(
    String(status ?? "").trim()
  );
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
