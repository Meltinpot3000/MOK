import { NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const nextRaw = requestUrl.searchParams.get("next");
  /** Ohne explizites Ziel: Root — dort erfolgt Redirect auf erste erlaubte Shell-Route. */
  const safeNext = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/";
  const errorRedirect = new URL("/auth/error", requestUrl.origin);
  const supabase = await createSupabaseRouteHandlerClient();

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        throw error;
      }
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash,
      });

      if (error) {
        throw error;
      }
    } else {
      throw new Error("Missing authentication callback parameters.");
    }

    if (type === "recovery") {
      return NextResponse.redirect(new URL("/reset-password", requestUrl.origin));
    }

    return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
  } catch {
    return NextResponse.redirect(errorRedirect);
  }
}
