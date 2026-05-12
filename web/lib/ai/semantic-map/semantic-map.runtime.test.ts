import { describe, expect, it } from "vitest";

import { strategyInventoryFixture } from "./__fixtures__/strategy-inventory.fixture";
import { buildSemanticMapRuntimeDiagnostics } from "./diagnostics/semantic-map-diagnostics";
import { buildCompactMapForPlanner } from "./runtime/build-compact-map-for-planner";
import { planRouteFromMap } from "./runtime/plan-route-from-map";
import type { SemanticMapDraft } from "./types";
import { validateMapDraft } from "./validation/validate-map-draft";
import { miniExecutableFromValidated } from "./semantic-map-test-helpers";

describe("semantic-map runtime", () => {
  it("planRouteFromMap nutzt inferred nur mit allowInferredRoads", () => {
    const draft: SemanticMapDraft = {
      places: [
        {
          placeKey: "a.p",
          canonicalName: "A",
          domain: "x",
          businessMeaning: "b",
          descriptionForPlanner: "d",
          evidence: [{ sourceType: "table", sourceRef: "app.strategic_challenges" }],
        },
        {
          placeKey: "b.p",
          canonicalName: "B",
          domain: "x",
          businessMeaning: "b",
          descriptionForPlanner: "d",
          evidence: [{ sourceType: "table", sourceRef: "app.strategic_initiatives" }],
        },
      ],
      roads: [
        {
          roadKey: "a.to.b",
          fromPlaceKey: "a.p",
          toPlaceKey: "b.p",
          businessMeaning: "x",
          relationType: "guess",
          evidence: [{ sourceType: "inferred", sourceRef: "heuristic" }],
        },
      ],
      suggestedQuestions: [],
      gaps: [],
    };
    const v = validateMapDraft({ draft, inventory: strategyInventoryFixture });
    const map = miniExecutableFromValidated(v.places, v.roads);
    const without = planRouteFromMap({
      map,
      fromPlaceKey: "a.p",
      toPlaceKey: "b.p",
      options: { allowInferredRoads: false },
    });
    expect(without.found).toBe(false);
    const withInf = planRouteFromMap({
      map,
      fromPlaceKey: "a.p",
      toPlaceKey: "b.p",
      options: { allowInferredRoads: true },
    });
    expect(withInf.found).toBe(true);
  });

  it("Compact Map listet inferred getrennt von verified", () => {
    const draft: SemanticMapDraft = {
      places: [
        {
          placeKey: "a.p",
          canonicalName: "A",
          domain: "x",
          businessMeaning: "b",
          descriptionForPlanner: "d",
          evidence: [{ sourceType: "table", sourceRef: "app.strategic_challenges" }],
        },
        {
          placeKey: "b.p",
          canonicalName: "B",
          domain: "x",
          businessMeaning: "b",
          descriptionForPlanner: "d",
          evidence: [{ sourceType: "table", sourceRef: "app.strategic_initiatives" }],
        },
      ],
      roads: [
        {
          roadKey: "v",
          fromPlaceKey: "a.p",
          toPlaceKey: "b.p",
          businessMeaning: "v",
          relationType: "fk",
          evidence: [
            {
              sourceType: "foreign_key",
              sourceRef:
                "app.strategic_initiatives.challenge_id->app.strategic_challenges.id",
            },
          ],
        },
        {
          roadKey: "i",
          fromPlaceKey: "b.p",
          toPlaceKey: "a.p",
          businessMeaning: "i",
          relationType: "x",
          evidence: [{ sourceType: "inferred", sourceRef: "x" }],
        },
      ],
      suggestedQuestions: [],
      gaps: [],
    };
    const v = validateMapDraft({ draft, inventory: strategyInventoryFixture });
    const map = miniExecutableFromValidated(v.places, v.roads);
    const compact = buildCompactMapForPlanner({ map, options: { includeInferredRoadsInCompact: true } });
    expect(compact.roadsVerified.length).toBeGreaterThanOrEqual(1);
    expect(compact.roadsInferred.length).toBeGreaterThanOrEqual(1);
  });

  it("Runtime-Diagnostics: strict nur mit verified Road", () => {
    const draft: SemanticMapDraft = {
      places: [
        {
          placeKey: "a.p",
          canonicalName: "A",
          domain: "x",
          businessMeaning: "b",
          descriptionForPlanner: "d",
          evidence: [{ sourceType: "table", sourceRef: "app.strategic_challenges" }],
        },
        {
          placeKey: "b.p",
          canonicalName: "B",
          domain: "x",
          businessMeaning: "b",
          descriptionForPlanner: "d",
          evidence: [{ sourceType: "table", sourceRef: "app.strategic_initiatives" }],
        },
      ],
      roads: [
        {
          roadKey: "inf",
          fromPlaceKey: "a.p",
          toPlaceKey: "b.p",
          businessMeaning: "x",
          relationType: "x",
          evidence: [{ sourceType: "inferred", sourceRef: "x" }],
        },
      ],
      suggestedQuestions: [],
      gaps: [],
    };
    const v = validateMapDraft({ draft, inventory: strategyInventoryFixture });
    const map = miniExecutableFromValidated(v.places, v.roads);
    const d = buildSemanticMapRuntimeDiagnostics(map);
    expect(d.executableForPlacesOnly).toBe(true);
    expect(d.executableForCrossPlaceRoutes).toBe(false);
    expect(d.runtimeExecutableStrict).toBe(false);
  });
});
