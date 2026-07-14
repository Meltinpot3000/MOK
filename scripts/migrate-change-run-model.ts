/**
 * Change/Run-Migrationsreport und optionale Nachmigration (idempotent).
 *
 *   npx tsx scripts/migrate-change-run-model.ts
 *   npx tsx scripts/migrate-change-run-model.ts --org <uuid>
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFiles() {
  const roots = [process.cwd(), resolve(process.cwd(), "..")];
  for (const root of roots) {
    for (const name of [".env.local", ".env"]) {
      const p = resolve(root, name);
      if (!existsSync(p)) continue;
      for (const raw of readFileSync(p, "utf8").split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const idx = line.indexOf("=");
        if (idx <= 0) continue;
        const key = line.slice(0, idx).trim();
        if (!process.env[key]) process.env[key] = line.slice(idx + 1).trim();
      }
    }
  }
}

loadEnvFiles();

async function main() {
  const { formatDatabaseTargetLogLine, getResolvedDatabaseUrlMeta } = await import(
    "../web/lib/ai/semantic-map/inventory/resolve-database-url"
  );
  const { closeSentinelMapPoolForTests, getSentinelMapPool } = await import(
    "../web/lib/ai/semantic-map/storage/sentinel-map-db"
  );

  const orgArgIdx = process.argv.indexOf("--org");
  const orgFilter = orgArgIdx >= 0 ? process.argv[orgArgIdx + 1]?.trim() : null;

  const meta = getResolvedDatabaseUrlMeta();
  console.log(formatDatabaseTargetLogLine("[migrate-change-run-model]", meta));
  if (!meta.url) {
    console.error(JSON.stringify({ ok: false, error: "no_database_url" }));
    process.exit(1);
  }

  const pool = getSentinelMapPool();
  try {
    const issues = await pool.query<{
      issue_code: string;
      entity_type: string;
      count: string;
    }>(
      `select issue_code, entity_type, count(*)::text as count
       from app.change_run_migration_issues
       where ($1::uuid is null or organization_id = $1::uuid)
       group by issue_code, entity_type
       order by issue_code, entity_type`,
      [orgFilter ?? null]
    );

    const openInitiatives = await pool.query<{ count: string }>(
      `select count(*)::text as count
       from app.initiatives i
       where ($1::uuid is null or i.organization_id = $1::uuid)
         and i.program_id is null
         and i.status not in ('archived', 'completed')`,
      [orgFilter ?? null]
    );

    const runWithOkr = await pool.query<{ count: string }>(
      `select count(*)::text as count
       from app.annual_target_okr_objective_links l
       join app.annual_targets t on t.id = l.annual_target_id
       where ($1::uuid is null or t.organization_id = $1::uuid)
         and t.strategy_program_id is null`,
      [orgFilter ?? null]
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          organizationFilter: orgFilter ?? null,
          summary: {
            openInitiativesWithoutProgram: Number(openInitiatives.rows[0]?.count ?? 0),
            runAnnualTargetsWithOkrLinks: Number(runWithOkr.rows[0]?.count ?? 0),
          },
          migrationIssues: issues.rows.map((r) => ({
            issueCode: r.issue_code,
            entityType: r.entity_type,
            count: Number(r.count),
          })),
        },
        null,
        2
      )
    );
  } finally {
    await closeSentinelMapPoolForTests();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
