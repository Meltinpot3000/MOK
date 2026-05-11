import { describe, expect, it } from "vitest";

import { computeOkrRiskSignalsFromContext } from "./okr-tools";

const NOW = Date.parse("2026-04-01T00:00:00Z");

const baseContext = {
  objectiveViews: [
    {
      objective: { id: "obj-1", title: "Healthy" },
      keyResults: [
        { keyResult: { status: "active" }, lastCheckInAt: "2026-03-30T00:00:00Z", reviewStatus: "on_track" as const },
      ],
      rollupProgressPercent: 75,
      rollupStatus: "on_track" as const,
      lastActivityAt: "2026-03-30T00:00:00Z",
      warnings: [],
    },
    {
      objective: { id: "obj-2", title: "AtRisk" },
      keyResults: [
        { keyResult: { status: "blocked" }, lastCheckInAt: null, reviewStatus: "off_track" as const },
        { keyResult: { status: "at_risk" }, lastCheckInAt: "2026-01-01T00:00:00Z", reviewStatus: "at_risk" as const },
      ],
      rollupProgressPercent: 30,
      rollupStatus: "off_track" as const,
      lastActivityAt: "2026-01-01T00:00:00Z",
      warnings: ["no_checkin_stale"],
    },
    {
      objective: { id: "obj-3", title: "Slight" },
      keyResults: [
        { keyResult: { status: "active" }, lastCheckInAt: "2026-03-15T00:00:00Z", reviewStatus: "at_risk" as const },
      ],
      rollupProgressPercent: 60,
      rollupStatus: "at_risk" as const,
      lastActivityAt: "2026-03-15T00:00:00Z",
      warnings: [],
    },
  ],
};

describe("computeOkrRiskSignalsFromContext", () => {
  it("ignoriert gesundes Objective ohne Risikomerkmale", () => {
    const signals = computeOkrRiskSignalsFromContext(baseContext, { nowMs: NOW });
    expect(signals.some((s) => s.objectiveId === "obj-1")).toBe(false);
  });

  it("ranked off_track-Objective hoeher als at_risk", () => {
    const signals = computeOkrRiskSignalsFromContext(baseContext, { nowMs: NOW, limit: 10 });
    expect(signals[0].objectiveId).toBe("obj-2");
    expect(signals[0].riskScore).toBeGreaterThan(signals[1].riskScore);
  });

  it("setzt staleCheckIn=true bei alten Aktivitaeten", () => {
    const signals = computeOkrRiskSignalsFromContext(baseContext, { nowMs: NOW });
    const off = signals.find((s) => s.objectiveId === "obj-2");
    expect(off?.staleCheckIn).toBe(true);
  });

  it("limit-Cap greift", () => {
    const signals = computeOkrRiskSignalsFromContext(baseContext, { nowMs: NOW, limit: 1 });
    expect(signals).toHaveLength(1);
  });
});
