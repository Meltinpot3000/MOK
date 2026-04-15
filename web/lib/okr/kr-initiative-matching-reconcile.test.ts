import { describe, expect, it } from "vitest";
import { reconcileKrInitiativeMatching } from "./kr-initiative-matching-reconcile";

describe("kr-initiative-matching-reconcile", () => {
  it("aktualisiert gematchte Links und setzt pending wenn nicht bestaetigt", () => {
    const result = reconcileKrInitiativeMatching({
      runId: "run-1",
      existingLinks: [
        {
          id: "link-1",
          initiativeId: "i-1",
          confirmationStatus: "none",
          confirmedLevel: null,
        },
      ],
      suggestedMatches: [{ initiativeId: "i-1", level: "high", reason: "Direkter Einfluss." }],
    });

    expect(result.updates).toEqual([
      {
        id: "link-1",
        patch: {
          llm_level: "high",
          llm_reason: "Direkter Einfluss.",
          llm_run_id: "run-1",
          confirmation_status: "pending",
        },
      },
    ]);
    expect(result.inserts).toEqual([]);
  });

  it("raeumt stale Vorschlaege f\u00FCr none/pending/rejected auf", () => {
    const result = reconcileKrInitiativeMatching({
      runId: "run-2",
      existingLinks: [
        {
          id: "link-1",
          initiativeId: "i-1",
          confirmationStatus: "rejected",
          confirmedLevel: null,
        },
      ],
      suggestedMatches: [],
    });

    expect(result.updates).toEqual([
      {
        id: "link-1",
        patch: {
          llm_level: null,
          llm_reason: null,
          llm_run_id: null,
          confirmation_status: "none",
        },
      },
    ]);
  });

  it("fasst accepted/manual nicht an und f\u00FCgt neue Vorschlaege ein", () => {
    const result = reconcileKrInitiativeMatching({
      runId: "run-3",
      existingLinks: [
        {
          id: "link-1",
          initiativeId: "i-1",
          confirmationStatus: "accepted",
          confirmedLevel: "medium",
        },
      ],
      suggestedMatches: [{ initiativeId: "i-2", level: "low", reason: "Indirekter Beitrag." }],
    });

    expect(result.updates).toEqual([]);
    expect(result.inserts).toEqual([
      {
        initiativeId: "i-2",
        llmLevel: "low",
        llmReason: "Indirekter Beitrag.",
        confirmationStatus: "pending",
      },
    ]);
  });
});
