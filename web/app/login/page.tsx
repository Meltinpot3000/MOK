"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSupabasePublicConfigError } from "@/lib/supabase/public-config";

function safeNextPath(raw: string | null): string {
  return raw && raw.startsWith("/") ? raw : "/";
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);
  const [nextPath, setNextPath] = useState("/");
  /** Session ohne explizites ?next= — keine automatische Weiterleitung (sonst Schleife mit /no-access). */
  const [openSession, setOpenSession] = useState<Session | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(safeNextPath(params.get("next")));
    const emailParam = params.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const params = new URLSearchParams(window.location.search);
      const nextRaw = params.get("next");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted || !session) {
        return;
      }

      // Nur bei explizitem Ziel weiterleiten (z. B. Einladung). Ohne ?next= nicht automatisch zur Startseite —
      // sonst Schleife bei fehlendem Organisationszugang.
      if (nextRaw && nextRaw.startsWith("/")) {
        router.replace(nextRaw);
        router.refresh();
        return;
      }

      setOpenSession(session);
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

    if (!password.trim()) {
      setLoading(false);
      setError("Bitte Passwort eingeben oder «Anmeldelink per E-Mail» nutzen.");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      return;
    }

    // Voller Seitenwechsel: Server (/, Shell) sieht die frisch gesetzten Auth-Cookies —
    // Server-Actions direkt nach signIn laufen oft noch ohne Session und liefern fälschlich /login.
    const params = new URLSearchParams(window.location.search);
    const nextRaw = params.get("next");
    const target = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/";
    window.location.assign(target);
  }

  async function handleMagicLink() {
    setMagicSent(false);
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Bitte zuerst die E-Mail-Adresse eintragen.");
      return;
    }

    const configError = getSupabasePublicConfigError();
    if (configError) {
      setError(configError);
      return;
    }

    setMagicLoading(true);
    const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const isInviteFlow = next.includes("/invite/accept");

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo,
        shouldCreateUser: isInviteFlow,
      },
    });

    setMagicLoading(false);

    if (otpError) {
      setError(otpError.message);
      return;
    }

    setMagicSent(true);
  }

  const showInviteHint = nextPath.includes("/invite/accept");

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <section className="w-full rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">CITADEL Anmeldung</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Plattform-Zugang</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Anmeldung erfolgt per Firmen-Einladung. Ohne Einladung kann kein Konto erstellt werden.
        </p>

        {showInviteHint ? (
          <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <span className="font-medium">Einladung:</span> Nutze den Link in der E-Mail — der meldet dich an und fuehrt zur
            Annahme. Ohne Passwort: unten «Anmeldelink per E-Mail» verwenden (Posteingang pruefen).
          </p>
        ) : null}

        {openSession ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <p>
              Du bist noch als <span className="font-medium">{openSession.user.email ?? "diesem Konto"}</span> angemeldet.
              Für ein anderes Konto bitte zuerst abmelden.
            </p>
            <p className="mt-2 flex flex-wrap gap-3">
              <Link href="/logout" className="font-medium text-amber-900 underline underline-offset-2">
                Abmelden
              </Link>
              <Link href="/" className="font-medium text-amber-900 underline underline-offset-2">
                Zur App
              </Link>
            </p>
          </div>
        ) : null}

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
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2"
              autoComplete="current-password"
            />
            <span className="mt-1 block text-xs text-zinc-500">Optional, falls du ein Passwort gesetzt hast.</span>
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
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          {magicSent ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Wenn diese E-Mail bekannt ist, findest du den Anmeldelink im Posteingang (und ggf. unter Spam).
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || magicLoading}
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {loading ? "Anmeldung..." : "Mit Passwort anmelden"}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wide text-zinc-500">
            <span className="bg-white px-2">oder</span>
          </div>
        </div>

        <button
          type="button"
          disabled={magicLoading || loading}
          onClick={() => void handleMagicLink()}
          className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {magicLoading ? "Sende Link..." : "Anmeldelink per E-Mail (ohne Passwort)"}
        </button>

        <p className="mt-4 text-sm text-zinc-600">
          Keine Einladung erhalten?{" "}
          <span className="font-medium text-zinc-900">Bitte an die Organisations-Administration wenden.</span>
        </p>
      </section>
    </main>
  );
}
