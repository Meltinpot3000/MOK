import { describe, expect, it } from "vitest";
import { buildOkrDashboardGroups } from "@/lib/okr/okr-dashboard-grouping";
import type { OkrObjectiveView } from "@/lib/okr/okr-cycle-view-model";

function ov(partial: {
  id: string;
  title: string;
  ownerMembershipId?: string | null;
  ownerDisplayName?: string | null;
  directionId?: string | null;
  directionTitle?: string | null;
  progress?: number;
  status?: "on_track" | "at_risk" | "off_track";
  krCount?: number;
}): OkrObjectiveView {
  return {
    objective: {
      id: partial.id,
      title: partial.title,
      ownerMembershipId: partial.ownerMembershipId ?? null,
      ownerDisplayName: partial.ownerDisplayName ?? null,
      leadingStrategicDirectionId: partial.directionId ?? null,
      leadingStrategicDirectionTitle: partial.directionTitle ?? null,
    } as OkrObjectiveView["objective"],
    keyResults: Array.from({ length: partial.krCount ?? 1 }, (_, i) => ({
      keyResult: { id: `${partial.id}-kr-${i}`, title: "KR" },
      progress: 50,
      metricProgress: 50,
      trend: "stable" as const,
      reviewStatus: "on_track" as const,
      lastCheckInAt: null,
      lastActivityAt: null,
      effectiveOwnerMembershipId: null,
      effectiveOwnerDisplayName: null,
      effectiveDeputyMembershipId: null,
      effectiveDeputyDisplayName: null,
      confidenceLevel: null,
      pendingHundredCheckIn: false,
      warnings: [],
    })),
    rollupProgressPercent: partial.progress ?? 50,
    rollupStatus: partial.status ?? "on_track",
    statusCounts: { on_track: 1, at_risk: 0, off_track: 0 },
    statusDistributionLabel: "1 on track",
    lastActivityAt: null,
    warnings: [],
  };
}

describe("buildOkrDashboardGroups", () => {
  const rows = [
    ov({
      id: "o1",
      title: "A",
      ownerMembershipId: "u1",
      ownerDisplayName: "Anna",
      directionId: "d1",
      directionTitle: "Wachstum",
      progress: 40,
      krCount: 2,
    }),
    ov({
      id: "o2",
      title: "B",
      ownerMembershipId: "u1",
      ownerDisplayName: "Anna",
      directionId: "d2",
      directionTitle: "Effizienz",
      progress: 80,
      status: "at_risk",
    }),
    ov({
      id: "o3",
      title: "C",
      ownerMembershipId: "u2",
      ownerDisplayName: "Ben",
      directionId: "d1",
      directionTitle: "Wachstum",
      progress: 60,
    }),
  ];

  it("gruppiert nach Owner mit Durchschnittsfortschritt", () => {
    const groups = buildOkrDashboardGroups(rows, "owner");
    expect(groups).toHaveLength(2);
    const anna = groups!.find((g) => g.label === "Anna");
    expect(anna?.objectiveCount).toBe(2);
    expect(anna?.keyResultCount).toBe(3);
    expect(anna?.avgProgressPercent).toBe(60);
    expect(anna?.rollupStatus).toBe("at_risk");
  });

  it("gruppiert nach Stoßrichtung", () => {
    const groups = buildOkrDashboardGroups(rows, "direction");
    expect(groups).toHaveLength(2);
    const wachstum = groups!.find((g) => g.label === "Wachstum");
    expect(wachstum?.objectiveCount).toBe(2);
    expect(wachstum?.avgProgressPercent).toBe(50);
  });
});
