import type { CanonicalOkrObjectiveFact } from "./fact-types";

export type OwnerLabelByMembershipId = Map<string, string>;

export function resolveObjectiveOwnerDisplayNames(
  facts: CanonicalOkrObjectiveFact[],
  ownerLabels: OwnerLabelByMembershipId
): CanonicalOkrObjectiveFact[] {
  return facts.map((fact) => {
    if (fact.ownerDisplayName) return fact;
    if (fact.ownerMembershipId && ownerLabels.has(fact.ownerMembershipId)) {
      return { ...fact, ownerDisplayName: ownerLabels.get(fact.ownerMembershipId) ?? "Person ohne Namen" };
    }
    if (fact.ownerMembershipId) return { ...fact, ownerDisplayName: "Person ohne Namen" };
    return { ...fact, ownerDisplayName: "Nicht zugewiesen" };
  });
}

export function applyCycleLabel(
  facts: CanonicalOkrObjectiveFact[],
  cycleLabel: string | null
): CanonicalOkrObjectiveFact[] {
  if (!cycleLabel) return facts;
  return facts.map((fact) => ({ ...fact, cycleLabel }));
}

