/**
 * Diagnose: strategische Planungsobjekte in Legacy-Tabellen vs. Views
 *
 *   npm --prefix web run db:diagnose-strategy-objects
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFiles() {
  const roots = [process.cwd(), resolve(process.cwd(), "..")];
  const names = [".env.local", ".env"];
  for (const root of roots) {
    for (const name of names) {
      const p = resolve(root, name);
      if (!existsSync(p)) continue;
      for (const raw of readFileSync(p, "utf8").split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const idx = line.indexOf("=");
        if (idx <= 0) continue;
        const key = line.slice(0, idx).trim();
        if (!process.env[key]) {
          process.env[key] = line.slice(idx + 1).trim();
        }
      }
    }
  }
}

loadEnvFiles();

async function main() {
  const { formatDatabaseTargetLogLine, getResolvedDatabaseUrlMeta } = await import(
    "../lib/ai/semantic-map/inventory/resolve-database-url"
  );
  const { closeSentinelMapPoolForTests, getSentinelMapPool } = await import(
    "../lib/ai/semantic-map/storage/sentinel-map-db"
  );

  const meta = getResolvedDatabaseUrlMeta();
  console.log(formatDatabaseTargetLogLine("[diagnose-strategy-objects]", meta));
  if (!meta.url) {
    console.error(JSON.stringify({ ok: false, error: "no_database_url" }));
    process.exit(1);
  }

  const pool = getSentinelMapPool();
  try {
    const cycles = await pool.query<{
      id: string;
      name: string;
      code: string;
      legacy_planning_cycle_id: string | null;
    }>(
      `select id, name, code, legacy_planning_cycle_id
       from app.cycle_instances
       order by created_at desc
       limit 5`
    );

    const totals = await pool.query<{
      challenges: string;
      directions: string;
      objectives: string;
      revisions: string;
      current_view: string;
      draft_revisions: string;
    }>(
      `select
        (select count(*)::text from app.strategic_challenges) as challenges,
        (select count(*)::text from app.strategic_directions) as directions,
        (select count(*)::text from app.strategy_objectives) as objectives,
        (select count(*)::text from app.strategy_object_revisions) as revisions,
        (select count(*)::text from app.v_current_strategy_objects) as current_view,
        (select count(*)::text from app.strategy_object_revisions where revision_state = 'draft') as draft_revisions`
    );

    const perCycle = await pool.query<{
      cycle_id: string;
      cycle_name: string;
      level_no: number;
      start_date: string;
      end_date: string;
      is_active_scheme: boolean;
      challenges: string;
      directions: string;
      objectives: string;
      current_objectives: string;
    }>(
      `select
        ci.id as cycle_id,
        ci.name as cycle_name,
        ci.level_no,
        ci.starts_on::text as start_date,
        ci.ends_on::text as end_date,
        coalesce(cs.is_active, true) as is_active_scheme,
        (select count(*)::text from app.strategic_challenges c where c.cycle_instance_id = ci.id) as challenges,
        (select count(*)::text from app.strategic_directions d where d.cycle_instance_id = ci.id) as directions,
        (select count(*)::text from app.strategy_objectives o where o.cycle_instance_id = ci.id) as objectives,
        (select count(*)::text from app.v_current_strategy_objects v
          where v.cycle_instance_id = ci.id and v.object_type = 'strategic_objective') as current_objectives
       from app.cycle_instances ci
       left join app.cycle_schemes cs on cs.id = ci.cycle_scheme_id
       order by ci.created_at desc
       limit 8`
    );

    const nowMs = Date.now();
    const cycleRows = perCycle.rows.map((row) => ({
      ...row,
      inCurrentWindow:
        Date.parse(row.start_date) <= nowMs && nowMs < Date.parse(row.end_date),
    }));
    const activeScheme = cycleRows.filter((c) => c.is_active_scheme);
    const scope = activeScheme.length > 0 ? activeScheme : cycleRows;
    const current = scope
      .filter((c) => c.inCurrentWindow)
      .sort(
        (a, b) =>
          (b.level_no ?? 1) - (a.level_no ?? 1) ||
          Date.parse(b.start_date) - Date.parse(a.start_date)
      );
    const picked = current[0] ?? scope[0] ?? null;

    const viewExists = await pool.query<{ view_name: string }>(
      `select table_name as view_name
       from information_schema.views
       where table_schema = 'app' and table_name = 'v_current_strategy_objects'`
    );

    const l3WithData = "fdeb6ab9-5027-48fd-9d16-ab8358d82a9b";
    const tableCounts = await pool.query<{ table_name: string; count: string }>(
      `select 'analysis_entries' as table_name, count(*)::text from app.analysis_entries where cycle_instance_id = $1
       union all select 'strategic_challenges', count(*)::text from app.strategic_challenges where cycle_instance_id = $1
       union all select 'strategic_directions', count(*)::text from app.strategic_directions where cycle_instance_id = $1
       union all select 'strategy_objectives', count(*)::text from app.strategy_objectives where cycle_instance_id = $1
       union all select 'strategy_programs', count(*)::text from app.strategy_programs where cycle_instance_id = $1
       union all select 'initiatives', count(*)::text from app.initiatives where cycle_instance_id = $1
       union all select 'annual_targets', count(*)::text from app.annual_targets where cycle_instance_id = $1
       union all select 'okr_objectives', count(*)::text from app.okr_objectives o join app.okr_cycles oc on oc.id = o.okr_cycle_id where oc.cycle_instance_id = $1`,
      [l3WithData]
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          viewExists: viewExists.rows.length > 0,
          totals: totals.rows[0] ?? null,
          recentCycles: cycles.rows,
          perCycle: perCycle.rows,
          simulatedActiveCycle: picked
            ? {
                id: picked.cycle_id,
                name: picked.cycle_name,
                level_no: picked.level_no,
                objectives: picked.objectives,
                inCurrentWindow: picked.inCurrentWindow,
              }
            : null,
          misplacedOnL3Sample: tableCounts.rows,
        },
        null,
        2
      )
    );
  } finally {
    await closeSentinelMapPoolForTests();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
