import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { Client } = require(join(__dirname, "..", "node_modules", "pg"));

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
  ...loadLocalEnv(resolve(process.cwd(), ".env")),
  ...loadLocalEnv(resolve(process.cwd(), ".env.local")),
  ...loadLocalEnv(resolve(process.cwd(), "web", ".env.local")),
};
const databaseUrl =
  process.env.SUPABASE_POOLER_DB_URL ||
  process.env.DATABASE_URL ||
  merged.SUPABASE_POOLER_DB_URL ||
  merged.DATABASE_URL;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const c = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
await c.connect();

const org = (await c.query(`select id from app.organizations where slug='cabtecgroup'`)).rows[0];
const ci = (
  await c.query(
    `
  select ci.id from app.cycle_instances ci
  join app.cycle_schemes sch on sch.id = ci.cycle_scheme_id
  where ci.organization_id=$1 and sch.is_active and ci.level_no=1
    and ci.starts_on <= (timezone('utc', now()))::date
    and (timezone('utc', now()))::date < ci.ends_on
  order by ci.starts_on desc limit 1`,
    [org.id]
  )
).rows[0];
console.log("active L1 cycle:", ci?.id);

const dirs = await c.query(
  `
  select sd.id, sd.title, length(sd.description) legacy_len, left(sd.description, 70) legacy_desc,
         length(v.description) view_len, left(v.description, 70) view_desc
  from app.strategic_directions sd
  left join app.v_current_strategy_objects v on v.revision_id = sd.id
  where sd.organization_id=$1 and sd.cycle_instance_id=$2
  order by sd.title`,
  [org.id, ci.id]
);

const weak = dirs.rows.filter((r) => {
  const len = Math.max(r.legacy_len ?? 0, r.view_len ?? 0);
  const desc = r.legacy_desc ?? r.view_desc ?? "";
  return (
    len < 80 ||
    r.title?.startsWith("[Seed]") ||
    desc.startsWith("Demo:") ||
    desc === r.title?.slice(0, 70)
  );
});

console.log(`\nTotal directions: ${dirs.rows.length}, weak: ${weak.length}\n`);
for (const r of weak) {
  console.log("---");
  console.log("title:", r.title);
  console.log("legacy:", r.legacy_len, r.legacy_desc);
  console.log("view:", r.view_len, r.view_desc);
}

const seedAll = await c.query(
  `
  select sd.cycle_instance_id, ci.starts_on, sd.title, length(sd.description) len, left(sd.description, 80) d
  from app.strategic_directions sd
  join app.cycle_instances ci on ci.id = sd.cycle_instance_id
  where sd.organization_id=$1 and sd.title like '[Seed]%'
  order by ci.starts_on desc, sd.title`,
  [org.id]
);
console.log(`\n[Seed] directions all cycles: ${seedAll.rows.length}`);
for (const r of seedAll.rows) console.log(r);

const badAll = await c.query(
  `
  select sd.cycle_instance_id, sd.title, length(sd.description) len, left(sd.description, 80) d,
         left(v.description, 80) view_d, length(v.description) view_len
  from app.strategic_directions sd
  left join app.v_current_strategy_objects v on v.revision_id = sd.id
  where sd.organization_id=$1
    and (sd.description ilike 'Demo:%' or sd.description = sd.title
         or coalesce(length(sd.description),0) < 80
         or coalesce(length(v.description),0) < 80)
  order by sd.title`,
  [org.id]
);
console.log(`\nWeak dirs all cycles: ${badAll.rows.length}`);
for (const r of badAll.rows) console.log(r);

const viewBad = await c.query(
  `
  select cycle_instance_id, title, left(description, 80) d, length(description) len
  from app.v_current_strategy_objects
  where organization_id=$1 and object_type='strategic_direction'
    and (title like '[Seed]%' or description ilike 'Demo:%' or description = title or length(description) < 80)
  order by title`,
  [org.id]
);
console.log(`\nWeak in v_current (all cycles): ${viewBad.rows.length}`);
for (const r of viewBad.rows) console.log(r);

const allTitles = await c.query(
  `select title, length(description) len, left(description, 100) d
   from app.strategic_directions where organization_id=$1 and cycle_instance_id=$2 order by title`,
  [org.id, ci.id]
);
console.log(`\nAll ${allTitles.rows.length} directions on active cycle:`);
allTitles.rows.forEach((r) => console.log(`  [${r.len}] ${r.title}`));

await c.end();
