import Link from "next/link";

export default function NoAccessPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">CITADEL</p>
      <h1 className="mt-2 text-3xl font-semibold text-zinc-900">Kein Zugriff</h1>
      <p className="mt-3 text-sm text-zinc-600">
        Du bist angemeldet, hast aber keine <strong>aktive Organisationsmitgliedschaft</strong> in CITADEL. Nach einer
        Einladung muss die Mitgliedschaft unter «Benutzer / Einladungen» angelegt und die Einladung angenommen
        worden sein.
      </p>
      <p className="mt-3 text-sm text-zinc-600">
        
        Technische Prüfung: In der Datenbank <code className="rounded bg-zinc-100 px-1">app.organization_memberships</code>{" "}
        (status active) und <code className="rounded bg-zinc-100 px-1">rbac.member_roles</code>  für deine Mitgliedschaft.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
      >
        Zur Startseite
      </Link>
      <Link
        href="/logout"
        className="mt-3 text-sm text-zinc-600 underline hover:text-zinc-900"
      >
        Abmelden und anderes Konto verwenden
      </Link>
    </main>
  );
}
