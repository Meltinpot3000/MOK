import { describe, expect, it } from "vitest";
import {
  buildOkrReviewSummary,
  parseOkrReviewObjectiveSections,
  splitOkrReviewSummaryPreamble,
} from "./okr-review-summary";

describe("okr-review-summary", () => {
  it("roundtrips preamble and objective sections", () => {
    const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const summary = buildOkrReviewSummary({
      preamble: "Teilnehmer: A, B",
      perObjective: [{ id, notes: "Line1\nLine2" }],
    });
    expect(splitOkrReviewSummaryPreamble(summary)).toBe("Teilnehmer: A, B");
    const m = parseOkrReviewObjectiveSections(summary);
    expect(m.get(id)).toBe("Line1\nLine2");
  });
});
