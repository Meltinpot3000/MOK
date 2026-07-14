import { describe, expect, it } from "vitest";
import { evaluateStrategyReviewProcedureStartGate } from "@/lib/strategy-review/procedure-start-gate";

describe("evaluateStrategyReviewProcedureStartGate", () => {
  it("blocks non-lead without moderate", () => {
    const gate = evaluateStrategyReviewProcedureStartGate({
      membershipId: "m1",
      leadMembershipIds: ["lead-1"],
      canModerate: false,
      daysToEnd: 30,
      leadTimeDays: 90,
    });
    expect(gate.canStart).toBe(false);
    expect(gate.blockReason).toMatch(/Review-Leitung/);
  });

  it("allows lead inside lead window", () => {
    const gate = evaluateStrategyReviewProcedureStartGate({
      membershipId: "lead-1",
      leadMembershipIds: ["lead-1"],
      canModerate: false,
      daysToEnd: 30,
      leadTimeDays: 90,
    });
    expect(gate.canStart).toBe(true);
    expect(gate.inLeadWindow).toBe(true);
    expect(gate.blockReason).toBeNull();
  });

  it("blocks lead outside lead window without moderate", () => {
    const gate = evaluateStrategyReviewProcedureStartGate({
      membershipId: "lead-1",
      leadMembershipIds: ["lead-1"],
      canModerate: false,
      daysToEnd: 120,
      leadTimeDays: 90,
    });
    expect(gate.canStart).toBe(false);
    expect(gate.inLeadWindow).toBe(false);
    expect(gate.blockReason).toMatch(/Lead-Fenster/);
  });

  it("allows moderate override outside lead window", () => {
    const gate = evaluateStrategyReviewProcedureStartGate({
      membershipId: "admin",
      leadMembershipIds: [],
      canModerate: true,
      daysToEnd: 200,
      leadTimeDays: 90,
    });
    expect(gate.canStart).toBe(true);
    expect(gate.blockReason).toMatch(/Override/);
  });
});
