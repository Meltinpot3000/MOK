import { describe, expect, it } from "vitest";

import {
  isStrategyScopeTable,
  isStrategyScopeTool,
  isStrategyScopeUiRoute,
  resolveSemanticMapBuildScope,
} from "./build-scope";
import { getInventoryScopeCaps } from "./scope-caps";

describe("semantic map build scope", () => {
  it("resolves strategy from arg or env", () => {
    expect(resolveSemanticMapBuildScope({ scopeArg: "strategy", envScope: null })).toBe("strategy");
    expect(resolveSemanticMapBuildScope({ scopeArg: null, envScope: "strategy" })).toBe("strategy");
    expect(resolveSemanticMapBuildScope({ scopeArg: null, envScope: "full" })).toBe("full");
  });

  it("filters known strategy tables and tools", () => {
    expect(isStrategyScopeTable("strategic_challenges")).toBe(true);
    expect(isStrategyScopeTable("okr_objectives")).toBe(true);
    expect(isStrategyScopeTable("ai_conversations")).toBe(false);
    expect(isStrategyScopeTool("get_current_okr_cycle")).toBe(true);
    expect(isStrategyScopeTool("get_visible_tasks_for_user")).toBe(false);
    expect(isStrategyScopeUiRoute("/okr/planning")).toBe(true);
    expect(isStrategyScopeUiRoute("/access-control")).toBe(false);
  });

  it("strategy caps are smaller than full", () => {
    const s = getInventoryScopeCaps("strategy");
    const f = getInventoryScopeCaps("full");
    expect(s.maxPromptChars).toBeLessThan(f.maxPromptChars);
    expect(s.maxTables).toBeLessThan(f.maxTables);
  });
});
