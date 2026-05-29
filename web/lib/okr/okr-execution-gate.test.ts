import { describe, expect, it } from "vitest";
import { okrCheckInBlockedMessageDe, okrObjectiveAllowsCheckIn } from "@/lib/okr/okr-execution-gate";

describe("okrObjectiveAllowsCheckIn", () => {
  it("allows active and at_risk only", () => {
    expect(okrObjectiveAllowsCheckIn("active")).toBe(true);
    expect(okrObjectiveAllowsCheckIn("at_risk")).toBe(true);
    expect(okrObjectiveAllowsCheckIn("draft")).toBe(false);
    expect(okrObjectiveAllowsCheckIn("pending_approval")).toBe(false);
  });
});

describe("okrCheckInBlockedMessageDe", () => {
  it("mentions Freigabe for draft", () => {
    expect(okrCheckInBlockedMessageDe("draft")).toContain("Freigabe");
  });
});
