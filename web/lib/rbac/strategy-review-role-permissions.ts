import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getStrategyReviewDefaultCodesForRoleCode,
  STRATEGY_REVIEW_PERMISSION_CODES,
} from "@/lib/rbac/strategy-review-permission-ui";

/**
 * Liest für alle Rollen der Organisation die Strategy-Review-Permissions.
 */
export async function getStrategyReviewPermissionMatrix(organizationId: string): Promise<{
  roles: { id: string; code: string; name: string }[];
  cells: Record<string, boolean>;
}> {
  const supabase = await createSupabaseServerClient();

  const { data: roles } = await supabase
    .schema("rbac")
    .from("roles")
    .select("id, code, name")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  const roleIds = (roles ?? []).map((role) => role.id);
  if (roleIds.length === 0) {
    return { roles: [], cells: {} };
  }

  const { data: permissions } = await supabase
    .schema("rbac")
    .from("permissions")
    .select("id, code")
    .in("code", STRATEGY_REVIEW_PERMISSION_CODES);

  const permissionIds = (permissions ?? []).map((p) => p.id);
  const permissionById = new Map(
    (permissions ?? []).map((permission) => [permission.id, permission.code])
  );

  const cells: Record<string, boolean> = {};
  for (const roleId of roleIds) {
    for (const code of STRATEGY_REVIEW_PERMISSION_CODES) {
      cells[`${roleId}__${code}`] = false;
    }
  }

  if (permissionIds.length === 0) {
    return {
      roles: (roles ?? []) as { id: string; code: string; name: string }[],
      cells,
    };
  }

  const { data: rolePermissions } = await supabase
    .schema("rbac")
    .from("role_permissions")
    .select("role_id, permission_id")
    .in("role_id", roleIds)
    .in("permission_id", permissionIds);

  for (const row of rolePermissions ?? []) {
    const code = permissionById.get(row.permission_id);
    if (!code || !STRATEGY_REVIEW_PERMISSION_CODES.includes(code)) continue;
    cells[`${row.role_id}__${code}`] = true;
  }

  return {
    roles: (roles ?? []) as { id: string; code: string; name: string }[],
    cells,
  };
}

/** Speichert nur Strategy-Review-Permissions; andere role_permissions bleiben unberührt. */
export async function saveStrategyReviewRolePermissions(
  organizationId: string,
  roleIds: string[],
  grantedKeys: Set<string>
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { data: permissions } = await supabase
    .schema("rbac")
    .from("permissions")
    .select("id, code")
    .in("code", STRATEGY_REVIEW_PERMISSION_CODES);

  const permissionByCode = new Map((permissions ?? []).map((p) => [p.code, p.id]));
  const permissionIds = (permissions ?? []).map((p) => p.id);

  if (permissionIds.length === 0) {
    return;
  }

  await supabase
    .schema("rbac")
    .from("role_permissions")
    .delete()
    .in("role_id", roleIds)
    .in("permission_id", permissionIds);

  const inserts: { role_id: string; permission_id: string }[] = [];
  for (const roleId of roleIds) {
    for (const code of STRATEGY_REVIEW_PERMISSION_CODES) {
      if (!grantedKeys.has(`${roleId}__${code}`)) continue;
      const pid = permissionByCode.get(code);
      if (pid) inserts.push({ role_id: roleId, permission_id: pid });
    }
  }

  if (inserts.length > 0) {
    await supabase.schema("rbac").from("role_permissions").insert(inserts);
  }
}

export async function restoreStrategyReviewPermissionDefaults(
  organizationId: string,
  roles: { id: string; code: string }[]
): Promise<void> {
  const { cells: current } = await getStrategyReviewPermissionMatrix(organizationId);
  const granted = new Set<string>();
  const roleIds = roles.map((r) => r.id);

  for (const role of roles) {
    const defaults = getStrategyReviewDefaultCodesForRoleCode(role.code);
    if (defaults) {
      for (const code of defaults) {
        granted.add(`${role.id}__${code}`);
      }
    } else {
      for (const code of STRATEGY_REVIEW_PERMISSION_CODES) {
        const key = `${role.id}__${code}`;
        if (current[key]) granted.add(key);
      }
    }
  }

  await saveStrategyReviewRolePermissions(organizationId, roleIds, granted);
}
