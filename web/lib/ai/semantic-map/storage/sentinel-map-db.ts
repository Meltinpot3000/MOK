import { Pool, type PoolConfig } from "pg";

import { resolveDatabaseUrl } from "../inventory/env";
import { postgresConnectionOptions } from "../inventory/pg-remote-tls";

let pool: Pool | null = null;

/**
 * Gleiche URL-Auflösung wie `scripts/run-dbmate.ts` / `inventory/resolve-database-url.ts` (Pooler zuerst).
 * Nur serverseitig (Service Role / direkte DB), kein Browser.
 */
export function getSentinelMapDatabaseUrl(): string {
  const url = resolveDatabaseUrl();
  if (!url?.trim()) {
    throw new Error(
      "sentinel_map: SUPABASE_POOLER_DB_URL oder DATABASE_URL fehlt (siehe .env.example / run-dbmate.ts)."
    );
  }
  return url.trim();
}

function buildSentinelMapPoolConfig(connectionString: string): PoolConfig {
  return {
    ...postgresConnectionOptions(connectionString),
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
