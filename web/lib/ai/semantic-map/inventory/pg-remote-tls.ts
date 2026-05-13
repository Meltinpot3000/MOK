/**
 * TLS für Remote-Postgres (Supabase Pooler) wie sentinel_map / ensure-initiative-review-rollup:
 * Query-String entfernen, bei Nicht-Localhost `rejectUnauthorized: false`.
 */
export function postgresConnectionOptions(connectionString: string): {
  connectionString: string;
  ssl?: false | { rejectUnauthorized: boolean };
} {
  const trimmed = connectionString.trim();
  const useSsl = !/localhost|127\.0\.0\.1/i.test(trimmed);
  const connectionStringNoQuery = trimmed.replace(/\?[^#]*$/, "");
  if (!useSsl) {
    return { connectionString: connectionStringNoQuery };
  }
  return {
    connectionString: connectionStringNoQuery,
    ssl: { rejectUnauthorized: false },
  };
}
