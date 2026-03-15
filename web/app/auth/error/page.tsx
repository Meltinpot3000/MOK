import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <section className="w-full rounded-xl border border-red-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Authentifizierung</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Link ungültig oder abgelaufen</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Der Login- oder Passwort-Link konnte nicht verarbeitet werden. Bitte fordere einen neuen Link
          an.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/forgot-password"
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-zinc-700"
          >
            Passwort neu anfordern
          </Link>
          <Link
            href="/login"
            className="w-full rounded-md border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            Zur Anmeldung
          </Link>
        </div>
      </section>
    </main>
  );
}
