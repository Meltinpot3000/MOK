/** Formatiert den Ersteller für die Anzeige in Line-Item-Tabellen. */
export function formatCreatorLabel(
  createdBySource: string | null | undefined,
  creatorDisplayName: string | null | undefined
): string {
  if (createdBySource === "sentinel") return "Sentinel✨";
  if (creatorDisplayName?.trim()) return creatorDisplayName.trim();
  return "—";
}
