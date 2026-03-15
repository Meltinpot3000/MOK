import Link from "next/link";
import { redirect } from "next/navigation";
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
    .select("id, organization_id, invited_email, role_code, status, expires_at")
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
            Die Einladung wurde widerrufen oder ist abgelaufen. Bitte Admin um eine neue Einladung.
          </p>
        </section>
      </main>
    );
  }

  const { data: role } = await supabase
    .schema("rbac")
    .from("roles")
    .select("id")
    .eq("organization_id", invite.organization_id)
    .eq("code", invite.role_code)
    .single();

  if (!role) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-6">
        <section className="w-full rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">Rolle fehlt</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Die in der Einladung hinterlegte Rolle existiert nicht mehr.
          </p>
        </section>
      </main>
    );
  }

  const { data: membership } = await supabase
    .schema("app")
    .from("organization_memberships")
    .upsert(
      {
        organization_id: invite.organization_id,
        user_id: user.id,
        status: "active",
      },
      { onConflict: "organization_id,user_id" }
    )
    .select("id")
    .single();

  if (!membership) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-6">
        <section className="w-full rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">Mitgliedschaft fehlgeschlagen</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Deine Mitgliedschaft konnte nicht angelegt werden. Bitte Admin kontaktieren.
          </p>
        </section>
      </main>
    );
  }

  await supabase.schema("rbac").from("member_roles").upsert(
    {
      membership_id: membership.id,
      role_id: role.id,
    },
    { onConflict: "membership_id,role_id" }
  );

  if (invite.status === "pending") {
    await supabase
      .schema("app")
      .from("member_invitations")
      .update({
        status: "accepted",
        accepted_by_user_id: user.id,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invite.id);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6">
      <section className="w-full rounded-xl border border-green-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Einladung angenommen</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Willkommen im Workspace</h1>
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
