import { describe, expect, it } from "vitest";
import {
  classifyOkrProgressVsPlan,
  computeLinearExpectedProgressPercent,
} from "@/lib/okr/okr-progress-plan-bucket";
import { OKR_LINEAR_AT_RISK_GAP_PP } from "@/lib/okr/okr-cycle-view-model";

describe("okr-progress-plan-bucket", () => {
  const start = "2025-01-01T00:00:00.000Z";
  const end = "2025-04-11T00:00:00.000Z";
  const half =
    Date.parse(start) + Math.floor((Date.parse(end) - Date.parse(start)) / 2);

  it("erwartet 50 % zur Zyklusmitte", () => {
    expect(computeLinearExpectedProgressPercent(start, end, half)).toBeCloseTo(50, 5);
  });

  it("ahead wenn Fortschritt über Erwartung", () => {
    expect(classifyOkrProgressVsPlan(55, start, end, half)).toBe("ahead");
  });

  it("on_plan wenn Rückstand ≤ 10 pp", () => {
    const expected = 50;
    const p = expected - OKR_LINEAR_AT_RISK_GAP_PP;
    expect(classifyOkrProgressVsPlan(p, start, end, half)).toBe("on_plan");
  });

  it("behind wenn Rückstand > 10 pp", () => {
    const p = 50 - OKR_LINEAR_AT_RISK_GAP_PP - 1;
    expect(classifyOkrProgressVsPlan(p, start, end, half)).toBe("behind");
  });
});
