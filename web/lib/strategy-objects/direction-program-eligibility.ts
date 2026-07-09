import type { StrategyObjectVersioningMeta } from "./types";

/** Programme duerfen nur fuer Stossrichtungen mit aktiver, gueltiger Fassung angelegt werden. */
export function isStrategicDirectionEligibleForPrograms(
  versioning?: StrategyObjectVersioningMeta | null
): boolean {
  if (!versioning) return false;
  if (versioning.identity_lifecycle_state !== "active") return false;
  if (versioning.revision_state !== "current") return false;
  const signal = versioning.latest_operational_signal;
  const operationalStatus = versioning.operational_status;
  if (
    operationalStatus === "on_hold" ||
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

/** Programm-Matrix: aktive Identitaet mit gueltiger Fassung (inkl. pausiert). */
export function isStrategicDirectionVisibleInProgramMatrix(
  versioning?: StrategyObjectVersioningMeta | null
): boolean {
  if (!versioning) return false;
  if (versioning.identity_lifecycle_state !== "active") return false;
  if (versioning.revision_state !== "current") return false;
  const signal = versioning.latest_operational_signal;
  if (signal === "retired" || signal === "removed") return false;
  return true;
}
