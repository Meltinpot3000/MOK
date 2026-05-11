/**
 * Resolve membership_id via Supabase Auth Admin + app.organization_memberships (no direct Postgres).
 * Usage: node scripts/resolve-member-via-supabase-api.mjs maissen
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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

const needle = (process.argv[2] || "").trim().toLowerCase();
if (!needle) {
  console.error("Usage: node scripts/resolve-member-via-supabase-api.mjs <email-or-name-substring>");
  process.exit(1);
}

const url = loadEnv("NEXT_PUBLIC_SUPABASE_URL");
const key = loadEnv("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.local)");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let page = 1;
const matches = [];
while (page <= 20) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) {
    console.error(JSON.stringify({ error: error.message }));
    process.exit(1);
  }
  const users = data?.users ?? [];
  if (users.length === 0) break;
  for (const u of users) {
    const email = (u.email ?? "").toLowerCase();
    const meta = u.user_metadata ?? {};
    const full = String(meta.full_name ?? meta.display_name ?? "").toLowerCase();
    if (email.includes(needle) || full.includes(needle)) {
      matches.push({
        user_id: u.id,
        email: u.email,
        full_name: meta.full_name ?? meta.display_name ?? null,
      });
    }
  }
  if (users.length < 1000) break;
  page += 1;
}

if (matches.length === 0) {
  console.log(JSON.stringify({ needle, users: [] }, null, 2));
  process.exit(0);
}

const enriched = [];
for (const m of matches) {
  const { data: rows, error: memErr } = await admin
    .schema("app")
    .from("organization_memberships")
    .select("id, organization_id, status, display_name")
    .eq("user_id", m.user_id);
  if (memErr) {
    enriched.push({ ...m, memberships_error: memErr.message });
    continue;
  }
  enriched.push({ ...m, memberships: rows ?? [] });
}

console.log(JSON.stringify({ needle, users: enriched }, null, 2));
