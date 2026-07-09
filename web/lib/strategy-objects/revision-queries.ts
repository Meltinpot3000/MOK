import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StrategyObjectRevisionRow, StrategyObjectRevisionState } from "./types";
type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mapRevisionRow(row: Record<string, unknown>): StrategyObjectRevisionRow | null {
  const identity = asRecord(row.strategy_object_identities);
  const objectType = identity.object_type;
  if (
    objectType !== "strategic_challenge" &&
    objectType !== "strategic_direction" &&
    objectType !== "strategic_objective"
  ) {
    return null;
  }
  return {
    id: String(row.id),
    object_identity_id: String(row.object_identity_id),
    organization_id: String(row.organization_id),
    cycle_instance_id: String(row.cycle_instance_id),
    revision_number: Number(row.revision_number),
    revision_state: row.revision_state as StrategyObjectRevisionState,
    title: String(row.title ?? ""),
    description: typeof row.description === "string" ? row.description : null,
    definition_payload: asRecord(row.definition_payload),
    definition_hash: String(row.definition_hash ?? ""),
    legacy_status: typeof row.legacy_status === "string" ? row.legacy_status : null,
    object_type: objectType,
  };
}

export async function fetchRevisionById(
  organizationId: string,
  revisionId: string,
  options: { supabase?: SupabaseClient } = {}
): Promise<StrategyObjectRevisionRow | null> {
  const supabase = options.supabase ?? (await createSupabaseServerClient());
  const { data, error } = await supabase
    .schema("app")
    .from("strategy_object_revisions")
    .select(
      "id, object_identity_id, organization_id, cycle_instance_id, revision_number, revision_state, title, description, definition_payload, definition_hash, legacy_status, strategy_object_identities(object_type)"
    )
    .eq("organization_id", organizationId)
    .eq("id", revisionId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[strategy-objects] fetchRevisionById", error.message);
    return null;
  }
  return mapRevisionRow(data as Record<string, unknown>);
}

export async function fetchOpenDraftForIdentity(
  organizationId: string,
  objectIdentityId: string,
  cycleInstanceId: string,
  options: { supabase?: SupabaseClient } = {}
): Promise<StrategyObjectRevisionRow | null> {
  const supabase = options.supabase ?? (await createSupabaseServerClient());
  const { data, error } = await supabase
    .schema("app")
    .from("strategy_object_revisions")
    .select(
      "id, object_identity_id, organization_id, cycle_instance_id, revision_number, revision_state, title, description, definition_payload, definition_hash, legacy_status, strategy_object_identities(object_type)"
    )
    .eq("organization_id", organizationId)
    .eq("object_identity_id", objectIdentityId)
    .eq("cycle_instance_id", cycleInstanceId)
    .in("revision_state", ["draft", "pending_approval"])
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[strategy-objects] fetchOpenDraftForIdentity", error.message);
    return null;
  }
  return mapRevisionRow(data as Record<string, unknown>);
}

export async function fetchOpenDraftsForCycle(
  organizationId: string,
  cycleInstanceId: string,
  options: { supabase?: SupabaseClient } = {}
): Promise<Record<string, StrategyObjectRevisionRow>> {
  const supabase = options.supabase ?? (await createSupabaseServerClient());
  const { data, error } = await supabase
    .schema("app")
    .from("strategy_object_revisions")
    .select(
      "id, object_identity_id, organization_id, cycle_instance_id, revision_number, revision_state, title, description, definition_payload, definition_hash, legacy_status, strategy_object_identities(object_type)"
    )
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .in("revision_state", ["draft", "pending_approval"])
    .order("revision_number", { ascending: false });

  if (error) {
    console.error("[strategy-objects] fetchOpenDraftsForCycle", error.message);
    return {};
  }

  const byIdentity: Record<string, StrategyObjectRevisionRow> = {};
  for (const row of data ?? []) {
    const mapped = mapRevisionRow(row as Record<string, unknown>);
    if (!mapped || byIdentity[mapped.object_identity_id]) continue;
    byIdentity[mapped.object_identity_id] = mapped;
  }
  return byIdentity;
}
