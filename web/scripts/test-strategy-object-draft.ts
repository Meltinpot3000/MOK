import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

for (const root of [process.cwd(), resolve(process.cwd(), "..")]) {
  for (const name of [".env.local", ".env"]) {
    const p = resolve(root, name);
    if (!existsSync(p)) continue;
    for (const raw of readFileSync(p, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i <= 0) continue;
      const key = line.slice(0, i).trim();
      if (!process.env[key]) process.env[key] = line.slice(i + 1).trim();
    }
  }
}

async function main() {
  const { getSentinelMapPool, closeSentinelMapPoolForTests } = await import(
    "../lib/ai/semantic-map/storage/sentinel-map-db.ts"
  );
  const pool = getSentinelMapPool();

  const ext = await pool.query(
    `select n.nspname, p.proname
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where p.proname = 'digest' and pg_get_function_identity_arguments(p.oid) like '%bytea%'
     order by n.nspname`
  );
  console.log("digest functions", ext.rows);

  const hash = await pool.query(
    `select app.strategy_object_definition_hash('strategic_objective', 'Test', null, '{}'::jsonb) as h`
  );
  console.log("hash ok", hash.rows[0]);

  await pool.query("set search_path = app, public, rbac");
  try {
    const hashRpcPath = await pool.query(
      `select app.strategy_object_definition_hash('strategic_objective', 'Test', null, '{}'::jsonb) as h`
    );
    console.log("hash under rpc search_path", hashRpcPath.rows[0]);
  } catch (e) {
    console.error("hash under rpc search_path FAIL", e instanceof Error ? e.message : e);
  }

  const rev = await pool.query<{ id: string }>(
    `select r.id from app.strategy_object_revisions r
     join app.strategy_object_identities i on i.id = r.object_identity_id
     where i.object_type = 'strategic_objective' and r.revision_state = 'current'
     limit 1`
  );
  if (rev.rows[0]) {
    const draft = await pool.query(
      `select app.create_strategy_object_draft($1::uuid) as id`,
      [rev.rows[0].id]
    );
    console.log("draft", draft.rows[0]);
  }

  await closeSentinelMapPoolForTests();
}

main().catch((e) => {
  console.error("FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
