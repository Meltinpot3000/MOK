import { describe, expect, it } from "vitest";

import {
  getReadPermissionCode,
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

  it("hat keine doppelten IDs oder hrefs", () => {
    const ids = SIDEBAR_ITEMS.map((i) => i.id);
    const hrefs = SIDEBAR_ITEMS.map((i) => i.href);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(SIDEBAR_ITEM_IDS).toEqual(ids);
  });
});
