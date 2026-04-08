import type { SupabaseClient } from "@supabase/supabase-js";

export type ResponsibleAssignmentType = "owner" | "support" | "stakeholder";

/** Höherer Wert = höherwertige Rolle an der Organisationseinheit (Hauptverantwortung > …). */
export const ASSIGNMENT_RANK: Record<ResponsibleAssignmentType, number> = {
  owner: 3,
  support: 2,
  stakeholder: 1,
};

export function rankFromAssignmentType(t: ResponsibleAssignmentType): number {
  return ASSIGNMENT_RANK[t];
}

export async function fetchMaxAssignmentRankInUnit(
  supabase: SupabaseClient,
  organizationId: string,
  organizationUnitId: string,
  responsibleId: string
): Promise<number | null> {
  const { data, error } = await supabase
    .schema("app")
    .from("responsible_assignments")
    .select("assignment_type")
    .eq("organization_id", organizationId)
    .eq("organization_unit_id", organizationUnitId)
    .eq("responsible_id", responsibleId);

  if (error || !data?.length) return null;
  const ranks = data
    .map((row) => ASSIGNMENT_RANK[row.assignment_type as ResponsibleAssignmentType])
    .filter((n) => Number.isFinite(n));
  if (ranks.length === 0) return null;
  return Math.max(...ranks);
}
