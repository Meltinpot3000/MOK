import { describe, expect, it } from "vitest";
import { computeReviewerFeedbackProgress, listStrategyReviewElementKeys } from "./reviewer-feedback-progress";
import type { StrategyReviewChainHub } from "./pre-read-chain";

const hubs: StrategyReviewChainHub[] = [
  {
    direction: { id: "d1", title: "Richtung 1" },
    challenges: [{ id: "c1", title: "C1" }],
    objectives: [{ id: "o1", title: "O1" }],
    programs: [{ id: "p1", title: "P1" }],
  },
];

describe("listStrategyReviewElementKeys", () => {
  it("listet alle Theme-Elemente", () => {
    expect(listStrategyReviewElementKeys(hubs)).toEqual([
      "challenge:c1",
      "focus_area:d1",
      "objective:o1",
      "program:p1",
    ]);
  });
});

describe("computeReviewerFeedbackProgress", () => {
  it("berechnet Prozent je Reviewer", () => {
    const rows = computeReviewerFeedbackProgress({
      hubs,
      participants: [
        {
          id: "rp1",
          review_id: "r1",
          membership_id: "m1",
          review_role: "stakeholder",
          invited_at: "",
          display_name: "Alice",
          org_roles_label: "",
        },
        {
          id: "rp2",
          review_id: "r1",
          membership_id: "m2",
          review_role: "observer",
          invited_at: "",
          display_name: "Bob",
          org_roles_label: "",
        },
      ],
      feedbackRows: [
        { subject_type: "challenge", subject_id: "c1", actor_id: "m1", rating: "improved" },
        { subject_type: "focus_area", subject_id: "d1", actor_id: "m1", rating: "continue" },
      ],
      roleLabel: (r) => r,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      membershipId: "m1",
      displayName: "Alice",
      ratedCount: 2,
      totalCount: 4,
      percent: 50,
    });
  });
});
