import QRCode from "qrcode";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId, getCeoAccessContext } from "@/lib/ceo/queries";

export type InvitationRole = {
  code: string;
  name: string;
};

export type MemberInvitation = {
  id: string;
  organization_id: string;
  invited_email: string;
  role_code: string;
  token: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
  last_sent_at: string | null;
  accepted_at: string | null;
};

export async function requireOrgAdminContext() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return null;
  }

  const access = await getCeoAccessContext(userId);
  if (!access) {
    return null;
  }

  if (!access.roleCodes.includes("org_admin")) {
    return null;
  }

  return access;
}

export async function getInvitationRoles(organizationId: string): Promise<InvitationRole[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("rbac")
    .from("roles")
    .select("code, name")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  return (data ?? []) as InvitationRole[];
}

export async function listInvitations(organizationId: string): Promise<MemberInvitation[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("member_invitations")
    .select("id, organization_id, invited_email, role_code, token, status, expires_at, created_at, last_sent_at, accepted_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);

  return (data ?? []) as MemberInvitation[];
}

export function buildInvitationLinks(baseUrl: string, token: string, email: string) {
  const acceptPath = `/invite/accept?token=${encodeURIComponent(token)}`;
  const loginPath = `/login?email=${encodeURIComponent(email)}&next=${encodeURIComponent(acceptPath)}`;

  return {
    acceptUrl: `${baseUrl}${acceptPath}`,
    loginUrl: `${baseUrl}${loginPath}`,
  };
}

export async function toQrDataUrl(value: string): Promise<string> {
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 180,
  });
}

export async function sendInviteEmailViaSupabase(email: string, redirectTo: string): Promise<boolean> {
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return false;
  }

  const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}
