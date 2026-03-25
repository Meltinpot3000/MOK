/**
 * Liest Einladungs-, Membership- und Auth-Status zu einer E-Mail (einmaliger Check).
 *   node ./scripts/check-invitee-cleanup.mjs --email user@firma.ch
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";

function loadEnvFileIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const contents = fs.readFileSync(filePath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function parseArgs() {
  let email = null;
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === "--email") {
      email = process.argv[++i]?.trim().toLowerCase() ?? null;
    }
  }
  return { email };
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(scriptDir, "..");
loadEnvFileIfPresent(path.join(webRoot, ".env.local"));
loadEnvFileIfPresent(path.join(webRoot, ".env"));

const { email } = parseArgs();
if (!email) {
  console.error("Bitte --email angeben.");
  process.exit(1);
}

const databaseUrl =
  process.env.SUPABASE_POOLER_DB_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("SUPABASE_POOLER_DB_URL oder DATABASE_URL fehlt.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  const inv = await client.query(
    `select id, organization_id, invited_email, status, accepted_at, accepted_by_user_id, created_at, updated_at
     from app.member_invitations
     where lower(invited_email) = lower($1)
     order by created_at desc
     limit 10`,
    [email]
  );

  console.log("--- app.member_invitations (letzte 10) ---");
  console.log(JSON.stringify(inv.rows, null, 2));

  const authu = await client.query(
    `select id, email, created_at
     from auth.users
     where lower(email) = lower($1)`,
    [email]
  );

  console.log("--- auth.users ---");
  console.log(JSON.stringify(authu.rows, null, 2));

  const uid = authu.rows[0]?.id;
  if (uid) {
    const mem = await client.query(
      `select id, organization_id, user_id, status, title
       from app.organization_memberships
       where user_id = $1`,
      [uid]
    );
    console.log("--- app.organization_memberships (user_id) ---");
    console.log(JSON.stringify(mem.rows, null, 2));

    const mr = await client.query(
      `select mr.membership_id, mr.role_id
       from rbac.member_roles mr
       join app.organization_memberships m on m.id = mr.membership_id
       where m.user_id = $1`,
      [uid]
    );
    console.log("--- rbac.member_roles (this user) ---");
    console.log(JSON.stringify(mr.rows, null, 2));
  } else {
    console.log("--- Kein auth.users-Eintrag: keine Memberships/Rollen pruefbar per user_id ---");
  }
} finally {
  await client.end();
}
