"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSupabasePublicConfigError } from "@/lib/supabase/public-config";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const configError = getSupabasePublicConfigError();
    if (configError) {
      setLoading(false);
      setError(configError);
      return;
    }

    const redirectTo = `${window.location.origin}/auth/callback?type=recovery`;
    let resetErrorMessage: string | null = null;

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      resetErrorMessage = resetError?.message ?? null;
    } catch {
      resetErrorMessage =
        "Die Anfrage konnte nicht gesendet werden. Bitte Supabase-URL/Key pruefen und Netzwerkverbindung testen.";
    }

    setLoading(false);

    if (resetErrorMessage) {
      setError(resetErrorMessage);
      return;
    }

    router.push("/forgot-password/sent");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <section className="w-full rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Passwort vergessen</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Passwort zuruecksetzen</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Gib deine E-Mail ein. Du bekommst einen Link, um ein neues Passwort zu setzen.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-700">E-Mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2"
            />
          </label>

          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {loading ? "Sende Link..." : "Reset-Link senden"}
          </button>
        </form>

        <p className="mt-4 text-sm text-zinc-600">
          <Link href="/login" className="font-medium text-zinc-900 underline underline-offset-2">
            Zurueck zur Anmeldung
          </Link>
        </p>
      </section>
    </main>
  );
}
