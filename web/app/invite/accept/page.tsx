import Link from "next/link";
import { redirect } from "next/navigation";
import { invitationRoleCodesFromRow } from "@/lib/invitations";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AcceptInvitePageProps = {
  searchParams: Promise<{
    token?: string;
  }>;
};

export default async function AcceptInvitePage({ searchParams }: AcceptInvitePageProps) {
  const { token } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-6">
        <section className="w-full rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">Einladung ungueltig</h1>
          <p className="mt-2 text-sm text-zinc-600">Der Einladungs-Token fehlt oder ist beschaedigt.</p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Zur Anmeldung
          </Link>
        </section>
      </main>
    );
  }

  if (!user?.email) {
    redirect(`/login?next=${encodeURIComponent(`/invite/accept?token=${token}`)}`);
  }

  const email = user.email.toLowerCase();

  const { data: invite } = await supabase
    .schema("app")
    .from("member_invitations")
    .select(
      "id, organization_id, invited_email, invited_display_name, invited_membership_title, role_code, role_codes, status, expires_at"
    )
    .eq("token", token)
    .single();

  if (!invite) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-6">
        <section className="w-full rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">Einladung nicht gefunden</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Diese Einladung existiert nicht oder wurde bereits geloescht.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Zur Anmeldung
          </Link>
        </section>
      </main>
    );
  }

  if (invite.invited_email.toLowerCase() !== email) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-6">
        <section className="w-full rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">Falsche E-Mail</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Diese Einladung ist fuer {invite.invited_email} ausgestellt. Bitte mit diesem Account einloggen.
          </p>
          <Link
            href="/logout"
            className="mt-6 inline-block rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Mit anderem Account anmelden
          </Link>
        </section>
      </main>
    );
  }

  if (invite.status === "revoked" || invite.status === "expired") {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-6">
        <section className="w-full rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">Einladung nicht mehr gueltig</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Die Einladung wurde widerrufen oder ist abgelaufen. Bitte die Administration um eine neue Einladung.
          </p>
        </section>
      </main>
    );
  }

  const inviteRoleCodes = invitationRoleCodesFromRow({
    role_codes: invite.role_codes,
    role_code: invite.role_code,
  });

  if (inviteRoleCodes.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-6">
        <section className="w-full rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">Einladung unvollstaendig</h1>
          <p className="mt-2 text-sm text-zinc-600">Fuer diese Einladung sind keine Rollen hinterlegt.</p>
        </section>
      </main>
    );
  }

  const { data: roleRows } = await supabase
    .schema("rbac")
    .from("roles")
    .select("id, code")
    .eq("organization_id", invite.organization_id)
    .in("code", inviteRoleCodes);

  if (!roleRows || roleRows.length !== inviteRoleCodes.length) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-6">
        <section className="w-full rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">Rolle fehlt</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Mindestens eine in der Einladung angegebene Organisations-Rolle ist fuer diesen Mandanten in der
            Datenbank nicht vorhanden, z. B. weil sie nie eingerichtet wurde, der Rollencode nicht passt oder
            die Einladung veraltet ist. Bitte die Administration kontaktieren.
          </p>
        </section>
      </main>
    );
  }

  const inviteDisplayName =
    typeof invite.invited_display_name === "string" && invite.invited_display_name.trim().length > 0
      ? invite.invited_display_name.trim()
      : null;
  const inviteTitle =
    typeof invite.invited_membership_title === "string" &&
    invite.invited_membership_title.trim().length > 0
      ? invite.invited_membership_title.trim()
      : null;

  const { data: existingMembership } = await supabase
    .schema("app")
    .from("organization_memberships")
    .select("display_name, title")
    .eq("organization_id", invite.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const membershipPayload = {
    organization_id: invite.organization_id,
    user_id: user.id,
    status: "active" as const,
    display_name: inviteDisplayName ?? (existingMembership?.display_name as string | null) ?? null,
    title: inviteTitle ?? (existingMembership?.title as string | null) ?? null,
  };

  const { data: membership, error: membershipError } = await supabase
    .schema("app")
    .from("organization_memberships")
    .upsert(membershipPayload, { onConflict: "organization_id,user_id" })
    .select("id")
    .single();

  if (membershipError || !membership) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-6">
        <section className="w-full rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">Mitgliedschaft fehlgeschlagen</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Deine Mitgliedschaft konnte nicht angelegt werden. Bitte die Administration kontaktieren oder den
            Einladungslink erneut aufrufen.
          </p>
          {membershipError?.message ? (
            <p className="mt-3 break-words font-mono text-xs text-zinc-500">{membershipError.message}</p>
          ) : null}
        </section>
      </main>
    );
  }

  const { error: rolesError } = await supabase.schema("rbac").from("member_roles").upsert(
    roleRows.map((row) => ({
      membership_id: membership.id,
      role_id: row.id,
    })),
    { onConflict: "membership_id,role_id" }
  );

  if (rolesError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-6">
        <section className="w-full rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">Rollen konnten nicht gesetzt werden</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Die Mitgliedschaft ist angelegt, die Organisations-Rollen nicht. Bitte die Administration kontaktieren.
          </p>
          <p className="mt-3 break-words font-mono text-xs text-zinc-500">{rolesError.message}</p>
        </section>
      </main>
    );
  }

  if (invite.status === "pending") {
    const { error: inviteUpdateError } = await supabase
      .schema("app")
      .from("member_invitations")
      .update({
        status: "accepted",
        accepted_by_user_id: user.id,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invite.id);
    if (inviteUpdateError) {
      return (
        <main className="mx-auto flex min-h-screen max-w-xl items-center px-6">
          <section className="w-full rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold text-zinc-900">Zugriff aktiviert, Status nicht aktualisiert</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Du solltest die App nutzen koennen. Die Einladung konnte in der Datenbank nicht als angenommen markiert
              werden — bitte die Administration informieren, falls du noch unter «offene Einladungen» gesehen wirst.
            </p>
            <p className="mt-3 break-words font-mono text-xs text-zinc-500">{inviteUpdateError.message}</p>
            <div className="mt-6">
              <Link
                href="/dashboard"
                className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Zum Dashboard
              </Link>
            </div>
          </section>
        </main>
      );
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6">
      <section className="w-full rounded-xl border border-green-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Einladung angenommen</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Willkommen im Arbeitsbereich</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Dein Zugriff wurde erfolgreich aktiviert. Du kannst jetzt direkt ins Dashboard wechseln.
        </p>
        <div className="mt-6">
          <Link
            href="/dashboard"
            className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Zum Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
