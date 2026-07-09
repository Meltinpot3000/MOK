import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  resolveAnnualPlanningCycle,
  resolveOkrPlanningCycle,
  resolveStrategyPlanningCycle,
} from "@/lib/strategy-cycle/pick-strategy-planning-cycle";
import * as phase0 from "@/lib/phase0/queries";

describe("pick-strategy-planning-cycle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resolveStrategyPlanningCycle nutzt Ebene 1", async () => {
    const spy = vi.spyOn(phase0, "getPlanningCycleAtLevel").mockResolvedValue({ id: "l1" } as never);
    await resolveStrategyPlanningCycle("org-1", { preferredCycleId: "x" });
    expect(spy).toHaveBeenCalledWith("org-1", 1, "x");
  });

  it("resolveAnnualPlanningCycle nutzt Ebene 2", async () => {
    const spy = vi.spyOn(phase0, "getPlanningCycleAtLevel").mockResolvedValue({ id: "l2" } as never);
    await resolveAnnualPlanningCycle("org-1");
    expect(spy).toHaveBeenCalledWith("org-1", 2, undefined);
  });

  it("resolveOkrPlanningCycle nutzt Ebene 3", async () => {
    const spy = vi.spyOn(phase0, "getPlanningCycleAtLevel").mockResolvedValue({ id: "l3" } as never);
    await resolveOkrPlanningCycle("org-1");
    expect(spy).toHaveBeenCalledWith("org-1", 3, undefined);
  });
});
