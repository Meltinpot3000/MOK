import { describe, expect, it } from "vitest";

import { mockResolveQuestionForTests } from "./__fixtures__/mock-resolve-question";
import { strategyMapThreePlaceDraftFixture } from "./__fixtures__/strategy-map-draft.fixture";
import { strategyInventoryFixture } from "./__fixtures__/strategy-inventory.fixture";
import { deriveEvidenceRequirementsFromResolution } from "./runtime/evidence-requirements-from-route";
import { evaluateSemanticEvidenceCoverage } from "./runtime/evaluate-semantic-evidence-coverage";
import { semanticMapQuestionResolutionSchema } from "./types";
import { validateDraftToExecutable, findPlaceByMeaning } from "./semantic-map-test-helpers";

describe("semantic-map question resolution (deterministisch)", () => {
  it("Question-Resolution-Schema akzeptiert Fixture-Payload", () => {
    const payload = mockResolveQuestionForTests();
    const parsed = semanticMapQuestionResolutionSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("deriveEvidenceRequirementsFromResolution + Evidence-Gate gegen Mock-Resolution", () => {
    const { map } = validateDraftToExecutable({
      draft: strategyMapThreePlaceDraftFixture,
      inventory: strategyInventoryFixture,
    });
    const resolution = mockResolveQuestionForTests();
    const ev = deriveEvidenceRequirementsFromResolution({ resolution, map });
    expect(ev.some((e) => e.placeKey === "strategy.challenge")).toBe(true);

    const challengePlace = findPlaceByMeaning(map.places, "Challenge");
    expect(challengePlace).toBeDefined();

    const gate = evaluateSemanticEvidenceCoverage({
      requiredEvidence: ev,
      usedSources: [{ sourceType: "tool", sourceRef: "get_current_okr_cycle" }],
      questionClaimsTopStrategicChallenge: true,
    });
    expect(gate.answerAllowed).toBe(false);
    expect(gate.missingEvidence).toEqual(expect.arrayContaining(["strategy_challenge", "initiative"]));
  });
});
