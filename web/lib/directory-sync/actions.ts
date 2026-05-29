"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { runDirectorySync } from "@/lib/directory-sync/run-directory-sync";
import type { UserProvisioningPolicy } from "@/lib/directory-sync/types";

async function requireDirectorySyncWrite() {
  const access = await getSidebarAccessContext("directory-sync");
  if (access.state === "unauthenticated") redirect("/login");
  if (access.state === "forbidden" || !access.canWrite) redirect("/no-access");
  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  return { context, access };
}

export async function saveDirectoryConnection(formData: FormData) {
  const { context } = await requireDirectorySyncWrite();
  const supabase = await createSupabaseServerClient();

  const azureTenantId = String(formData.get("azure_tenant_id") ?? "").trim() || null;
  const clientId = String(formData.get("client_id") ?? "").trim() || null;
  const syncEnabled = formData.get("sync_enabled") === "on";
  const policy = String(formData.get("user_provisioning_policy") ?? "invite_only").trim() as UserProvisioningPolicy;
  const separator = String(formData.get("department_path_separator") ?? "").trim() || null;

  const validPolicies: UserProvisioningPolicy[] = ["none", "invite_only", "create_auth_user"];
  const userProvisioningPolicy = validPolicies.includes(policy) ? policy : "invite_only";

  const { error } = await supabase.schema("app").from("directory_connections").upsert(
    {
      organization_id: context.organizationId,
      provider: "entra_id",
      azure_tenant_id: azureTenantId,
      client_id: clientId,
      sync_enabled: syncEnabled,
      user_provisioning_policy: userProvisioningPolicy,
      department_path_separator: separator,
    },
    { onConflict: "organization_id" }
  );

  if (error) {
    redirect(`/directory-sync?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/directory-sync");
  redirect("/directory-sync?success=connection-saved");
}

export async function saveGroupRoleMapping(formData: FormData) {
  const { context } = await requireDirectorySyncWrite();
  const supabase = await createSupabaseServerClient();

  const entraGroupId = String(formData.get("entra_group_id") ?? "").trim();
  const entraGroupDisplayName = String(formData.get("entra_group_display_name") ?? "").trim() || null;
  const roleId = String(formData.get("role_id") ?? "").trim();

  if (!entraGroupId || !roleId) {
    redirect("/directory-sync?error=group-mapping-incomplete");
  }

  const { error } = await supabase.schema("app").from("directory_group_role_mappings").upsert(
    {
      organization_id: context.organizationId,
      entra_group_id: entraGroupId,
      entra_group_display_name: entraGroupDisplayName,
      role_id: roleId,
    },
    { onConflict: "organization_id,entra_group_id,role_id" }
  );

  if (error) {
    redirect(`/directory-sync?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/directory-sync");
  redirect("/directory-sync?success=group-mapping-saved");
}

export async function deleteGroupRoleMapping(formData: FormData) {
  const { context } = await requireDirectorySyncWrite();
  const supabase = await createSupabaseServerClient();
  const id = String(formData.get("mapping_id") ?? "").trim();

  if (id) {
    await supabase
      .schema("app")
      .from("directory_group_role_mappings")
      .delete()
      .eq("id", id)
      .eq("organization_id", context.organizationId);
  }

  revalidatePath("/directory-sync");
  redirect("/directory-sync?success=group-mapping-deleted");
}

export async function runDirectorySyncPreview() {
  const { context } = await requireDirectorySyncWrite();
  const admin = createSupabaseAdminClient();
  if (!admin) {
    redirect("/directory-sync?error=service-role-missing");
  }

  const result = await runDirectorySync({
    admin,
    organizationId: context.organizationId,
    mode: "preview",
    createdByMembershipId: context.membershipId,
  });

  revalidatePath("/directory-sync");
  if (result.status === "failed") {
    redirect(`/directory-sync?error=${encodeURIComponent(result.errorMessage ?? "preview-failed")}`);
  }
  redirect(`/directory-sync?success=preview-done&runId=${result.runId}`);
}

export async function runDirectorySyncApply(formData: FormData) {
  const { context } = await requireDirectorySyncWrite();
  const admin = createSupabaseAdminClient();
  if (!admin) {
    redirect("/directory-sync?error=service-role-missing");
  }

  const previewRunId = String(formData.get("preview_run_id") ?? "").trim();
  if (!previewRunId) {
    redirect("/directory-sync?error=preview-run-required");
  }

  const result = await runDirectorySync({
    admin,
    organizationId: context.organizationId,
    mode: "apply",
    previewRunId,
    createdByMembershipId: context.membershipId,
  });

  revalidatePath("/directory-sync");
  if (result.status === "failed") {
    redirect(`/directory-sync?error=${encodeURIComponent(result.errorMessage ?? "apply-failed")}`);
  }
  redirect(`/directory-sync?success=apply-done&runId=${result.runId}`);
}
