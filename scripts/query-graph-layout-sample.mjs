import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
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

const ORG = "15fd7d63-dad1-44c4-9ee5-b3bc34f54e43";
const CYCLE = "fdeb6ab9-5027-48fd-9d16-ab8358d82a9b";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const c = new Client({ connectionString: loadDatabaseUrl(), ssl: { rejectUnauthorized: false } });
await c.connect();

const dist = await c.query(
  `select graph_layout_source, graph_layout_fallback_reason, count(*)::int as n
   from app.analysis_entries
   where organization_id = $1::uuid and cycle_instance_id = $2::uuid
   group by 1, 2 order by n desc`,
  [ORG, CYCLE]
);
console.log(JSON.stringify(dist.rows, null, 2));

const sample = await c.query(
  `select title, analysis_type, impact_level, uncertainty_level,
          graph_layout_x, graph_layout_y, graph_layout_z,
          graph_layout_source, graph_layout_provider, graph_layout_fallback_reason,
          graph_layout_calculated_at
   from app.analysis_entries
   where organization_id = $1::uuid and cycle_instance_id = $2::uuid
   order by title
   limit 30`,
  [ORG, CYCLE]
);
console.log(JSON.stringify(sample.rows, null, 2));

await c.end();
