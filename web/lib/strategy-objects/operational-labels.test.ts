import { describe, expect, it } from "vitest";
import { formatStrategyObjectStandLabel } from "./operational-labels";
import type { StrategyObjectVersioningMeta } from "./types";

const baseVersioning = (
  overrides: Partial<StrategyObjectVersioningMeta> = {}
): StrategyObjectVersioningMeta => ({
  object_identity_id: "id-1",
  revision_id: "rev-1",
  revision_number: 1,
  revision_state: "current",
  identity_lifecycle_state: "active",
  ...overrides,
});

describe("formatStrategyObjectStandLabel", () => {
  it("zeigt kompakten Normalfall", () => {
    expect(formatStrategyObjectStandLabel(baseVersioning())).toBe("Aktiv (r1)");
  });

  it("zeigt offenen Entwurf", () => {
    expect(
      formatStrategyObjectStandLabel(baseVersioning(), {
        revision_number: 2,
        revision_state: "draft",
      })
    ).toBe("Aktiv · Entwurf r2 offen");
  });

  it("zeigt Portfolio-Abweichung", () => {
    expect(
      formatStrategyObjectStandLabel(
        baseVersioning({ identity_lifecycle_state: "retired", revision_number: 3 })
      )
    ).toBe("Stillgelegt (r3)");
  });
});
