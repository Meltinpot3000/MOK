import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Alle RBAC-Permission-Codes der Membership (nicht auf nav.* eingeschränkt).
 * Pro Request gecacht (React cache).
 */
export const getPermissionCodesForMembership = cache(
  async (membershipId: string): Promise<Set<string>> => {
    const supabase = await createSupabaseServerClient();
    const codes = new Set<string>();

    const { data: memberRoles } = await supabase
      .schema("rbac")
      .from("member_roles")
      .select("role_id")
      .eq("membership_id", membershipId);

    const roleIds = [...new Set((memberRoles ?? []).map((row) => row.role_id))];
    if (roleIds.length === 0) return codes;

    const { data: rolePermissions } = await supabase
      .schema("rbac")
      .from("role_permissions")
      .select("permission_id")
      .in("role_id", roleIds);

    const permissionIds = [...new Set((rolePermissions ?? []).map((row) => row.permission_id))];
    if (permissionIds.length === 0) return codes;

    const { data: permissionsData } = await supabase
      .schema("rbac")
      .from("permissions")
      .select("code")
      .in("id", permissionIds);

    for (const row of permissionsData ?? []) {
      if (row.code) codes.add(row.code);
    }
    return codes;
  }
);
