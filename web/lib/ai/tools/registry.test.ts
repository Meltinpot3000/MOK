import { describe, expect, it } from "vitest";

import {
  getToolByName,
  listAllTools,
  listToolsForPrompt,
} from "./registry";

/** Alle Capabilities, die mindestens ein registriertes Tool verlangt. */
const ALL_REQUIRED_CAPS = new Set(
  listAllTools().flatMap((t) => t.requiredCapabilities)
);

describe("AI tool registry (smoke)", () => {
  it("hat eindeutige Tool-Namen und mindestens die erwarteten OKR-Tools", () => {
    const tools = listAllTools();
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("get_visible_okr_objectives");
    expect(names).toContain("get_current_okr_cycle");
    expect(names).toContain("calculate_okr_risk_signals");
    expect(tools.length).toBeGreaterThanOrEqual(8);
  });

  it("getToolByName findet bekannte Tools und null bei Unbekannt", () => {
    expect(getToolByName("get_current_user_context")?.domain).toBe("organization");
    expect(getToolByName("__no_such_tool__")).toBeNull();
  });

  it("listToolsForPrompt filtert ohne Capabilities leer", () => {
    expect(listToolsForPrompt({ capabilities: new Set() })).toEqual([]);
  });

  it("listToolsForPrompt mit vollem Cap-Set liefert alle Tools", () => {
    const listed = listToolsForPrompt({
      capabilities: ALL_REQUIRED_CAPS,
      maxTools: 99,
    });
    expect(listed.length).toBe(listAllTools().length);
  });

  it("listToolsForPrompt respektiert maxTools", () => {
    const listed = listToolsForPrompt({
      capabilities: ALL_REQUIRED_CAPS,
      maxTools: 3,
    });
    expect(listed.length).toBe(3);
  });

  it("listToolsForPrompt bevorzugt per domainHints passende Domains (OKR zuerst)", () => {
    const listed = listToolsForPrompt({
      capabilities: ALL_REQUIRED_CAPS,
      maxTools: 12,
      domainHints: ["okr"],
    });
    expect(listed.length).toBeGreaterThan(0);
    expect(listed[0]?.domain).toBe("okr");
  });
});
