import { createHash } from "node:crypto";

import { collectSampleProfiles } from "./collect-sample-profile";
import { collectSchemaInventory } from "./collect-schema-inventory";
import { collectToolInventory } from "./collect-tool-inventory";
import { collectUiInventory } from "./collect-ui-inventory";
import { resolveDatabaseUrl } from "./env";
import type { SemanticSourceInventory } from "./inventory-types";

export type CollectFullInventoryOptions = {
  databaseUrl?: string | null;
  organizationId?: string;
  /** cwd fuer UI-Scan (Next `app/`-Ordner). */
  webRoot?: string;
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
  const schema = await collectSchemaInventory({ databaseUrl });
  const tools = collectToolInventory();
  const webRoot = options.webRoot ?? process.cwd();
  const uiRoutes = collectUiInventory(webRoot);
  const sampleProfiles = await collectSampleProfiles({
    databaseUrl,
    tables: schema.tables,
    organizationId: options.organizationId,
  });

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
