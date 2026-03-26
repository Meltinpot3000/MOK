import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId, getCeoAccessContext } from "@/lib/ceo/queries";

export type SendInviteEmailResult =
  | { ok: true; via: "invite" | "magic_link" }
  | { ok: false; message: string };

function authUserAlreadyRegistered(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const m = (error.message ?? "").toLowerCase();
  const c = (error.code ?? "").toLowerCase();
  if (c === "email_exists") return true;
  return (
    m.includes("already been registered") ||
    m.includes("already registered") ||
    (m.includes("user") && m.includes("already") && m.includes("registered"))
  );
}

function createSupabaseAnonAuthClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return null;
  }
  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Versucht zuerst Admin-Einladung (legt neue Auth-User an). Wenn die E-Mail schon existiert,
 * wird ein Magic Link per signInWithOtp gesendet (bestehender User, shouldCreateUser: false).
 */
export async function trySendInviteEmailViaSupabase(
  email: string,
  redirectTo: string
): Promise<SendInviteEmailResult> {
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return { ok: false, message: "Supabase Service-Role ist nicht konfiguriert." };
  }

  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  if (!inviteError) {
    return { ok: true, via: "invite" };
  }

  if (!authUserAlreadyRegistered(inviteError)) {
    return { ok: false, message: inviteError.message };
  }

  const anon = createSupabaseAnonAuthClient();
  if (!anon) {
    return { ok: false, message: "NEXT_PUBLIC_SUPABASE_URL oder ANON_KEY fehlt fuer Magic-Link." };
  }

  const { error: otpError } = await anon.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
    },
  });

  if (!otpError) {
    return { ok: true, via: "magic_link" };
  }

  const { error: otpExistingOnlyError } = await anon.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: false,
    },
  });

  if (!otpExistingOnlyError) {
    return { ok: true, via: "magic_link" };
  }

  return {
    ok: false,
    message: [otpError.message, otpExistingOnlyError.message].filter(Boolean).join(" | "),
  };
}

/**
 * «Erneut senden»: typischerweise existiert der Auth-User schon — zuerst Magic Link (auch mit
 * shouldCreateUser true), dann Admin-Einladung, dann nochmal Magic Link nur fuer bestehende Nutzer.
 * Vermeidet haeufige Dead-Ends bei «already registered» ohne zweiten Versandweg.
 */
export async function tryResendInviteEmailViaSupabase(
  email: string,
  redirectTo: string
): Promise<SendInviteEmailResult> {
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return { ok: false, message: "Supabase Service-Role ist nicht konfiguriert." };
  }

  const anon = createSupabaseAnonAuthClient();
  if (!anon) {
    return { ok: false, message: "NEXT_PUBLIC_SUPABASE_URL oder ANON_KEY fehlt fuer Magic-Link." };
  }

  const magicAny = await anon.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
    },
  });

  if (!magicAny.error) {
    return { ok: true, via: "magic_link" };
  }

  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  if (!inviteError) {
    return { ok: true, via: "invite" };
  }

  if (authUserAlreadyRegistered(inviteError)) {
    const magicExisting = await anon.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: false,
      },
    });

    if (!magicExisting.error) {
      return { ok: true, via: "magic_link" };
    }

    return {
      ok: false,
      message: [
        `OTP (zulaessig neuer User): ${magicAny.error.message}`,
        `Invite: ${inviteError.message}`,
        `OTP (nur bestehend): ${magicExisting.error.message}`,
      ].join(" — "),
    };
  }

  return {
    ok: false,
    message: [`OTP: ${magicAny.error.message}`, `Invite: ${inviteError.message}`].join(" — "),
  };
}

export type InvitationRole = {
  code: string;
  name: string;
};

export type MemberInvitation = {
  id: string;
  organization_id: string;
  invited_email: string;
  /** Optional; bei Annahme → membership.display_name (organisationsbezogener Anzeigename). */
  invited_display_name: string | null;
  /** Optional; bei Annahme → membership.title (Funktion in der Organisation). */
  invited_membership_title: string | null;
  /** Erste Rolle; fuer Rueckwaertskompatibilitaet. */
  role_code: string;
  /** Alle Rollen der Einladung (effektiv nach dem Speichern). */
  role_codes: string[];
  token: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
  last_sent_at: string | null;
  accepted_at: string | null;
};

export function invitationRoleCodesFromRow(row: {
  role_codes: unknown;
  role_code: string;
}): string[] {
  const raw = row.role_codes;
  if (Array.isArray(raw)) {
    const codes = raw
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);
    if (codes.length > 0) return [...new Set(codes)];
  }
  if (row.role_code?.trim()) return [row.role_code.trim()];
  return [];
}

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
    .select(
      "id, organization_id, invited_email, invited_display_name, invited_membership_title, role_code, role_codes, token, status, expires_at, created_at, last_sent_at, accepted_at"
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as Array<
    MemberInvitation & {
      role_codes?: unknown;
      invited_display_name?: string | null;
      invited_membership_title?: string | null;
    }
  >;
  return rows.map((row) => {
    const role_codes = invitationRoleCodesFromRow({
      role_codes: row.role_codes,
      role_code: row.role_code,
    });
    const role_code = role_codes[0] ?? row.role_code ?? "team_member";
    const invited_display_name = row.invited_display_name ?? null;
    const invited_membership_title = row.invited_membership_title ?? null;
    return { ...row, role_code, role_codes, invited_display_name, invited_membership_title };
  });
}

async function findAuthUserIdCaseInsensitive(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  email: string
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) {
      break;
    }
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === normalized);
    if (hit?.id) {
      return hit.id;
    }
    if (data.users.length < perPage) {
      break;
    }
    page += 1;
  }
  return null;
}

/**
 * Legt sofort eine aktive Mitgliedschaft und rbac.member_roles an, sobald der Auth-User zur
 * Einladungs-E-Mail existiert (z. B. direkt nach inviteUserByEmail oder bei bestehendem Konto).
 * Nutzt den Service-Role-Client, damit keine admin.manage_roles beim Einladenden nötig sind.
 * Die Zeile in member_invitations bleibt «pending», bis der Nutzer /invite/accept aufruft.
 */
export async function provisionMembershipFromInvitationForEmail(params: {
  organizationId: string;
  invitedEmail: string;
  roleRows: { id: string; code: string }[];
  membershipDisplayName: string | null;
  membershipTitle: string | null;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin || params.roleRows.length === 0) {
    return;
  }

  const userId = await findAuthUserIdCaseInsensitive(admin, params.invitedEmail);
  if (!userId) {
    return;
  }

  const incomingDisplay = params.membershipDisplayName?.trim() || null;
  const incomingTitle = params.membershipTitle?.trim() || null;

  const { data: existing } = await admin
    .schema("app")
    .from("organization_memberships")
    .select("display_name, title")
    .eq("organization_id", params.organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  const payload = {
    organization_id: params.organizationId,
    user_id: userId,
    status: "active" as const,
    display_name: incomingDisplay ?? (existing?.display_name as string | null) ?? null,
    title: incomingTitle ?? (existing?.title as string | null) ?? null,
  };

  const { data: membership, error: mErr } = await admin
    .schema("app")
    .from("organization_memberships")
    .upsert(payload, { onConflict: "organization_id,user_id" })
    .select("id")
    .single();

  if (mErr || !membership) {
    return;
  }

  await admin.schema("rbac").from("member_roles").upsert(
    params.roleRows.map((row) => ({ membership_id: membership.id, role_id: row.id })),
    { onConflict: "membership_id,role_id" }
  );
}

/**
 * Nach «Widerruf»: Mitgliedschaft im Mandanten entfernen (inkl. member_roles per CASCADE).
 * Auth-User nur loeschen, wenn keine weiteren organization_memberships mehr existieren —
 * sonst bliebe z. B. ein zweiter Mandant erhalten.
 * Erfordert SUPABASE_SERVICE_ROLE_KEY (User-Suche per E-Mail wie bei der Provisionierung).
 */
export async function cleanupInvitedUserAfterRevoke(params: {
  organizationId: string;
  invitedEmail: string;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return;
  }

  const userId = await findAuthUserIdCaseInsensitive(admin, params.invitedEmail);
  if (!userId) {
    return;
  }

  const { error: delErr } = await admin
    .schema("app")
    .from("organization_memberships")
    .delete()
    .eq("organization_id", params.organizationId)
    .eq("user_id", userId);

  if (delErr) {
    return;
  }

  const { count, error: cntErr } = await admin
    .schema("app")
    .from("organization_memberships")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (cntErr || count === null || count > 0) {
    return;
  }

  await admin.auth.admin.deleteUser(userId);
}

export function buildInvitationLinks(baseUrl: string, token: string, email: string) {
  const base = baseUrl.replace(/\/$/, "");
  const acceptPath = `/invite/accept?token=${encodeURIComponent(token)}`;
  /**
   * Kurze redirectTo-URL fuer Supabase (leichter in URL-Allowlist): /invite/oauth?token=...
   * Session wird in route.ts per code/token_hash aufgebaut, dann Redirect nach /invite/accept.
   */
  const oauthPath = `/invite/oauth?token=${encodeURIComponent(token)}`;
  const emailAuthReturnUrl = `${base}${oauthPath}`;
  const loginPrefillPath = `/login?email=${encodeURIComponent(email)}&next=${encodeURIComponent(acceptPath)}`;

  return {
    /** Direkt zur Annahme — nur sinnvoll bei bestehender Session. */
    acceptUrl: `${base}${acceptPath}`,
    /** E-Mail/QR / «Erneut senden»: OAuth-Zwischenstopp mit zuverlaessigem Cookie-Handling. */
    loginUrl: emailAuthReturnUrl,
    /** Manuell: Login-Seite mit E-Mail und optional Magic-Link-Button. */
    loginPrefillUrl: `${base}${loginPrefillPath}`,
  };
}

export async function toQrDataUrl(value: string): Promise<string> {
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 180,
  });
}

/** Boolescher Helfer; Details siehe trySendInviteEmailViaSupabase. */
export async function sendInviteEmailViaSupabase(email: string, redirectTo: string): Promise<boolean> {
  const r = await trySendInviteEmailViaSupabase(email, redirectTo);
  return r.ok;
}
