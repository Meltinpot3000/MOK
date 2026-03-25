/**
 * Setzt widerrufene Einladung(en) fuer eine E-Mail wieder auf «pending» (fuer Retests von «Widerrufen»).
 * Aus web/: node ./scripts/reset-invitation-pending.mjs --email person@firma.de
 * Optional: --organization-id <uuid> — nur diese Organisation.
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
  let organizationId = null;
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === "--email") {
      email = process.argv[++i]?.trim().toLowerCase() ?? null;
    } else if (a === "--organization-id") {
      organizationId = process.argv[++i]?.trim() ?? null;
    }
  }
  return { email, organizationId };
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(scriptDir, "..");
loadEnvFileIfPresent(path.join(webRoot, ".env.local"));
loadEnvFileIfPresent(path.join(webRoot, ".env"));

const { email, organizationId } = parseArgs();
if (!email) {
  console.error("Bitte --email angeben.");
  process.exit(1);
}

const databaseUrl =
  process.env.SUPABASE_POOLER_DB_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    "SUPABASE_POOLER_DB_URL oder DATABASE_URL in .env.local / .env setzen."
  );
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  const params = [email];
  let orgClause = "";
  if (organizationId) {
    orgClause = " and organization_id = $2::uuid";
    params.push(organizationId);
  }
  const { rows } = await client.query(
    `
    update app.member_invitations
    set status = 'pending',
        accepted_at = null,
        accepted_by_user_id = null,
        updated_at = now()
    where lower(invited_email) = lower($1)
      and status = 'revoked'
      ${orgClause}
    returning id, organization_id, invited_email, status
    `,
    params
  );
  if (rows.length === 0) {
    console.log("Keine widerrufene Einladung fuer diese E-Mail gefunden (ggf. schon pending).");
  } else {
    console.log("Zurueckgesetzt:", rows);
  }
} finally {
  await client.end();
}
