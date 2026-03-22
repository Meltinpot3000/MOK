/**
 * Eine Quelle der Wahrheit fuer erlaubte Initiative-Gewichte:
 * DB-Check (Migration 0073), Server-Validierung, Formular.
 */
export const ALLOWED_INITIATIVE_WEIGHTS = [1, 2, 3, 5, 8] as const;

export type InitiativeWeight = (typeof ALLOWED_INITIATIVE_WEIGHTS)[number];

export const DEFAULT_INITIATIVE_WEIGHT: InitiativeWeight = 3;

export function isAllowedInitiativeWeight(value: number): value is InitiativeWeight {
  return (ALLOWED_INITIATIVE_WEIGHTS as readonly number[]).includes(value);
}

/** Zaehlt als „aktive Umsetzung“ fuer Roll-up, KPIs und Attention (kein Draft/Abgeschlossen/Archiv). */
export const ACTIVE_INITIATIVE_STATUSES = ["planned", "active", "at_risk"] as const;

export type ActiveInitiativeStatus = (typeof ACTIVE_INITIATIVE_STATUSES)[number];

export function isActiveExecutionInitiativeStatus(status: string): status is ActiveInitiativeStatus {
  return (ACTIVE_INITIATIVE_STATUSES as readonly string[]).includes(status);
}
