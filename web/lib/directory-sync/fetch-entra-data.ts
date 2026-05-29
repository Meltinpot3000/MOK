import type { EntraGraphUser, EntraGroupMember } from "@/lib/directory-sync/types";
import { graphGetAllPages } from "@/lib/directory-sync/entra-graph-client";

type RawGraphUser = {
  id: string;
  mail?: string | null;
  userPrincipalName?: string | null;
  displayName?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  officeLocation?: string | null;
  companyName?: string | null;
  accountEnabled?: boolean;
  manager?: { id?: string } | null;
};

type RawGroupMember = {
  id: string;
  "@odata.type"?: string;
};

const USER_SELECT =
  "id,mail,userPrincipalName,displayName,jobTitle,department,officeLocation,companyName,accountEnabled";
const USER_EXPAND = "manager($select=id)";

export async function fetchEntraUsers(accessToken: string): Promise<EntraGraphUser[]> {
  const rows = await graphGetAllPages<RawGraphUser>(
    accessToken,
    `https://graph.microsoft.com/v1.0/users?$select=${USER_SELECT}&$expand=${encodeURIComponent(USER_EXPAND)}&$top=999`
  );

  return rows.map((row) => ({
    id: row.id,
    mail: row.mail ?? null,
    userPrincipalName: row.userPrincipalName ?? null,
    displayName: row.displayName ?? null,
    jobTitle: row.jobTitle ?? null,
    department: row.department ?? null,
    officeLocation: row.officeLocation ?? null,
    companyName: row.companyName ?? null,
    accountEnabled: row.accountEnabled !== false,
    managerId: row.manager?.id ?? null,
  }));
}

export async function fetchEntraGroupMembers(
  accessToken: string,
  groupIds: string[]
): Promise<EntraGroupMember[]> {
  const out: EntraGroupMember[] = [];

  for (const groupId of groupIds) {
    const members = await graphGetAllPages<RawGroupMember>(
      accessToken,
      `https://graph.microsoft.com/v1.0/groups/${encodeURIComponent(groupId)}/members?$select=id&$top=999`
    );
    for (const member of members) {
      const type = member["@odata.type"] ?? "";
      if (type.includes("group") || type.includes("device")) {
        continue;
      }
      if (member.id) {
        out.push({ groupId, userId: member.id });
      }
    }
  }

  return out;
}

export function resolveUserEmail(user: EntraGraphUser): string | null {
  const mail = user.mail?.trim().toLowerCase();
  if (mail) return mail;
  const upn = user.userPrincipalName?.trim().toLowerCase();
  if (upn && upn.includes("@")) return upn;
  return null;
}

export function pickOrgAttributeValue(
  user: EntraGraphUser,
  attributePriority: string[]
): string | null {
  const map: Record<string, string | null> = {
    department: user.department,
    officeLocation: user.officeLocation,
    companyName: user.companyName,
  };
  for (const key of attributePriority) {
    const raw = map[key];
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw.trim();
    }
  }
  return null;
}
