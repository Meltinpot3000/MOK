import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DirectoryConnectionRow,
  DirectorySyncDiffSummary,
  DiffEntry,
  EntraGraphUser,
} from "@/lib/directory-sync/types";
import {
  fetchEntraGroupMembers,
  fetchEntraUsers,
  pickOrgAttributeValue,
  resolveUserEmail,
} from "@/lib/directory-sync/fetch-entra-data";
import {
  entraAttributeExternalId,
  entraUnitCode,
  splitAttributePath,
} from "@/lib/directory-sync/slug";
import {
  fetchEntraAccessToken,
  resolveEntraClientSecret,
} from "@/lib/directory-sync/entra-graph-client";
import {
  loadExistingMemberships,
  loadExistingOrgUnits,
  loadExternalMappings,
  loadGroupRoleMappings,
} from "@/lib/directory-sync/load-context";

export type PlannedOrgUnit = {
  externalId: string;
  code: string;
  name: string;
  parentExternalId: string | null;
  fullPath: string;
};

function countActions(entries: DiffEntry[]): DirectorySyncDiffSummary["counts"] {
  const counts = { create: 0, update: 0, archive: 0, skip: 0, delete: 0 };
  for (const e of entries) {
    counts[e.action] = (counts[e.action] ?? 0) + 1;
  }
  return counts;
}

export function buildPlannedUnits(
  users: EntraGraphUser[],
  connection: DirectoryConnectionRow
): Map<string, PlannedOrgUnit> {
  const planned = new Map<string, PlannedOrgUnit>();
  const separator = connection.department_path_separator;

  for (const user of users) {
    const attr = pickOrgAttributeValue(user, connection.attribute_priority);
    if (!attr) continue;

    const parts = splitAttributePath(attr, separator);
    let parentPath: string | null = null;

    for (let i = 0; i < parts.length; i++) {
      const segment = parts[i];
      const pathKey = parts.slice(0, i + 1).join("|");
      const externalId = entraAttributeExternalId(pathKey);
      const parentExternalId = parentPath ? entraAttributeExternalId(parentPath) : null;

      if (!planned.has(externalId)) {
        planned.set(externalId, {
          externalId,
          code: entraUnitCode(pathKey),
          name: segment,
          parentExternalId,
          fullPath: pathKey,
        });
      }
      parentPath = pathKey;
    }
  }

  return planned;
}

export async function computeSyncDiff(
  admin: SupabaseClient,
  organizationId: string,
  connection: DirectoryConnectionRow
): Promise<DirectorySyncDiffSummary> {
  const entries: DiffEntry[] = [];

  const secret = resolveEntraClientSecret();
  if (!connection.azure_tenant_id || !connection.client_id || !secret) {
    throw new Error("Entra-Konfiguration unvollständig (Tenant, Client-ID oder AZURE_CLIENT_SECRET).");
  }

  const token = await fetchEntraAccessToken({
    tenantId: connection.azure_tenant_id,
    clientId: connection.client_id,
    clientSecret: secret,
  });

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
  const unitById = new Map(existingUnits.map((u) => [u.id, u]));
  const membershipByUserId = new Map(existingMemberships.map((m) => [m.user_id, m]));

  const plannedExtIds = new Set(plannedUnits.keys());

  for (const [, unit] of plannedUnits) {
    const key = `organization_unit:${unit.externalId}`;
    const internalId = mappingByExt.get(key);
    if (!internalId) {
      entries.push({
        action: "create",
        entity: "organization_unit",
        key: unit.code,
        details: { name: unit.name, externalId: unit.externalId },
      });
      continue;
    }
    const existing = unitById.get(internalId);
    if (!existing) {
      entries.push({
        action: "create",
        entity: "organization_unit",
        key: unit.code,
        reason: "mapping ohne Zeile",
      });
      continue;
    }
    if (!existing.managed_by_directory_sync && !mappingByExt.has(key)) {
      entries.push({ action: "skip", entity: "organization_unit", key: unit.code, reason: "manuell" });
      continue;
    }
    if (existing.managed_by_directory_sync || mappingByExt.has(key)) {
      if (existing.name !== unit.name) {
        entries.push({
          action: "update",
          entity: "organization_unit",
          key: unit.code,
          details: { from: existing.name, to: unit.name },
        });
      }
    } else {
      entries.push({ action: "skip", entity: "organization_unit", key: unit.code, reason: "nicht sync-managed" });
    }
  }

  for (const unit of existingUnits) {
    if (!unit.managed_by_directory_sync) continue;
    const mapping = mappings.find(
      (m) => m.entity_type === "organization_unit" && m.internal_id === unit.id
    );
    if (mapping && !plannedExtIds.has(mapping.external_id)) {
      entries.push({
        action: "archive",
        entity: "organization_unit",
        key: unit.code,
        reason: "nicht mehr in Entra-Attributen",
      });
    }
  }

  const policy = connection.user_provisioning_policy;

  for (const user of entraUsers) {
    const email = resolveUserEmail(user);
    const userKey = user.id;

    if (!email) {
      entries.push({
        action: "skip",
        entity: "user",
        key: userKey,
        reason: "keine E-Mail",
      });
      continue;
    }

    if (!user.accountEnabled) {
      const mapping = mappingByExt.get(`user:${user.id}`);
      if (mapping) {
        const mem = [...membershipByUserId.values()].find((m) => m.id === mapping);
        void mem;
        entries.push({
          action: "update",
          entity: "membership",
          key: email,
          details: { status: "suspended" },
        });
      } else {
        entries.push({ action: "skip", entity: "user", key: email, reason: "deaktiviert, nicht gemappt" });
      }
      continue;
    }

    if (policy === "none") {
      entries.push({ action: "skip", entity: "user", key: email, reason: "provisioning_policy=none" });
    } else {
      const userMapping = mappingByExt.get(`user:${user.id}`);
      if (!userMapping) {
        entries.push({
          action: "create",
          entity: policy === "invite_only" ? "invitation" : "membership",
          key: email,
          details: { displayName: user.displayName, policy },
        });
      } else {
        const mem = membershipByUserId.get(userMapping);
        if (mem && (mem.managed_by_directory_sync || userMapping)) {
          entries.push({
            action: "update",
            entity: "membership",
            key: email,
            details: { displayName: user.displayName, title: user.jobTitle },
          });
        } else if (mem) {
          entries.push({ action: "skip", entity: "membership", key: email, reason: "manuell" });
        }
      }
    }

    const attr = pickOrgAttributeValue(user, connection.attribute_priority);
    if (attr) {
      const parts = splitAttributePath(attr, connection.department_path_separator);
      const leafPath = parts.join("|");
      const extId = entraAttributeExternalId(leafPath);
      entries.push({
        action: mappingByExt.get(`user:${user.id}`) ? "update" : "skip",
        entity: "responsible_assignment",
        key: email,
        details: { unitExternalId: extId },
        reason: mappingByExt.get(`user:${user.id}`) ? undefined : "user nicht gemappt",
      });
    }

    if (user.managerId) {
      entries.push({
        action: "update",
        entity: "responsible_hierarchy",
        key: email,
        details: { managerEntraId: user.managerId },
      });
    }
  }

  const userDesiredRoles = new Map<string, Set<string>>();
  for (const gm of groupMembers) {
    const mappingsForGroup = groupMappings.filter((g) => g.entra_group_id === gm.groupId);
    for (const m of mappingsForGroup) {
      if (!userDesiredRoles.has(gm.userId)) {
        userDesiredRoles.set(gm.userId, new Set());
      }
      userDesiredRoles.get(gm.userId)!.add(m.role_id);
    }
  }

  for (const [entraUserId, roleIds] of userDesiredRoles) {
    const membershipInternal = mappingByExt.get(`user:${entraUserId}`);
    if (!membershipInternal) {
      entries.push({
        action: "skip",
        entity: "member_roles",
        key: entraUserId,
        reason: "membership nicht gemappt",
      });
      continue;
    }
    entries.push({
      action: "update",
      entity: "member_roles",
      key: entraUserId,
      details: { roleIds: [...roleIds] },
    });
  }

  return { entries, counts: countActions(entries) };
}
