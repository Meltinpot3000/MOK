import { describe, expect, it } from "vitest";
import {
  okrObjectiveEditableInPlanning,
  okrObjectiveLifecycleLabelDe,
  okrObjectiveVisibleInTracking,
  okrPlanningEditBlockedMessageDe,
} from "@/lib/okr/okr-objective-lifecycle";

describe("okrObjectiveVisibleInTracking", () => {
  it("hides draft only", () => {
    expect(okrObjectiveVisibleInTracking("draft")).toBe(false);
    expect(okrObjectiveVisibleInTracking("")).toBe(false);
    expect(okrObjectiveVisibleInTracking("pending_approval")).toBe(true);
    expect(okrObjectiveVisibleInTracking("active")).toBe(true);
  });
});

describe("okrObjectiveLifecycleLabelDe", () => {
  it("labels pending approval", () => {
    expect(okrObjectiveLifecycleLabelDe("pending_approval")).toBe("Freigabe ausstehend");
  });
});

describe("okrObjectiveEditableInPlanning", () => {
  it("allows draft only", () => {
    expect(okrObjectiveEditableInPlanning("draft")).toBe(true);
    expect(okrObjectiveEditableInPlanning("active")).toBe(false);
    expect(okrObjectiveEditableInPlanning("pending_approval")).toBe(false);
  });
});

describe("okrPlanningEditBlockedMessageDe", () => {
  it("returns null for draft", () => {
    expect(okrPlanningEditBlockedMessageDe("draft")).toBeNull();
  });

  it("blocks active after approval", () => {
    expect(okrPlanningEditBlockedMessageDe("active")).toContain("freigegeben");
  });
});
