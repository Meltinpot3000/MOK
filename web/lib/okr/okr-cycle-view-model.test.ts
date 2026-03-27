import { describe, expect, it } from "vitest";
import {
  computeCheckInFirstLastActivityAt,
  deriveReviewStatusLinearOkrCycle,
  formatStatusDistribution,
  OKR_LINEAR_AT_RISK_GAP_PP,
  OKR_LINEAR_OFF_TRACK_GAP_PP,
  worstReviewStatus,
} from "./okr-cycle-view-model";
import type { OkrPlanningKeyResultRow } from "./planning-data";

function kr(partial: Partial<OkrPlanningKeyResultRow> & { id: string; objectiveId: string }): OkrPlanningKeyResultRow {
  return {
    id: partial.id,
    objectiveId: partial.objectiveId,
    title: partial.title ?? "KR",
    status: partial.status ?? "active",
    metricType: partial.metricType ?? "numeric",
    startValue: partial.startValue ?? 0,
    targetValue: partial.targetValue ?? 100,
    currentValue: partial.currentValue ?? 50,
    measurementUnit: partial.measurementUnit ?? null,
    dueDate: partial.dueDate ?? null,
    updatedAt: partial.updatedAt ?? "2025-01-02T00:00:00.000Z",
    ownerMembershipId: partial.ownerMembershipId ?? null,
    ownerDisplayName: partial.ownerDisplayName ?? null,
    deputyMembershipId: partial.deputyMembershipId ?? null,
    deputyDisplayName: partial.deputyDisplayName ?? null,
    linkedInitiativeIds: partial.linkedInitiativeIds ?? [],
    linkedInitiativeTitles: partial.linkedInitiativeTitles ?? [],
    warningNoInitiativeLink: partial.warningNoInitiativeLink ?? false,
  };
}

describe("okr-cycle-view-model", () => {
  it("computeCheckInFirstLastActivityAt prefers latest check-in", () => {
    const keyResults = [
      kr({ id: "k1", objectiveId: "o1", updatedAt: "2025-01-01T00:00:00.000Z" }),
      kr({ id: "k2", objectiveId: "o1", updatedAt: "2025-01-03T00:00:00.000Z" }),
    ];
    const map = new Map<string, string | null>([
      ["k1", "2025-02-01T00:00:00.000Z"],
      ["k2", "2025-01-15T00:00:00.000Z"],
    ]);
    expect(computeCheckInFirstLastActivityAt(keyResults, map)).toBe("2025-02-01T00:00:00.000Z");
  });

  it("computeCheckInFirstLastActivityAt falls back to max updated_at without check-ins", () => {
    const keyResults = [
      kr({ id: "k1", objectiveId: "o1", updatedAt: "2025-01-01T00:00:00.000Z" }),
      kr({ id: "k2", objectiveId: "o1", updatedAt: "2025-01-10T00:00:00.000Z" }),
    ];
    const map = new Map<string, string | null>([
      ["k1", null],
      ["k2", null],
    ]);
    expect(computeCheckInFirstLastActivityAt(keyResults, map)).toBe("2025-01-10T00:00:00.000Z");
  });

  it("worstReviewStatus", () => {
    expect(worstReviewStatus([])).toBe("on_track");
    expect(worstReviewStatus(["on_track", "at_risk"])).toBe("at_risk");
    expect(worstReviewStatus(["on_track", "off_track", "at_risk"])).toBe("off_track");
  });

  it("formatStatusDistribution", () => {
    expect(
      formatStatusDistribution({ on_track: 2, at_risk: 1, off_track: 0 })
    ).toBe("2 on track · 1 at risk");
  });

  describe("deriveReviewStatusLinearOkrCycle", () => {
    const start = "2025-01-01T00:00:00.000Z";
    const end = "2025-04-11T00:00:00.000Z";
    const half =
      Date.parse(start) + Math.floor((Date.parse(end) - Date.parse(start)) / 2); // exakt 50 % Zeit

    it("on_track wenn Rückstand ≤ at-risk-Schwelle", () => {
      const e = 50;
      const p = e - OKR_LINEAR_AT_RISK_GAP_PP; // 40
      expect(deriveReviewStatusLinearOkrCycle(p, start, end, half)).toBe("on_track");
    });

    it("at_risk wenn Rückstand > 10 pp und ≤ 30 pp", () => {
      const p = 50 - OKR_LINEAR_AT_RISK_GAP_PP - 1; // 39, Rückstand 11
      expect(deriveReviewStatusLinearOkrCycle(p, start, end, half)).toBe("at_risk");
    });

    it("off_track wenn Rückstand > 30 pp", () => {
      const p = 50 - OKR_LINEAR_OFF_TRACK_GAP_PP - 1; // 19, Rückstand 31
      expect(deriveReviewStatusLinearOkrCycle(p, start, end, half)).toBe("off_track");
    });

    it("vor Zyklusbeginn: erwartet 0 % — hoher Fortschritt trotzdem on_track", () => {
      const before = new Date("2024-12-15T00:00:00.000Z").getTime();
      expect(deriveReviewStatusLinearOkrCycle(0, start, end, before)).toBe("on_track");
    });

    it("nach Zyklusende: erwartet 100 %", () => {
      const after = new Date("2025-05-01T00:00:00.000Z").getTime();
      expect(deriveReviewStatusLinearOkrCycle(85, start, end, after)).toBe("at_risk");
      expect(deriveReviewStatusLinearOkrCycle(65, start, end, after)).toBe("off_track");
    });

    it("ungültiges Fenster → on_track", () => {
      expect(deriveReviewStatusLinearOkrCycle(0, "x", end, half)).toBe("on_track");
    });
  });
});
