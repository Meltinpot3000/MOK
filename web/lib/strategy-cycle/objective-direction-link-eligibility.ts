/**
 * Nur Objectives mit diesen Lifecycle-Status duerfen neu mit einer Stossrichtung verknuepft
 * (oder in der Matrix verlinkt) werden.
 */
export function isObjectiveEligibleForDirectionLink(status: string | null | undefined): boolean {
  const s = String(status ?? "").trim();
  return s === "active" || s === "at_risk";
}
