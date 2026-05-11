/**
 * One-off / dev helper: resolve membership_id + user_id by email or name substring.
 * Usage: node scripts/lookup-member-by-name.mjs maissen
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

function loadEnv(key) {
  if (process.env[key]) return process.env[key];
  try {
    const envRaw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    const m = envRaw.match(new RegExp(`^${key}=(.+)$`, "m"));
    const raw = m?.[1]?.trim() ?? "";
    return raw.replace(/^["']|["']$/g, "");
  } catch {
    return "";
  }
}

const needle = (process.argv[2] || "").trim();
if (!needle) {
  console.error("Usage: node scripts/lookup-member-by-name.mjs <substring>");
  process.exit(1);
}

const url = loadEnv("DATABASE_URL") || loadEnv("SUPABASE_POOLER_DB_URL") || loadEnv("DIRECT_DATABASE_URL");
if (!url) {
  console.error("Missing DATABASE_URL / SUPABASE_POOLER_DB_URL in env or .env.local");
  process.exit(1);
}

const ssl = url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false };
const client = new pg.Client({ connectionString: url, ssl });
await client.connect();

const like = `%${needle}%`;
const { rows } = await client.query(
  `
  select
    om.id as membership_id,
    u.id as user_id,
    u.email,
    coalesce(
      nullif(trim(om.display_name), ''),
      nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(u.raw_user_meta_data->>'display_name'), '')
    ) as resolved_name,
    om.organization_id
  from auth.users u
  join app.organization_memberships om on om.user_id = u.id
  where
    u.email ilike $1
    or coalesce(om.display_name, '') ilike $1
    or coalesce(u.raw_user_meta_data->>'full_name', '') ilike $1
    or coalesce(u.raw_user_meta_data->>'display_name', '') ilike $1
  order by u.email
  `,
  [like]
);

console.log(JSON.stringify({ needle, count: rows.length, rows }, null, 2));
await client.end();
