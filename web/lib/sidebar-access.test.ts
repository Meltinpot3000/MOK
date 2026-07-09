import { describe, expect, it } from "vitest";

import {
  getReadPermissionCode,
  isPipNavItemActive,
  isSidebarNavItemActive,
  SIDEBAR_ITEM_IDS,
  SIDEBAR_ITEMS,
} from "./sidebar-access";

describe("Sidebar-Konfiguration (smoke)", () => {
  it("enthält Sentinel Assistant mit stabiler Route", () => {
    const ai = SIDEBAR_ITEMS.find((i) => i.id === "ai-assistant");
    expect(ai).toBeDefined();
    expect(ai?.href).toBe("/ai-assistant");
    expect(ai?.section).toBe("top");
  });

  it("mappt ai-assistant auf den erwarteten Permission-Code", () => {
    expect(getReadPermissionCode("ai-assistant")).toBe("nav.ai-assistant.read");
  });

  it("hat keine doppelten IDs", () => {
    const ids = SIDEBAR_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SIDEBAR_ITEM_IDS).toEqual(ids);
  });

  it("verlinkt Jahresziele auf den Jahresziele-Screen", () => {
    const annual = SIDEBAR_ITEMS.find((i) => i.id === "annual-targets");
    expect(annual?.href).toBe("/annual-targets");
  });

  it("markiert Programme und Initiativen getrennt im Strategiezyklus", () => {
    const programs = new URLSearchParams("l1=pips&l2=programme");
    const initiatives = new URLSearchParams("l1=pips&l2=initiativen");
    const programItem = { id: "programs" as const, href: "/strategy-cycle?l1=pips&l2=programme", label: "Programme" };
    const initiativeItem = {
      id: "pip-initiatives" as const,
      href: "/strategy-cycle?l1=pips&l2=initiativen",
      label: "Initiativen",
    };
    expect(isPipNavItemActive("/strategy-cycle", programs, programItem)).toBe(true);
    expect(isPipNavItemActive("/strategy-cycle", initiatives, initiativeItem)).toBe(true);
    expect(isPipNavItemActive("/strategy-cycle", programs, initiativeItem)).toBe(false);
  });

  it("trennt Strategiezyklus und Jahresziele bei Matrix-Tab", () => {
    const matrixTab = new URLSearchParams("l1=corporate-strategy&l2=strategy-matrix");
    const strategyCycle = SIDEBAR_ITEMS.find((i) => i.id === "strategy-cycle")!;
    const annualTargets = SIDEBAR_ITEMS.find((i) => i.id === "annual-targets")!;
    expect(isSidebarNavItemActive("/strategy-cycle", annualTargets, matrixTab)).toBe(true);
    expect(isSidebarNavItemActive("/strategy-cycle", strategyCycle, matrixTab)).toBe(false);
    expect(isSidebarNavItemActive("/strategy-matrix", annualTargets, matrixTab)).toBe(true);
  });
});
