/**
 * Initiative Health – measures execution confidence, NOT strategic success.
 * "Is execution progressing?" vs "Is strategy working?"
 */

import type { ReviewStatus } from "./key-result-progress";

export type InitiativeRow = {
  id: string;
  status: string;
  execution_health_override?: string | null;
  execution_health_override_by_membership_id?: string | null;
  execution_health_override_at?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

/**
 * Leitet Initiative Health aus Status und Kontext ab.
 * execution_health_override hat Vorrang.
 */
export function deriveInitiativeHealth(initiative: InitiativeRow): ReviewStatus {
  if (initiative.execution_health_override) {
    return initiative.execution_health_override as ReviewStatus;
  }

  const status = initiative.status;
  const now = new Date();

  if (status === "completed") return "on_track";
  if (status === "archived") return "on_track";
  if (status === "at_risk") return "at_risk";
  if (status === "draft" || status === "planned") return "on_track";

  if (status === "active") {
    const endDate = initiative.end_date ? new Date(initiative.end_date) : null;
    if (endDate && endDate < now) return "off_track";
    if (endDate) {
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft < 14) return "at_risk";
    }
    return "on_track";
  }

  return "on_track";
}
