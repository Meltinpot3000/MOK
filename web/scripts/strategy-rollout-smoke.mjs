import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";

function loadEnvFileIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function pass(msg) {
  console.log(`PASS ${msg}`);
}

function fail(msg) {
  console.error(`FAIL ${msg}`);
}

async function main() {
  loadEnvFileIfPresent(path.resolve(process.cwd(), ".env.local"));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL fehlt.");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const checks = [
      "app.strategic_metrics",
      "app.strategic_challenges",
      "app.strategic_directions",
      "app.annual_targets",
      "app.initiatives",
      "app.okr_cycles",
      "app.analysis_entries",
      "app.analysis_item_link_draft",
      "app.analysis_item_link",
      "app.analysis_clusters",
      "app.analysis_cluster_members",
      "app.analysis_gap_findings",
      "app.industries",
      "app.business_models",
      "app.operating_models",
      "app.business_model_industries",
      "app.operating_model_industries",
      "app.operating_model_business_models",
      "app.strategic_direction_industries",
      "app.strategic_direction_business_models",
      "app.strategic_direction_operating_models",
      "app.annual_target_industries",
      "app.annual_target_business_models",
      "app.annual_target_operating_models",
      "app.initiative_industries",
      "app.initiative_business_models",
      "app.initiative_operating_models",
      "app.objective_industries",
      "app.objective_business_models",
      "app.objective_operating_models",
      "app.key_result_industries",
      "app.key_result_business_models",
      "app.key_result_operating_models",
      "app.challenge_direction_links",
      "app.initiative_target_links",
      "app.objective_target_links",
      "app.objective_direction_links",
      "app.key_result_target_links",
      "app.okr_updates",
      "app.okr_reviews",
    ];

    for (const fullName of checks) {
      const result = await client.query("select to_regclass($1) as regclass", [fullName]);
      if (result.rows[0]?.regclass) {
        pass(`Tabelle vorhanden: ${fullName}`);
      } else {
        fail(`Tabelle fehlt: ${fullName}`);
      }
    }

    const permissions = await client.query(
      `
      select count(*)::int as count
      from rbac.permissions
      where code in ('metric.read','metric.write','initiative.read','initiative.write','okr.read','okr.write','traceability.read','traceability.write')
      `
    );
    if (permissions.rows[0].count === 8) {
      pass("Neue Permission-Codes vorhanden");
    } else {
      fail(`Permission-Codes unvollstaendig (${permissions.rows[0].count}/8)`);
    }

    const dimensionPermissions = await client.query(
      `
      select count(*)::int as count
      from rbac.permissions
      where code in ('dimension.read','dimension.write','nav.industries.read','nav.industries.write','nav.business-models.read','nav.business-models.write','nav.operating-models.read','nav.operating-models.write')
      `
    );
    if (dimensionPermissions.rows[0].count === 8) {
      pass("Dimension-Permissions vorhanden");
    } else {
      fail(`Dimension-Permissions unvollstaendig (${dimensionPermissions.rows[0].count}/8)`);
    }

    const guardTriggers = await client.query(
      `
      select count(*)::int as count
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where not t.tgisinternal
        and n.nspname = 'app'
        and c.relname in ('objectives', 'key_results')
        and t.tgname in ('trg_objectives_require_context', 'trg_key_results_require_context')
      `
    );

    if (guardTriggers.rows[0].count === 2) {
      pass("Objective/KR-Guards aktiv");
    } else {
      fail(`Objective/KR-Guards fehlen (${guardTriggers.rows[0].count}/2)`);
    }

    const analysisNetworkRls = await client.query(
      `
      select count(*)::int as count
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'app'
        and c.relname in ('analysis_item_link_draft','analysis_item_link','analysis_clusters','analysis_cluster_members','analysis_gap_findings')
        and c.relrowsecurity = true
      `
    );
    if (analysisNetworkRls.rows[0].count === 5) {
      pass("RLS auf Analyse-Netzwerk-Tabellen aktiv");
    } else {
      fail(`RLS auf Analyse-Netzwerk unvollstaendig (${analysisNetworkRls.rows[0].count}/5)`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
