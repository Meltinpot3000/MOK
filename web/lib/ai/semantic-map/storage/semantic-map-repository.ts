import type { SupabaseClient } from "@supabase/supabase-js";

import type { SemanticSourceInventory } from "../inventory/inventory-types";
import type {
  SemanticMapDraft,
  SemanticMapRoad,
  SemanticMapSnapshot,
  SemanticMapValidationSummary,
  SemanticMapPlace,
} from "../types";
import { getSentinelMapPool } from "./sentinel-map-db";

/** SupabaseClient bleibt in der Signatur (Aufrufer), wird für sentinel_map nicht genutzt — Zugriff nur per Postgres. */
type Db = SupabaseClient;

function j(row: unknown): string {
  return JSON.stringify(row ?? null);
}

export async function insertMapRun(
  _client: Db,
  row: {
    organization_id: string | null;
    triggered_by_membership_id: string | null;
    status: string;
    model_provider: string | null;
    model_name: string | null;
    schema_hash: string | null;
  }
): Promise<{ id: string }> {
  const pool = getSentinelMapPool();
  const r = await pool.query<{ id: string }>(
    `insert into sentinel_map.map_runs
      (organization_id, triggered_by_membership_id, status, model_provider, model_name, schema_hash)
     values ($1,$2,$3,$4,$5,$6)
     returning id`,
    [
      row.organization_id,
      row.triggered_by_membership_id,
      row.status,
      row.model_provider,
      row.model_name,
      row.schema_hash,
    ]
  );
  return { id: r.rows[0]!.id };
}

const MAP_RUN_PATCH_KEYS = [
  "status",
  "completed_at",
  "error",
  "model_provider",
  "model_name",
  "schema_hash",
] as const;

export async function updateMapRun(
  _client: Db,
  id: string,
  patch: Partial<{
    status: string;
    completed_at: string | null;
    error: string | null;
    model_provider: string | null;
    model_name: string | null;
    schema_hash: string | null;
  }>
) {
  const entries = (Object.entries(patch) as [string, unknown][]).filter(
    ([k, v]) => v !== undefined && (MAP_RUN_PATCH_KEYS as readonly string[]).includes(k)
  );
  if (!entries.length) return;
  const pool = getSentinelMapPool();
  const cols = entries.map(([k]) => k);
  const setSql = cols.map((c, i) => `${c} = $${i + 2}`).join(", ");
  const vals = [id, ...entries.map(([, v]) => v)];
  const r = await pool.query(`update sentinel_map.map_runs set ${setSql} where id = $1`, vals);
  if (r.rowCount === 0) {
    throw new Error(`updateMapRun: keine Zeile für id=${id}`);
  }
}

export async function insertSourceInventoryRow(
  _client: Db,
  row: { run_id: string; inventory: unknown; schema_hash: string | null }
) {
  const pool = getSentinelMapPool();
  const r = await pool.query(
    `insert into sentinel_map.source_inventory (run_id, inventory, schema_hash) values ($1, $2::jsonb, $3)`,
    [row.run_id, j(row.inventory), row.schema_hash]
  );
  if (r.rowCount === 0) throw new Error("insertSourceInventoryRow: insert fehlgeschlagen");
}

export async function insertMapDraft(
  _client: Db,
  row: { run_id: string; draft: SemanticMapDraft; raw_llm_text: string | null }
): Promise<{ id: string }> {
  const pool = getSentinelMapPool();
  const r = await pool.query<{ id: string }>(
    `insert into sentinel_map.map_drafts (run_id, draft, raw_llm_text) values ($1, $2::jsonb, $3) returning id`,
    [row.run_id, j(row.draft), row.raw_llm_text]
  );
  return { id: r.rows[0]!.id };
}

export async function markDraftValidated(_client: Db, draftId: string) {
  const pool = getSentinelMapPool();
  const r = await pool.query(
    `update sentinel_map.map_drafts set validated_at = now() where id = $1`,
    [draftId]
  );
  if (r.rowCount === 0) throw new Error(`markDraftValidated: keine Zeile für id=${draftId}`);
}

export async function insertValidationResultRow(
  _client: Db,
  row: {
    run_id: string | null;
    draft_id: string;
    snapshot_id: string | null;
    passed: boolean;
    summary: unknown;
  }
) {
  const pool = getSentinelMapPool();
  const r = await pool.query(
    `insert into sentinel_map.validation_results (run_id, draft_id, snapshot_id, passed, summary)
     values ($1,$2,$3,$4,$5::jsonb)`,
    [row.run_id, row.draft_id, row.snapshot_id, row.passed, j(row.summary)]
  );
  if (r.rowCount === 0) throw new Error("insertValidationResultRow: insert fehlgeschlagen");
}

export async function insertMapGaps(
  _client: Db,
  rows: Array<{ draft_id?: string | null; snapshot_id?: string | null; gap_type: string; detail: unknown }>
) {
  if (!rows.length) return;
  const pool = getSentinelMapPool();
  const c = await pool.connect();
  try {
    await c.query("begin");
    for (const g of rows) {
      await c.query(
        `insert into sentinel_map.map_gaps (draft_id, snapshot_id, gap_type, detail)
         values ($1,$2,$3,$4::jsonb)`,
        [g.draft_id ?? null, g.snapshot_id ?? null, g.gap_type, j(g.detail)]
      );
    }
    await c.query("commit");
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

export async function deleteMapGapsForDraft(_client: Db, draftId: string) {
  const pool = getSentinelMapPool();
  await pool.query(`delete from sentinel_map.map_gaps where draft_id = $1`, [draftId]);
}

export async function fetchDraft(_client: Db, draftId: string) {
  const pool = getSentinelMapPool();
  const r = await pool.query<{
    id: string;
    run_id: string;
    draft: SemanticMapDraft;
    validated_at: string | null;
    created_at: string;
  }>(
    `select id, run_id, draft, validated_at, created_at from sentinel_map.map_drafts where id = $1`,
    [draftId]
  );
  return r.rows[0] ?? null;
}

export async function fetchInventoryForRun(_client: Db, runId: string) {
  const pool = getSentinelMapPool();
  const r = await pool.query<{ inventory: unknown }>(
    `select inventory from sentinel_map.source_inventory where run_id = $1 limit 1`,
    [runId]
  );
  return (r.rows[0]?.inventory ?? null) as SemanticSourceInventory | null;
}

export async function fetchRunForDraft(_client: Db, draftId: string) {
  const draft = await fetchDraft(_client, draftId);
  if (!draft) return null;
  const pool = getSentinelMapPool();
  const r = await pool.query<{ id: string; organization_id: string | null }>(
    `select id, organization_id from sentinel_map.map_runs where id = $1`,
    [draft.run_id]
  );
  return { draft, run: r.rows[0] ?? null };
}

export async function deactivateSnapshots(_client: Db, organizationId: string | null) {
  const pool = getSentinelMapPool();
  if (organizationId === null) {
    await pool.query(
      `update sentinel_map.map_snapshots set is_active = false where is_active = true and organization_id is null`
    );
  } else {
    await pool.query(
      `update sentinel_map.map_snapshots set is_active = false where is_active = true and organization_id = $1`,
      [organizationId]
    );
  }
}

export async function insertSnapshotBundle(
  _client: Db,
  args: {
    run_id: string | null;
    draft_id: string | null;
    organization_id: string | null;
    validation_summary: SemanticMapValidationSummary;
    model_provider: string | null;
    model_name: string | null;
    places: SemanticMapPlace[];
    roads: SemanticMapRoad[];
    gapRows: Array<{ gap_type: string; detail: Record<string, unknown> }>;
  }
): Promise<{ snapshotId: string }> {
  const pool = getSentinelMapPool();
  const c = await pool.connect();
  try {
    await c.query("begin");
    const ins = await c.query<{ id: string }>(
      `insert into sentinel_map.map_snapshots
        (run_id, draft_id, organization_id, is_active, validation_summary, model_provider, model_name)
       values ($1,$2,$3,true,$4::jsonb,$5,$6)
       returning id`,
      [
        args.run_id,
        args.draft_id,
        args.organization_id,
        j(args.validation_summary),
        args.model_provider,
        args.model_name,
      ]
    );
    const snapshotId = ins.rows[0]!.id;

    for (const p of args.places) {
      await c.query(
        `insert into sentinel_map.map_places
          (snapshot_id, place_key, canonical_name, domain, business_meaning, description_for_planner, evidence, validation_status, confidence)
         values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`,
        [
          snapshotId,
          p.placeKey,
          p.canonicalName,
          p.domain,
          p.businessMeaning,
          p.descriptionForPlanner,
          j(p.evidence),
          p.validationStatus,
          p.confidence,
        ]
      );
    }
    for (const r of args.roads) {
      await c.query(
        `insert into sentinel_map.map_roads
          (snapshot_id, road_key, from_place_key, to_place_key, business_meaning, relation_type, evidence, validation_status, confidence)
         values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`,
        [
          snapshotId,
          r.roadKey,
          r.fromPlaceKey,
          r.toPlaceKey,
          r.businessMeaning,
          r.relationType,
          j(r.evidence),
          r.validationStatus,
          r.confidence,
        ]
      );
    }
    for (const g of args.gapRows) {
      await c.query(
        `insert into sentinel_map.map_gaps (snapshot_id, gap_type, detail) values ($1,$2,$3::jsonb)`,
        [snapshotId, g.gap_type, j(g.detail)]
      );
    }
    await c.query("commit");
    return { snapshotId };
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

export async function fetchActiveSnapshot(
  _client: Db,
  organizationId: string | undefined
): Promise<{ snapshot: Record<string, unknown>; places: unknown[]; roads: unknown[] } | null> {
  const pool = getSentinelMapPool();

  async function loadScoped(org: string) {
    const s = await pool.query(
      `select id, run_id, draft_id, organization_id, is_active, generated_at, validation_summary, model_provider, model_name
       from sentinel_map.map_snapshots
       where is_active = true and organization_id = $1
       limit 1`,
      [org]
    );
    return s.rows[0] ?? null;
  }

  async function loadGlobal() {
    const s = await pool.query(
      `select id, run_id, draft_id, organization_id, is_active, generated_at, validation_summary, model_provider, model_name
       from sentinel_map.map_snapshots
       where is_active = true and organization_id is null
       limit 1`
    );
    return s.rows[0] ?? null;
  }

  async function loadPlacesRoads(snap: Record<string, unknown>) {
    const sid = snap.id as string;
    const [pr, rr] = await Promise.all([
      pool.query(`select * from sentinel_map.map_places where snapshot_id = $1`, [sid]),
      pool.query(`select * from sentinel_map.map_roads where snapshot_id = $1`, [sid]),
    ]);
    return { snapshot: snap, places: pr.rows as unknown[], roads: rr.rows as unknown[] };
  }

  let snap: Record<string, unknown> | null = null;
  if (organizationId) {
    snap = (await loadScoped(organizationId)) as Record<string, unknown> | null;
    if (!snap) snap = (await loadGlobal()) as Record<string, unknown> | null;
  } else {
    snap = (await loadGlobal()) as Record<string, unknown> | null;
  }
  if (!snap) return null;
  return loadPlacesRoads(snap);
}

export async function fetchLatestValidationForDraft(_client: Db, draftId: string) {
  const pool = getSentinelMapPool();
  const r = await pool.query<{
    id: string;
    passed: boolean;
    summary: Record<string, unknown>;
    created_at: string;
  }>(
    `select id, passed, summary, created_at from sentinel_map.validation_results
     where draft_id = $1 order by created_at desc limit 1`,
    [draftId]
  );
  return r.rows[0] ?? null;
}

function mapSnapshotRow(row: Record<string, unknown>): SemanticMapSnapshot {
  return {
    id: row.id as string,
    runId: (row.run_id as string | null) ?? null,
    draftId: (row.draft_id as string | null) ?? null,
    organizationId: (row.organization_id as string | null) ?? null,
    isActive: Boolean(row.is_active),
    generatedAt: row.generated_at as string,
    validationSummary: row.validation_summary as SemanticMapValidationSummary,
    modelProvider: (row.model_provider as string | null) ?? null,
    modelName: (row.model_name as string | null) ?? null,
  };
}

export async function fetchMapRunForPublish(
  _client: Db,
  runId: string
): Promise<{
  organization_id: string | null;
  model_provider: string | null;
  model_name: string | null;
} | null> {
  const pool = getSentinelMapPool();
  const r = await pool.query<{
    organization_id: string | null;
    model_provider: string | null;
    model_name: string | null;
  }>(
    `select organization_id, model_provider, model_name from sentinel_map.map_runs where id = $1`,
    [runId]
  );
  return r.rows[0] ?? null;
}

export async function fetchSnapshotById(_client: Db, snapshotId: string): Promise<SemanticMapSnapshot | null> {
  const pool = getSentinelMapPool();
  const r = await pool.query(
    `select id, run_id, draft_id, organization_id, is_active, generated_at, validation_summary, model_provider, model_name
     from sentinel_map.map_snapshots where id = $1`,
    [snapshotId]
  );
  const row = r.rows[0] as Record<string, unknown> | undefined;
  return row ? mapSnapshotRow(row) : null;
}

export async function listSnapshots(_client: Db, limit = 10): Promise<SemanticMapSnapshot[]> {
  const pool = getSentinelMapPool();
  const r = await pool.query(
    `select id, run_id, draft_id, organization_id, is_active, generated_at, validation_summary, model_provider, model_name
     from sentinel_map.map_snapshots order by generated_at desc limit $1`,
    [limit]
  );
  return (r.rows as Record<string, unknown>[]).map(mapSnapshotRow);
}
