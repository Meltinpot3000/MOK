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

const localEnv = loadLocalEnv(resolve(process.cwd(), ".env.local"));
const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_POOLER_DB_URL ||
  localEnv.DATABASE_URL ||
  localEnv.SUPABASE_POOLER_DB_URL;

if (!databaseUrl) {
  console.error(
    "DATABASE_URL fehlt. Setze DATABASE_URL oder SUPABASE_POOLER_DB_URL in .env.local."
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const result = spawnSync("dbmate", args, {
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
