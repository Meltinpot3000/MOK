import type { SupabaseClient } from "@supabase/supabase-js";
import type { DirectoryConnectionRow, EntraGraphUser } from "@/lib/directory-sync/types";
import {
  fetchEntraGroupMembers,
  fetchEntraUsers,
  pickOrgAttributeValue,
  resolveUserEmail,
} from "@/lib/directory-sync/fetch-entra-data";
import {
  entraAttributeExternalId,
  splitAttributePath,
} from "@/lib/directory-sync/slug";
import { fetchEntraAccessToken, resolveEntraClientSecret } from "@/lib/directory-sync/entra-graph-client";
import {
  getDepartmentUnitTypeId,
  loadExistingMemberships,
  loadExistingOrgUnits,
  loadExternalMappings,
  loadGroupRoleMappings,
} from "@/lib/directory-sync/load-context";
import { buildPlannedUnits } from "@/lib/directory-sync/build-diff";
import { createAuthUserWithoutInvite, findAuthUserIdByEmail } from "@/lib/directory-sync/auth-users";
import { buildInvitationLinks, trySendInviteEmailViaSupabase } from "@/lib/invitations";
import { ensureResponsibleForMembership, syncResponsibleManagerEdge } from "@/lib/responsibles/membership-responsible";

async function upsertExternalMapping(
  admin: SupabaseClient,
  organizationId: string,
  entityType: string,
  externalId: string,
  internalId: string
): Promise<void> {
  await admin.schema("app").from("directory_external_mappings").upsert(
    {
      organization_id: organizationId,
      entity_type: entityType,
      external_provider: "entra_id",
      external_id: externalId,
      internal_id: internalId,
    },
    { onConflict: "organization_id,entity_type,external_provider,external_id" }
  );
}

async function getDefaultTeamMemberRoleId(
  admin: SupabaseClient,
  organizationId: string
): Promise<string | null> {
  const { data } = await admin
    .schema("rbac")
    .from("roles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("code", "team_member")
    .maybeSingle();
  return data?.id ?? null;
}

export type ApplyStats = {
  unitsCreated: number;
  unitsUpdated: number;
  unitsArchived: number;
  usersProvisioned: number;
  membershipsUpdated: number;
  rolesSynced: number;
  hierarchyEdges: number;
};

export async function applyDirectorySync(
  admin: SupabaseClient,
  organizationId: string,
  connection: DirectoryConnectionRow
): Promise<ApplyStats> {
  const stats: ApplyStats = {
    unitsCreated: 0,
    unitsUpdated: 0,
    unitsArchived: 0,
    usersProvisioned: 0,
    membershipsUpdated: 0,
    rolesSynced: 0,
    hierarchyEdges: 0,
  };

  const secret = resolveEntraClientSecret();
  if (!connection.azure_tenant_id || !connection.client_id || !secret) {
    throw new Error("Entra-Konfiguration unvollständig.");
  }

  const token = await fetchEntraAccessToken({
    tenantId: connection.azure_tenant_id,
    clientId: connection.client_id,
    clientSecret: secret,
  });

  const unitTypeId = await getDepartmentUnitTypeId(admin);
  if (!unitTypeId) {
    throw new Error("organization_unit_type 'department' fehlt.");
  }

  const [entraUsers, mappings, existingUnits, existingMemberships, groupMappings] = await Promise.all([
    fetchEntraUsers(token),
    loadExternalMappings(admin, organizationId),
    loadExistingOrgUnits(admin, organizationId),
    loadExistingMemberships(admin, organizationId),
    loadGroupRoleMappings(admin, organizationId),
  ]);

  const groupIds = [...new Set(groupMappings.map((g) => g.entra_group_id))];
  const groupMembers =
    groupIds.length > 0 ? await fetchEntraGroupMembers(token, groupIds) : [];

  const plannedUnits = buildPlannedUnits(entraUsers, connection);
  const mappingByExt = new Map(mappings.map((m) => [`${m.entity_type}:${m.external_id}`, m.internal_id]));
  const internalToExt = new Map(mappings.map((m) => [`${m.entity_type}:${m.internal_id}`, m.external_id]));

  const extToInternalUnit = new Map<string, string>();

  const sortedUnits = [...plannedUnits.values()].sort(
    (a, b) => a.fullPath.split("|").length - b.fullPath.split("|").length
  );

  for (const unit of sortedUnits) {
    const mapKey = `organization_unit:${unit.externalId}`;
    let internalId = mappingByExt.get(mapKey) ?? extToInternalUnit.get(unit.externalId) ?? null;

    let parentId: string | null = null;
    if (unit.parentExternalId) {
      parentId =
        extToInternalUnit.get(unit.parentExternalId) ??
        mappingByExt.get(`organization_unit:${unit.parentExternalId}`) ??
        null;
    }

    const existing = internalId ? existingUnits.find((u) => u.id === internalId) : null;
    const canWrite = !existing || existing.managed_by_directory_sync || mappingByExt.has(mapKey);

    if (!canWrite) {
      continue;
    }

    if (!internalId) {
      const { data: created, error } = await admin
        .schema("app")
        .from("organization_unit")
        .insert({
          organization_id: organizationId,
          organization_unit_type_id: unitTypeId,
          code: unit.code,
          name: unit.name,
          parent_id: parentId,
          status: "active",
          managed_by_directory_sync: true,
        })
        .select("id")
        .single();

      if (error || !created?.id) {
        throw new Error(`organization_unit insert: ${error?.message ?? "unknown"}`);
      }
      internalId = created.id as string;
      await upsertExternalMapping(admin, organizationId, "organization_unit", unit.externalId, internalId);
      mappingByExt.set(mapKey, internalId);
      extToInternalUnit.set(unit.externalId, internalId);
      stats.unitsCreated += 1;
    } else if (existing && (existing.name !== unit.name || existing.parent_id !== parentId)) {
      await admin
        .schema("app")
        .from("organization_unit")
        .update({
          name: unit.name,
          parent_id: parentId,
          managed_by_directory_sync: true,
        })
        .eq("id", internalId)
        .eq("organization_id", organizationId);
      stats.unitsUpdated += 1;
    }
    if (internalId) {
      extToInternalUnit.set(unit.externalId, internalId);
    }
  }

  const plannedExtIds = new Set(plannedUnits.keys());
  for (const unit of existingUnits) {
    if (!unit.managed_by_directory_sync) continue;
    const ext = internalToExt.get(`organization_unit:${unit.id}`);
    if (ext && !plannedExtIds.has(ext)) {
      await admin
        .schema("app")
        .from("organization_unit")
        .update({ status: "archived" })
        .eq("id", unit.id)
        .eq("organization_id", organizationId);
      stats.unitsArchived += 1;
    }
  }

  const defaultRoleId = await getDefaultTeamMemberRoleId(admin, organizationId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const entraUserIdToMembershipId = new Map<string, string>();
  const entraUserIdToResponsibleId = new Map<string, string>();

  for (const user of entraUsers) {
    const email = resolveUserEmail(user);
    if (!email) continue;

    const userMapKey = `user:${user.id}`;
    let membershipId = mappingByExt.get(userMapKey) ?? null;
    const existingMem = membershipId
      ? existingMemberships.find((m) => m.id === membershipId)
      : null;

    if (!user.accountEnabled) {
      if (existingMem?.managed_by_directory_sync || mappingByExt.has(userMapKey)) {
        await admin
          .schema("app")
          .from("organization_memberships")
          .update({ status: "suspended" })
          .eq("id", existingMem!.id);
      }
      continue;
    }

    if (connection.user_provisioning_policy === "none") {
      continue;
    }

    if (connection.user_provisioning_policy === "invite_only") {
      const { data: pending } = await admin
        .schema("app")
        .from("member_invitations")
        .select("id")
        .eq("organization_id", organizationId)
        .ilike("invited_email", email)
        .eq("status", "pending")
        .maybeSingle();

      if (!pending && !membershipId) {
        const { data: invite } = await admin
          .schema("app")
          .from("member_invitations")
          .insert({
            organization_id: organizationId,
            invited_email: email,
            invited_display_name: user.displayName,
            invited_membership_title: user.jobTitle,
            role_code: "team_member",
            role_codes: ["team_member"],
            status: "pending",
          })
          .select("token, invited_email")
          .single();

        if (invite?.token) {
          const links = buildInvitationLinks(appUrl, invite.token, invite.invited_email);
          await trySendInviteEmailViaSupabase(email, links.loginUrl);
        }
        stats.usersProvisioned += 1;
      }
    }

    if (connection.user_provisioning_policy === "create_auth_user") {
      let userId: string | null = null;
      if (membershipId) {
        const mem = existingMemberships.find((m) => m.id === membershipId);
        userId = mem ? (await admin.schema("app").from("organization_memberships").select("user_id").eq("id", membershipId).single()).data?.user_id ?? null : null;
      }
      if (!userId) {
        userId = await findAuthUserIdByEmail(admin, email);
      }
      if (!userId) {
        const created = await createAuthUserWithoutInvite({
          email,
          displayName: user.displayName,
        });
        if (!created.ok) continue;
        userId = created.userId;
        stats.usersProvisioned += 1;
      }

      const { data: membership, error: mErr } = await admin
        .schema("app")
        .from("organization_memberships")
        .upsert(
          {
            organization_id: organizationId,
            user_id: userId,
            status: "active",
            display_name: user.displayName,
            title: user.jobTitle,
            managed_by_directory_sync: true,
          },
          { onConflict: "organization_id,user_id" }
        )
        .select("id")
        .single();

      if (mErr || !membership?.id) continue;
      membershipId = membership.id as string;
      await upsertExternalMapping(admin, organizationId, "user", user.id, membershipId);
      mappingByExt.set(userMapKey, membershipId);
      stats.membershipsUpdated += 1;
    }

    if (!membershipId && connection.user_provisioning_policy === "invite_only") {
      const authUserId = await findAuthUserIdByEmail(admin, email);
      if (authUserId) {
        const { data: membership } = await admin
          .schema("app")
          .from("organization_memberships")
          .upsert(
            {
              organization_id: organizationId,
              user_id: authUserId,
              status: "active",
              display_name: user.displayName,
              title: user.jobTitle,
              managed_by_directory_sync: true,
            },
            { onConflict: "organization_id,user_id" }
          )
          .select("id")
          .single();
        if (membership?.id) {
          membershipId = membership.id as string;
          await upsertExternalMapping(admin, organizationId, "user", user.id, membershipId);
          mappingByExt.set(userMapKey, membershipId);
        }
      }
    }

    if (!membershipId) continue;

    const canUpdateMem =
      existingMem?.managed_by_directory_sync ||
      mappingByExt.has(userMapKey) ||
      connection.user_provisioning_policy === "create_auth_user";

    if (canUpdateMem) {
      await admin
        .schema("app")
        .from("organization_memberships")
        .update({
          display_name: user.displayName,
          title: user.jobTitle,
          status: "active",
          managed_by_directory_sync: true,
        })
        .eq("id", membershipId);
    }

    const ensured = await ensureResponsibleForMembership(organizationId, membershipId, admin);
    if (ensured.ok) {
      entraUserIdToMembershipId.set(user.id, membershipId);
      entraUserIdToResponsibleId.set(user.id, ensured.responsibleId);
    }

    const attr = pickOrgAttributeValue(user, connection.attribute_priority);
    if (attr && ensured.ok) {
      const parts = splitAttributePath(attr, connection.department_path_separator);
      const leafPath = parts.join("|");
      const unitExtId = entraAttributeExternalId(leafPath);
      const unitId =
        extToInternalUnit.get(unitExtId) ?? mappingByExt.get(`organization_unit:${unitExtId}`) ?? null;

      if (unitId && (existingMem?.managed_by_directory_sync || mappingByExt.has(userMapKey))) {
        await admin.schema("app").from("responsible_assignments").delete().eq("responsible_id", ensured.responsibleId).eq("organization_id", organizationId);
        await admin.schema("app").from("responsible_assignments").insert({
          organization_id: organizationId,
          responsible_id: ensured.responsibleId,
          organization_unit_id: unitId,
          assignment_type: "owner",
        });
      }
    }
  }

  for (const user of entraUsers) {
    if (!user.managerId) continue;
    const reportResp = entraUserIdToResponsibleId.get(user.id);
    const managerMembershipId = mappingByExt.get(`user:${user.managerId}`);
    if (!reportResp || !managerMembershipId) continue;

    const managerMem = existingMemberships.find((m) => m.id === managerMembershipId) ??
      (await admin.schema("app").from("organization_memberships").select("id, managed_by_directory_sync").eq("id", managerMembershipId).single()).data;

    const reportMem = entraUserIdToMembershipId.get(user.id);
    const reportMemRow = reportMem
      ? existingMemberships.find((m) => m.id === reportMem)
      : null;

    const reportManaged =
      reportMemRow?.managed_by_directory_sync || mappingByExt.has(`user:${user.id}`);
    if (!reportManaged) continue;

    const managerEnsured = await ensureResponsibleForMembership(organizationId, managerMembershipId, admin);
    if (!managerEnsured.ok) continue;

    const edge = await syncResponsibleManagerEdge(
      admin,
      organizationId,
      reportResp,
      managerEnsured.responsibleId
    );
    if (edge.ok) stats.hierarchyEdges += 1;
  }

  const userDesiredRoles = new Map<string, Set<string>>();
  for (const gm of groupMembers) {
    for (const gr of groupMappings.filter((g) => g.entra_group_id === gm.groupId)) {
      if (!userDesiredRoles.has(gm.userId)) userDesiredRoles.set(gm.userId, new Set());
      userDesiredRoles.get(gm.userId)!.add(gr.role_id);
    }
  }

  for (const [entraUserId, roleIds] of userDesiredRoles) {
    const membershipId = mappingByExt.get(`user:${entraUserId}`);
    if (!membershipId) continue;

    await admin
      .schema("rbac")
      .from("member_roles")
      .delete()
      .eq("membership_id", membershipId)
      .eq("assignment_source", "entra_sync");

    const inserts = [...roleIds].map((roleId) => ({
      membership_id: membershipId,
      role_id: roleId,
      assignment_source: "entra_sync" as const,
    }));

    if (inserts.length > 0) {
      await admin.schema("rbac").from("member_roles").insert(inserts);
      stats.rolesSynced += inserts.length;
    }
  }

  void defaultRoleId;

  return stats;
}
