/**
 * Program & Direction Aggregation – berechnet, nicht persistiert.
 * MVP: Direction primär aus Objective Health + Program Health; Initiativen als Beleg.
 */

import type { ReviewStatus } from "./key-result-progress";
import { deriveInitiativeHealth } from "./initiative-health";
import type { InitiativeRow } from "./initiative-health";

/**
 * Aggregiert Program Health aus Initiative Health.
 * Regel: mindestens ein off_track → off_track; mindestens ein at_risk → at_risk; sonst on_track.
 */
export function aggregateProgramHealth(
  initiatives: InitiativeRow[]
): ReviewStatus {
  if (initiatives.length === 0) return "on_track";
  const statuses = initiatives.map((i) => deriveInitiativeHealth(i));
  if (statuses.some((s) => s === "off_track")) return "off_track";
  if (statuses.some((s) => s === "at_risk")) return "at_risk";
  return "on_track";
}

/**
 * MVP: Direction Performance primär aus Objective Health + Program Health.
 * Initiativen nur als unterstützendes Signal.
 */
export function aggregateDirectionPerformance(
  objectiveHealths: ReviewStatus[],
  programHealths: ReviewStatus[]
): ReviewStatus {
  const all = [...objectiveHealths, ...programHealths];
  if (all.length === 0) return "on_track";
  if (all.some((s) => s === "off_track")) return "off_track";
  if (all.some((s) => s === "at_risk")) return "at_risk";
  return "on_track";
}
