import type { ReviewCycleOwnerOption } from "@/lib/review/review-cycle-data";
import type { ReviewCycleInitiativeInput } from "@/lib/review/review-cycle-view-model";

function formatReviewOwnerOptionLabel(o: ReviewCycleOwnerOption): string {
  const name = o.display_name?.trim() || "Mitglied";
  const roles = o.roles_label?.trim();
  if (roles.length > 0) return `${name} · ${roles}`;
  return name;
}

/** Optionen fuer Owner-Dropdowns im Reviewzyklus (inkl. aktueller Initiative-Owner). */
export function buildReviewOwnerSelectOptions(
  ownerRows: ReviewCycleOwnerOption[],
  initiativeRows: ReviewCycleInitiativeInput[]
): Array<{ id: string; label: string }> {
  const byId = new Map<string, string>();
  for (const o of ownerRows) {
    byId.set(o.membership_id, formatReviewOwnerOptionLabel(o));
  }
  for (const row of initiativeRows) {
    if (row.owner_membership_id && !byId.has(row.owner_membership_id)) {
      byId.set(row.owner_membership_id, row.owner_display_name ?? "Zugewiesener Owner");
    }
  }
  return [...byId.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "de"));
}
