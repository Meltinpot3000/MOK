import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

function loadLocalEnv(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
}

const rootEnv = loadLocalEnv(resolve(process.cwd(), ".env"));
const localEnv = loadLocalEnv(resolve(process.cwd(), ".env.local"));
const webLocalEnv = loadLocalEnv(resolve(process.cwd(), "web", ".env.local"));
const merged = { ...rootEnv, ...localEnv, ...webLocalEnv };

function extractSupabaseProjectRef(supabaseUrl) {
  const m = String(supabaseUrl)
    .trim()
    .match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i);
  return m ? m[1] : null;
}

function tryBuildPoolerUrlFromParts(m) {
  const password = (process.env.SUPABASE_DB_PASSWORD || m.SUPABASE_DB_PASSWORD || "").trim();
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || m.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const host = (process.env.SUPABASE_POOLER_HOST || m.SUPABASE_POOLER_HOST || "").trim();
  const port = (process.env.SUPABASE_POOLER_PORT || m.SUPABASE_POOLER_PORT || "5432").trim();
  if (!password || !supabaseUrl || !host) return null;
  const ref = extractSupabaseProjectRef(supabaseUrl);
  if (!ref) return null;
  return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${host}:${port}/postgres`;
}

// Pooler zuerst: IPv4 / Session-Pooler; sonst direkte DB-URL; sonst aus SUPABASE_DB_PASSWORD + URL + SUPABASE_POOLER_HOST.
const databaseUrl =
  process.env.SUPABASE_POOLER_DB_URL ||
  process.env.DATABASE_URL ||
  merged.SUPABASE_POOLER_DB_URL ||
  merged.DATABASE_URL ||
  tryBuildPoolerUrlFromParts(merged);

if (!databaseUrl) {
  console.error(
    "DATABASE_URL fehlt. Setze SUPABASE_POOLER_DB_URL oder DATABASE_URL, oder SUPABASE_DB_PASSWORD + NEXT_PUBLIC_SUPABASE_URL + SUPABASE_POOLER_HOST (siehe .env.example)."
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const dbmateArgs = ["--yes", "dbmate", ...args];
const result = spawnSync("npx", dbmateArgs, {
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
  },
  shell: true,
});

if (typeof result.status === "number") {
  process.exit(result.status);
}
process.exit(1);
