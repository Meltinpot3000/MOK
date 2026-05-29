import { getProvider, type LlmProviderName } from "@/lib/llm/providers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { buildMapDraftWithLlm } from "./builder/build-map-draft";
import { resolveSemanticMapBuildScope } from "./inventory/build-scope";
import { collectFullSemanticSourceInventory } from "./inventory/collect-full-inventory";
import { resolveDatabaseUrl } from "./inventory/env";
import { buildCompactMapForPlanner } from "./runtime/build-compact-map-for-planner";
import { buildSemanticMapRuntimeDiagnostics } from "./diagnostics/semantic-map-diagnostics";
import { getActiveSemanticMapFromDb } from "./runtime/get-active-semantic-map";
import * as repo from "./storage/semantic-map-repository";
import type {
  BuildCompactMapOptions,
  ExecutableSemanticMap,
  SemanticMapDraftResult,
  SemanticMapPlace,
  SemanticMapQuestionResolution,
  SemanticMapRoad,
  SemanticMapSnapshot,
  SemanticMapValidationResult,
  SemanticMapValidationSummary,
} from "./types";
import { semanticMapQuestionResolutionSchema } from "./types";
import { validateMapDraft } from "./validation/validate-map-draft";

function requireAdmin() {
  const client = createSupabaseAdminClient();
  if (!client) {
    throw new Error(
      "Semantic Map: Supabase Admin Client nicht verfuegbar (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)."
    );
  }
  return client;
}

function resolveMapQuestionProvider(): LlmProviderName {
  const raw = (
    process.env.SEMANTIC_MAP_LLM_PROVIDER ??
    process.env.SENTINEL_LOCAL_LLM_PROVIDER ??
    "ollama"
  )
    .trim()
    .toLowerCase();
  if (raw === "openai_compat" || raw === "vllm") return "openai_compat";
  if (raw === "groq") return "groq";
  if (raw === "gemini") return "gemini";
  if (raw === "anthropic") return "anthropic";
  return "ollama";
}

export async function buildSemanticMapDraft(input: {
  organizationId?: string;
  triggeredByMembershipId?: string;
  model?: { provider: string; name: string };
  webRoot?: string;
  /** `full` oder `strategy`; Fallback: `AI_SEMANTIC_MAP_BUILD_SCOPE`. */
  scope?: string;
}): Promise<SemanticMapDraftResult> {
  const admin = requireAdmin();
  const dbUrl = resolveDatabaseUrl();
  if (!dbUrl) {
    throw new Error("buildSemanticMapDraft: DATABASE_URL / SUPABASE_POOLER_DB_URL fehlt.");
  }

  const scope = resolveSemanticMapBuildScope({
    scopeArg: input.scope ?? null,
    envScope: process.env.AI_SEMANTIC_MAP_BUILD_SCOPE,
  });

  const inventory = await collectFullSemanticSourceInventory({
    databaseUrl: dbUrl,
    organizationId: input.organizationId,
    webRoot: input.webRoot,
    scope,
  });

  const { id: runId } = await repo.insertMapRun(admin, {
    organization_id: input.organizationId ?? null,
    triggered_by_membership_id: input.triggeredByMembershipId ?? null,
    status: "drafting",
    model_provider: input.model?.provider ?? null,
    model_name: input.model?.name ?? null,
    schema_hash: inventory.schemaHash,
  });

  await repo.insertSourceInventoryRow(admin, {
    run_id: runId,
    inventory,
    schema_hash: inventory.schemaHash,
  });

  let draftResult: Awaited<ReturnType<typeof buildMapDraftWithLlm>>;
  try {
    const invJson = JSON.stringify(inventory);
    draftResult = await buildMapDraftWithLlm({
      inventoryJson: invJson,
      model: input.model,
      scope,
      inventoryTableCount: inventory.tables.length,
      inventoryToolCount: inventory.tools.length,
      inventoryUiRouteCount: inventory.uiRoutes.length,
      inventoryForeignKeyCount: inventory.foreignKeys.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await repo.updateMapRun(admin, runId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error: msg,
    });
    throw e;
  }

  const { id: draftId } = await repo.insertMapDraft(admin, {
    run_id: runId,
    draft: draftResult.draft,
    raw_llm_text: draftResult.rawText,
  });

  await repo.updateMapRun(admin, runId, {
    status: "completed",
    completed_at: new Date().toISOString(),
    model_provider: draftResult.provider,
    model_name: draftResult.model,
    schema_hash: inventory.schemaHash,
    error: null,
  });

  return {
    runId,
    draftId,
    draft: draftResult.draft,
    inventorySummary: {
      tables: inventory.tables.length,
      tools: inventory.tools.length,
      uiRoutes: inventory.uiRoutes.length,
      foreignKeys: inventory.foreignKeys.length,
    },
    modelProvider: draftResult.provider,
    modelName: draftResult.model,
    schemaHash: inventory.schemaHash,
  };
}

export async function validateSemanticMapDraft(input: {
  draftId: string;
}): Promise<SemanticMapValidationResult> {
  const admin = requireAdmin();
  const bundle = await repo.fetchRunForDraft(admin, input.draftId);
  if (!bundle?.draft) {
    throw new Error(`validateSemanticMapDraft: Draft ${input.draftId} nicht gefunden.`);
  }
  const runId = bundle.draft.run_id;
  await repo.updateMapRun(admin, runId, { status: "validating", completed_at: null, error: null });

  const inv = await repo.fetchInventoryForRun(admin, runId);
  if (!inv) {
    await repo.updateMapRun(admin, runId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error: "Kein Source Inventory fuer Run.",
    });
    throw new Error("validateSemanticMapDraft: Kein Inventory.");
  }

  const validated = validateMapDraft({ draft: bundle.draft.draft, inventory: inv });
  validated.draftId = input.draftId;
  validated.runId = runId;

  await repo.deleteMapGapsForDraft(admin, input.draftId);
  await repo.insertMapGaps(
    admin,
    validated.gaps.map((g) => ({
      draft_id: input.draftId,
      gap_type: g.gapType,
      detail: g.detail,
    }))
  );

  const summaryPayload = {
    ...validated.summary,
    placesPayload: validated.places,
    roadsPayload: validated.roads,
  };

  await repo.insertValidationResultRow(admin, {
    run_id: runId,
    draft_id: input.draftId,
    snapshot_id: null,
    passed: true,
    summary: summaryPayload,
  });

  await repo.markDraftValidated(admin, input.draftId);
  await repo.updateMapRun(admin, runId, {
    status: "completed",
    completed_at: new Date().toISOString(),
    error: null,
  });

  return validated;
}

export async function publishSemanticMapSnapshot(input: {
  runId: string;
  validatedDraftId: string;
}): Promise<SemanticMapSnapshot> {
  const admin = requireAdmin();
  const draft = await repo.fetchDraft(admin, input.validatedDraftId);
  if (!draft || draft.run_id !== input.runId) {
    throw new Error("publishSemanticMapSnapshot: Draft/Run Mismatch oder Draft fehlt.");
  }
  if (!draft.validated_at) {
    throw new Error(
      "publishSemanticMapSnapshot: Draft ist nicht validiert (validated_at fehlt). Bitte validateSemanticMapDraft ausfuehren."
    );
  }

  const latest = await repo.fetchLatestValidationForDraft(admin, input.validatedDraftId);
  if (!latest?.passed) {
    throw new Error("publishSemanticMapSnapshot: Keine erfolgreiche Validation fuer diesen Draft.");
  }

  const places = latest.summary.placesPayload as SemanticMapPlace[] | undefined;
  const roads = latest.summary.roadsPayload as SemanticMapRoad[] | undefined;
  if (!places || !roads) {
    throw new Error("publishSemanticMapSnapshot: Validation summary ohne places/roads Payload.");
  }

  const counts = latest.summary as SemanticMapValidationSummary & {
    placesPayload?: unknown;
    roadsPayload?: unknown;
  };

  const runRow = await repo.fetchMapRunForPublish(admin, input.runId);
  if (!runRow) {
    throw new Error(`publishSemanticMapSnapshot: Run ${input.runId} nicht gefunden.`);
  }
  const organization_id = runRow.organization_id;

  await repo.deactivateSnapshots(admin, organization_id);

  const publishPlaces = places.map((p) => ({
    ...p,
    id: crypto.randomUUID(),
    snapshotId: "",
  }));
  const publishRoads = roads.map((r) => ({
    ...r,
    id: crypto.randomUUID(),
    snapshotId: "",
  }));

  const gapRows = validatedGapsFromRoads(publishRoads);

  const validation_summary: SemanticMapValidationSummary = {
    places: counts.places,
    roads: counts.roads,
    gapsCount: gapRows.length,
  };

  const { snapshotId } = await repo.insertSnapshotBundle(admin, {
    run_id: input.runId,
    draft_id: input.validatedDraftId,
    organization_id,
    validation_summary,
    model_provider: runRow.model_provider,
    model_name: runRow.model_name,
    places: publishPlaces,
    roads: publishRoads,
    gapRows,
  });

  const snap = await repo.fetchSnapshotById(admin, snapshotId);
  if (!snap) {
    throw new Error("publishSemanticMapSnapshot: Snapshot nach Insert nicht lesbar.");
  }
  return snap;
}

function validatedGapsFromRoads(roads: SemanticMapRoad[]): Array<{
  gap_type: string;
  detail: Record<string, unknown>;
}> {
  const out: Array<{ gap_type: string; detail: Record<string, unknown> }> = [];
  for (const r of roads) {
    if (r.validationStatus === "missing_tool") {
      out.push({
        gap_type: "missing_tool_for_road",
        detail: { roadKey: r.roadKey, from: r.fromPlaceKey, to: r.toPlaceKey },
      });
    }
    if (r.validationStatus === "unsupported") {
      out.push({
        gap_type: "unsupported_road",
        detail: { roadKey: r.roadKey, from: r.fromPlaceKey, to: r.toPlaceKey },
      });
    }
  }
  return out;
}

export async function getActiveSemanticMap(input: {
  organizationId?: string;
}): Promise<ExecutableSemanticMap | null> {
  const admin = requireAdmin();
  return getActiveSemanticMapFromDb(admin, input.organizationId);
}

export async function inspectSemanticMap(input: {
  organizationId?: string;
}): Promise<{
  diagnostics: ReturnType<typeof buildSemanticMapRuntimeDiagnostics>;
  recentSnapshots: Awaited<ReturnType<typeof repo.listSnapshots>>;
  activeSnapshotId: string | null;
}> {
  const admin = requireAdmin();
  const map = await getActiveSemanticMapFromDb(admin, input.organizationId);
  const diagnostics = buildSemanticMapRuntimeDiagnostics(map);
  const recentSnapshots = await repo.listSnapshots(admin, 8);
  return {
    diagnostics,
    recentSnapshots,
    activeSnapshotId: map?.snapshotId ?? null,
  };
}

export async function resolveQuestionAgainstSemanticMap(input: {
  question: string;
  map: ExecutableSemanticMap;
  model?: { provider: string; name: string };
}): Promise<SemanticMapQuestionResolution> {
  const compact = buildCompactMapForPlanner({
    map: input.map,
    maxPlaces: 35,
    maxRoads: 50,
    options: { includeInferredRoadsInCompact: true },
  });
  const providerName = (input.model?.provider as LlmProviderName | undefined) ?? resolveMapQuestionProvider();
  const provider = getProvider(providerName);
  const model = input.model?.name?.trim() || provider.defaultModel;
  const userPrompt = [
    "Userfrage:",
    input.question,
    "",
    "Kompakte Semantic Map (JSON):",
    JSON.stringify(compact),
    "",
    "Antworte mit JSON gemaess Schema: konzeptbasierte Zuordnung zu placeKeys aus der Map.",
    "Kein Feld matchedTerms. Nutze nur placeKeys, die in der Map vorkommen.",
  ].join("\n");

  const result = await provider.generateJson({
    systemPrompt:
      "Du bist ein Query-Interpreter fuer eine validierte fachliche Semantic Map. " +
      "Ordne die Frage den relevanten Orten und benoetigten Verbindungen zu. " +
      "Antwort ausschliesslich als valides JSON.",
    userPrompt,
    schemaName: "semantic_map_question_resolution_v1",
    schema: semanticMapQuestionResolutionSchema,
    temperature: 0.1,
    maxOutputTokens: 1200,
    timeoutMs: Number(process.env.SEMANTIC_MAP_LLM_TIMEOUT_MS ?? 90000),
    model,
  });
  return result.data;
}
