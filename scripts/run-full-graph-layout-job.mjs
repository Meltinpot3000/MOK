/**
 * One-off: reset graph_layout_calculated_at for a cycle and enqueue graph_layout_recompute.
 * Usage: DATABASE_URL=... node scripts/run-full-graph-layout-job.mjs
 * Or rely on .env.local next to repo root (loaded manually below).
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Client } = require(join(dirname(fileURLToPath(import.meta.url)), "../web/node_modules/pg"));

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = join(root, ".env.local");
  if (!existsSync(envPath)) throw new Error("Set DATABASE_URL or add .env.local with DATABASE_URL");
  const line = readFileSync(envPath, "utf8").split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL not found in .env.local");
  return line.slice("DATABASE_URL=".length).trim();
}

const ORG = process.env.GRAPH_RECOMPUTE_ORG_ID ?? "15fd7d63-dad1-44c4-9ee5-b3bc34f54e43";
const CYCLE = process.env.GRAPH_RECOMPUTE_CYCLE_ID ?? "fdeb6ab9-5027-48fd-9d16-ab8358d82a9b";

const cs = loadDatabaseUrl();
const client = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await client.connect();

const reset = await client.query(
  `update app.analysis_entries
   set graph_layout_calculated_at = null
   where organization_id = $1::uuid and cycle_instance_id = $2::uuid`,
  [ORG, CYCLE]
);
console.log("graph_layout_calculated_at cleared for rows:", reset.rowCount);

const payload = { trigger: "sql_full_graph_recompute", scope: "dirty", tab: "environment" };
const ins = await client.query(
  `insert into app.analysis_background_jobs (organization_id, cycle_instance_id, job_type, status, payload)
   values ($1::uuid, $2::uuid, 'graph_layout_recompute', 'pending', $3::jsonb)
   returning id`,
  [ORG, CYCLE, JSON.stringify(payload)]
);
console.log("enqueued graph_layout_recompute job:", ins.rows[0].id);

await client.end();
