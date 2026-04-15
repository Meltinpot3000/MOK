"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSupabasePublicConfigError } from "@/lib/supabase/public-config";

function displayNameFromUser(user: User): string {
  const m = user.user_metadata as Record<string, unknown> | undefined;
  if (!m || typeof m !== "object") {
    return user.email ?? "";
  }
  for (const key of ["full_name", "name", "display_name"] as const) {
    const v = m[key];
    if (typeof v === "string" && v.trim().length > 0) {
      return v.trim();
    }
  }
  return user.email ?? "";
}

export default function ProfilePage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user: u },
        error,
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (error || !u) {
        setLoadError(error?.message ?? "Nicht angemeldet.");
        return;
      }
      setUser(u);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (password !== confirmPassword) {
      setPwError("Die Passwoerter stimmen nicht ueberein.");
      return;
    }

    const configError = getSupabasePublicConfigError();
    if (configError) {
      setPwError(configError);
      return;
    }

    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setPwLoading(false);

    if (error) {
      setPwError(error.message);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setPwSuccess(true);
  }

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Konto</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Profil</h1>
        <p className="mt-1 text-sm text-zinc-600">
          
          Angaben zu deinem Login und Passwort ändern.
        </p>
      </header>

      {loadError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{loadError}</p>
      ) : null}

      {user ? (
        <section className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Anmeldung</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Anzeigename</dt>
              <dd className="mt-0.5 text-zinc-900">{displayNameFromUser(user) || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">E-Mail</dt>
              <dd className="mt-0.5 text-zinc-900">{user.email ?? "—"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-zinc-500">
            
            Aenderungen an Name/E-Mail können je nach Organisationsrichtlinie nur in der Administration oder in
            Supabase erfolgen.
          </p>
        </section>
      ) : null}

      {user ? (
        <section className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Passwort ändern</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Neues Passwort waehlen (mindestens 8 Zeichen). Du bleibst nach der Aenderung angemeldet.
          </p>

          <form className="mt-4 max-w-md space-y-4" onSubmit={handlePasswordSubmit}>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-700">Neues Passwort</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-700">Neues Passwort wiederholen</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2"
              />
            </label>

            {pwError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{pwError}</p>
            ) : null}
            {pwSuccess ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Passwort wurde geaendert.
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pwLoading}
              className="brand-btn px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pwLoading ? "Speichern..." : "Passwort speichern"}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
