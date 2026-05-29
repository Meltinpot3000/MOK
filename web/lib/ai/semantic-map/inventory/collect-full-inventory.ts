import { createHash } from "node:crypto";

import {
  isStrategyScopeTool,
  isStrategyScopeUiRoute,
  resolveSemanticMapBuildScope,
  STRATEGY_SCOPE_TABLE_NAMES,
  STRATEGY_SCOPE_TOOL_NAMES,
  type SemanticMapBuildScope,
} from "./build-scope";
import { collectSampleProfiles } from "./collect-sample-profile";
import { collectSchemaInventory } from "./collect-schema-inventory";
import { collectToolInventory } from "./collect-tool-inventory";
import { collectUiInventory } from "./collect-ui-inventory";
import { resolveDatabaseUrl } from "./env";
import type { SemanticSourceInventory } from "./inventory-types";
import { getInventoryScopeCaps } from "./scope-caps";

export type CollectFullInventoryOptions = {
  databaseUrl?: string | null;
  organizationId?: string;
  /** cwd fuer UI-Scan (Next `app/`-Ordner). */
  webRoot?: string;
  /** `full` (default) oder `strategy` — begrenztes Inventory fuer lokale LLM-Builds. */
  scope?: SemanticMapBuildScope | string | null;
};

export async function collectFullSemanticSourceInventory(
  options: CollectFullInventoryOptions = {}
): Promise<SemanticSourceInventory> {
  const databaseUrl = options.databaseUrl ?? resolveDatabaseUrl();
  if (!databaseUrl) {
    throw new Error(
      "collectFullSemanticSourceInventory: DATABASE_URL / SUPABASE_POOLER_DB_URL fehlt."
    );
  }

  const scope = resolveSemanticMapBuildScope({
    scopeArg: typeof options.scope === "string" ? options.scope : options.scope ?? null,
    envScope: process.env.AI_SEMANTIC_MAP_BUILD_SCOPE,
  });
  const caps = getInventoryScopeCaps(scope);

  const schema = await collectSchemaInventory({
    databaseUrl,
    maxTables: caps.maxTables,
    maxColumnsPerTable: caps.maxColumnsPerTable,
    maxForeignKeys: caps.maxForeignKeys,
    tableAllowlist: scope === "strategy" ? STRATEGY_SCOPE_TABLE_NAMES : null,
    maxViews: scope === "strategy" ? 0 : undefined,
    maxFunctions: scope === "strategy" ? 0 : undefined,
  });

  const tools = collectToolInventory({
    allowedToolNames: scope === "strategy" ? STRATEGY_SCOPE_TOOL_NAMES : null,
    maxTools: caps.maxTools,
  });

  const webRoot = options.webRoot ?? process.cwd();
  const uiRoutes = collectUiInventory(webRoot, {
    maxRoutes: caps.maxUiRoutes,
    pathFilter: scope === "strategy" ? isStrategyScopeUiRoute : undefined,
  });

  const sampleProfiles =
    caps.maxSampleTables > 0
      ? await collectSampleProfiles({
          databaseUrl,
          tables: schema.tables,
          organizationId: options.organizationId,
          maxTables: caps.maxSampleTables,
          maxDistinctValues: caps.maxSampleDistinctValues,
          maxSampleTitles: caps.maxSampleTitles,
        })
      : [];

  const collectedAt = new Date().toISOString();
  const body = {
    collectedAt,
    tables: schema.tables,
    foreignKeys: schema.foreignKeys,
    views: schema.views,
    functions: schema.functions,
    tools,
    uiRoutes,
    sampleProfiles,
  };
  const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 32);

  return {
    ...body,
    schemaHash: schema.schemaHash || hash,
  };
}
