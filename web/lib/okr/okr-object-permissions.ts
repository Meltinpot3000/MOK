/**
 * Objektschutz im OKR-Arbeitsbereich (Bereichsschreibrecht ist separat via RBAC).
 * Objective-Owner darf alle KRs des Objectives mitbearbeiten; KR-Verantwortlicher zusätzlich sein eigenes KR.
 */
export function canEditOkrObjectiveForUser(
  membershipId: string,
  objectiveOwnerMembershipId: string | null
): boolean {
  return objectiveOwnerMembershipId == null || objectiveOwnerMembershipId === membershipId;
}

export function canEditOkrKeyResultForUser(
  membershipId: string,
  objectiveOwnerMembershipId: string | null,
  keyResultOwnerMembershipId: string | null
): boolean {
  if (objectiveOwnerMembershipId != null && objectiveOwnerMembershipId === membershipId) {
    return true;
  }
  const effective = keyResultOwnerMembershipId ?? objectiveOwnerMembershipId;
  if (effective != null && effective === membershipId) {
    return true;
  }
  if (objectiveOwnerMembershipId == null && effective == null) {
    return true;
  }
  return false;
}
