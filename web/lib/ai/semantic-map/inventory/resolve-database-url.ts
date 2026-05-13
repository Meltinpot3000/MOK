import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildSupabaseSessionPoolerUrl } from "./build-supabase-pooler-url";

function parseEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(filePath)) return out;
  for (const raw of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    out[key] = line.slice(idx + 1).trim();
  }
  return out;
}

function getRepoRootForEnvMerge(cwd: string): string {
  const pkgPath = resolve(cwd, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const name = JSON.parse(readFileSync(pkgPath, "utf8")).name as string | undefined;
      if (name === "web") return resolve(cwd, "..");
    } catch {
      /* ignore */
    }
  }
  return cwd;
}

/**
 * Lädt .env / .env.local für Repo-Root und web/ — **dieselbe Reihenfolge wie** `scripts/run-dbmate.ts`
 * (Root zuerst, `web/.env.local` zuletzt, überschreibt frühere Keys).
 */
export function loadMergedDatabaseEnvFiles(): Record<string, string> {
  const repo = getRepoRootForEnvMerge(process.cwd());
  const web = resolve(repo, "web");
  return {
    ...parseEnvFile(resolve(repo, ".env")),
    ...parseEnvFile(resolve(repo, ".env.local")),
    ...parseEnvFile(resolve(web, ".env")),
    ...parseEnvFile(resolve(web, ".env.local")),
  };
}

export type DatabaseUrlEnvSource =
  | "process.env.SUPABASE_POOLER_DB_URL"
  | "process.env.DATABASE_URL"
  | "process.env.DIRECT_URL"
  | "merged.SUPABASE_POOLER_DB_URL"
  | "merged.DATABASE_URL"
  | "merged.DIRECT_URL"
  | "composed(SUPABASE_DB_PASSWORD + NEXT_PUBLIC_SUPABASE_URL + SUPABASE_POOLER_HOST)"
  | "none";

export type ResolvedDatabaseUrlMeta = {
  url: string | null;
  envSource: DatabaseUrlEnvSource;
  connection: {
    host: string;
    port: string;
    database: string;
    user: string;
  } | null;
};

/** Nur Host/Port/DB/User — kein Passwort. */
export function describePostgresConnectionString(connectionString: string): {
  host: string;
  port: string;
  database: string;
  user: string;
} {
  const raw = connectionString.trim();
  const normalized = raw.replace(/^postgresql:/i, "http:");
  const u = new URL(normalized);
  const db = (u.pathname || "/postgres").replace(/^\//, "") || "postgres";
  return {
    host: u.hostname,
    port: u.port || "5432",
    database: db,
    user: decodeURIComponent(u.username || ""),
  };
}

/**
 * Gleiche Priorität wie bisher env.ts / dbmate: Process-Env zuerst (POOLER → DATABASE → DIRECT),
 * dann merged-Dateien, zuletzt zusammengesetzte Session-Pooler-URL.
 */
export function getResolvedDatabaseUrlMeta(): ResolvedDatabaseUrlMeta {
  const merged = loadMergedDatabaseEnvFiles();

  const candidates: Array<{ source: DatabaseUrlEnvSource; value: string | undefined }> = [
    { source: "process.env.SUPABASE_POOLER_DB_URL", value: process.env.SUPABASE_POOLER_DB_URL },
    { source: "process.env.DATABASE_URL", value: process.env.DATABASE_URL },
    { source: "process.env.DIRECT_URL", value: process.env.DIRECT_URL },
    { source: "merged.SUPABASE_POOLER_DB_URL", value: merged.SUPABASE_POOLER_DB_URL },
    { source: "merged.DATABASE_URL", value: merged.DATABASE_URL },
    { source: "merged.DIRECT_URL", value: merged.DIRECT_URL },
  ];

  for (const { source, value } of candidates) {
    const v = value?.trim();
    if (v) {
      return {
        url: v,
        envSource: source,
        connection: describePostgresConnectionString(v),
      };
    }
  }

  const composed = buildSupabaseSessionPoolerUrl({
    supabaseDbPassword:
      process.env.SUPABASE_DB_PASSWORD || merged.SUPABASE_DB_PASSWORD || "",
    nextPublicSupabaseUrl:
      process.env.NEXT_PUBLIC_SUPABASE_URL || merged.NEXT_PUBLIC_SUPABASE_URL || "",
    poolerHost: process.env.SUPABASE_POOLER_HOST || merged.SUPABASE_POOLER_HOST || "",
    poolerPort: process.env.SUPABASE_POOLER_PORT || merged.SUPABASE_POOLER_PORT,
  });

  if (composed) {
    return {
      url: composed,
      envSource: "composed(SUPABASE_DB_PASSWORD + NEXT_PUBLIC_SUPABASE_URL + SUPABASE_POOLER_HOST)",
      connection: describePostgresConnectionString(composed),
    };
  }

  return { url: null, envSource: "none", connection: null };
}

export function resolveDatabaseUrl(): string | null {
  return getResolvedDatabaseUrlMeta().url;
}

/** Eine Zeile stderr/stdout: Ziel-DB ohne Geheimnis (für Smoke, db:migrate, Diagnose). */
export function formatDatabaseTargetLogLine(prefix: string, meta: ResolvedDatabaseUrlMeta): string {
  if (!meta.url || !meta.connection) {
    return `${prefix} databaseUrlSource=${meta.envSource} (no URL resolved)`;
  }
  const c = meta.connection;
  return `${prefix} databaseUrlSource=${meta.envSource} host=${c.host} port=${c.port} database=${c.database} user=${c.user}`;
}
