import type { SemanticMapBuildScope } from "../inventory/build-scope";

export type SemanticMapBuildPreflight = {
  scope: SemanticMapBuildScope;
  inventoryTableCount: number;
  inventoryToolCount: number;
  inventoryUiRouteCount: number;
  inventoryForeignKeyCount: number;
  promptChars: number;
  model: string;
  provider: string;
  timeoutMs: number;
};

/** Vor LLM-Call auf stderr (keine Secrets). */
export function logSemanticMapBuildPreflight(p: SemanticMapBuildPreflight): void {
  console.error(
    `[semantic-map:build] scope=${p.scope} tables=${p.inventoryTableCount} tools=${p.inventoryToolCount} ` +
      `uiRoutes=${p.inventoryUiRouteCount} fks=${p.inventoryForeignKeyCount} promptChars=${p.promptChars} ` +
      `provider=${p.provider} model=${p.model} timeoutMs=${p.timeoutMs}`
  );
}
