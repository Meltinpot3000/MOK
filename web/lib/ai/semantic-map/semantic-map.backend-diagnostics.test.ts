import { describe, expect, it } from "vitest";

import { SEMANTIC_MAP_BLOCKED_CLAIMS } from "./types";
import { buildSemanticMapRunDiagnostics } from "./runtime/build-semantic-map-run-diagnostics";
import { buildSemanticUsedSourcesFromToolCalls } from "./runtime/build-semantic-used-sources";
import { strategyMapThreePlaceDraftFixture } from "./__fixtures__/strategy-map-draft.fixture";
import { strategyInventoryFixture } from "./__fixtures__/strategy-inventory.fixture";
import { validateDraftToExecutable } from "./semantic-map-test-helpers";

describe("semantic-map backend diagnostics", () => {
  it("nur get_current_okr_cycle: Evidence unvollständig, Run fachlich nicht OK", async () => {
    const { map } = validateDraftToExecutable({
      draft: strategyMapThreePlaceDraftFixture,
      inventory: strategyInventoryFixture,
    });
    const question =
      "Welches ist die grösste strategische Herausforderung im aktuellen Zyklus und welche Initiativen laufen, um diese zu lösen oder zu meistern?";

    const result = await buildSemanticMapRunDiagnostics({
      question,
      toolCalls: [{ toolName: "get_current_okr_cycle" }],
      map,
      useMockResolver: true,
    });

    expect(result.evidenceCoverage.answerAllowed).toBe(false);
    expect(result.evidenceCoverage.missingEvidence).toContain("strategy_challenge");
    expect(result.evidenceCoverage.missingEvidence).toContain("initiative");
    expect(result.evidenceCoverage.blockedClaims).toContain(
      SEMANTIC_MAP_BLOCKED_CLAIMS.challengeClaimWithoutEvidence
    );
    expect(result.evidenceCoverage.blockedClaims).toContain(
      SEMANTIC_MAP_BLOCKED_CLAIMS.initiativeClaimWithoutEvidence
    );
    expect(result.executionReadiness).toBe("missing_evidence");
    expect(result.diagnosticsOnly).toBe(true);
  });

  it("Zyklus-Claims widersprechen dem geladenen Current Cycle", async () => {
    const { map } = validateDraftToExecutable({
      draft: strategyMapThreePlaceDraftFixture,
      inventory: strategyInventoryFixture,
    });

    const result = await buildSemanticMapRunDiagnostics({
      question: "OKR Status",
      toolCalls: [
        { toolName: "get_current_okr_cycle" },
        { toolName: "get_visible_strategy_challenges" },
        { toolName: "get_visible_initiatives" },
      ],
      map,
      useMockResolver: true,
      selectedCurrentCycleId: "9f4dd341-a869-443e-8a0c-847fddd97e1d",
      answerClaimedCycleIds: [
        "ff8de12c-334e-4c02-984b-73267e3c15e6",
        "2d69261c-21c7-4077-8b0c-9f54233a4884",
      ],
    });

    expect(result.cycleConsistency?.ok).toBe(false);
    expect(result.cycleConsistency?.blockedClaims).toContain(
      SEMANTIC_MAP_BLOCKED_CLAIMS.currentCycleMismatch
    );
    expect(result.evidenceCoverage.answerAllowed).toBe(true);
    expect(result.executionReadiness).toBe("failed");
  });

  it("buildSemanticUsedSourcesFromToolCalls mappt MVP-Tools inkl. placeKey", () => {
    const used = buildSemanticUsedSourcesFromToolCalls({
      toolCalls: [{ toolName: "get_current_okr_cycle" }],
    });
    expect(used).toEqual([
      { sourceType: "tool", sourceRef: "get_current_okr_cycle", placeKey: "okr.cycle" },
    ]);
  });
});
