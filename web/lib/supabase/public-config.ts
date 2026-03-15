const URL_PLACEHOLDER = "your-project-ref.supabase.co";
const KEY_PLACEHOLDER = "sb_publishable_your_publishable_key";

export function getSupabasePublicConfigError(): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return "Supabase ist nicht konfiguriert. Bitte NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY in web/.env.local setzen und den Dev-Server neu starten.";
  }

  if (supabaseUrl.includes(URL_PLACEHOLDER) || supabaseAnonKey.includes(KEY_PLACEHOLDER)) {
    return "Supabase ist noch mit Platzhalterwerten konfiguriert. Bitte echte Werte in web/.env.local eintragen und den Dev-Server neu starten.";
  }

  return null;
}
