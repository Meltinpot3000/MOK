import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { Client } = require(join(__dirname, "..", "web", "node_modules", "pg"));

function loadLocalEnv(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[line.slice(0, idx).trim()] = value;
  }
  return out;
}

const merged = {
  ...loadLocalEnv(resolve(process.cwd(), ".env")),
  ...loadLocalEnv(resolve(process.cwd(), ".env.local")),
  ...loadLocalEnv(resolve(process.cwd(), "web", ".env.local")),
};

const databaseUrl =
  process.env.SUPABASE_POOLER_DB_URL ||
  process.env.DATABASE_URL ||
  merged.SUPABASE_POOLER_DB_URL ||
  merged.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    "DATABASE_URL fehlt. Setze SUPABASE_POOLER_DB_URL oder DATABASE_URL.",
  );
  process.exit(1);
}

const relativePath = process.argv[2];
if (!relativePath) {
  console.error("Usage: node scripts/run-sql-seed.mjs <path-to.sql>");
  process.exit(1);
}

const sqlPath = resolve(process.cwd(), relativePath);
if (!existsSync(sqlPath)) {
  console.error("Datei nicht gefunden:", sqlPath);
  process.exit(1);
}

const sql = readFileSync(sqlPath, "utf8");

/** @type {import('pg').ClientConfig} */
const config = { connectionString: databaseUrl };
// Supabase Pooler / manche Hosts: Zertifikatkette erfordert relaxed TLS in Node.
if (
  process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0" ||
  /supabase\.co|pooler\.supabase/i.test(databaseUrl)
) {
  config.ssl = { rejectUnauthorized: false };
}

const c = new Client(config);
await c.connect();
try {
  await c.query(sql);
  console.log("Seed OK:", relativePath);
} finally {
  await c.end();
}
