/**
 * Setzt das Passwort eines Supabase-Auth-Users (Admin API, Service Role).
 *
 * Nutzung im Ordner web/:
 *   node ./scripts/set-auth-user-password.mjs --email user@firma.de
 *   (Passwort wird abgefragt, sofern nicht per Umgebungsvariable gesetzt)
 *
 * Oder ohne Prompt in der Shell (Vorsicht: kann in der Shell-Historie landen):
 *   set AUTH_SET_PASSWORD=Geheim123&& node ./scripts/set-auth-user-password.mjs --email user@firma.de
 *
 * Unter PowerShell:
 *   $env:AUTH_SET_PASSWORD="Geheim123"; node ./scripts/set-auth-user-password.mjs --email user@firma.de
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as readline from "node:readline/promises";

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
  const out = { email: null, password: null };
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === "--email") {
      out.email = process.argv[++i]?.trim().toLowerCase() ?? null;
    } else if (a === "--password") {
      out.password = process.argv[++i] ?? null;
    }
  }
  return out;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(scriptDir, "..");
loadEnvFileIfPresent(path.join(webRoot, ".env.local"));
loadEnvFileIfPresent(path.join(webRoot, ".env"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

async function findUserIdByEmail(admin, email) {
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) {
      return hit.id;
    }
    if (users.length < perPage) {
      break;
    }
    page += 1;
  }
  return null;
}

async function main() {
  const { email: argEmail, password: argPassword } = parseArgs();
  const email = (argEmail || process.env.AUTH_SET_EMAIL)?.trim().toLowerCase();
  let password = argPassword || process.env.AUTH_SET_PASSWORD || null;

  if (!url || !serviceKey) {
    console.error("Fehlt NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY (z. B. in web/.env.local).");
    process.exit(1);
  }
  if (!email) {
    console.error("Bitte --email angeben oder AUTH_SET_EMAIL setzen.");
    process.exit(1);
  }

  if (!password) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question("Neues Passwort (Eingabe wird angezeigt): ");
    await rl.close();
  }

  if (!password || password.length < 8) {
    console.error("Passwort zu kurz oder leer (mindestens 8 Zeichen empfohlen).");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userId = await findUserIdByEmail(admin, email);
  if (!userId) {
    console.error(`Kein Auth-User mit E-Mail ${email} gefunden.`);
    process.exit(1);
  }

  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) {
    console.error("Supabase:", error.message);
    process.exit(1);
  }

  console.log(`Passwort fuer ${email} wurde aktualisiert.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
