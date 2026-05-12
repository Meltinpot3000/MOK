import type { SupabaseClient } from "@supabase/supabase-js";

import type { SemanticSourceInventory } from "../inventory/inventory-types";
import type {
  SemanticMapDraft,
  SemanticMapRoad,
  SemanticMapSnapshot,
  SemanticMapValidationSummary,
  SemanticMapPlace,
} from "../types";

const SCHEMA = "sentinel_map" as const;

function db(client: SupabaseClient) {
  return client.schema(SCHEMA);
}

export async function insertMapRun(
  client: SupabaseClient,
  row: {
    organization_id: string | null;
    triggered_by_membership_id: string | null;
    status: string;
    model_provider: string | null;
    model_name: string | null;
    schema_hash: string | null;
  }
): Promise<{ id: string }> {
  const { data, error } = await db(client)
    .from("map_runs")
    .insert(row)
    .select("id")
    .single();
  if (error) throw new Error(`insertMapRun: ${error.message}`);
  return { id: data!.id as string };
}

export async function updateMapRun(
  client: SupabaseClient,
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
  const { error } = await db(client).from("map_runs").update(patch).eq("id", id);
  if (error) throw new Error(`updateMapRun: ${error.message}`);
}

export async function insertSourceInventoryRow(
  client: SupabaseClient,
  row: { run_id: string; inventory: unknown; schema_hash: string | null }
) {
  const { error } = await db(client).from("source_inventory").insert({
    run_id: row.run_id,
    inventory: row.inventory,
    schema_hash: row.schema_hash,
  });
  if (error) throw new Error(`insertSourceInventoryRow: ${error.message}`);
}

export async function insertMapDraft(
  client: SupabaseClient,
  row: { run_id: string; draft: SemanticMapDraft; raw_llm_text: string | null }
): Promise<{ id: string }> {
  const { data, error } = await db(client)
    .from("map_drafts")
    .insert({
      run_id: row.run_id,
      draft: row.draft,
      raw_llm_text: row.raw_llm_text,
    })
    .select("id")
    .single();
  if (error) throw new Error(`insertMapDraft: ${error.message}`);
  return { id: data!.id as string };
}

export async function markDraftValidated(client: SupabaseClient, draftId: string) {
  const { error } = await db(client)
    .from("map_drafts")
    .update({ validated_at: new Date().toISOString() })
    .eq("id", draftId);
  if (error) throw new Error(`markDraftValidated: ${error.message}`);
}

export async function insertValidationResultRow(
  client: SupabaseClient,
  row: {
    run_id: string | null;
    draft_id: string;
    snapshot_id: string | null;
    passed: boolean;
    summary: unknown;
  }
) {
  const { error } = await db(client).from("validation_results").insert(row);
  if (error) throw new Error(`insertValidationResultRow: ${error.message}`);
}

export async function insertMapGaps(
  client: SupabaseClient,
  rows: Array<{ draft_id?: string | null; snapshot_id?: string | null; gap_type: string; detail: unknown }>
) {
  if (!rows.length) return;
  const { error } = await db(client).from("map_gaps").insert(rows);
  if (error) throw new Error(`insertMapGaps: ${error.message}`);
}

export async function deleteMapGapsForDraft(client: SupabaseClient, draftId: string) {
  const { error } = await db(client).from("map_gaps").delete().eq("draft_id", draftId);
  if (error) throw new Error(`deleteMapGapsForDraft: ${error.message}`);
}

export async function fetchDraft(client: SupabaseClient, draftId: string) {
  const { data, error } = await db(client)
    .from("map_drafts")
    .select("id, run_id, draft, validated_at, created_at")
    .eq("id", draftId)
    .maybeSingle();
  if (error) throw new Error(`fetchDraft: ${error.message}`);
  return data as {
    id: string;
    run_id: string;
    draft: SemanticMapDraft;
    validated_at: string | null;
    created_at: string;
  } | null;
}

export async function fetchInventoryForRun(client: SupabaseClient, runId: string) {
  const { data, error } = await db(client)
    .from("source_inventory")
    .select("inventory")
    .eq("run_id", runId)
    .maybeSingle();
  if (error) throw new Error(`fetchInventoryForRun: ${error.message}`);
  return (data?.inventory ?? null) as SemanticSourceInventory | null;
}

export async function fetchRunForDraft(client: SupabaseClient, draftId: string) {
  const draft = await fetchDraft(client, draftId);
  if (!draft) return null;
  const { data, error } = await db(client)
    .from("map_runs")
    .select("id, organization_id")
    .eq("id", draft.run_id)
    .maybeSingle();
  if (error) throw new Error(`fetchRunForDraft: ${error.message}`);
  return { draft, run: data as { id: string; organization_id: string | null } | null };
}

export async function deactivateSnapshots(
  client: SupabaseClient,
  organizationId: string | null
) {
  const base = db(client).from("map_snapshots").update({ is_active: false }).eq("is_active", true);
  if (organizationId === null) {
    const { error } = await base.is("organization_id", null);
    if (error) throw new Error(`deactivateSnapshots: ${error.message}`);
  } else {
    const { error } = await base.eq("organization_id", organizationId);
    if (error) throw new Error(`deactivateSnapshots: ${error.message}`);
  }
}

export async function insertSnapshotBundle(
  client: SupabaseClient,
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
  const { data: snap, error: e1 } = await db(client)
    .from("map_snapshots")
    .insert({
      run_id: args.run_id,
      draft_id: args.draft_id,
      organization_id: args.organization_id,
      is_active: true,
      validation_summary: args.validation_summary,
      model_provider: args.model_provider,
      model_name: args.model_name,
    })
    .select("id")
    .single();
  if (e1) throw new Error(`insertSnapshotBundle snapshot: ${e1.message}`);
  const snapshotId = snap!.id as string;

  const placeRows = args.places.map((p) => ({
    snapshot_id: snapshotId,
    place_key: p.placeKey,
    canonical_name: p.canonicalName,
    domain: p.domain,
    business_meaning: p.businessMeaning,
    description_for_planner: p.descriptionForPlanner,
    evidence: p.evidence,
    validation_status: p.validationStatus,
    confidence: p.confidence,
  }));
  if (placeRows.length) {
    const { error: e2 } = await db(client).from("map_places").insert(placeRows);
    if (e2) throw new Error(`insertSnapshotBundle places: ${e2.message}`);
  }

  const roadRows = args.roads.map((r) => ({
    snapshot_id: snapshotId,
    road_key: r.roadKey,
    from_place_key: r.fromPlaceKey,
    to_place_key: r.toPlaceKey,
    business_meaning: r.businessMeaning,
    relation_type: r.relationType,
    evidence: r.evidence,
    validation_status: r.validationStatus,
    confidence: r.confidence,
  }));
  if (roadRows.length) {
    const { error: e3 } = await db(client).from("map_roads").insert(roadRows);
    if (e3) throw new Error(`insertSnapshotBundle roads: ${e3.message}`);
  }

  if (args.gapRows.length) {
    const { error: e4 } = await db(client).from("map_gaps").insert(
      args.gapRows.map((g) => ({
        snapshot_id: snapshotId,
        gap_type: g.gap_type,
        detail: g.detail,
      }))
    );
    if (e4) throw new Error(`insertSnapshotBundle gaps: ${e4.message}`);
  }

  return { snapshotId };
}

export async function fetchActiveSnapshot(
  client: SupabaseClient,
  organizationId: string | undefined
): Promise<{ snapshot: Record<string, unknown>; places: unknown[]; roads: unknown[] } | null> {
  async function load(whereOrg: "scoped" | "global") {
    let q = client
      .schema(SCHEMA)
      .from("map_snapshots")
      .select(
        "id, run_id, draft_id, organization_id, is_active, generated_at, validation_summary, model_provider, model_name"
      )
      .eq("is_active", true);
    if (whereOrg === "scoped" && organizationId) {
      q = q.eq("organization_id", organizationId);
    } else {
      q = q.is("organization_id", null);
    }
    const { data: snap, error } = await q.maybeSingle();
    if (error) throw new Error(`fetchActiveSnapshot: ${error.message}`);
    if (!snap) return null;
    const sid = snap.id as string;
    const { data: places, error: ep } = await client
      .schema(SCHEMA)
      .from("map_places")
      .select("*")
      .eq("snapshot_id", sid);
    if (ep) throw new Error(`fetchActiveSnapshot places: ${ep.message}`);
    const { data: roads, error: er } = await client
      .schema(SCHEMA)
      .from("map_roads")
      .select("*")
      .eq("snapshot_id", sid);
    if (er) throw new Error(`fetchActiveSnapshot roads: ${er.message}`);
    return { snapshot: snap as Record<string, unknown>, places: places ?? [], roads: roads ?? [] };
  }

  if (organizationId) {
    const scoped = await load("scoped");
    if (scoped) return scoped;
    return load("global");
  }
  return load("global");
}

export async function fetchLatestValidationForDraft(client: SupabaseClient, draftId: string) {
  const { data, error } = await db(client)
    .from("validation_results")
    .select("id, passed, summary, created_at")
    .eq("draft_id", draftId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`fetchLatestValidationForDraft: ${error.message}`);
  return data as { id: string; passed: boolean; summary: Record<string, unknown>; created_at: string } | null;
}

export async function listSnapshots(
  client: SupabaseClient,
  limit = 10
): Promise<SemanticMapSnapshot[]> {
  const { data, error } = await db(client)
    .from("map_snapshots")
    .select("id, run_id, draft_id, organization_id, is_active, generated_at, validation_summary, model_provider, model_name")
    .order("generated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listSnapshots: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    runId: (row.run_id as string | null) ?? null,
    draftId: (row.draft_id as string | null) ?? null,
    organizationId: (row.organization_id as string | null) ?? null,
    isActive: Boolean(row.is_active),
    generatedAt: row.generated_at as string,
    validationSummary: row.validation_summary as SemanticMapValidationSummary,
    modelProvider: (row.model_provider as string | null) ?? null,
    modelName: (row.model_name as string | null) ?? null,
  }));
}
