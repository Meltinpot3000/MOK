import { describe, expect, it } from "vitest";
import {
  computeContentVsTimeDeltaPp,
  computeOkrCycleContentProgress,
  computeProgressVsPlanWeeks,
  computeReviewCycleContentProgress,
  formatProgressVsPlanWeeksDe,
  formatProgressVsPlanWeeksShortDe,
} from "@/lib/ceo/cycle-content-progress";

describe("computeOkrCycleContentProgress", () => {
  it("berechnet Durchschnitt der Objective-Rollups", () => {
    const result = computeOkrCycleContentProgress([
      { progress_percent: 80 },
      { progress_percent: 60 },
    ]);
    expect(result.contentProgressPercent).toBe(70);
    expect(result.detailHint).toContain("2 OKR-Objectives");
  });

  it("liefert null ohne Objectives", () => {
    expect(computeOkrCycleContentProgress([]).contentProgressPercent).toBeNull();
  });
});

describe("computeReviewCycleContentProgress", () => {
  it("gewichtet nur aktive Initiativen", () => {
    const result = computeReviewCycleContentProgress([
      { progress_percent: 100, weight: 2, status: "active" },
      { progress_percent: 0, weight: 8, status: "active" },
      { progress_percent: 50, weight: 5, status: "completed" },
    ]);
    expect(result.contentProgressPercent).toBe(20);
  });
});

describe("computeContentVsTimeDeltaPp", () => {
  it("positiv bei Vorsprung", () => {
    expect(computeContentVsTimeDeltaPp(77, 63)).toBe(14);
  });
});

describe("computeProgressVsPlanWeeks", () => {
  it("rechnet Vorsprung in Wochen aus Delta und Zyklusdauer", () => {
    const start = "2026-04-01T00:00:00.000Z";
    const end = "2026-07-01T00:00:00.000Z";
    const result = computeProgressVsPlanWeeks(14, start, end);
    expect(result).not.toBeNull();
    expect(result!.totalWeeks).toBe(13);
    expect(result!.weeksDelta).toBe(1.8);
    expect(formatProgressVsPlanWeeksDe(14, start, end)).toBe(
      "≈1,8 Wochen voraus · 14% von 13 Wochen"
    );
    expect(formatProgressVsPlanWeeksShortDe(14, start, end)).toBe("1,8 Wochen voraus");
  });
});
