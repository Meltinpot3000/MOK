import { describe, expect, it } from "vitest";

import { SEMANTIC_MAP_BLOCKED_CLAIMS } from "./types";
import { evaluateCycleClaimConsistency } from "./runtime/evaluate-cycle-claim-consistency";
import {
  evaluateSemanticEvidenceCoverage,
  minimalRequirementsFromPlaceKeys,
} from "./runtime/evaluate-semantic-evidence-coverage";

describe("semantic-map evidence gates", () => {
  it("evaluateSemanticEvidenceCoverage: Zyklus-Tool deckt current_cycle ab", () => {
    const r = evaluateSemanticEvidenceCoverage({
      requiredEvidence: minimalRequirementsFromPlaceKeys(["okr.cycle"]),
      usedSources: [{ sourceType: "tool", sourceRef: "get_current_okr_cycle" }],
    });
    expect(r.answerAllowed).toBe(true);
    expect(r.status).toBe("ok");
    expect(r.missingEvidence).toHaveLength(0);
  });

  it("evaluateSemanticEvidenceCoverage: Challenge-Tool deckt strategy_challenge ab", () => {
    const r = evaluateSemanticEvidenceCoverage({
      requiredEvidence: minimalRequirementsFromPlaceKeys(["strategy.challenge"]),
      usedSources: [{ sourceType: "tool", sourceRef: "get_visible_strategy_challenges" }],
    });
    expect(r.answerAllowed).toBe(true);
  });

  it("Negativfall: nur get_current_okr_cycle bei Pflicht Challenge+Initiative+Zyklus", () => {
    const requiredEvidence = minimalRequirementsFromPlaceKeys([
      "strategy.challenge",
      "strategy.initiative",
      "okr.cycle",
    ]);
    const r = evaluateSemanticEvidenceCoverage({
      requiredEvidence,
      usedSources: [{ sourceType: "tool", sourceRef: "get_current_okr_cycle" }],
      questionClaimsTopStrategicChallenge: true,
    });
    expect(r.answerAllowed).toBe(false);
    expect(r.status).toBe("failed");
    expect(r.missingEvidence).toEqual(
      expect.arrayContaining(["strategy_challenge", "initiative"])
    );
    expect(r.missingEvidence).toHaveLength(2);
    expect(r.blockedClaims).toEqual(
      expect.arrayContaining([
        SEMANTIC_MAP_BLOCKED_CLAIMS.challengeClaimWithoutEvidence,
        SEMANTIC_MAP_BLOCKED_CLAIMS.topChallengeWithoutChallengeEvidence,
        SEMANTIC_MAP_BLOCKED_CLAIMS.initiativeClaimWithoutEvidence,
      ])
    );
    expect(r.blockedClaims).toHaveLength(3);
  });

  it("evaluateCycleClaimConsistency meldet Fremdzyklus", () => {
    const r = evaluateCycleClaimConsistency({
      selectedCurrentCycleId: "aaa",
      answerClaimedCycleIds: ["bbb"],
    });
    expect(r.ok).toBe(false);
    expect(r.blockedClaims).toContain(SEMANTIC_MAP_BLOCKED_CLAIMS.currentCycleMismatch);
  });

  it("evaluateCycleClaimConsistency: leere oder passende Claims sind ok", () => {
    expect(
      evaluateCycleClaimConsistency({
        selectedCurrentCycleId: "X",
        answerClaimedCycleIds: ["", "x"],
      }).ok
    ).toBe(true);
  });
});
