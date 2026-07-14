import { describe, expect, it } from "vitest";
import { countItemsWithFeedback, summarizeSubjectFeedback } from "./feedback-summary";

describe("summarizeSubjectFeedback", () => {
  it("aggregiert Ratings und Kommentare", () => {
    const summary = summarizeSubjectFeedback(
      [
        {
          subject_type: "challenge",
          subject_id: "c1",
          actor_id: "m1",
          rating: "improved",
          comment: "Besser geworden",
        },
        {
          subject_type: "challenge",
          subject_id: "c1",
          actor_id: "m2",
          rating: "improved",
          comment: null,
        },
        {
          subject_type: "challenge",
          subject_id: "c1",
          actor_id: "m3",
          rating: "worsened",
          comment: "Risiko steigt",
        },
        {
          subject_type: "challenge",
          subject_id: "c2",
          actor_id: "m1",
          rating: "unchanged",
          comment: null,
        },
      ],
      "challenge",
      "c1",
      { m1: "Alice", m2: "Bob", m3: "Carol" }
    );

    expect(summary.totalRatings).toBe(3);
    expect(summary.buckets).toEqual([
      {
        rating: "improved",
        label: "verbessert",
        count: 2,
        reviewers: ["Alice", "Bob"],
      },
      {
        rating: "worsened",
        label: "verschlechtert",
        count: 1,
        reviewers: ["Carol"],
      },
    ]);
    expect(summary.comments).toHaveLength(2);
  });
});

describe("countItemsWithFeedback", () => {
  it("zählt Elemente mit mindestens einer Bewertung", () => {
    expect(
      countItemsWithFeedback(
        [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
        "challenge",
        [
          { subject_type: "challenge", subject_id: "c1", actor_id: "m1", rating: "improved", comment: null },
          { subject_type: "challenge", subject_id: "c1", actor_id: "m2", rating: "unchanged", comment: null },
          { subject_type: "objective", subject_id: "c2", actor_id: "m1", rating: "keep", comment: null },
        ]
      )
    ).toBe(1);
  });
});
