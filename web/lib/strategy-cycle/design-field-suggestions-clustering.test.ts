import { describe, expect, it } from "vitest";
import {
  prepareDesignFieldSuggestionsInput,
  strategicFamilyMatchScore,
} from "@/lib/strategy-cycle/design-field-suggestions-prep";
import type { StrategyObjectVersioningMeta } from "@/lib/strategy-objects/types";

function v(): StrategyObjectVersioningMeta {
  return {
    object_identity_id: "id-1",
    revision_id: "rev-1",
    revision_number: 1,
    revision_state: "current",
    identity_lifecycle_state: "active",
    operational_status: "active",
    latest_operational_signal: "on_track",
  };
}

describe("strategicFamilyMatchScore", () => {
  it("groups cost and efficiency topics", () => {
    const match = strategicFamilyMatchScore("Reduce production costs", "OPEX optimization");
    expect(match.score).toBeGreaterThan(0);
    expect(match.familyId).toBe("cost_efficiency");
  });

  it("groups digital topics", () => {
    const match = strategicFamilyMatchScore("Digitalisation platform", "Data integration systems");
    expect(match.familyId).toBe("digital");
  });

  it("groups market and customer topics", () => {
    const match = strategicFamilyMatchScore("Customer growth EMEA", "Sales region expansion");
    expect(match.familyId).toBe("market_customer");
  });

  it("groups organisation and leadership topics", () => {
    const match = strategicFamilyMatchScore("Leadership culture", "Staff development");
    expect(match.familyId).toBe("organisation");
  });
});

describe("prepareDesignFieldSuggestionsInput thematic clustering", () => {
  it("builds 3-5 management partitions for diverse directions", () => {
    const titles = [
      "OPEX reduction",
      "Production cost efficiency",
      "Digitalisation roadmap",
      "Data platform integration",
      "Customer growth Americas",
      "Sales region expansion",
      "Leadership culture",
      "Staff development",
      "Product engineering excellence",
      "Automotive applications",
      "Governance standards",
      "Process operating model",
      "Build up expertise",
      "Corporate leadership",
      "Automotive sales",
      "Reduce scrap rate",
      "ERP modernization",
      "Market entry APAC",
      "Management development",
      "Innovation pipeline",
      "Quality systems",
      "Customer applications",
      "Operational excellence",
      "Talent acquisition",
    ];

    const result = prepareDesignFieldSuggestionsInput({
      strategicDirections: titles.map((title, index) => ({
        id: `d${index + 1}`,
        title,
        versioning: v(),
      })),
      challenges: [],
      objectives: [],
      challengeDirectionLinks: [],
      directionObjectiveLinks: [],
      directionIndustries: [],
      directionBusinessModels: [],
      industryLabelsById: {},
      businessModelLabelsById: {},
    });

    expect(result.managementPartitions.length).toBeGreaterThanOrEqual(2);
    expect(result.managementPartitions.length).toBeLessThanOrEqual(5);

    const assigned = new Set(result.managementPartitions.flatMap((p) => p.directionIds));
    expect(assigned.size).toBeGreaterThanOrEqual(20);
  });
});
