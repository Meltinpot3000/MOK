import { describe, expect, it } from "vitest";

import type { RankingContract } from "./answer-contracts";
import { renderDeterministicNarration } from "./deterministic-narrator";
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

describe("verifyAnswer", () => {
  it("blockt no-data claim trotz contract-daten", () => {
    const result = verifyAnswer({
      contract: rankingContract,
      llmText: "Es liegen keine Daten vor.",
    });
    expect(result.status).toBe("blocked");
  });

  it("laesst praefix-label-match zu (Carmelo Messina)", () => {
    const result = verifyAnswer({
      contract: rankingContract,
      llmText: "Der führende Owner ist Carmelo Messina mit 4 OKRs. Insgesamt wurden 5 OKRs betrachtet.",
    });
    expect(result.status).toBe("ok");
  });

  it("blockt klaren top-owner-widerspruch", () => {
    const result = verifyAnswer({
      contract: rankingContract,
      llmText: "Die meisten OKRs hat Karl mit 4 OKRs.",
    });
    expect(result.status).toBe("blocked");
  });

  it("blockt kontextuellen number mismatch", () => {
    const result = verifyAnswer({
      contract: rankingContract,
      llmText: "Carmelo hat 5 OKRs. Insgesamt wurden 5 OKRs betrachtet.",
    });
    expect(result.status).toBe("blocked");
  });

  it("akzeptiert totalItems=0 mit keine-daten", () => {
    const empty: RankingContract = { ...rankingContract, totalItems: 0, top: [] };
    const result = verifyAnswer({
      contract: empty,
      llmText: "Aktuell sind keine Daten verfuegbar.",
    });
    expect(result.status).toBe("ok");
  });

  it("liefert deterministic replacement", () => {
    const baseline = renderDeterministicNarration(rankingContract);
    const result = verifyAnswer({
      contract: rankingContract,
      llmText: "Es liegen keine Daten vor.",
      baselineText: baseline,
    });
    expect(result.status).toBe("blocked");
    if (result.status === "blocked") {
      expect(result.replacementText).toContain("Kernaussage:");
    }
  });

  it("blockt numerische Aussagen bei retrievalStatus=failed", () => {
    const failed: RankingContract = {
      ...rankingContract,
      retrievalStatus: "failed",
      totalItems: null,
      top: [],
    };
    const result = verifyAnswer({
      contract: failed,
      llmText: "Es sind 0 Eintraege vorhanden.",
    });
    expect(result.status).toBe("blocked");
  });
});

