/**
 * Baut die Session-Pooler-Postgres-URL aus Einzelwerten (Passwort nicht in *_URL duplizieren).
 * Host/Port kommen aus dem Supabase-Dashboard (Connect → Session pooler).
 */
export function extractSupabaseProjectRef(supabaseUrl: string): string | null {
  const u = supabaseUrl.trim();
  const m = u.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i);
  return m?.[1] ?? null;
}

export function buildSupabaseSessionPoolerUrl(input: {
  supabaseDbPassword: string;
  nextPublicSupabaseUrl: string;
  poolerHost: string;
  poolerPort?: string;
}): string | null {
  const password = input.supabaseDbPassword.trim();
  const supabaseUrl = input.nextPublicSupabaseUrl.trim();
  const host = input.poolerHost.trim();
  const port = (input.poolerPort ?? "5432").trim();
  if (!password || !supabaseUrl || !host) return null;
  const ref = extractSupabaseProjectRef(supabaseUrl);
  if (!ref) return null;
  const user = `postgres.${ref}`;
  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/postgres`;
}
