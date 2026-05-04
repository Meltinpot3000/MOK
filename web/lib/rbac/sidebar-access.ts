import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getEmptySidebarPermissionMap,
  getReadPermissionCode,
  getWritePermissionCode,
  SIDEBAR_ITEM_IDS,
  type SidebarItemId,
  type SidebarPermissionMap,
} from "@/lib/sidebar-access";

export type RoleAccessRow = {
  role_id: string;
  item_id: SidebarItemId;
  level: "none" | "read" | "write";
};

export async function getSidebarPermissionsForMembership(
  membershipId: string
): Promise<SidebarPermissionMap> {
  const supabase = await createSupabaseServerClient();
  const permissions = getEmptySidebarPermissionMap();

  const { data: memberRoles } = await supabase
    .schema("rbac")
    .from("member_roles")
    .select("role_id")
    .eq("membership_id", membershipId);

  const roleIds = [...new Set((memberRoles ?? []).map((row) => row.role_id))];
  if (roleIds.length === 0) {
    return permissions;
  }

  const { data: roleRows } = await supabase
    .schema("rbac")
    .from("roles")
    .select("id, code")
    .in("id", roleIds);
  const roleCodeById = new Map((roleRows ?? []).map((row) => [row.id, row.code]));
  const roleCodes = [...new Set(roleIds.map((id) => roleCodeById.get(id)).filter(Boolean) as string[])];
  const hasOrgAdminRole = roleCodes.includes("org_admin");
  const hasExecutiveRole = roleCodes.includes("executive");
  const hasDepartmentLeadRole = roleCodes.includes("department_lead");

  const { data: rolePermissions } = await supabase
    .schema("rbac")
    .from("role_permissions")
    .select("permission_id")
    .in("role_id", roleIds);

  const permissionIds = [...new Set((rolePermissions ?? []).map((row) => row.permission_id))];
  const codeSet = new Set<string>();

  if (permissionIds.length > 0) {
    const { data: permissionsData } = await supabase
      .schema("rbac")
      .from("permissions")
      .select("id, code")
      .in("id", permissionIds);

    for (const row of permissionsData ?? []) {
      codeSet.add(row.code);
    }

    for (const itemId of SIDEBAR_ITEM_IDS) {
      const read = codeSet.has(getReadPermissionCode(itemId));
      const write = codeSet.has(getWritePermissionCode(itemId));
      permissions[itemId] = {
        read: read || write,
        write,
      };
    }
  }

  /**
   * Menü «Meine Aufgaben» hängt an nav.my-tasks.read. Rollen mit tasks.read (0124) hatten das Nav-Recht
   * oft paarweise — bei manuell gepflegten Matrizen fehlt nav.my-tasks.read trotzdem. Dann trotzdem anzeigen.
   */
  if (codeSet.has("tasks.read")) {
    permissions["my-tasks"] = {
      read: true,
      write: permissions["my-tasks"].write,
    };
  }

  const hasAnySidebarPermission = SIDEBAR_ITEM_IDS.some(
    (itemId) => permissions[itemId].read || permissions[itemId].write
  );

  /**
   * Wenn nav.* in role_permissions fehlen: fuer Fuehrungsrollen Nav-Zugang setzen (sonst leere Sidebar).
   */
  if (!hasAnySidebarPermission && hasOrgAdminRole) {
    for (const itemId of SIDEBAR_ITEM_IDS) {
      permissions[itemId] = { read: true, write: true };
    }
  } else if (!hasAnySidebarPermission && (hasExecutiveRole || hasDepartmentLeadRole)) {
    for (const itemId of SIDEBAR_ITEM_IDS) {
      permissions[itemId] = { read: true, write: false };
    }
  }

  return permissions;
}

export async function getRoleAccessMatrix(
  organizationId: string
): Promise<{ roles: { id: string; code: string; name: string }[]; matrix: RoleAccessRow[] }> {
  const supabase = await createSupabaseServerClient();

  const { data: roles } = await supabase
    .schema("rbac")
    .from("roles")
    .select("id, code, name")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  const roleIds = (roles ?? []).map((role) => role.id);
  if (roleIds.length === 0) {
    return { roles: [], matrix: [] };
  }

  const sidebarCodes = SIDEBAR_ITEM_IDS.flatMap((itemId) => [
    getReadPermissionCode(itemId),
    getWritePermissionCode(itemId),
  ]);

  const { data: permissions } = await supabase
    .schema("rbac")
    .from("permissions")
    .select("id, code")
    .in("code", sidebarCodes);

  const permissionById = new Map((permissions ?? []).map((permission) => [permission.id, permission.code]));
  const { data: rolePermissions } = await supabase
    .schema("rbac")
    .from("role_permissions")
    .select("role_id, permission_id")
    .in("role_id", roleIds)
    .in("permission_id", (permissions ?? []).map((permission) => permission.id));

  const roleCodes = new Map<string, Set<string>>();
  for (const roleId of roleIds) {
    roleCodes.set(roleId, new Set<string>());
  }

  for (const row of rolePermissions ?? []) {
    const code = permissionById.get(row.permission_id);
    if (!code) {
      continue;
    }
    roleCodes.get(row.role_id)?.add(code);
  }

  const matrix: RoleAccessRow[] = [];
  for (const roleId of roleIds) {
    const codes = roleCodes.get(roleId) ?? new Set<string>();
    for (const itemId of SIDEBAR_ITEM_IDS) {
      const hasRead = codes.has(getReadPermissionCode(itemId));
      const hasWrite = codes.has(getWritePermissionCode(itemId));
      const level: RoleAccessRow["level"] = hasWrite ? "write" : hasRead ? "read" : "none";
      matrix.push({ role_id: roleId, item_id: itemId, level });
    }
  }

  return {
    roles: (roles ?? []) as { id: string; code: string; name: string }[],
    matrix,
  };
}

export async function saveRoleAccessMatrix(
  organizationId: string,
  roleIds: string[],
  levels: Record<string, "none" | "read" | "write">
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const sidebarCodes = SIDEBAR_ITEM_IDS.flatMap((itemId) => [
    getReadPermissionCode(itemId),
    getWritePermissionCode(itemId),
  ]);

  const { data: permissions } = await supabase
    .schema("rbac")
    .from("permissions")
    .select("id, code")
    .in("code", sidebarCodes);

  const permissionByCode = new Map((permissions ?? []).map((permission) => [permission.code, permission.id]));
  const permissionIds = (permissions ?? []).map((permission) => permission.id);

  await supabase
    .schema("rbac")
    .from("role_permissions")
    .delete()
    .in("role_id", roleIds)
    .in("permission_id", permissionIds);

  const inserts: { role_id: string; permission_id: string }[] = [];
  for (const roleId of roleIds) {
    for (const itemId of SIDEBAR_ITEM_IDS) {
      const key = `${roleId}__${itemId}`;
      const level = levels[key] ?? "none";
      if (level === "none") {
        continue;
      }

      const readPermissionId = permissionByCode.get(getReadPermissionCode(itemId));
      if (readPermissionId) {
        inserts.push({ role_id: roleId, permission_id: readPermissionId });
      }

      if (level === "write") {
        const writePermissionId = permissionByCode.get(getWritePermissionCode(itemId));
        if (writePermissionId) {
          inserts.push({ role_id: roleId, permission_id: writePermissionId });
        }
      }
    }
  }

  if (inserts.length > 0) {
    await supabase.schema("rbac").from("role_permissions").insert(inserts);
  }
}

export function canReadItem(
  permissions: SidebarPermissionMap,
  itemId: SidebarItemId
): boolean {
  return permissions[itemId]?.read ?? false;
}

export function canWriteItem(
  permissions: SidebarPermissionMap,
  itemId: SidebarItemId
): boolean {
  return permissions[itemId]?.write ?? false;
}
