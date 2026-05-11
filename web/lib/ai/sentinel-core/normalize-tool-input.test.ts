import { describe, expect, it } from "vitest";

import type { AiUserContext, AssistantUiContext } from "@/lib/ai/types";
import { normalizeToolInput } from "./normalize-tool-input";

const userContext: AiUserContext = {
  userId: "11111111-1111-1111-1111-111111111111",
  organizationId: "22222222-2222-2222-2222-222222222222",
  organizationName: "Acme",
  membershipId: "33333333-3333-3333-3333-333333333333",
  roleCodes: ["org_admin"],
  permissionCodes: new Set(["nav.okr-workspace.read"]),
};

const uiContext: AssistantUiContext = {
  page: "/okr/planning",
  cycleId: "44444444-4444-4444-4444-444444444444",
  objectType: "okr_objective",
  objectId: "55555555-5555-5555-5555-555555555555",
  organizationUnitId: null,
};

describe("normalizeToolInput", () => {
  it("mapped Cycle/OrgScope-Aliase auf kanonische Werte", () => {
    const result = normalizeToolInput(
      { name: "get_visible_okr_objectives" },
      { cycle: "Aktueller Zyklus", organizationScope: "MY TEAM" },
      uiContext,
      userContext
    );
    expect(result.input.cycle).toBe("current");
    expect(result.input.organizationScope).toBe("team");
    expect(result.warnings.some((w) => w.field === "cycle")).toBe(true);
    expect(result.warnings.some((w) => w.field === "organizationScope")).toBe(true);
  });

  it("ergaenzt objectType/objectId/cycleId aus UI-Kontext", () => {
    const result = normalizeToolInput(
      { name: "get_okr_objective_context", requiresObjectId: true },
      {},
      uiContext,
      userContext
    );
    expect(result.input.objectType).toBe("okr_objective");
    expect(result.input.objectId).toBe(uiContext.objectId);
    expect(result.input.cycleId).toBe(uiContext.cycleId);
  });

  it("setzt organizationId aus User-Kontext", () => {
    const result = normalizeToolInput(
      { name: "get_visible_initiatives" },
      {},
      undefined,
      userContext
    );
    expect(result.input.organizationId).toBe(userContext.organizationId);
    expect(result.warnings.some((w) => w.field === "organizationId")).toBe(true);
  });

  it("ueberschreibt fremde organizationId mit User-Org", () => {
    const result = normalizeToolInput(
      { name: "x" },
      { organizationId: "00000000-0000-0000-0000-000000000000" },
      undefined,
      userContext
    );
    expect(result.input.organizationId).toBe(userContext.organizationId);
    expect(
      result.warnings.some(
        (w) => w.field === "organizationId" && w.reason === "overridden_to_user_organization"
      )
    ).toBe(true);
  });

  it("droppt unaufloesbare organizationUnitId-Namen", () => {
    const result = normalizeToolInput(
      { name: "x" },
      { organizationUnitId: "Vertrieb DACH" },
      undefined,
      userContext
    );
    expect(result.input.organizationUnitId).toBeNull();
    expect(result.warnings.some((w) => w.reason === "unresolved_name_dropped")).toBe(true);
  });
});
