import { Pool, type PoolConfig } from "pg";

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

/**
 * TLS wie `web/scripts/ensure-initiative-review-rollup.mjs`: Query-String entfernen (sslmode in der URL
 * kann sonst node-pg anders steuern) und bei Remote-Host explizit `rejectUnauthorized: false` setzen —
 * typisch für Supabase Pooler ohne extra Firmen-CA in Node.
 */
function buildSentinelMapPoolConfig(connectionString: string): PoolConfig {
  const trimmed = connectionString.trim();
  const useSsl = !/localhost|127\.0\.0\.1/i.test(trimmed);
  const connectionStringNoQuery = trimmed.replace(/\?[^#]*$/, "");
  return {
    connectionString: connectionStringNoQuery,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    max: 8,
    idleTimeoutMillis: 30_000,
  };
}

export function getSentinelMapPool(): Pool {
  if (!pool) {
    pool = new Pool(buildSentinelMapPoolConfig(getSentinelMapDatabaseUrl()));
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
