import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildSupabaseSessionPoolerUrl } from "./build-supabase-pooler-url";

function parseEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(filePath)) return out;
  for (const raw of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    out[key] = line.slice(idx + 1).trim();
  }
  return out;
}

/**
 * Liest DATABASE_URL / Pooler-URL wie dbmate-Skript (Root + web .env.local).
 */
export function resolveDatabaseUrl(): string | null {
  const fromProcess =
    process.env.SUPABASE_POOLER_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.DIRECT_URL ||
    "";
  if (fromProcess) return fromProcess.trim();

  const root = resolve(process.cwd(), "..");
  const merged = {
    ...parseEnvFile(resolve(process.cwd(), ".env")),
    ...parseEnvFile(resolve(process.cwd(), ".env.local")),
    ...parseEnvFile(resolve(root, ".env")),
    ...parseEnvFile(resolve(root, ".env.local")),
  };

  const composed = buildSupabaseSessionPoolerUrl({
    supabaseDbPassword:
      process.env.SUPABASE_DB_PASSWORD || merged.SUPABASE_DB_PASSWORD || "",
    nextPublicSupabaseUrl:
      process.env.NEXT_PUBLIC_SUPABASE_URL || merged.NEXT_PUBLIC_SUPABASE_URL || "",
    poolerHost: process.env.SUPABASE_POOLER_HOST || merged.SUPABASE_POOLER_HOST || "",
    poolerPort: process.env.SUPABASE_POOLER_PORT || merged.SUPABASE_POOLER_PORT,
  });

  return (
    merged.SUPABASE_POOLER_DB_URL ||
    merged.DATABASE_URL ||
    merged.DIRECT_URL ||
    composed ||
    null
  );
}
