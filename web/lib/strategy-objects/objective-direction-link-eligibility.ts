import type { StrategyObjectVersioningMeta } from "./types";

/** Strategische Ziele duerfen verknuepft werden, wenn Identity aktiv und Revision current ist. */
export function isObjectiveEligibleForDirectionLink(
  versioning?: StrategyObjectVersioningMeta | null
): boolean {
  if (!versioning) return false;
  if (versioning.identity_lifecycle_state !== "active") return false;
  if (versioning.revision_state !== "current") return false;
  const signal = versioning.latest_operational_signal;
  if (signal === "completed" || signal === "retired" || signal === "removed") return false;
  return true;
}
