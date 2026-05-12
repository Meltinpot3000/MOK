import type { SupabaseClient } from "@supabase/supabase-js";

import * as repo from "../storage/semantic-map-repository";
import type { ExecutableSemanticMap } from "../types";
import { toExecutableSemanticMap } from "./map-row-mappers";

export async function getActiveSemanticMapFromDb(
  client: SupabaseClient,
  organizationId?: string
): Promise<ExecutableSemanticMap | null> {
  const bundle = await repo.fetchActiveSnapshot(client, organizationId);
  if (!bundle) return null;
  return toExecutableSemanticMap({
    snapshot: bundle.snapshot,
    placeRows: bundle.places as Record<string, unknown>[],
    roadRows: bundle.roads as Record<string, unknown>[],
  });
}
