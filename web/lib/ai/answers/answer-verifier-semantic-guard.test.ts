import { afterEach, describe, expect, it, vi } from "vitest";

import type { SemanticMapRunDiagnostics } from "@/lib/ai/semantic-map/types";
import { SEMANTIC_MAP_BLOCKED_CLAIMS } from "@/lib/ai/semantic-map/types";
import type { RankingContract } from "./answer-contracts";
import { verifyAnswer } from "./answer-verifier";

const rankingContract: RankingContract = {
  queryClass: "ranking",
  domain: "okr",
  metric: "objective_count",
  groupBy: "owner",
  scope: { cycleId: "c1", cycleLabel: "Aktueller Zyklus" },
  totalItems: 5,
  top: [
    { rank: 1, label: "Carmelo", count: 4, evidenceIds: ["o1", "o2", "o3", "o4"] },
    { rank: 2, label: "Karl", count: 1, evidenceIds: ["o5"] },
  ],
  evidenceSummary: "owner ranking",
  confidence: "high",
  retrievalStatus: "ok",
  missingCapabilities: [],
  missingTools: [],
  requestedOps: ["rank", "count_total"],
  coveredOps: ["rank", "count_total"],
  missingOps: [],
};

function minimalDiagnostics(
  overrides: Partial<SemanticMapRunDiagnostics>
): SemanticMapRunDiagnostics {
  return {
    enabled: true,
    resolutionStatus: "ok",
    requiredEvidence: [],
    usedSources: [{ sourceType: "tool", sourceRef: "get_current_okr_cycle", placeKey: "okr.cycle" }],
    evidenceCoverage: {
      status: "failed",
      answerAllowed: false,
      missingEvidence: ["strategy_challenge", "initiative"],
      blockedClaims: [
        SEMANTIC_MAP_BLOCKED_CLAIMS.challengeClaimWithoutEvidence,
        SEMANTIC_MAP_BLOCKED_CLAIMS.initiativeClaimWithoutEvidence,
      ],
    },
    executionReadiness: "missing_evidence",
    diagnosticsOnly: true,
    ...overrides,
  };
}

describe("verifyAnswer semantic evidence guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("blockt freie LLM-Antwort bei fehlender Evidence (Feature-Flag an)", () => {
    vi.stubEnv("AI_SEMANTIC_EVIDENCE_GUARD_ENABLED", "true");
    const diag = minimalDiagnostics({ diagnosticsOnly: true });
    const result = verifyAnswer({
      contract: rankingContract,
      llmText: "Die größte strategische Herausforderung ist Kundenzufriedenheit.",
      semanticMapRunDiagnostics: diag,
    });
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") {
      expect(result.reason).toBe("semantic_evidence_incomplete");
      expect(result.replacementText).toContain("strategischen Herausforderungen");
      expect(result.replacementText).not.toContain("Kundenzufriedenheit");
    }
  });

  it("greift ohne Feature-Flag, wenn diagnosticsOnly false", () => {
    const diag = minimalDiagnostics({ diagnosticsOnly: false });
    const result = verifyAnswer({
      contract: rankingContract,
      llmText: "Die größte strategische Herausforderung ist X.",
      semanticMapRunDiagnostics: diag,
    });
    expect(result.status).toBe("blocked");
  });

  it("greift nicht bei diagnosticsOnly true und Flag aus", () => {
    vi.stubEnv("AI_SEMANTIC_EVIDENCE_GUARD_ENABLED", "");
    const diag = minimalDiagnostics({ diagnosticsOnly: true });
    const result = verifyAnswer({
      contract: rankingContract,
      llmText: "Der führende Owner ist Carmelo Messina mit 4 OKRs. Insgesamt wurden 5 OKRs betrachtet.",
      semanticMapRunDiagnostics: diag,
    });
    expect(result.status).toBe("ok");
  });

  it("blockt bei Zyklus-Mismatch (High-Risk)", () => {
    vi.stubEnv("AI_SEMANTIC_EVIDENCE_GUARD_ENABLED", "true");
    const diag = minimalDiagnostics({
      diagnosticsOnly: true,
      evidenceCoverage: {
        status: "ok",
        answerAllowed: true,
        missingEvidence: [],
        blockedClaims: [],
      },
      executionReadiness: "failed",
      cycleConsistency: {
        ok: false,
        blockedClaims: [SEMANTIC_MAP_BLOCKED_CLAIMS.currentCycleMismatch],
      },
    });
    const result = verifyAnswer({
      contract: rankingContract,
      llmText: "Alles passt.",
      semanticMapRunDiagnostics: diag,
    });
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") {
      expect(result.reason).toBe("semantic_cycle_claim_mismatch");
    }
  });
});
