export type SemanticMapBuildScope = "full" | "strategy";

/** Tabellen in `app.*` für Scope `strategy` (nur diese + verknüpfte FKs). */
export const STRATEGY_SCOPE_TABLE_NAMES = [
  "strategic_challenges",
  "strategy_challenges",
  "strategic_directions",
  "strategic_initiatives",
  "initiatives",
  "cycle_instances",
  "okr_cycles",
  "okr_objectives",
  "key_results",
  "initiative_key_result_links",
] as const;

/** Sentinel-Tools für Strategy-/OKR-Fragen (Planner-Evidence). */
export const STRATEGY_SCOPE_TOOL_NAMES = [
  "get_current_okr_cycle",
  "get_visible_okr_objectives",
  "get_key_results_for_objectives",
  "get_visible_initiatives",
  "get_okr_objective_owner_counts",
  "calculate_okr_risk_signals",
] as const;

const STRATEGY_UI_PATH_RE =
  /\/(strategy|okr|initiative|initiatives|challenge|planning|strategic)/i;

export function resolveSemanticMapBuildScope(
  input?: { scopeArg?: string | null; envScope?: string | null }
): SemanticMapBuildScope {
  const raw = (input?.scopeArg ?? input?.envScope ?? "full").trim().toLowerCase();
  return raw === "strategy" ? "strategy" : "full";
}

export function isStrategyScopeTable(tableName: string): boolean {
  const n = tableName.toLowerCase();
  return STRATEGY_SCOPE_TABLE_NAMES.some((t) => t === n);
}

export function isStrategyScopeTool(toolName: string): boolean {
  return (STRATEGY_SCOPE_TOOL_NAMES as readonly string[]).includes(toolName);
}

export function isStrategyScopeUiRoute(path: string): boolean {
  return STRATEGY_UI_PATH_RE.test(path);
}

export function filterTablesForScope<T extends { name: string }>(
  scope: SemanticMapBuildScope,
  tables: T[]
): T[] {
  if (scope !== "strategy") return tables;
  return tables.filter((t) => isStrategyScopeTable(t.name));
}

export function filterForeignKeysForScope(
  scope: SemanticMapBuildScope,
  fks: Array<{ sourceTableFull: string; targetTableFull: string }>,
  allowedTableNames: Set<string>
): typeof fks {
  if (scope !== "strategy") return fks;
  return fks.filter((fk) => {
    const src = fk.sourceTableFull.split(".")[1]?.toLowerCase();
    const tgt = fk.targetTableFull.split(".")[1]?.toLowerCase();
    return src && tgt && allowedTableNames.has(src) && allowedTableNames.has(tgt);
  });
}
