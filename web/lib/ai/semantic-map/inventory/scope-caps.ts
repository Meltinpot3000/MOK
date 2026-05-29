import type { SemanticMapBuildScope } from "./build-scope";
import {
  INVENTORY_JSON_MAX_CHARS,
  SAMPLE_PROFILE_MAX_DISTINCT_VALUES,
  SAMPLE_PROFILE_MAX_SAMPLE_TITLES,
  SAMPLE_PROFILE_MAX_TABLES,
  SCHEMA_INVENTORY_MAX_COLUMNS_PER_TABLE,
  SCHEMA_INVENTORY_MAX_FKS,
  SCHEMA_INVENTORY_MAX_TABLES,
  UI_INVENTORY_MAX_ROUTES,
} from "./caps";

export type InventoryScopeCaps = {
  maxTables: number;
  maxColumnsPerTable: number;
  maxForeignKeys: number;
  maxTools: number;
  maxUiRoutes: number;
  maxSampleTables: number;
  maxSampleDistinctValues: number;
  maxSampleTitles: number;
  maxPromptChars: number;
};

const FULL_CAPS: InventoryScopeCaps = {
  maxTables: SCHEMA_INVENTORY_MAX_TABLES,
  maxColumnsPerTable: SCHEMA_INVENTORY_MAX_COLUMNS_PER_TABLE,
  maxForeignKeys: SCHEMA_INVENTORY_MAX_FKS,
  maxTools: 200,
  maxUiRoutes: UI_INVENTORY_MAX_ROUTES,
  maxSampleTables: SAMPLE_PROFILE_MAX_TABLES,
  maxSampleDistinctValues: SAMPLE_PROFILE_MAX_DISTINCT_VALUES,
  maxSampleTitles: SAMPLE_PROFILE_MAX_SAMPLE_TITLES,
  maxPromptChars: INVENTORY_JSON_MAX_CHARS,
};

/** Kompaktes Inventory für lokale Ollama-Builds (Strategy/OKR). */
const STRATEGY_CAPS: InventoryScopeCaps = {
  maxTables: 12,
  maxColumnsPerTable: 12,
  maxForeignKeys: 48,
  maxTools: 8,
  maxUiRoutes: 16,
  maxSampleTables: 0,
  maxSampleDistinctValues: 0,
  maxSampleTitles: 0,
  maxPromptChars: 48_000,
};

export function getInventoryScopeCaps(scope: SemanticMapBuildScope): InventoryScopeCaps {
  return scope === "strategy" ? STRATEGY_CAPS : FULL_CAPS;
}
