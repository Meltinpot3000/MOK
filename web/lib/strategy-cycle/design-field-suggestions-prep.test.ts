import { describe, expect, it } from "vitest";
import {
  filterActiveStrategicDirectionsForDesignFieldSuggestions,
  prepareDesignFieldSuggestionsInput,
} from "@/lib/strategy-cycle/design-field-suggestions-prep";
import type { StrategyObjectVersioningMeta } from "@/lib/strategy-objects/types";

function v(overrides: Partial<StrategyObjectVersioningMeta>): StrategyObjectVersioningMeta {
  return {
    object_identity_id: "id-1",
    revision_id: "rev-1",
    revision_number: 1,
    revision_state: "current",
    identity_lifecycle_state: "active",
    operational_status: "active",
    latest_operational_signal: "on_track",
    ...overrides,
  };
}

const activeV = v({});
const draftV = v({ identity_lifecycle_state: "draft", revision_state: "draft" });

describe("filterActiveStrategicDirectionsForDesignFieldSuggestions", () => {
  it("keeps only active current directions", () => {
    const result = filterActiveStrategicDirectionsForDesignFieldSuggestions([
      { id: "d1", title: "A", versioning: activeV },
      { id: "d2", title: "B", versioning: draftV },
    ]);
    expect(result.map((d) => d.id)).toEqual(["d1"]);
  });
});

describe("prepareDesignFieldSuggestionsInput", () => {
  it("builds summaries and cluster candidates from shared links", () => {
    const result = prepareDesignFieldSuggestionsInput({
      strategicDirections: [
        { id: "d1", title: "Digital Wachstum", description: "Plattform skalieren", versioning: activeV },
        { id: "d2", title: "Digitale Vertrieb", versioning: activeV },
        { id: "d3", title: "Draft only", versioning: draftV },
      ],
      challenges: [
        { id: "c1", title: "Marktdruck", challenge_score: 80 },
        { id: "c2", title: "Kosten", challenge_score: 60 },
      ],
      objectives: [
        { id: "o1", title: "Umsatz steigern", importance_score: 5 },
        { id: "o2", title: "Effizienz", importance_score: 4 },
      ],
      challengeDirectionLinks: [
        { strategic_direction_id: "d1", strategic_challenge_id: "c1", contribution_level: "high" },
        { strategic_direction_id: "d2", strategic_challenge_id: "c1", contribution_level: "high" },
        { strategic_direction_id: "d2", strategic_challenge_id: "c2", contribution_level: "medium" },
      ],
      directionObjectiveLinks: [
        { strategic_direction_id: "d1", objective_id: "o1", contribution_level: "high" },
        { strategic_direction_id: "d2", objective_id: "o1", contribution_level: "high" },
      ],
      directionIndustries: [
        { strategic_direction_id: "d1", industry_id: "i1" },
        { strategic_direction_id: "d2", industry_id: "i1" },
      ],
      directionBusinessModels: [],
      industryLabelsById: { i1: "Technologie" },
      businessModelLabelsById: {},
    });

    expect(result.activeDirections).toHaveLength(2);
    expect(result.directionSummaries).toHaveLength(2);
    expect(result.directionSummaries[0]?.topChallenges[0]).toBe("Marktdruck");
    expect(result.clusterCandidates.length).toBeGreaterThan(0);
    expect(result.clusterCandidates[0]?.directionIds).toEqual(expect.arrayContaining(["d1", "d2"]));
    expect(result.managementPartitions.length).toBeGreaterThanOrEqual(1);
    expect(result.managementPartitions.length).toBeLessThanOrEqual(5);
  });

  it("returns empty clusters when fewer than two active directions", () => {
    const result = prepareDesignFieldSuggestionsInput({
      strategicDirections: [{ id: "d1", title: "Solo", versioning: activeV }],
      challenges: [],
      objectives: [],
      challengeDirectionLinks: [],
      directionObjectiveLinks: [],
      directionIndustries: [],
      directionBusinessModels: [],
      industryLabelsById: {},
      businessModelLabelsById: {},
    });
    expect(result.clusterCandidates).toHaveLength(0);
  });
});
