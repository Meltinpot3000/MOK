/**
 * Lokaler Pfad ohne LLM: Run + Fixture-Inventory + Fixture-Draft in sentinel_map.
 * Danach: validate → publish → inspect (IDs aus stdout).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { strategyLandscapeInventoryFixture } from "../lib/ai/semantic-map/__fixtures__/strategy-landscape-inventory.fixture";
import { strategyMapThreePlaceDraftFixture } from "../lib/ai/semantic-map/__fixtures__/strategy-map-draft.fixture";
import * as repo from "../lib/ai/semantic-map/storage/semantic-map-repository";
import { createSupabaseAdminClient } from "../lib/supabase/admin";

function loadEnvFiles() {
  const tryPaths = [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "..", ".env.local"),
    resolve(process.cwd(), "..", ".env"),
  ];
  for (const p of tryPaths) {
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

async function main() {
  loadEnvFiles();
  const admin = createSupabaseAdminClient();
  if (!admin) {
    console.error(JSON.stringify({ ok: false, error: "admin-client-unavailable" }));
    process.exit(1);
  }

  const inventory = strategyLandscapeInventoryFixture;
  const { id: runId } = await repo.insertMapRun(admin, {
    organization_id: null,
    triggered_by_membership_id: null,
    status: "drafting",
    model_provider: "fixture",
    model_name: "strategy-map-three-place",
    schema_hash: inventory.schemaHash,
  });

  await repo.insertSourceInventoryRow(admin, {
    run_id: runId,
    inventory,
    schema_hash: inventory.schemaHash,
  });

  const { id: draftId } = await repo.insertMapDraft(admin, {
    run_id: runId,
    draft: strategyMapThreePlaceDraftFixture,
    raw_llm_text: null,
  });

  await repo.updateMapRun(admin, runId, {
    status: "completed",
    completed_at: new Date().toISOString(),
    error: null,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        source: "fixture",
        runId,
        draftId,
        next: [
          `npm --prefix web run ai:semantic-map:validate -- --draft ${draftId}`,
          `npm --prefix web run ai:semantic-map:publish -- --run ${runId} --draft ${draftId}`,
        ],
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
