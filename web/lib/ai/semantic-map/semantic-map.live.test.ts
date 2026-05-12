import { describe, expect, it } from "vitest";

import { strategyMapThreePlaceDraftFixture } from "./__fixtures__/strategy-map-draft.fixture";
import { strategyInventoryFixture } from "./__fixtures__/strategy-inventory.fixture";
import { resolveQuestionAgainstSemanticMap } from "./semantic-map-service";
import { validateDraftToExecutable } from "./semantic-map-test-helpers";

const live = process.env.AI_SEMANTIC_MAP_LIVE_TEST === "true";

describe.skipIf(!live)("semantic-map live (Ollama/Provider)", () => {
  it("resolveQuestionAgainstSemanticMap liefert strukturierte Resolution", async () => {
    const { map } = validateDraftToExecutable({
      draft: strategyMapThreePlaceDraftFixture,
      inventory: strategyInventoryFixture,
    });
    const resolution = await resolveQuestionAgainstSemanticMap({
      question: "What is our biggest strategic challenge and which initiatives address it?",
      map,
    });
    expect(resolution.relevantPlaces.length).toBeGreaterThan(0);
    expect(resolution.interpretedIntent.length).toBeGreaterThan(0);
  });
});
