import { describe, expect, it } from "vitest";

import { strategyLandscapeInventoryFixture } from "./__fixtures__/strategy-landscape-inventory.fixture";
import { strategyMapThreePlaceDraftFixture } from "./__fixtures__/strategy-map-draft.fixture";
import { strategyInventoryFixture } from "./__fixtures__/strategy-inventory.fixture";
import type { SemanticMapDraft } from "./types";
import { validateMapDraft } from "./validation/validate-map-draft";

describe("semantic-map validation", () => {
  it("Place ohne Evidence wird unsupported", () => {
    const draft: SemanticMapDraft = {
      places: [
        {
          placeKey: "x.y",
          canonicalName: "X",
          domain: "x",
          businessMeaning: "b",
          descriptionForPlanner: "d",
          evidence: [{ sourceType: "table", sourceRef: "app.strategic_challenges" }],
        },
        {
          placeKey: "no.evidence",
          canonicalName: "N",
          domain: "x",
          businessMeaning: "b",
          descriptionForPlanner: "d",
          evidence: [],
        },
      ],
      roads: [],
      suggestedQuestions: [],
      gaps: [],
    };
    const v = validateMapDraft({ draft, inventory: strategyInventoryFixture });
    const bad = v.places.find((p) => p.placeKey === "no.evidence");
    expect(bad?.validationStatus).toBe("unsupported");
  });

  it("validiert Places und Roads gegen Fixture-Inventory", () => {
    const v = validateMapDraft({
      draft: strategyMapThreePlaceDraftFixture,
      inventory: strategyInventoryFixture,
    });
    expect(v.summary.places.verified).toBeGreaterThanOrEqual(3);
    expect(v.summary.roads.verified).toBe(1);
  });

  it("Landschafts-Inventar: zusätzliche Tabellen sind belegbar", () => {
    const draft: SemanticMapDraft = {
      places: [
        {
          placeKey: "okr.objective",
          canonicalName: "Ziel",
          domain: "okr",
          businessMeaning: "OKR-Ziel",
          descriptionForPlanner: "Objective",
          evidence: [{ sourceType: "table", sourceRef: "app.okr_objectives" }],
        },
      ],
      roads: [],
      suggestedQuestions: [],
      gaps: [],
    };
    const v = validateMapDraft({ draft, inventory: strategyLandscapeInventoryFixture });
    const p = v.places.find((x) => x.placeKey === "okr.objective");
    expect(p?.validationStatus).toBe("verified");
  });
});
