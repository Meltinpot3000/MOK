import { describe, expect, it } from "vitest";
import type { StrategyObjectVersioningMeta } from "@/lib/strategy-objects";
import {
  filterDirectionsForAnnualTargetSelect,
  filterProgramsForAnnualTargetSelect,
  isStrategicDirectionEligibleForAnnualTargetLink,
  isStrategyProgramEligibleForAnnualTargetLink,
} from "@/lib/annual-targets/alignment-eligibility";

function activeDirectionVersioning(): StrategyObjectVersioningMeta {
  return {
    object_identity_id: "id-1",
    revision_id: "rev-1",
    revision_number: 1,
    revision_state: "current",
    identity_lifecycle_state: "active",
    definition_hash: "hash",
    operational_status: "active",
    latest_review_decision: null,
    latest_operational_signal: null,
    latest_assessed_at: null,
  };
}

describe("alignment-eligibility", () => {
  it("erlaubt draft- und active-Stoßrichtungen für Jahresziel-Planung", () => {
    expect(isStrategicDirectionEligibleForAnnualTargetLink(activeDirectionVersioning())).toBe(true);
    expect(
      isStrategicDirectionEligibleForAnnualTargetLink({
        ...activeDirectionVersioning(),
        identity_lifecycle_state: "draft",
      })
    ).toBe(true);
    expect(
      isStrategicDirectionEligibleForAnnualTargetLink({
        ...activeDirectionVersioning(),
        identity_lifecycle_state: "inactive",
      })
    ).toBe(false);
    expect(
      isStrategicDirectionEligibleForAnnualTargetLink({
        ...activeDirectionVersioning(),
        latest_operational_signal: "completed",
      })
    ).toBe(false);
  });

  it("erlaubt planungsrelevante Programme (draft/on_hold/active)", () => {
    expect(isStrategyProgramEligibleForAnnualTargetLink("active")).toBe(true);
    expect(isStrategyProgramEligibleForAnnualTargetLink("draft")).toBe(true);
    expect(isStrategyProgramEligibleForAnnualTargetLink("on_hold")).toBe(true);
    expect(isStrategyProgramEligibleForAnnualTargetLink("closed")).toBe(false);
  });

  it("behält beim Bearbeiten die bestehende Verknüpfung", () => {
    const dirs = [
      {
        id: "d1",
        title: "Alt",
        versioning: {
          ...activeDirectionVersioning(),
          latest_operational_signal: "completed" as const,
        },
      },
      { id: "d2", title: "Neu", versioning: activeDirectionVersioning() },
    ];
    expect(filterDirectionsForAnnualTargetSelect(dirs, "d1").map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(filterProgramsForAnnualTargetSelect([{ id: "p1", status: "closed" }], null)).toEqual([]);
    expect(filterProgramsForAnnualTargetSelect([{ id: "p1", status: "draft" }], null).map((p) => p.id)).toEqual([
      "p1",
    ]);
  });
});
