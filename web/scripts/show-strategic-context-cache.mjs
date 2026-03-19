import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
const env = {};
for (const line of raw.split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const c = new pg.Client({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

console.log("=== aktuelle strategische Kontext-Caches (is_current=true) ===\n");

const full = await c.query(`
  select organization_id::text, is_current, provider, model, prompt_version, created_at,
         context_json
  from app.strategic_context_cache
  where is_current = true
  order by created_at desc
  limit 3
`);

for (const r of full.rows) {
  const j = r.context_json;
  const keys =
    j && typeof j === "object" ? Object.keys(j).sort().join(", ") : "(kein Objekt)";
  const preview =
    j && typeof j === "object"
      ? JSON.stringify(j).slice(0, 600) + (JSON.stringify(j).length > 600 ? "…" : "")
      : String(j);
  console.log({
    organization_id: r.organization_id,
    is_current: r.is_current,
    provider: r.provider,
    model: r.model,
    prompt_version: r.prompt_version,
    created_at: r.created_at,
    context_top_level_keys: keys,
    context_preview: preview,
  });
  console.log("");
}

if (full.rows.length === 0) {
  console.log("Keine Zeile mit is_current=true gefunden.");
}

await c.end();
