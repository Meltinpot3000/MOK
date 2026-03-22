/**
 * Pure helpers for OKR planning workspace (warnings + link maps). Used by UI and Vitest.
 */

export type InitiativeKrLinkRow = {
  initiative_id: string;
  key_result_id: string;
};

export function keyResultIdsByInitiativeId(links: InitiativeKrLinkRow[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const l of links) {
    const cur = m.get(l.initiative_id) ?? [];
    cur.push(l.key_result_id);
    m.set(l.initiative_id, cur);
  }
  return m;
}

export function initiativeIdsByKeyResultId(links: InitiativeKrLinkRow[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const l of links) {
    const cur = m.get(l.key_result_id) ?? [];
    cur.push(l.initiative_id);
    m.set(l.key_result_id, cur);
  }
  return m;
}

export function initiativeWarningNoKeyResultLink(
  initiativeId: string,
  links: InitiativeKrLinkRow[]
): boolean {
  return !links.some((l) => l.initiative_id === initiativeId);
}

export function keyResultWarningNoInitiativeLink(
  keyResultId: string,
  links: InitiativeKrLinkRow[]
): boolean {
  return !links.some((l) => l.key_result_id === keyResultId);
}
