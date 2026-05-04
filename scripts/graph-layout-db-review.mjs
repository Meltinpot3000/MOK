/**
 * Liest alle Analyse-Knoten eines Zyklus für Layout-Review (stdout JSON).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Client } = require(join(dirname(fileURLToPath(import.meta.url)), "../web/node_modules/pg"));

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = join(root, ".env.local");
  const line = readFileSync(envPath, "utf8").split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
  return line.slice("DATABASE_URL=".length).trim();
}

const ORG = process.env.GRAPH_RECOMPUTE_ORG_ID ?? "15fd7d63-dad1-44c4-9ee5-b3bc34f54e43";
const CYCLE = process.env.GRAPH_RECOMPUTE_CYCLE_ID ?? "fdeb6ab9-5027-48fd-9d16-ab8358d82a9b";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const c = new Client({ connectionString: loadDatabaseUrl(), ssl: { rejectUnauthorized: false } });
await c.connect();

const { rows } = await c.query(
  `select id, title, analysis_type, sub_type,
          left(coalesce(description,''), 400) as description_excerpt,
          impact_level, uncertainty_level, quality_score,
          graph_layout_x, graph_layout_y, graph_layout_z, graph_layout_confidence,
          graph_layout_source, graph_layout_provider, graph_layout_reason,
          graph_layout_calculated_at
   from app.analysis_entries
   where organization_id = $1::uuid and cycle_instance_id = $2::uuid
   order by analysis_type, title`,
  [ORG, CYCLE]
);
console.log(JSON.stringify(rows, null, 2));
await c.end();
