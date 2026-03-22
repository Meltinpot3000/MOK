/**
 * Gleiche Regel wie in ProgramMappingMatrix: Anzahl Verknuepfungen
 * unter 3 gruen, unter 5 gelb, sonst rot (Fokus vs. Ueberlappung).
 */
export function addressedLinkCountToneClass(addressedCount: number): string {
  if (addressedCount < 3) return "text-emerald-700";
  if (addressedCount < 5) return "text-amber-700";
  return "text-red-700";
}

/** Max. sichtbare Pills pro Zeile (Herausforderungen / Objectives), Rest als +N. */
export const MATRIX_TABLE_LINK_PILLS_MAX = 3;
