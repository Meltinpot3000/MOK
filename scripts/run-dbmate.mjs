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
// Pooler zuerst: IPv4 / Session-Pooler; sonst direkte DB-URL (oft nur IPv6).
const databaseUrl =
  process.env.SUPABASE_POOLER_DB_URL ||
  process.env.DATABASE_URL ||
  merged.SUPABASE_POOLER_DB_URL ||
  merged.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    "DATABASE_URL fehlt. Setze SUPABASE_POOLER_DB_URL oder DATABASE_URL in .env oder .env.local (siehe .env.example)."
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
