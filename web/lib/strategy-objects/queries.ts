import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  adaptOperationalRowToChallengeLegacy,
  adaptOperationalRowToDirectionLegacy,
  adaptOperationalRowToObjectiveLegacy,
} from "./adapters";
import { strategyObjectDefinitionHash } from "./definition-hash";
import { fetchOpenDraftsForCycle } from "./revision-queries";
import type {
  StrategyChallengeLegacyRow,
  StrategyDirectionLegacyRow,
  StrategyObjectiveLegacyRow,
  StrategyObjectOperationalRow,
  StrategyObjectType,
} from "./types";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type QueryOptions = {
  supabase?: SupabaseClient;
  legacyPlanningCycleId?: string | null;
};

function isMissingOperationalViewsError(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    (m.includes("v_current_strategy_objects") || m.includes("v_strategy_object_operational_status")) &&
    (m.includes("does not exist") || m.includes("schema cache") || m.includes("could not find"))
  );
}

function emptyPayload(): Record<string, unknown> {
  return {};
}

function mapLegacyStatusToOperationalStatus(status: string | null | undefined): StrategyObjectOperationalRow["operational_status"] {
  const s = (status ?? "").toLowerCase();
  if (s === "at_risk") return "at_risk";
  if (s === "completed" || s === "closed") return "completed";
  if (s === "on_hold") return "on_hold";
  if (s === "pending_approval") return "pending_approval";
  if (s === "archived") return "archived";
  if (s === "draft") return "active";
  return "active";
}

function mapLegacyToOperationalRow(
  objectType: StrategyObjectType,
  organizationId: string,
  cycleInstanceId: string,
  row: Record<string, unknown>
): StrategyObjectOperationalRow {
  const id = String(row.id);
  const createdAt = typeof row.created_at === "string" ? row.created_at : new Date(0).toISOString();
  const updatedAt = typeof row.updated_at === "string" ? row.updated_at : createdAt;
  const legacyStatus = typeof row.status === "string" ? row.status : null;
  let definitionPayload: Record<string, unknown> = emptyPayload();
  if (objectType === "strategic_challenge") {
    definitionPayload = {
      priority: row.priority ?? null,
      visibility: row.visibility ?? null,
      impact_score: row.impact_score ?? null,
      urgency_score: row.urgency_score ?? null,
      scope_score: row.scope_score ?? null,
      root_cause_score: row.root_cause_score ?? null,
      challenge_score: row.challenge_score ?? null,
      relevance_level: row.relevance_level ?? null,
      risk_level: row.risk_level ?? null,
      source_cluster_id: row.source_cluster_id ?? null,
      source_analysis_entry_id: row.source_analysis_entry_id ?? null,
      created_by_membership_id: row.created_by_membership_id ?? null,
      created_by_source: row.created_by_source ?? null,
    };
  } else if (objectType === "strategic_direction") {
    definitionPayload = {
      priority: row.priority ?? null,
      grouping: row.grouping ?? null,
      relevance_level: row.relevance_level ?? null,
      risk_level: row.risk_level ?? null,
      strategic_value_score: row.strategic_value_score ?? null,
      capability_fit_score: row.capability_fit_score ?? null,
      feasibility_score: row.feasibility_score ?? null,
    };
  } else {
    definitionPayload = {
      importance_score: row.importance_score ?? null,
      time_horizon: row.time_horizon ?? null,
      created_by_membership_id: row.created_by_membership_id ?? null,
      created_by_source: row.created_by_source ?? null,
      ai_evaluation: {
        clarity_score: row.ai_clarity_score ?? null,
        strategic_relevance_score: row.ai_strategic_relevance_score ?? null,
        feasibility_score: row.ai_feasibility_score ?? null,
        fit_to_company_score: row.ai_fit_to_company_score ?? null,
        confidence_score: row.ai_confidence_score ?? null,
        summary: row.ai_summary ?? null,
        issues_json: row.ai_issues_json ?? [],
        suggestion: row.ai_improvement_suggestion ?? null,
        objective_score: row.ai_objective_score ?? null,
        status: row.ai_evaluation_status ?? null,
        evaluated_at: row.ai_evaluated_at ?? null,
        evaluation_version: row.ai_evaluation_version ?? null,
        manual_override: row.ai_manual_override ?? null,
        manual_comment: row.ai_manual_comment ?? null,
        external_internal_classification: row.ai_external_internal_classification ?? null,
        short_long_term_classification: row.ai_short_long_term_classification ?? null,
        exploit_explore_classification: row.ai_exploit_explore_classification ?? null,
      },
    };
  }
  return {
    object_identity_id: id,
    organization_id: organizationId,
    cycle_instance_id: cycleInstanceId,
    object_type: objectType,
    identity_lifecycle_state: legacyStatus === "archived" ? "archived" : legacyStatus === "draft" ? "draft" : "active",
    revision_id: id,
    revision_number: 1,
    revision_state: legacyStatus === "pending_approval" ? "pending_approval" : "current",
    title: typeof row.title === "string" ? row.title : "",
    description: typeof row.description === "string" ? row.description : null,
    definition_payload: definitionPayload,
    definition_hash: "",
    legacy_status: legacyStatus,
    created_at: createdAt,
    updated_at: updatedAt,
    latest_review_decision: null,
    latest_operational_signal: null,
    latest_assessed_at: null,
    operational_status: mapLegacyStatusToOperationalStatus(legacyStatus),
  };
}

async function listOperationalFromViews(
  supabase: SupabaseClient,
  organizationId: string,
  cycleInstanceId: string,
  objectType: StrategyObjectType
): Promise<StrategyObjectOperationalRow[]> {
  const [currentResult, statusResult] = await Promise.all([
    supabase
      .schema("app")
      .from("v_current_strategy_objects")
      .select(
        "object_identity_id, organization_id, cycle_instance_id, object_type, identity_lifecycle_state, revision_id, revision_number, revision_state, title, description, definition_payload, definition_hash, legacy_status, created_by_membership_id, created_at, updated_at"
      )
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .eq("object_type", objectType),
    supabase
      .schema("app")
      .from("v_strategy_object_operational_status")
      .select(
        "object_identity_id, revision_id, latest_review_decision, latest_operational_signal, latest_assessed_at, operational_status"
      )
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .eq("object_type", objectType),
  ]);

  if (currentResult.error || statusResult.error) {
    const currentMsg = currentResult.error?.message;
    const statusMsg = statusResult.error?.message;
    if (isMissingOperationalViewsError(currentMsg) || isMissingOperationalViewsError(statusMsg)) {
      throw new Error("MISSING_OPERATIONAL_VIEWS");
    }
    if (currentMsg) console.error("[strategy-objects] v_current_strategy_objects", currentMsg);
    if (statusMsg) console.error("[strategy-objects] v_strategy_object_operational_status", statusMsg);
    return [];
  }

  const statusByRevisionId = new Map<string, Record<string, unknown>>();
  for (const row of statusResult.data ?? []) {
    const raw = row as Record<string, unknown>;
    const revisionId = typeof raw.revision_id === "string" ? raw.revision_id : "";
    if (!revisionId) continue;
    statusByRevisionId.set(revisionId, raw);
  }

  return (currentResult.data ?? []).map((row) => {
    const raw = row as Record<string, unknown>;
    const status = statusByRevisionId.get(String(raw.revision_id)) ?? {};
    return {
      object_identity_id: String(raw.object_identity_id),
      organization_id: String(raw.organization_id),
      cycle_instance_id: String(raw.cycle_instance_id),
      object_type: raw.object_type as StrategyObjectType,
      identity_lifecycle_state: raw.identity_lifecycle_state as StrategyObjectOperationalRow["identity_lifecycle_state"],
      revision_id: String(raw.revision_id),
      revision_number: Number(raw.revision_number ?? 1),
      revision_state: raw.revision_state as StrategyObjectOperationalRow["revision_state"],
      title: String(raw.title ?? ""),
      description: typeof raw.description === "string" ? raw.description : null,
      definition_payload:
        raw.definition_payload && typeof raw.definition_payload === "object"
          ? (raw.definition_payload as Record<string, unknown>)
          : {},
      definition_hash: typeof raw.definition_hash === "string" ? raw.definition_hash : "",
      legacy_status: typeof raw.legacy_status === "string" ? raw.legacy_status : null,
      created_by_membership_id:
        typeof raw.created_by_membership_id === "string" ? raw.created_by_membership_id : null,
      created_at: String(raw.created_at),
      updated_at: String(raw.updated_at),
      latest_review_decision:
        typeof status.latest_review_decision === "string"
          ? (status.latest_review_decision as StrategyObjectOperationalRow["latest_review_decision"])
          : null,
      latest_operational_signal:
        typeof status.latest_operational_signal === "string"
          ? (status.latest_operational_signal as StrategyObjectOperationalRow["latest_operational_signal"])
          : null,
      latest_assessed_at: typeof status.latest_assessed_at === "string" ? status.latest_assessed_at : null,
      operational_status:
        typeof status.operational_status === "string"
          ? (status.operational_status as StrategyObjectOperationalRow["operational_status"])
          : null,
    };
  });
}

async function listOperationalFromLegacy(
  supabase: SupabaseClient,
  organizationId: string,
  cycleInstanceId: string,
  objectType: StrategyObjectType,
  legacyPlanningCycleId?: string | null
): Promise<StrategyObjectOperationalRow[]> {
  if (objectType === "strategic_challenge") {
    const { data, error } = await supabase
      .schema("app")
      .from("strategic_challenges")
      .select(
        "id, title, description, source_analysis_entry_id, relevance_level, risk_level, impact_score, urgency_score, scope_score, root_cause_score, challenge_score, priority, visibility, source_cluster_id, created_by_membership_id, created_by_source, created_at, updated_at"
      )
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[strategy-objects] fallback strategic_challenges", error.message);
      return [];
    }
    return (data ?? []).map((row) =>
      mapLegacyToOperationalRow(objectType, organizationId, cycleInstanceId, row as Record<string, unknown>)
    );
  }

  if (objectType === "strategic_direction") {
    const { data, error } = await supabase
      .schema("app")
      .from("strategic_directions")
      .select(
        "id, title, description, priority, status, grouping, relevance_level, risk_level, strategic_value_score, capability_fit_score, feasibility_score, created_at, updated_at"
      )
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) {
      console.error("[strategy-objects] fallback strategic_directions", error.message);
      return [];
    }
    return (data ?? []).map((row) =>
      mapLegacyToOperationalRow(objectType, organizationId, cycleInstanceId, row as Record<string, unknown>)
    );
  }

  let query = supabase
    .schema("app")
    .from("strategy_objectives")
    .select(
      "id, title, description, importance_score, time_horizon, status, created_by_membership_id, created_by_source, ai_clarity_score, ai_strategic_relevance_score, ai_feasibility_score, ai_fit_to_company_score, ai_confidence_score, ai_external_internal_classification, ai_short_long_term_classification, ai_exploit_explore_classification, ai_issues_json, ai_improvement_suggestion, ai_summary, ai_objective_score, ai_evaluation_status, ai_evaluated_at, ai_evaluation_version, ai_manual_override, ai_manual_comment, created_at, updated_at"
    )
    .eq("organization_id", organizationId);
  if (legacyPlanningCycleId) {
    query = query.or(`cycle_instance_id.eq.${cycleInstanceId},cycle_id.eq.${legacyPlanningCycleId}`);
  } else {
    query = query.eq("cycle_instance_id", cycleInstanceId);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[strategy-objects] fallback strategy_objectives", error.message);
    return [];
  }
  return (data ?? []).map((row) =>
    mapLegacyToOperationalRow(objectType, organizationId, cycleInstanceId, row as Record<string, unknown>)
  );
}

/**
 * IDs aller vom Revisions-System verwalteten Revisionen (org + Zyklus). Legacy-Zeilen in
 * strategy_objectives/…, deren id einer dieser Revisionen entspricht, werden ausschließlich
 * über v_current_strategy_objects repräsentiert (aktuelle Fassung). Beim Promoten archivierte
 * Alt-Zeilen dürfen daher NICHT als zusätzliche Legacy-Zeilen erscheinen.
 */
async function fetchManagedRevisionIds(
  supabase: SupabaseClient,
  organizationId: string,
  cycleInstanceId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .schema("app")
    .from("strategy_object_revisions")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId);
  if (error) {
    if (!isMissingOperationalViewsError(error.message)) {
      console.error("[strategy-objects] strategy_object_revisions ids", error.message);
    }
    return new Set();
  }
  return new Set((data ?? []).map((row) => String((row as Record<string, unknown>).id)));
}

export async function listOperationalStrategyObjects(
  organizationId: string,
  cycleInstanceId: string,
  objectType: StrategyObjectType,
  options: QueryOptions = {}
): Promise<StrategyObjectOperationalRow[]> {
  const supabase = options.supabase ?? (await createSupabaseServerClient());
  try {
    const viewRows = await listOperationalFromViews(
      supabase,
      organizationId,
      cycleInstanceId,
      objectType
    );
    const legacyRows = await listOperationalFromLegacy(
      supabase,
      organizationId,
      cycleInstanceId,
      objectType,
      options.legacyPlanningCycleId
    );
    if (viewRows.length === 0) {
      return legacyRows;
    }
    const coveredRevisionIds = new Set(viewRows.map((row) => row.revision_id));
    const managedRevisionIds = await fetchManagedRevisionIds(
      supabase,
      organizationId,
      cycleInstanceId
    );
    const supplemental = legacyRows.filter(
      (row) =>
        !coveredRevisionIds.has(row.revision_id) && !managedRevisionIds.has(row.revision_id)
    );
    return [...viewRows, ...supplemental];
  } catch (error) {
    if (error instanceof Error && error.message === "MISSING_OPERATIONAL_VIEWS") {
      return listOperationalFromLegacy(
        supabase,
        organizationId,
        cycleInstanceId,
        objectType,
        options.legacyPlanningCycleId
      );
    }
    throw error;
  }
}

export async function fetchChallengesForCycle(
  organizationId: string,
  cycleInstanceId: string,
  options: QueryOptions = {}
): Promise<StrategyChallengeLegacyRow[]> {
  const rows = await listOperationalStrategyObjects(
    organizationId,
    cycleInstanceId,
    "strategic_challenge",
    options
  );
  const adapted = rows.map((row) => adaptOperationalRowToChallengeLegacy(row));
  return overlayLiveStrategyObjectCopy(
    adapted,
    organizationId,
    cycleInstanceId,
    "strategic_challenge",
    options
  );
}

export async function fetchDirectionsForCycle(
  organizationId: string,
  cycleInstanceId: string,
  options: QueryOptions = {}
): Promise<StrategyDirectionLegacyRow[]> {
  const rows = await listOperationalStrategyObjects(
    organizationId,
    cycleInstanceId,
    "strategic_direction",
    options
  );
  const adapted = rows.map((row) => adaptOperationalRowToDirectionLegacy(row));
  const withCopy = await overlayLiveStrategyObjectCopy(
    adapted,
    organizationId,
    cycleInstanceId,
    "strategic_direction",
    options
  );
  return overlayLiveDirectionGrouping(withCopy, organizationId, cycleInstanceId, options);
}

const LIVE_OBJECTIVE_AI_FIELDS = [
  "ai_clarity_score",
  "ai_strategic_relevance_score",
  "ai_feasibility_score",
  "ai_fit_to_company_score",
  "ai_confidence_score",
  "ai_external_internal_classification",
  "ai_short_long_term_classification",
  "ai_exploit_explore_classification",
  "ai_issues_json",
  "ai_improvement_suggestion",
  "ai_summary",
  "ai_objective_score",
  "ai_evaluation_status",
  "ai_evaluated_at",
  "ai_evaluation_version",
  "ai_manual_override",
  "ai_manual_comment",
] as const;

type StrategyObjectCopyOverlayRow = {
  id: string | null;
  title: string;
  description: string | null;
  versioning?: import("./types").StrategyObjectVersioningMeta;
};

/**
 * Seeds und Legacy-Schreibpfade aktualisieren oft `strategic_*` / `strategy_objectives`,
 * waehrend die UI aus `v_current_strategy_objects` (Revisions-Snapshot) liest.
 * Offene Entwuerfe haben Vorrang; sonst legen wir Titel und Beschreibung aus der
 * Legacy-Tabelle darueber (gleiche ID wie revision_id).
 */
async function overlayLiveStrategyObjectCopy<T extends StrategyObjectCopyOverlayRow>(
  rows: T[],
  organizationId: string,
  cycleInstanceId: string,
  objectType: StrategyObjectType,
  options: QueryOptions
): Promise<T[]> {
  const ids = rows.map((row) => row.id).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return rows;

  const legacyTable =
    objectType === "strategic_challenge"
      ? "strategic_challenges"
      : objectType === "strategic_direction"
        ? "strategic_directions"
        : "strategy_objectives";

  const supabase = options.supabase ?? (await createSupabaseServerClient());
  const [{ data: legacyRows, error: legacyError }, openDrafts] = await Promise.all([
    supabase
      .schema("app")
      .from(legacyTable)
      .select("id, title, description")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .in("id", ids),
    fetchOpenDraftsForCycle(organizationId, cycleInstanceId, { supabase }),
  ]);

  if (legacyError) {
    console.error("[strategy-objects] overlay live strategy object copy", legacyError.message);
  }

  const legacyById = new Map<string, { title: string; description: string | null }>();
  for (const row of legacyRows ?? []) {
    const rec = row as { id: string; title?: string; description?: string | null };
    legacyById.set(rec.id, {
      title: typeof rec.title === "string" ? rec.title : "",
      description: typeof rec.description === "string" ? rec.description : null,
    });
  }

  const draftByIdentity = new Map<string, { title: string; description: string | null }>();
  for (const draft of Object.values(openDrafts)) {
    if (draft.object_type !== objectType) continue;
    draftByIdentity.set(draft.object_identity_id, {
      title: draft.title,
      description: draft.description,
    });
  }

  return rows.map((row) => {
    const identityId = row.versioning?.object_identity_id;
    const draftCopy = identityId ? draftByIdentity.get(identityId) : undefined;
    if (draftCopy) {
      if (draftCopy.title === row.title && draftCopy.description === row.description) return row;
      return { ...row, title: draftCopy.title, description: draftCopy.description };
    }

    const legacy = row.id ? legacyById.get(row.id) : undefined;
    if (!legacy) return row;
    if (legacy.title === row.title && legacy.description === row.description) return row;
    return { ...row, title: legacy.title, description: legacy.description };
  });
}

/**
 * Die Sentinel-Bewertung wird in `strategy_objectives` geschrieben, waehrend die
 * Operational-Rows den AI-Snapshot aus `definition_payload.ai_evaluation` tragen.
 * Dieser Snapshot friert beim Anlegen einer Revision ein und spiegelt eine spaeter
 * ausgeloeste Neubewertung nicht wider. Damit die Tabelle die tatsaechlich aktuelle
 * Bewertung zeigt, legen wir die Live-Werte (per Revisions-/Legacy-ID) darueber.
 */
async function overlayLiveObjectiveEvaluations(
  rows: StrategyObjectiveLegacyRow[],
  organizationId: string,
  cycleInstanceId: string,
  options: QueryOptions
): Promise<StrategyObjectiveLegacyRow[]> {
  const ids = rows
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  if (ids.length === 0) return rows;
  const supabase = options.supabase ?? (await createSupabaseServerClient());
  const { data, error } = await supabase
    .schema("app")
    .from("strategy_objectives")
    .select(["id", ...LIVE_OBJECTIVE_AI_FIELDS].join(", "))
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .in("id", ids);
  if (error || !data) {
    if (error) console.error("[strategy-objects] overlay live objective ai", error.message);
    return rows;
  }
  const liveById = new Map<string, Record<string, unknown>>();
  for (const raw of data) {
    const rec = raw as Record<string, unknown>;
    if (typeof rec.id === "string") liveById.set(rec.id, rec);
  }
  return rows.map((row) => {
    const live = row.id ? liveById.get(row.id) : undefined;
    if (!live) return row;
    const merged: Record<string, unknown> = { ...row };
    for (const field of LIVE_OBJECTIVE_AI_FIELDS) {
      merged[field] = live[field] ?? null;
    }
    return merged as StrategyObjectiveLegacyRow;
  });
}

/**
 * Die Treemap liest grouping aus der aktuellen Revisions-View (`definition_payload`).
 * Gruppierungs-Updates landen teils in `strategic_directions` oder in offenen Entwürfen —
 * ohne Overlay bleibt die Anzeige leer, obwohl die Übernahme erfolgreich war.
 */
async function overlayLiveDirectionGrouping(
  rows: StrategyDirectionLegacyRow[],
  organizationId: string,
  cycleInstanceId: string,
  options: QueryOptions
): Promise<StrategyDirectionLegacyRow[]> {
  const ids = rows.map((row) => row.id).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return rows;

  const supabase = options.supabase ?? (await createSupabaseServerClient());
  const [{ data: legacyRows, error: legacyError }, openDrafts] = await Promise.all([
    supabase
      .schema("app")
      .from("strategic_directions")
      .select("id, grouping")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .in("id", ids),
    fetchOpenDraftsForCycle(organizationId, cycleInstanceId, { supabase }),
  ]);

  if (legacyError) {
    console.error("[strategy-objects] overlay live direction grouping", legacyError.message);
  }

  const groupingByLegacyId = new Map<string, string | null>();
  for (const row of legacyRows ?? []) {
    const rec = row as { id: string; grouping?: string | null };
    groupingByLegacyId.set(rec.id, typeof rec.grouping === "string" ? rec.grouping : null);
  }

  const groupingByIdentityFromDraft = new Map<string, string>();
  for (const draft of Object.values(openDrafts)) {
    if (draft.object_type !== "strategic_direction") continue;
    const grouping = draft.definition_payload.grouping;
    if (typeof grouping === "string" && grouping.trim()) {
      groupingByIdentityFromDraft.set(draft.object_identity_id, grouping.trim());
    }
  }

  return rows.map((row) => {
    const identityId = row.versioning?.object_identity_id;
    const draftGrouping = identityId ? groupingByIdentityFromDraft.get(identityId) : undefined;
    const legacyGrouping = row.id ? groupingByLegacyId.get(row.id) : undefined;
    const resolved =
      draftGrouping ??
      (legacyGrouping?.trim() ? legacyGrouping.trim() : null) ??
      (row.grouping?.trim() ? row.grouping.trim() : null);

    if (resolved === row.grouping) return row;
    return { ...row, grouping: resolved };
  });
}

export async function fetchObjectivesForCycle(
  organizationId: string,
  cycleInstanceId: string,
  options: QueryOptions = {}
): Promise<StrategyObjectiveLegacyRow[]> {
  const rows = await listOperationalStrategyObjects(
    organizationId,
    cycleInstanceId,
    "strategic_objective",
    options
  );
  const adapted = rows.map((row) => adaptOperationalRowToObjectiveLegacy(row));
  const withCopy = await overlayLiveStrategyObjectCopy(
    adapted,
    organizationId,
    cycleInstanceId,
    "strategic_objective",
    options
  );
  return overlayLiveObjectiveEvaluations(withCopy, organizationId, cycleInstanceId, options);
}

function operationalRowToVersioningMeta(
  row: StrategyObjectOperationalRow
): import("./types").StrategyObjectVersioningMeta {
  return {
    object_identity_id: row.object_identity_id,
    revision_id: row.revision_id,
    revision_number: row.revision_number,
    revision_state: row.revision_state,
    identity_lifecycle_state: row.identity_lifecycle_state,
    definition_hash: row.definition_hash,
    operational_status: row.operational_status,
    latest_review_decision: row.latest_review_decision,
    latest_operational_signal: row.latest_operational_signal,
    latest_assessed_at: row.latest_assessed_at,
  };
}

export async function fetchVersioningMetaForRevisionId(
  organizationId: string,
  cycleInstanceId: string,
  revisionId: string,
  options: QueryOptions = {}
): Promise<import("./types").StrategyObjectVersioningMeta | null> {
  const supabase = options.supabase ?? (await createSupabaseServerClient());
  try {
    const [currentResult, statusResult] = await Promise.all([
      supabase
        .schema("app")
        .from("v_current_strategy_objects")
        .select(
          "object_identity_id, organization_id, cycle_instance_id, object_type, identity_lifecycle_state, revision_id, revision_number, revision_state, title, description, definition_payload, definition_hash, legacy_status, created_by_membership_id, created_at, updated_at"
        )
        .eq("organization_id", organizationId)
        .eq("cycle_instance_id", cycleInstanceId)
        .eq("revision_id", revisionId)
        .maybeSingle(),
      supabase
        .schema("app")
        .from("v_strategy_object_operational_status")
        .select(
          "object_identity_id, revision_id, latest_review_decision, latest_operational_signal, latest_assessed_at, operational_status"
        )
        .eq("organization_id", organizationId)
        .eq("cycle_instance_id", cycleInstanceId)
        .eq("revision_id", revisionId)
        .maybeSingle(),
    ]);

    if (currentResult.error || !currentResult.data) {
      if (currentResult.error && !isMissingOperationalViewsError(currentResult.error.message)) {
        console.error("[strategy-objects] fetchVersioningMetaForRevisionId", currentResult.error.message);
      }
      return null;
    }

    const raw = currentResult.data as Record<string, unknown>;
    const status = (statusResult.data ?? {}) as Record<string, unknown>;
    const row: StrategyObjectOperationalRow = {
      object_identity_id: String(raw.object_identity_id),
      organization_id: String(raw.organization_id),
      cycle_instance_id: String(raw.cycle_instance_id),
      object_type: raw.object_type as StrategyObjectType,
      identity_lifecycle_state: raw.identity_lifecycle_state as StrategyObjectOperationalRow["identity_lifecycle_state"],
      revision_id: String(raw.revision_id),
      revision_number: Number(raw.revision_number ?? 1),
      revision_state: raw.revision_state as StrategyObjectOperationalRow["revision_state"],
      title: String(raw.title ?? ""),
      description: typeof raw.description === "string" ? raw.description : null,
      definition_payload:
        raw.definition_payload && typeof raw.definition_payload === "object"
          ? (raw.definition_payload as Record<string, unknown>)
          : {},
      definition_hash: typeof raw.definition_hash === "string" ? raw.definition_hash : "",
      legacy_status: typeof raw.legacy_status === "string" ? raw.legacy_status : null,
      created_by_membership_id:
        typeof raw.created_by_membership_id === "string" ? raw.created_by_membership_id : null,
      created_at: String(raw.created_at),
      updated_at: String(raw.updated_at),
      latest_review_decision:
        typeof status.latest_review_decision === "string"
          ? (status.latest_review_decision as StrategyObjectOperationalRow["latest_review_decision"])
          : null,
      latest_operational_signal:
        typeof status.latest_operational_signal === "string"
          ? (status.latest_operational_signal as StrategyObjectOperationalRow["latest_operational_signal"])
          : null,
      latest_assessed_at: typeof status.latest_assessed_at === "string" ? status.latest_assessed_at : null,
      operational_status:
        typeof status.operational_status === "string"
          ? (status.operational_status as StrategyObjectOperationalRow["operational_status"])
          : null,
    };
    return operationalRowToVersioningMeta(row);
  } catch (error) {
    if (error instanceof Error && error.message === "MISSING_OPERATIONAL_VIEWS") {
      return null;
    }
    throw error;
  }
}
