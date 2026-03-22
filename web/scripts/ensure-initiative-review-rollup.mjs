/**
 * Stellt sicher, dass app.initiatives die Review-Roll-up-Spalten hat (Migration 0073).
 * Nutzt DATABASE_URL / SUPABASE_POOLER_DB_URL aus Prozess-Umgebung oder .env.local (Root + web).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function loadLocalEnv(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const raw of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}

const merged = {
  ...loadLocalEnv(resolve(repoRoot, ".env")),
  ...loadLocalEnv(resolve(repoRoot, ".env.local")),
  ...loadLocalEnv(resolve(repoRoot, "web", ".env.local")),
};

const databaseUrl =
  process.env.SUPABASE_POOLER_DB_URL ||
  process.env.DATABASE_URL ||
  merged.SUPABASE_POOLER_DB_URL ||
  merged.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL oder SUPABASE_POOLER_DB_URL fehlt.");
  process.exit(1);
}

const useSsl = !/localhost|127\.0\.0\.1/i.test(databaseUrl);
// Query-Parameter wie sslmode=verify-full ueberschreiben sonst node-pg und ignorieren rejectUnauthorized.
const connectionString = databaseUrl.replace(/\?[^#]*$/, "");
const client = new pg.Client({
  connectionString,
  ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

const UP_SQL = `
alter table app.initiatives
  add column if not exists weight integer not null default 3
    constraint initiatives_weight_review_check check (weight in (1, 2, 3, 5, 8)),
  add column if not exists progress_percent integer not null default 0
    constraint initiatives_progress_percent_review_check check (progress_percent >= 0 and progress_percent <= 100),
  add column if not exists last_review_update_at timestamptz;
`;

async function main() {
  await client.connect();
  const check = await client.query(
    `select column_name from information_schema.columns
     where table_schema = 'app' and table_name = 'initiatives'
       and column_name = any ($1::text[])`,
    [["weight", "progress_percent", "last_review_update_at"]]
  );
  const have = new Set(check.rows.map((r) => r.column_name));
  const need = ["weight", "progress_percent", "last_review_update_at"];
  const missing = need.filter((c) => !have.has(c));

  if (missing.length === 0) {
    console.log("OK: Alle Roll-up-Spalten sind vorhanden:", need.join(", "));
    await client.end();
    return;
  }

  console.log("Fehlende Spalten:", missing.join(", "));
  console.log("Fuehre ALTER TABLE aus (idempotent) …");
  await client.query(UP_SQL);
  console.log("Fertig.");
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
