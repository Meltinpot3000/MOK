import { describe, expect, it } from "vitest";
import {
  computeCheckInFirstLastActivityAt,
  formatStatusDistribution,
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
});
