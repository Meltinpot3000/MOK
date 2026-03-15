import Link from "next/link";

export default function ForgotPasswordSentPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <section className="w-full rounded-xl border border-green-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-green-700">E-Mail gesendet</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Postfach pruefen</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Wenn ein Konto mit dieser E-Mail existiert, wurde ein Reset-Link versendet.
        </p>

        <div className="mt-6">
          <Link
            href="/login"
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-zinc-700"
          >
            Zur Anmeldung
          </Link>
        </div>
      </section>
    </main>
  );
}
