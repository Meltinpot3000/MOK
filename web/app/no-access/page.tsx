import Link from "next/link";

export default function NoAccessPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">CITADEL</p>
      <h1 className="mt-2 text-3xl font-semibold text-zinc-900">Kein Zugriff</h1>
      <p className="mt-3 text-sm text-zinc-600">
        Dieses Dashboard ist im MVP nur für CEO/Admin-Rollen freigeschaltet.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
      >
        Zur Dashboard-Startseite
      </Link>
    </main>
  );
}
