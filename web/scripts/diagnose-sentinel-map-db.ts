/**
 * Diagnose: welche Postgres-URL wird genutzt (ohne Passwort) + existiert sentinel_map?
 *
 *   npm run db:diagnose-sentinel-map
 *   (Repo-Root: npm --prefix web run db:diagnose-sentinel-map)
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFiles() {
  const roots = [process.cwd(), resolve(process.cwd(), "..")];
  const names = [".env.local", ".env"];
  for (const root of roots) {
    for (const name of names) {
      const p = resolve(root, name);
      if (!existsSync(p)) continue;
      for (const raw of readFileSync(p, "utf8").split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const idx = line.indexOf("=");
        if (idx <= 0) continue;
        const key = line.slice(0, idx).trim();
        if (!process.env[key]) {
          process.env[key] = line.slice(idx + 1).trim();
        }
      }
    }
  }
}

loadEnvFiles();

async function main() {
  const {
    formatDatabaseTargetLogLine,
    getResolvedDatabaseUrlMeta,
  } = await import("../lib/ai/semantic-map/inventory/resolve-database-url");
  const { closeSentinelMapPoolForTests, getSentinelMapPool } = await import(
    "../lib/ai/semantic-map/storage/sentinel-map-db"
  );

  const meta = getResolvedDatabaseUrlMeta();
  console.log(formatDatabaseTargetLogLine("[diagnose-sentinel-map]", meta));

  if (!meta.url) {
    console.error(JSON.stringify({ ok: false, error: "no_database_url" }));
    process.exit(1);
  }

  const pool = getSentinelMapPool();
  try {
    const schemas = await pool.query<{ schema_name: string }>(
      `select schema_name from information_schema.schemata where schema_name = 'sentinel_map'`
    );
    const tables = await pool.query<{ table_schema: string; table_name: string }>(
      `select table_schema, table_name from information_schema.tables
       where table_schema = 'sentinel_map' order by table_name`
    );
    console.log(
      JSON.stringify(
        {
          ok: true,
          sentinelMapSchemaExists: schemas.rows.length > 0,
          sentinelMapTables: tables.rows,
        },
        null,
        2
      )
    );
  } finally {
    await closeSentinelMapPoolForTests();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
