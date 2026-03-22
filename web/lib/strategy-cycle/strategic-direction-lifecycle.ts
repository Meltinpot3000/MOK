/**
 * Lifecycle for app.strategic_directions.status (single source of truth for UI + server validation).
 */
export const STRATEGIC_DIRECTION_STATUSES = [
  "draft",
  "approved",
  "active",
  "on_hold",
  "closed",
] as const;

export type StrategicDirectionStatus = (typeof STRATEGIC_DIRECTION_STATUSES)[number];

const ALLOWED = new Set<string>(STRATEGIC_DIRECTION_STATUSES);

export function isStrategicDirectionStatus(value: string): value is StrategicDirectionStatus {
  return ALLOWED.has(value);
}

/** Coerce form/legacy input to a valid status; invalid → draft. */
export function normalizeStrategicDirectionStatus(value: string | null | undefined): StrategicDirectionStatus {
  const v = String(value ?? "").trim();
  return isStrategicDirectionStatus(v) ? v : "draft";
}

/** Zeilen in der Programm-/Strategie-Matrix: genehmigt, aktiv oder pausiert (kein Entwurf, nicht abgeschlossen). */
export const STRATEGIC_DIRECTION_PROGRAM_MATRIX_STATUSES: readonly StrategicDirectionStatus[] = [
  "approved",
  "active",
  "on_hold",
] as const;

const PROGRAM_MATRIX_DIRECTION_STATUS_SET = new Set<string>(STRATEGIC_DIRECTION_PROGRAM_MATRIX_STATUSES);

export function isStrategicDirectionVisibleInProgramMatrix(
  status: string | null | undefined
): boolean {
  return PROGRAM_MATRIX_DIRECTION_STATUS_SET.has(normalizeStrategicDirectionStatus(status));
}

/** Programme duerfen nur fuer Stossrichtungen mit Status «aktiv» angelegt werden. */
export function isStrategicDirectionActiveForPrograms(
  status: string | null | undefined
): boolean {
  return normalizeStrategicDirectionStatus(status) === "active";
}

/** Deutsche UI-Labels (Anzeige in Dropdowns und Tabellen). */
export const STRATEGIC_DIRECTION_STATUS_LABELS_DE: Record<StrategicDirectionStatus, string> = {
  draft: "Entwurf",
  approved: "Genehmigt",
  active: "Aktiv",
  on_hold: "Pausiert",
  closed: "Abgeschlossen",
};
