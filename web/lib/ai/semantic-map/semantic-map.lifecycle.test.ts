import { describe, expect, it } from "vitest";

import { normalizeMapDraft } from "./builder/normalize-map-draft";
import type { SemanticMapDraft } from "./types";

describe("semantic-map lifecycle (normalize)", () => {
  it("normalisiert Draft-Keys und entfernt Duplikate", () => {
    const draft: SemanticMapDraft = {
      places: [
        {
          placeKey: " Strategy.Challenge ",
          canonicalName: "X",
          domain: "strategy",
          businessMeaning: "b",
          descriptionForPlanner: "d",
          evidence: [{ sourceType: "table", sourceRef: "app.strategic_challenges" }],
        },
        {
          placeKey: "strategy.challenge",
          canonicalName: "Y",
          domain: "strategy",
          businessMeaning: "b2",
          descriptionForPlanner: "d2",
          evidence: [{ sourceType: "table", sourceRef: "app.strategic_challenges" }],
        },
      ],
      roads: [],
      suggestedQuestions: [],
      gaps: [],
    };
    const n = normalizeMapDraft(draft);
    expect(n.places).toHaveLength(1);
    expect(n.places[0]!.placeKey).toBe("strategy.challenge");
  });
});
