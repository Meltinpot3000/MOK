import type { SupabaseClient } from "@supabase/supabase-js";
import type { DirectoryConnectionRow } from "@/lib/directory-sync/types";

export type ExternalMappingRow = {
  entity_type: string;
  external_id: string;
  internal_id: string;
};

export type GroupRoleMappingRow = {
  id: string;
  entra_group_id: string;
  entra_group_display_name: string | null;
  role_id: string;
};

export type ExistingOrgUnitRow = {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  managed_by_directory_sync: boolean;
};

export type ExistingMembershipRow = {
  id: string;
  user_id: string;
  status: string;
  display_name: string | null;
  title: string | null;
  responsible_id: string | null;
  managed_by_directory_sync: boolean;
};

export async function loadDirectoryConnection(
  admin: SupabaseClient,
  organizationId: string
): Promise<DirectoryConnectionRow | null> {
  const { data } = await admin
    .schema("app")
    .from("directory_connections")
    .select(
      "id, organization_id, provider, sync_enabled, azure_tenant_id, client_id, user_provisioning_policy, attribute_priority, department_path_separator, last_sync_at, last_preview_run_id, last_error"
    )
    .eq("organization_id", organizationId)
    .maybeSingle();

  return (data as DirectoryConnectionRow | null) ?? null;
}

export async function loadExternalMappings(
  admin: SupabaseClient,
  organizationId: string
): Promise<ExternalMappingRow[]> {
  const { data } = await admin
    .schema("app")
    .from("directory_external_mappings")
    .select("entity_type, external_id, internal_id")
    .eq("organization_id", organizationId);

  return (data ?? []) as ExternalMappingRow[];
}

export async function loadGroupRoleMappings(
  admin: SupabaseClient,
  organizationId: string
): Promise<GroupRoleMappingRow[]> {
  const { data } = await admin
    .schema("app")
    .from("directory_group_role_mappings")
    .select("id, entra_group_id, entra_group_display_name, role_id")
    .eq("organization_id", organizationId);

  return (data ?? []) as GroupRoleMappingRow[];
}

export async function loadExistingOrgUnits(
  admin: SupabaseClient,
  organizationId: string
): Promise<ExistingOrgUnitRow[]> {
  const { data } = await admin
    .schema("app")
    .from("organization_unit")
    .select("id, code, name, parent_id, managed_by_directory_sync")
    .eq("organization_id", organizationId);

  return (data ?? []) as ExistingOrgUnitRow[];
}

export async function loadExistingMemberships(
  admin: SupabaseClient,
  organizationId: string
): Promise<ExistingMembershipRow[]> {
  const { data } = await admin
    .schema("app")
    .from("organization_memberships")
    .select("id, user_id, status, display_name, title, responsible_id, managed_by_directory_sync")
    .eq("organization_id", organizationId);

  return (data ?? []) as ExistingMembershipRow[];
}

export async function getDepartmentUnitTypeId(admin: SupabaseClient): Promise<string | null> {
  const { data } = await admin
    .schema("app")
    .from("organization_unit_type")
    .select("id")
    .eq("code", "department")
    .maybeSingle();

  return data?.id ?? null;
}
