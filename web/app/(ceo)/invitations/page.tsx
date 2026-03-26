import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppBaseUrl } from "@/lib/app-url";
import { getPhase0Context } from "@/lib/phase0/queries";
import {
  buildInvitationLinks,
  getInvitationRoles,
  invitationRoleCodesFromRow,
  cleanupInvitedUserAfterRevoke,
  listInvitations,
  provisionMembershipFromInvitationForEmail,
  tryResendInviteEmailViaSupabase,
  trySendInviteEmailViaSupabase,
  toQrDataUrl,
} from "@/lib/invitations";
import { InvitationsMembershipTable } from "@/components/invitations/InvitationsMembershipTable";
import { InvitationsPendingTable } from "@/components/invitations/InvitationsPendingTable";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";

type InvitationsPageProps = {
  searchParams: Promise<{ success?: string; error?: string; detail?: string }>;
};

type MembershipRow = {
  id: string;
  user_id: string;
  status: "active" | "invited" | "suspended";
  /** Organisations-spezifischer Anzeigename (nicht Auth-Login-Name). */
  display_name: string | null;
  /** Funktion / Rollenbezeichnung in der Organisation. */
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

function getStatusMessage(error?: string, success?: string, detail?: string) {
  if (success === "membership-row-saved") {
    return {
      type: "success",
      text: "Rollen und Verantwortliche-Zuordnung wurden gespeichert." as const,
    };
  }
  if (success === "invite-created-mail-sent") {
    return {
      type: "success",
      text: "Benutzerzugang wurde angelegt und die Einladungs-E-Mail wurde versucht zuzustellen. Zusaetzlich findest du den Link in der Liste unten.",
    };
  }
  if (success === "invite-created-no-mail") {
    return {
      type: "success",
      text: "Benutzerzugang wurde angelegt. Automatischer E-Mail-Versand ist aus — bitte den Anmeldelink aus der Liste unten manuell weitergeben.",
    };
  }
  if (success === "invite-created-mail-failed") {
    const base =
      "Benutzerzugang wurde angelegt, aber der E-Mail-Versand ist fehlgeschlagen. Bitte den Anmeldelink aus der Liste unten manuell senden.";
    const hint =
      " In Supabase: Authentication — E-Mail aktiviert; URL configuration — Site-URL und erlaubte Redirects (z. B. deine App-URL und Pfad /invite/oauth**).";
    const tech = detail?.trim() ? ` Technische Meldung: ${detail.trim().slice(0, 500)}` : "";
    return {
      type: "warning" as const,
      text: `${base}${hint}${tech}`,
    };
  }
  if (error === "invite-missing-email") {
    return { type: "error", text: "Bitte eine E-Mail-Adresse eingeben." as const };
  }
  if (error === "invite-missing-roles") {
    return {
      type: "error",
      text: "Bitte mindestens eine Rolle (Checkbox) auswaehlen — ohne Rolle wird kein Zugang angelegt." as const,
    };
  }
  if (error === "invite-invalid-roles") {
    return {
      type: "error",
      text: "Mindestens eine gewaehlte Rolle ist fuer diese Organisation ungueltig. Bitte Auswahl pruefen.",
    };
  }
  if (error === "invite-save-failed") {
    return {
      type: "error",
      text: "Die Einladung konnte nicht gespeichert werden (Rechte oder Datenbank). Bitte erneut versuchen oder Administration/Supabase pruefen.",
    };
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
    return {
      type: "error",
      text: "Mindestens eine gueltige Rolle muss ausgewaehlt werden (Checkboxen)." as const,
    };
  }
  if (error === "role-save-failed") {
    return { type: "error", text: "Rolle konnte nicht gespeichert werden." as const };
  }
  if (error === "invite-resend-failed") {
    const base =
      "Die E-Mail konnte nicht erneut gesendet werden. Bitte den Anmeldelink aus der Liste manuell weitergeben.";
    const hint =
      " In Supabase unter URL configuration zulaessige Redirects: Site-URL und z. B. https://ihre-domain/invite/oauth** (oder Projekt-Wildcard). Authentication: E-Mail-Provider aktiv.";
    const tech = detail?.trim() ? ` Technische Meldung: ${detail.trim().slice(0, 500)}` : "";
    return {
      type: "error",
      text: `${base}${hint}${tech}`,
    };
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
  const [roles, invitations, membershipsRes, responsiblesRes, editableRolesRes] = await Promise.all([
    getInvitationRoles(context.organizationId),
    listInvitations(context.organizationId),
    createSupabaseServerClient().then((supabase) =>
      supabase
        .schema("app")
        .from("organization_memberships")
        .select(
          "id, user_id, status, display_name, title, created_at, responsible_id, responsible:responsible_id(id, full_name, email, role_title)"
        )
        .eq("organization_id", context.organizationId)
        .order("created_at", { ascending: false })
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

  const memberships = (membershipsRes.data ?? []) as MembershipRow[];
  const membershipIdList = memberships.map((m) => m.id);
  const roleAssignmentsRes =
    membershipIdList.length === 0
      ? { data: [] as RoleAssignmentRow[] }
      : await createSupabaseServerClient().then((supabase) =>
          supabase
            .schema("rbac")
            .from("member_roles")
            .select("membership_id, role:role_id(code, name)")
            .in("membership_id", membershipIdList)
        );
  const params = await searchParams;
  const status = getStatusMessage(params.error, params.success, params.detail);

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

  async function saveMembershipRow(formData: FormData) {
    "use server";
    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("invitations");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");

    const membershipId = String(formData.get("membership_id") ?? "").trim();
    const responsibleIdRaw = String(formData.get("responsible_id") ?? "").trim();
    const roleCodes = [
      ...new Set(
        formData
          .getAll("role_codes")
          .map((value) => String(value ?? "").trim())
          .filter(Boolean)
      ),
    ];
    const membershipDisplayNameRaw = String(formData.get("membership_display_name") ?? "").trim();
    const membershipDisplayName = membershipDisplayNameRaw.length > 0 ? membershipDisplayNameRaw : null;
    const membershipTitleRaw = String(formData.get("membership_title") ?? "").trim();
    const membershipTitle = membershipTitleRaw.length > 0 ? membershipTitleRaw : null;

    if (!membershipId) redirect("/invitations?error=missing-membership");
    if (roleCodes.length === 0) redirect("/invitations?error=missing-role");

    const supabase = await createSupabaseServerClient();
    const { data: membership } = await supabase
      .schema("app")
      .from("organization_memberships")
      .select("id, organization_id")
      .eq("id", membershipId)
      .eq("organization_id", localContext.organizationId)
      .maybeSingle();
    if (!membership) redirect("/invitations?error=missing-membership");

    if (responsibleIdRaw) {
      const { data: responsible } = await supabase
        .schema("app")
        .from("responsibles")
        .select("id, organization_id, is_active")
        .eq("id", responsibleIdRaw)
        .eq("organization_id", localContext.organizationId)
        .maybeSingle();
      if (!responsible || !responsible.is_active) {
        redirect("/invitations?error=missing-responsible");
      }
    }

    const { data: roleRows } = await supabase
      .schema("rbac")
      .from("roles")
      .select("id, code")
      .eq("organization_id", localContext.organizationId)
      .in("code", roleCodes);
    if (!roleRows || roleRows.length !== roleCodes.length) redirect("/invitations?error=missing-role");

    const wantedIds = new Set(roleRows.map((row) => row.id));

    const { data: existingRows, error: existingError } = await supabase
      .schema("rbac")
      .from("member_roles")
      .select("role_id")
      .eq("membership_id", membership.id);
    if (existingError) redirect("/invitations?error=role-save-failed");

    const existingIds = new Set((existingRows ?? []).map((row) => row.role_id));
    const toRemove = [...existingIds].filter((id) => !wantedIds.has(id));
    const toAdd = [...wantedIds].filter((id) => !existingIds.has(id));

    if (toRemove.length > 0) {
      const { error: deleteError } = await supabase
        .schema("rbac")
        .from("member_roles")
        .delete()
        .eq("membership_id", membership.id)
        .in("role_id", toRemove);
      if (deleteError) redirect("/invitations?error=role-save-failed");
    }

    if (toAdd.length > 0) {
      const { error: insertError } = await supabase
        .schema("rbac")
        .from("member_roles")
        .insert(toAdd.map((role_id) => ({ membership_id: membership.id, role_id })));
      if (insertError) redirect("/invitations?error=role-save-failed");
    }

    const nextResponsibleId = responsibleIdRaw ? responsibleIdRaw : null;
    const { error: membershipUpdateError } = await supabase
      .schema("app")
      .from("organization_memberships")
      .update({
        responsible_id: nextResponsibleId,
        display_name: membershipDisplayName,
        title: membershipTitle,
      })
      .eq("id", membership.id)
      .eq("organization_id", localContext.organizationId);
    if (membershipUpdateError) redirect("/invitations?error=save-failed");

    revalidatePath("/invitations");
    redirect("/invitations?success=membership-row-saved");
  }

  async function createInvitation(formData: FormData) {
    "use server";

    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("invitations");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");

    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const invitedDisplayName = String(formData.get("invited_display_name") ?? "").trim();
    const invitedMembershipTitle = String(formData.get("invited_membership_title") ?? "").trim();
    const roleCodes = [
      ...new Set(
        formData
          .getAll("invite_role_codes")
          .map((value) => String(value ?? "").trim())
          .filter(Boolean)
      ),
    ];
    const supabase = await createSupabaseServerClient();
    const localBaseUrl = await getAppBaseUrl();

    if (!email) {
      redirect("/invitations?error=invite-missing-email");
    }
    if (roleCodes.length === 0) {
      redirect("/invitations?error=invite-missing-roles");
    }

    const { data: roleRows } = await supabase
      .schema("rbac")
      .from("roles")
      .select("id, code")
      .eq("organization_id", localContext.organizationId)
      .in("code", roleCodes);
    if (!roleRows || roleRows.length !== roleCodes.length) {
      redirect("/invitations?error=invite-invalid-roles");
    }

    const { data: invite, error } = await supabase
      .schema("app")
      .from("member_invitations")
      .insert({
        organization_id: localContext.organizationId,
        invited_email: email,
        invited_display_name: invitedDisplayName || null,
        invited_membership_title: invitedMembershipTitle || null,
        role_code: roleCodes[0],
        role_codes: roleCodes,
        created_by_membership_id: localContext.membershipId,
      })
      .select("id, token, invited_email")
      .single();

    if (error || !invite) {
      redirect("/invitations?error=invite-save-failed");
    }

    const links = buildInvitationLinks(localBaseUrl, invite.token, invite.invited_email);
    const canSendMail = isServiceRoleConfigured();

    let mailSent = false;
    let mailFailed = false;
    let mailFailMessage: string | null = null;
    if (canSendMail) {
      const sendResult = await trySendInviteEmailViaSupabase(invite.invited_email, links.loginUrl);
      mailSent = sendResult.ok;
      mailFailed = !sendResult.ok;
      if (!sendResult.ok) {
        mailFailMessage = sendResult.message;
      }
    }

    if (mailSent) {
      await supabase
        .schema("app")
        .from("member_invitations")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", invite.id);
    }

    await provisionMembershipFromInvitationForEmail({
      organizationId: localContext.organizationId,
      invitedEmail: email,
      roleRows: roleRows as { id: string; code: string }[],
      membershipDisplayName: invitedDisplayName || null,
      membershipTitle: invitedMembershipTitle || null,
    });

    revalidatePath("/invitations");

    if (mailFailed) {
      const q = new URLSearchParams();
      q.set("success", "invite-created-mail-failed");
      if (mailFailMessage?.trim()) {
        q.set("detail", mailFailMessage.trim().slice(0, 450));
      }
      redirect(`/invitations?${q.toString()}`);
    }
    if (mailSent) {
      redirect("/invitations?success=invite-created-mail-sent");
    }
    redirect("/invitations?success=invite-created-no-mail");
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
      .select(
        "id, token, invited_email, status, role_code, role_codes, invited_display_name, invited_membership_title"
      )
      .eq("id", inviteId)
      .eq("organization_id", localContext.organizationId)
      .single();

    if (!invite || invite.status !== "pending") {
      redirect("/invitations");
    }

    const links = buildInvitationLinks(localBaseUrl, invite.token, invite.invited_email);
    const canSendMail = isServiceRoleConfigured();
    if (!canSendMail) {
      revalidatePath("/invitations");
      redirect("/invitations");
    }

    const sendResult = await tryResendInviteEmailViaSupabase(invite.invited_email, links.loginUrl);

    if (sendResult.ok) {
      await supabase
        .schema("app")
        .from("member_invitations")
        .update({ last_sent_at: new Date().toISOString() })
        .eq("id", invite.id);

      const resendRoleCodes = invitationRoleCodesFromRow({
        role_codes: invite.role_codes,
        role_code: invite.role_code,
      });
      if (resendRoleCodes.length > 0) {
        const { data: resendRoleRows } = await supabase
          .schema("rbac")
          .from("roles")
          .select("id, code")
          .eq("organization_id", localContext.organizationId)
          .in("code", resendRoleCodes);
        if (resendRoleRows && resendRoleRows.length === resendRoleCodes.length) {
          await provisionMembershipFromInvitationForEmail({
            organizationId: localContext.organizationId,
            invitedEmail: invite.invited_email.trim().toLowerCase(),
            roleRows: resendRoleRows,
            membershipDisplayName: invite.invited_display_name?.trim() || null,
            membershipTitle: invite.invited_membership_title?.trim() || null,
          });
        }
      }
    }

    revalidatePath("/invitations");
    if (!sendResult.ok) {
      const q = new URLSearchParams();
      q.set("error", "invite-resend-failed");
      if (sendResult.message) {
        q.set("detail", sendResult.message.slice(0, 450));
      }
      redirect(`/invitations?${q.toString()}`);
    }
    redirect("/invitations?success=invite-resent");
  }

  async function revokeInvitation(formData: FormData) {
    "use server";

    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("invitations");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");

    const inviteId = String(formData.get("invite_id") ?? "");
    const supabase = await createSupabaseServerClient();

    const { data: inviteRow } = await supabase
      .schema("app")
      .from("member_invitations")
      .select("id, invited_email, status")
      .eq("id", inviteId)
      .eq("organization_id", localContext.organizationId)
      .maybeSingle();

    if (!inviteRow || inviteRow.status !== "pending") {
      revalidatePath("/invitations");
      redirect("/invitations");
    }

    const invitedEmail = inviteRow.invited_email.trim().toLowerCase();

    const { data: revoked, error: revokeErr } = await supabase
      .schema("app")
      .from("member_invitations")
      .update({ status: "revoked" })
      .eq("id", inviteId)
      .eq("organization_id", localContext.organizationId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (!revokeErr && revoked) {
      await cleanupInvitedUserAfterRevoke({
        organizationId: localContext.organizationId,
        invitedEmail,
      });
    }

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
        <p
          className={`rounded-md border p-3 text-sm ${
            status.type === "error"
              ? "border-red-300 bg-red-50 text-red-800"
              : status.type === "warning"
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-emerald-300 bg-emerald-50 text-emerald-800"
          }`}
        >
          {status.text}
        </p>
      ) : null}

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Benutzerliste und Verantwortlichen-Zuordnung</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Mehrere Organisations-Rollen pro Benutzer sind moeglich; Navigationsrechte aus allen Rollen werden vereinigt
          (effektives Recht ist die Summe). Optional ist genau ein Verantwortlicher zuordenbar — das steuert kein RBAC.
        </p>
        <div className="mt-4 overflow-x-auto">
          <InvitationsMembershipTable
            memberships={memberships}
            identityByUserId={identityByUserIdRecord}
            roleCodesByMembership={roleCodesByMembershipRecord}
            responsibles={responsibles}
            editableRoles={editableRoles}
            canWrite={canWrite}
            saveMembershipRow={saveMembershipRow}
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
        <form action={createInvitation} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-700">E-Mail</span>
              <input
                name="email"
                required
                type="email"
                placeholder="person@firma.de"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-700">
                Anzeigename in der Organisation{" "}
                <span className="font-normal text-zinc-500">(optional)</span>
              </span>
              <input
                name="invited_display_name"
                type="text"
                autoComplete="name"
                placeholder="z. B. Max Mustermann"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-xs text-zinc-500">
                Wird auf der Mitgliedschaft gespeichert und in Listen bevorzugt — unabhaengig vom Namen im
                Login-Konto.
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-700">
                Titel / Funktion{" "}
                <span className="font-normal text-zinc-500">(optional)</span>
              </span>
              <input
                name="invited_membership_title"
                type="text"
                placeholder="z. B. Team Lead Vertrieb"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-xs text-zinc-500">
                Separate Angabe zur Rolle in der Organisation; nicht mit dem Anzeigenamen verwechselt.
              </span>
            </label>
            <fieldset
              disabled={!canWrite}
              className="rounded-md border border-zinc-200 bg-zinc-50/80 p-3 md:col-span-2"
            >
              <legend className="px-1 text-sm font-medium text-zinc-800">Organisation-Rollen</legend>
              <p className="mt-0.5 text-xs text-zinc-600">
                Mindestens eine Rolle. Nach Annahme der Einladung werden alle ausgewaehlten Rollen zugewiesen.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {roles.map((role) => (
                  <label
                    key={role.code}
                    className={`flex items-start gap-2 text-sm ${canWrite ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                  >
                    <input
                      type="checkbox"
                      name="invite_role_codes"
                      value={role.code}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-300 accent-blue-600"
                    />
                    <span className="text-zinc-800">
                      {role.name}{" "}
                      <span className="text-zinc-500">({role.code})</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!canWrite}
              className="brand-btn px-4 py-2 text-sm"
            >
              Benutzerzugang erstellen
            </button>
          </div>
        </form>
      </section>

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Offene und versendete Benutzerzugaenge</h2>
        {serviceRoleConfigured ? (
          <p className="mt-1 text-sm text-zinc-600">
            «Widerrufen» setzt die Einladung auf widerrufen, entfernt die Mandanten-Mitgliedschaft (und Rollen) fuer
            diese E-Mail und loescht den Supabase-Auth-Account, sofern der betroffene Nutzer in keiner anderen
            Organisation mehr eingetragen ist.
          </p>
        ) : (
          <p className="mt-1 text-sm text-amber-900">
            Ohne konfigurierte Service-Role kann «Widerrufen» nur die Einladung in der Datenbank schliessen — keine
            automatische Bereinigung von Mitgliedschaft oder Auth-User. Für eine vollstaendige Aufraeumung bitte{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">SUPABASE_SERVICE_ROLE_KEY</code> setzen.
          </p>
        )}
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
