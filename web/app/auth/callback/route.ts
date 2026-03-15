import { NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";
  const errorRedirect = new URL("/auth/error", requestUrl.origin);
  const safeNext = next.startsWith("/") ? next : "/dashboard";
  const supabase = await createSupabaseServerClient();

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
