import { Pool } from "pg";

import { resolveDatabaseUrl } from "../inventory/env";

let pool: Pool | null = null;

/**
 * Gleiche URL-Auflösung wie `scripts/run-dbmate.mjs` / `inventory/env.ts` (Pooler zuerst).
 * Nur serverseitig (Service Role / direkte DB), kein Browser.
 */
export function getSentinelMapDatabaseUrl(): string {
  const url = resolveDatabaseUrl();
  if (!url?.trim()) {
    throw new Error(
      "sentinel_map: SUPABASE_POOLER_DB_URL oder DATABASE_URL fehlt (siehe .env.example / run-dbmate.mjs)."
    );
  }
  return url.trim();
}

export function getSentinelMapPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getSentinelMapDatabaseUrl(),
      max: 8,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

/** Nur für Tests / Prozessende (optional). */
export async function closeSentinelMapPoolForTests(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
