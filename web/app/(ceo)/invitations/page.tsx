import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppBaseUrl } from "@/lib/app-url";
import { getPhase0Context } from "@/lib/phase0/queries";
import {
  buildInvitationLinks,
  getInvitationRoles,
  listInvitations,
  sendInviteEmailViaSupabase,
  toQrDataUrl,
} from "@/lib/invitations";
import { InvitationsMembershipTable } from "@/components/invitations/InvitationsMembershipTable";
import { InvitationsPendingTable } from "@/components/invitations/InvitationsPendingTable";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";

type InvitationsPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

type MembershipRow = {
  id: string;
  user_id: string;
  status: "active" | "invited" | "suspended";
  title: string | null;
  created_at: string;
  responsible_id: string | null;
  responsible:
    | {
        id: string;
        full_name: string;
        email: string | null;
        role_title: string | null;
      }
    | Array<{
        id: string;
        full_name: string;
        email: string | null;
        role_title: string | null;
      }>
    | null;
};

type RoleAssignmentRow = {
  membership_id: string;
  role: { code: string; name: string } | { code: string; name: string }[] | null;
};
type RoleRow = { id: string; code: string; name: string };

type UserIdentity = {
  email: string | null;
  name: string | null;
};

function getStatusMessage(error?: string, success?: string) {
  if (success === "responsible-linked") {
    return { type: "success", text: "Benutzer wurde einem Verantwortlichen zugeordnet." as const };
  }
  if (success === "responsible-unlinked") {
    return { type: "success", text: "Zuordnung zum Verantwortlichen wurde entfernt." as const };
  }
  if (error === "missing-membership") {
    return { type: "error", text: "Mitgliedschaft fehlt oder ist ungueltig." as const };
  }
  if (error === "missing-responsible") {
    return { type: "error", text: "Verantwortlicher fehlt oder ist ungueltig." as const };
  }
  if (error === "save-failed") {
    return { type: "error", text: "Zuordnung konnte nicht gespeichert werden." as const };
  }
  if (error === "missing-role") {
    return { type: "error", text: "Rolle fehlt oder ist ungueltig." as const };
  }
  if (error === "role-save-failed") {
    return { type: "error", text: "Rolle konnte nicht gespeichert werden." as const };
  }
  if (success === "role-updated") {
    return { type: "success", text: "Rolle wurde aktualisiert." as const };
  }
  return null;
}

function isServiceRoleConfigured(): boolean {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return Boolean(value && !value.includes("your_service_role_key"));
}

export default async function InvitationsPage({ searchParams }: InvitationsPageProps) {
  const pageAccess = await getSidebarAccessContext("invitations");
  if (pageAccess.state === "unauthenticated") {
    redirect("/login");
  }
  if (pageAccess.state === "forbidden") {
    redirect("/no-access");
  }
  const canWrite = pageAccess.canWrite;

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");

  const baseUrl = await getAppBaseUrl();
  const serviceRoleConfigured = isServiceRoleConfigured();
  const [roles, invitations, membershipsRes, roleAssignmentsRes, responsiblesRes, editableRolesRes] = await Promise.all([
    getInvitationRoles(context.organizationId),
    listInvitations(context.organizationId),
    createSupabaseServerClient().then((supabase) =>
      supabase
        .schema("app")
        .from("organization_memberships")
        .select(
          "id, user_id, status, title, created_at, responsible_id, responsible:responsible_id(id, full_name, email, role_title)"
        )
        .eq("organization_id", context.organizationId)
        .order("created_at", { ascending: false })
    ),
    createSupabaseServerClient().then((supabase) =>
      supabase
        .schema("rbac")
        .from("member_roles")
        .select("membership_id, role:role_id(code, name)")
    ),
    createSupabaseServerClient().then((supabase) =>
      supabase
        .schema("app")
        .from("responsibles")
        .select("id, full_name, email, role_title, is_active")
        .eq("organization_id", context.organizationId)
        .eq("is_active", true)
        .order("full_name", { ascending: true })
    ),
    createSupabaseServerClient().then((supabase) =>
      supabase
        .schema("rbac")
        .from("roles")
        .select("id, code, name")
        .eq("organization_id", context.organizationId)
        .order("name", { ascending: true })
    ),
  ]);
  const params = await searchParams;
  const status = getStatusMessage(params.error, params.success);

  const memberships = (membershipsRes.data ?? []) as MembershipRow[];
  const roleAssignments = (roleAssignmentsRes.data ?? []) as RoleAssignmentRow[];
  const responsibles =
    (responsiblesRes.data ?? []) as Array<{
      id: string;
      full_name: string;
      email: string | null;
      role_title: string | null;
      is_active: boolean;
    }>;
  const editableRoles = (editableRolesRes.data ?? []) as RoleRow[];

  const roleCodesByMembership = new Map<string, string[]>();
  const membershipIds = new Set(memberships.map((membership) => membership.id));
  for (const row of roleAssignments) {
    if (!membershipIds.has(row.membership_id)) continue;
    const roleValue = Array.isArray(row.role) ? row.role[0] : row.role;
    const roleCode = roleValue?.code;
    if (!roleCode) continue;
    const list = roleCodesByMembership.get(row.membership_id) ?? [];
    list.push(roleCode);
    roleCodesByMembership.set(row.membership_id, Array.from(new Set(list)));
  }

  const adminClient = createSupabaseAdminClient();
  const identityByUserId = new Map<string, UserIdentity>();
  if (adminClient) {
    await Promise.all(
      Array.from(new Set(memberships.map((membership) => membership.user_id))).map(async (userId) => {
        const { data } = await adminClient.auth.admin.getUserById(userId);
        const email = data.user?.email?.toLowerCase() ?? null;
        const metadata =
          data.user?.user_metadata && typeof data.user.user_metadata === "object"
            ? (data.user.user_metadata as Record<string, unknown>)
            : null;
        const fullNameRaw = metadata?.full_name ?? metadata?.name ?? metadata?.display_name ?? null;
        const fullName = typeof fullNameRaw === "string" && fullNameRaw.trim().length > 0 ? fullNameRaw.trim() : null;
        identityByUserId.set(userId, { email, name: fullName });
      })
    );
  }

  const identityByUserIdRecord = Object.fromEntries(identityByUserId);
  const roleCodesByMembershipRecord = Object.fromEntries(roleCodesByMembership);

  const invitationViews = await Promise.all(
    invitations.map(async (invite) => {
      const links = buildInvitationLinks(baseUrl, invite.token, invite.invited_email);
      const qrDataUrl = await toQrDataUrl(links.loginUrl);

      return {
        ...invite,
        ...links,
        qrDataUrl,
      };
    })
  );

  async function assignResponsibleToMembership(formData: FormData) {
    "use server";
    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("invitations");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");

    const membershipId = String(formData.get("membership_id") ?? "").trim();
    const responsibleId = String(formData.get("responsible_id") ?? "").trim();
    if (!membershipId) redirect("/invitations?error=missing-membership");

    const supabase = await createSupabaseServerClient();
    const { data: membership } = await supabase
      .schema("app")
      .from("organization_memberships")
      .select("id, organization_id")
      .eq("id", membershipId)
      .eq("organization_id", localContext.organizationId)
      .maybeSingle();
    if (!membership) redirect("/invitations?error=missing-membership");

    if (!responsibleId) {
      const { error } = await supabase
        .schema("app")
        .from("organization_memberships")
        .update({ responsible_id: null })
        .eq("id", membership.id)
        .eq("organization_id", localContext.organizationId);
      if (error) redirect("/invitations?error=save-failed");
      revalidatePath("/invitations");
      redirect("/invitations?success=responsible-unlinked");
    }

    const { data: responsible } = await supabase
      .schema("app")
      .from("responsibles")
      .select("id, organization_id, is_active")
      .eq("id", responsibleId)
      .eq("organization_id", localContext.organizationId)
      .maybeSingle();
    if (!responsible || !responsible.is_active) {
      redirect("/invitations?error=missing-responsible");
    }

    const { error } = await supabase
      .schema("app")
      .from("organization_memberships")
      .update({ responsible_id: responsible.id })
      .eq("id", membership.id)
      .eq("organization_id", localContext.organizationId);
    if (error) redirect("/invitations?error=save-failed");
    revalidatePath("/invitations");
    redirect("/invitations?success=responsible-linked");
  }

  async function updateMembershipRole(formData: FormData) {
    "use server";
    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("invitations");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");

    const membershipId = String(formData.get("membership_id") ?? "").trim();
    const roleCode = String(formData.get("role_code") ?? "").trim();
    if (!membershipId || !roleCode) redirect("/invitations?error=missing-role");

    const supabase = await createSupabaseServerClient();
    const { data: membership } = await supabase
      .schema("app")
      .from("organization_memberships")
      .select("id, organization_id")
      .eq("id", membershipId)
      .eq("organization_id", localContext.organizationId)
      .maybeSingle();
    if (!membership) redirect("/invitations?error=missing-membership");

    const { data: role } = await supabase
      .schema("rbac")
      .from("roles")
      .select("id")
      .eq("organization_id", localContext.organizationId)
      .eq("code", roleCode)
      .maybeSingle();
    if (!role) redirect("/invitations?error=missing-role");

    const { error: deleteError } = await supabase
      .schema("rbac")
      .from("member_roles")
      .delete()
      .eq("membership_id", membership.id);
    if (deleteError) redirect("/invitations?error=role-save-failed");

    const { error: insertError } = await supabase
      .schema("rbac")
      .from("member_roles")
      .insert({ membership_id: membership.id, role_id: role.id });
    if (insertError) redirect("/invitations?error=role-save-failed");

    revalidatePath("/invitations");
    redirect("/invitations?success=role-updated");
  }

  async function createInvitation(formData: FormData) {
    "use server";

    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("invitations");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");

    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const roleCode = String(formData.get("role_code") ?? "").trim();
    const supabase = await createSupabaseServerClient();
    const localBaseUrl = await getAppBaseUrl();

    if (!email || !roleCode) {
      redirect("/invitations");
    }

    const { data: invite, error } = await supabase
      .schema("app")
      .from("member_invitations")
      .insert({
        organization_id: localContext.organizationId,
        invited_email: email,
        role_code: roleCode,
        created_by_membership_id: localContext.membershipId,
      })
      .select("id, token, invited_email")
      .single();

    if (error || !invite) {
      redirect("/invitations");
    }

    const links = buildInvitationLinks(localBaseUrl, invite.token, invite.invited_email);
    const canSendMail = isServiceRoleConfigured();
    const sent = canSendMail
      ? await sendInviteEmailViaSupabase(invite.invited_email, links.loginUrl)
      : false;

    if (sent) {
      await supabase
        .schema("app")
        .from("member_invitations")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", invite.id);
    }

    revalidatePath("/invitations");
    redirect("/invitations");
  }

  async function resendInvitation(formData: FormData) {
    "use server";

    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("invitations");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");

    const inviteId = String(formData.get("invite_id") ?? "");
    const supabase = await createSupabaseServerClient();
    const localBaseUrl = await getAppBaseUrl();

    const { data: invite } = await supabase
      .schema("app")
      .from("member_invitations")
      .select("id, token, invited_email, status")
      .eq("id", inviteId)
      .eq("organization_id", localContext.organizationId)
      .single();

    if (!invite || invite.status !== "pending") {
      redirect("/invitations");
    }

    const links = buildInvitationLinks(localBaseUrl, invite.token, invite.invited_email);
    const canSendMail = isServiceRoleConfigured();
    const sent = canSendMail
      ? await sendInviteEmailViaSupabase(invite.invited_email, links.loginUrl)
      : false;

    if (sent) {
      await supabase
        .schema("app")
        .from("member_invitations")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", invite.id);
    }

    revalidatePath("/invitations");
    redirect("/invitations");
  }

  async function revokeInvitation(formData: FormData) {
    "use server";

    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("invitations");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");

    const inviteId = String(formData.get("invite_id") ?? "");
    const supabase = await createSupabaseServerClient();

    await supabase
      .schema("app")
      .from("member_invitations")
      .update({ status: "revoked" })
      .eq("id", inviteId)
      .eq("organization_id", localContext.organizationId)
      .eq("status", "pending");

    revalidatePath("/invitations");
    redirect("/invitations");
  }

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Benutzer</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Benutzer</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Verwalte Benutzer, Verantwortlichen-Zuordnungen und Zugaenge zentral an einer Stelle.
        </p>
      </header>

      {status ? (
        <p className={`rounded-md border p-3 text-sm ${status.type === "error" ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
          {status.text}
        </p>
      ) : null}

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Benutzerliste und Verantwortlichen-Zuordnung</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Pro Benutzer ist optional genau ein Verantwortlicher zuordenbar. Diese Zuordnung steuert kein RBAC.
        </p>
        <div className="mt-4 overflow-x-auto">
          <InvitationsMembershipTable
            memberships={memberships}
            identityByUserId={identityByUserIdRecord}
            roleCodesByMembership={roleCodesByMembershipRecord}
            responsibles={responsibles}
            editableRoles={editableRoles}
            canWrite={canWrite}
            updateMembershipRole={updateMembershipRole}
            assignResponsibleToMembership={assignResponsibleToMembership}
          />
        </div>
        {memberships.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Noch keine Benutzer-Memberships vorhanden.</p>
        ) : null}
      </section>

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Neuen Benutzerzugang anlegen</h2>
        {serviceRoleConfigured ? (
          <p className="mt-1 text-sm text-zinc-600">
            Automatischer E-Mail-Versand ist aktiv. Benutzerzugaenge werden direkt zugestellt.
          </p>
        ) : (
          <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Automatischer E-Mail-Versand ist derzeit deaktiviert. Benutzerzugaenge werden erstellt, aber nicht automatisch versendet.
          </p>
        )}
        <form action={createInvitation} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            name="email"
            required
            type="email"
            placeholder="person@firma.de"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <select name="role_code" required className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
            <option value="">Rolle waehlen</option>
            {roles.map((role) => (
              <option key={role.code} value={role.code}>
                {role.name} ({role.code})
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!canWrite}
            className="brand-btn px-4 py-2 text-sm"
          >
            Benutzerzugang erstellen
          </button>
        </form>
      </section>

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Offene und versendete Benutzerzugaenge</h2>
        <div className="mt-4 overflow-x-auto">
          <InvitationsPendingTable
            invitationViews={invitationViews}
            canWrite={canWrite}
            serviceRoleConfigured={serviceRoleConfigured}
            resendInvitation={resendInvitation}
            revokeInvitation={revokeInvitation}
          />
        </div>
        {invitationViews.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Noch keine Benutzerzugaenge vorhanden.</p>
        ) : null}
      </section>
      {!canWrite ? (
        <p className="brand-surface p-3 text-sm text-zinc-600">
          Diese Rolle hat nur Leserechte fuer Benutzer.
        </p>
      ) : null}
    </div>
  );
}
