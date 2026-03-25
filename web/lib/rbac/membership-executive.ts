import type { SupabaseClient } from "@supabase/supabase-js";

/** Tenant-spezifische Rolle `executive` (siehe rbac.roles / Migration 0038). */
export async function membershipHasExecutiveRole(
  supabase: SupabaseClient,
  organizationId: string,
  membershipId: string
): Promise<boolean> {
  const { data: roleRow } = await supabase
    .schema("rbac")
    .from("roles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("code", "executive")
    .maybeSingle();
  const roleId = (roleRow as { id: string } | null)?.id ?? null;
  if (!roleId) return false;
  const { data: link } = await supabase
    .schema("rbac")
    .from("member_roles")
    .select("membership_id")
    .eq("role_id", roleId)
    .eq("membership_id", membershipId)
    .maybeSingle();
  return Boolean(link);
}
