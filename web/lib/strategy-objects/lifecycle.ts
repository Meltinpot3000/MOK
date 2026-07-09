import type { StrategyObjectIdentityLifecycleState } from "./types";

/**
 * Portfolio-Lebenszyklus der Strategieobjekte:
 *   draft → active ⇄ inactive → retired (endgültig)
 * Kein Löschen aktiver/inaktiver/stillgelegter Objekte; nur Entwürfe sind löschbar.
 */
export type LifecycleTransitionTarget = "active" | "inactive" | "retired";

export function allowedLifecycleTransitions(
  current: StrategyObjectIdentityLifecycleState | null | undefined
): LifecycleTransitionTarget[] {
  switch (current) {
    case "draft":
      return ["active"];
    case "active":
      return ["inactive"];
    case "inactive":
      return ["active", "retired"];
    default:
      return [];
  }
}

export function isLifecycleTransitionAllowed(
  current: StrategyObjectIdentityLifecycleState | null | undefined,
  target: LifecycleTransitionTarget
): boolean {
  return allowedLifecycleTransitions(current).includes(target);
}

/** Nur ein Entwurf (Lifecycle draft) darf hart gelöscht werden. */
export function canHardDeleteLifecycle(
  current: StrategyObjectIdentityLifecycleState | null | undefined
): boolean {
  return current === "draft";
}

/** Button-Beschriftung – kontextabhängig (reaktivieren vs. aktivieren). */
export function lifecycleTransitionLabelDe(
  current: StrategyObjectIdentityLifecycleState | null | undefined,
  target: LifecycleTransitionTarget
): string {
  if (target === "inactive") return "Inaktivieren";
  if (target === "retired") return "Stilllegen";
  return current === "inactive" ? "Reaktivieren" : "Aktivieren";
}

export function normalizeLifecycleTarget(value: unknown): LifecycleTransitionTarget | null {
  return value === "active" || value === "inactive" || value === "retired" ? value : null;
}
