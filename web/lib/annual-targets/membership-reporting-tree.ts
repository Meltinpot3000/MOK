export type MembershipReportingRow = {
  id: string;
  reportsToMembershipId: string | null;
};

export function normMembershipId(id: string): string {
  return id.trim().toLowerCase();
}

/** Alle Membership-IDs in der Unterstellten-Hierarchie (ohne die Führungskraft selbst). */
export function collectDescendantMembershipIds(
  managerMembershipId: string,
  memberships: MembershipReportingRow[]
): Set<string> {
  const managerNorm = normMembershipId(managerMembershipId);
  const childrenByManager = new Map<string, string[]>();

  for (const row of memberships) {
    const parentId = row.reportsToMembershipId ? normMembershipId(row.reportsToMembershipId) : null;
    if (!parentId) continue;
    const childNorm = normMembershipId(row.id);
    const list = childrenByManager.get(parentId) ?? [];
    list.push(childNorm);
    childrenByManager.set(parentId, list);
  }

  const descendants = new Set<string>();
  const queue = [...(childrenByManager.get(managerNorm) ?? [])];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (descendants.has(id)) continue;
    descendants.add(id);
    for (const childId of childrenByManager.get(id) ?? []) {
      queue.push(childId);
    }
  }

  return descendants;
}

/** Vorgesetzte entlang reports_to (CEO, direkte Führungskraft, …). */
export function collectAncestorMembershipIds(
  membershipId: string,
  memberships: MembershipReportingRow[]
): Set<string> {
  const byId = new Map(memberships.map((m) => [normMembershipId(m.id), m]));
  const ancestors = new Set<string>();
  let current = normMembershipId(membershipId);

  for (let depth = 0; depth < memberships.length; depth++) {
    const row = byId.get(current);
    const parentId = row?.reportsToMembershipId ? normMembershipId(row.reportsToMembershipId) : null;
    if (!parentId) break;
    ancestors.add(parentId);
    current = parentId;
  }

  return ancestors;
}
