"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const OAUTH_DONE_PREFIX = "mok_invite_oauth_done:";

function parseImplicitFromHash(): { access_token: string; refresh_token: string } | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) {
    return null;
  }
  const h = new URLSearchParams(raw);
  const access_token = h.get("access_token");
  const refresh_token = h.get("refresh_token");
  if (access_token && refresh_token) {
    return { access_token, refresh_token };
  }
  return null;
}

function InviteOauthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Anmeldung wird abgeschlossen …");

  const inviteToken = searchParams.get("token");
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const err = searchParams.get("error");
  const errDesc = searchParams.get("error_description");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (err) {
        router.replace(`/auth/error?reason=${encodeURIComponent((errDesc ?? err).slice(0, 300))}`);
        return;
      }

      if (!inviteToken) {
        router.replace("/invite/accept");
        return;
      }

      const supabase = createSupabaseBrowserClient();

      try {
        if (code) {
          const doneKey = `${OAUTH_DONE_PREFIX}code:${code}`;
          if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(doneKey) === "1") {
            router.replace(`/invite/accept?token=${encodeURIComponent(inviteToken)}`);
            router.refresh();
            return;
          }
          setMessage("Sitzung wird hergestellt …");
          const { error: e } = await supabase.auth.exchangeCodeForSession(code);
          if (e) {
            throw e;
          }
          sessionStorage.setItem(doneKey, "1");
        } else if (tokenHash && type) {
          const doneKey = `${OAUTH_DONE_PREFIX}otp:${tokenHash}:${type}`;
          if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(doneKey) === "1") {
            router.replace(`/invite/accept?token=${encodeURIComponent(inviteToken)}`);
            router.refresh();
            return;
          }
          setMessage("Einmal-Code wird geprueft …");
          const { error: e } = await supabase.auth.verifyOtp({
            type,
            token_hash: tokenHash,
          });
          if (e) {
            throw e;
          }
          sessionStorage.setItem(doneKey, "1");
        } else {
          const implicit = parseImplicitFromHash();
          if (implicit) {
            const doneKey = `${OAUTH_DONE_PREFIX}implicit:${implicit.access_token.slice(0, 24)}`;
            if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(doneKey) === "1") {
              router.replace(`/invite/accept?token=${encodeURIComponent(inviteToken)}`);
              router.refresh();
              return;
            }
            setMessage("Sitzung wird hergestellt …");
            const { error: e } = await supabase.auth.setSession({
              access_token: implicit.access_token,
              refresh_token: implicit.refresh_token,
            });
            if (e) {
              throw e;
            }
            sessionStorage.setItem(doneKey, "1");
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
          } else {
            const {
              data: { session },
              error: sessionError,
            } = await supabase.auth.getSession();
            if (sessionError) {
              throw sessionError;
            }
            if (!session) {
              throw new Error(
                "Keine Session nach dem E-Mail-Link. Bitte Link erneut aus dem Posteingang oeffnen " +
                  "oder in Supabase Auth unter «URL Configuration» sicherstellen, dass PKCE genutzt wird " +
                  "und die Redirect-URL erlaubt ist."
              );
            }
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) {
          router.replace(`/auth/error?reason=${encodeURIComponent(msg.slice(0, 350))}`);
        }
        return;
      }

      if (!cancelled) {
        router.replace(`/invite/accept?token=${encodeURIComponent(inviteToken)}`);
        router.refresh();
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router, inviteToken, code, tokenHash, type, err, errDesc]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <p className="text-sm text-zinc-600">{message}</p>
    </main>
  );
}

export default function InviteOauthPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6">
          <p className="text-sm text-zinc-600">Anmeldung wird abgeschlossen …</p>
        </main>
      }
    >
      <InviteOauthContent />
    </Suspense>
  );
}
