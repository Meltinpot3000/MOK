import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase-Client fuer Route Handlers: Cookies werden zuverlaessig gesetzt (kein stilles Schlucken),
 * damit exchangeCodeForSession / verifyOtp eine Session anlegt.
 */
export async function createSupabaseRouteHandlerClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}
