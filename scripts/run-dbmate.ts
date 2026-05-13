import { spawnSync } from "node:child_process";

import {
  formatDatabaseTargetLogLine,
  getResolvedDatabaseUrlMeta,
} from "../web/lib/ai/semantic-map/inventory/resolve-database-url";

const meta = getResolvedDatabaseUrlMeta();
const databaseUrl = meta.url;

if (!databaseUrl) {
  console.error(
    "DATABASE_URL fehlt. Setze SUPABASE_POOLER_DB_URL oder DATABASE_URL oder DIRECT_URL, " +
      "oder SUPABASE_DB_PASSWORD + NEXT_PUBLIC_SUPABASE_URL + SUPABASE_POOLER_HOST (siehe .env.example)."
  );
  process.exit(1);
}

console.error(formatDatabaseTargetLogLine("[db:migrate]", meta));

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
