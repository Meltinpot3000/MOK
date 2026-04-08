import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Hierarchie der Standard-Organisationsrollen (rbac.roles.code), höher = mehr Mandat.
 * Unbekannte Codes gelten als 0 (niedrigste Stufe).
 */
export const RBAC_ORG_ROLE_RANK: Record<string, number> = {
  org_admin: 100,
  executive: 80,
  department_lead: 60,
  team_member: 40,
};

export function maxRbacRankForRoleCodes(codes: string[]): number {
  if (codes.length === 0) return 0;
  return Math.max(...codes.map((c) => RBAC_ORG_ROLE_RANK[c] ?? 0));
}

export async function fetchMaxRbacRankForResponsible(
  supabase: SupabaseClient,
  organizationId: string,
  responsibleId: string
): Promise<number> {
  const { data } = await supabase
    .schema("app")
    .from("responsibles")
    .select("membership_id")
    .eq("organization_id", organizationId)
    .eq("id", responsibleId)
    .maybeSingle();
  const mid = data?.membership_id ?? null;
  if (!mid) return 0;
  return fetchMaxRbacRankForMembership(supabase, organizationId, mid);
}

export async function fetchMaxRbacRankForMembership(
  supabase: SupabaseClient,
  organizationId: string,
  membershipId: string
): Promise<number> {
  const { data, error } = await supabase
    .schema("rbac")
    .from("member_roles")
    .select("role:role_id(code, organization_id)")
    .eq("membership_id", membershipId);

  if (error || !data?.length) return 0;

  const codes: string[] = [];
  for (const row of data) {
    const role = Array.isArray(row.role) ? row.role[0] : row.role;
    if (role && typeof role.code === "string" && role.organization_id === organizationId) {
      codes.push(role.code);
    }
  }
  return maxRbacRankForRoleCodes(codes);
}

export async function fetchRbacMaxRankByMembershipIds(
  supabase: SupabaseClient,
  organizationId: string,
  membershipIds: string[]
): Promise<Record<string, number>> {
  const unique = [...new Set(membershipIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return {};

  const { data, error } = await supabase
    .schema("rbac")
    .from("member_roles")
    .select("membership_id, role:role_id(code, organization_id)")
    .in("membership_id", unique);

  const result: Record<string, number> = Object.fromEntries(unique.map((id) => [id, 0]));
  if (error || !data?.length) {
    return result;
  }

  const codesByMembership = new Map<string, string[]>();
  for (const row of data) {
    const mid = row.membership_id as string;
    const role = Array.isArray(row.role) ? row.role[0] : row.role;
    if (!role || typeof role.code !== "string" || role.organization_id !== organizationId) continue;
    const list = codesByMembership.get(mid) ?? [];
    list.push(role.code);
    codesByMembership.set(mid, list);
  }

  for (const id of unique) {
    const codes = codesByMembership.get(id) ?? [];
    result[id] = maxRbacRankForRoleCodes(codes);
  }
  return result;
}
