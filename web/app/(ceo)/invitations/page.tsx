import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Image from "next/image";
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
import { getSidebarAccessContext } from "@/lib/rbac/page-access";

function isServiceRoleConfigured(): boolean {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return Boolean(value && !value.includes("your_service_role_key"));
}

export default async function InvitationsPage() {
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
  const [roles, invitations] = await Promise.all([
    getInvitationRoles(context.organizationId),
    listInvitations(context.organizationId),
  ]);

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
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Mitgliederverwaltung</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Einladungen</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Nur Admins koennen Zugaenge anlegen. Neue Nutzer kommen per Einladungslink und QR-Code ins
          System.
        </p>
      </header>

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Neue Einladung versenden</h2>
        {serviceRoleConfigured ? (
          <p className="mt-1 text-sm text-zinc-600">
            `SUPABASE_SERVICE_ROLE_KEY` ist gesetzt. Einladungen werden automatisch per E-Mail versendet.
          </p>
        ) : (
          <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            `SUPABASE_SERVICE_ROLE_KEY` fehlt oder ist noch ein Platzhalter. Einladungen werden erstellt,
            aber E-Mails nicht automatisch versendet.
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
            Einladung erstellen
          </button>
        </form>
      </section>

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Offene und versendete Einladungen</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500">
                <th className="py-2">E-Mail</th>
                <th className="py-2">Rolle</th>
                <th className="py-2">Status</th>
                <th className="py-2">Login-Link</th>
                <th className="py-2">QR</th>
                <th className="py-2">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {invitationViews.map((invite) => (
                <tr key={invite.id} className="border-b border-zinc-100 align-top">
                  <td className="py-3 pr-3">{invite.invited_email}</td>
                  <td className="py-3 pr-3">{invite.role_code}</td>
                  <td className="py-3 pr-3">
                    <div>{invite.status}</div>
                    <div className="text-xs text-zinc-500">
                      Ablauf: {new Date(invite.expires_at).toLocaleDateString("de-DE")}
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <a href={invite.loginUrl} className="text-zinc-900 underline underline-offset-2">
                      Login-Link
                    </a>
                    <div className="mt-1 break-all text-xs text-zinc-500">{invite.loginUrl}</div>
                  </td>
                  <td className="py-3 pr-3">
                    <Image
                      src={invite.qrDataUrl}
                      alt={`QR fuer ${invite.invited_email}`}
                      width={96}
                      height={96}
                      unoptimized
                      className="h-24 w-24 rounded border border-zinc-200"
                    />
                  </td>
                  <td className="py-3">
                    <div className="flex flex-col gap-2">
                      <form action={resendInvitation}>
                        <input type="hidden" name="invite_id" value={invite.id} />
                        <button
                          type="submit"
                          disabled={invite.status !== "pending" || !serviceRoleConfigured || !canWrite}
                          className="brand-btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Erneut senden
                        </button>
                      </form>
                      <form action={revokeInvitation}>
                        <input type="hidden" name="invite_id" value={invite.id} />
                        <button
                          type="submit"
                          disabled={invite.status !== "pending" || !canWrite}
                          className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Widerrufen
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {invitationViews.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Noch keine Einladungen vorhanden.</p>
        ) : null}
      </section>
      {!canWrite ? (
        <p className="brand-surface p-3 text-sm text-zinc-600">
          Diese Rolle hat nur Leserechte für Einladungen.
        </p>
      ) : null}
    </div>
  );
}
