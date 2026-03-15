"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSupabasePublicConfigError } from "@/lib/supabase/public-config";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (mounted && session) {
        router.replace("/dashboard");
        router.refresh();
      }
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

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

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    const nextFromUrl = new URLSearchParams(window.location.search).get("next");
    const safeNextPath = nextFromUrl && nextFromUrl.startsWith("/") ? nextFromUrl : "/dashboard";
    router.replace(safeNextPath);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <section className="w-full rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">CITADEL Login</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Plattform-Zugang</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Anmeldung erfolgt per Firmen-Einladung. Ohne Einladung kann kein Konto erstellt werden.
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

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-700">Passwort</span>
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2"
            />
          </label>

          <div className="flex items-center justify-end text-sm">
            <Link
              href="/forgot-password"
              className="font-medium text-zinc-900 underline underline-offset-2"
            >
              Passwort vergessen?
            </Link>
          </div>

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
            {loading ? "Anmeldung..." : "Anmelden"}
          </button>
        </form>

        <p className="mt-4 text-sm text-zinc-600">
          Keine Einladung erhalten?{" "}
          <span className="font-medium text-zinc-900">Bitte an den Organisations-Admin wenden.</span>
        </p>
      </section>
    </main>
  );
}
