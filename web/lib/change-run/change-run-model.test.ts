import { describe, expect, it } from "vitest";
import {
  assertProgramGateForInitiative,
  classifyAnnualTargetExecutionMode,
  deriveOkrStrategicDirection,
  isProgramSelectableForPlanning,
} from "./change-run-model";

describe("classifyAnnualTargetExecutionMode", () => {
  it("classifies run without program", () => {
    expect(classifyAnnualTargetExecutionMode(null)).toBe("run");
    expect(classifyAnnualTargetExecutionMode(undefined)).toBe("run");
  });

  it("classifies change with program", () => {
    expect(classifyAnnualTargetExecutionMode("prog-1")).toBe("change");
  });
});

describe("assertProgramGateForInitiative", () => {
  it("allows draft initiative on draft program", () => {
    expect(assertProgramGateForInitiative("draft", "draft")).toBeNull();
    expect(assertProgramGateForInitiative("on_hold", "planned")).toBeNull();
  });

  it("requires active program for active initiative", () => {
    expect(assertProgramGateForInitiative("draft", "active")).toBe(
      "active-initiative-needs-active-program"
    );
  });

  it("rejects closed program", () => {
    expect(assertProgramGateForInitiative("closed", "planned")).toBe("initiative-program-closed");
  });
});

describe("isProgramSelectableForPlanning", () => {
  it("accepts draft, on_hold, active", () => {
    expect(isProgramSelectableForPlanning("draft")).toBe(true);
    expect(isProgramSelectableForPlanning("active")).toBe(true);
    expect(isProgramSelectableForPlanning("closed")).toBe(false);
  });
});

describe("deriveOkrStrategicDirection", () => {
  it("prefers change annual target program direction", () => {
    const r = deriveOkrStrategicDirection({
      leadingStrategicDirectionId: "legacy-dir",
      changeAnnualTargetLinks: [
        {
          annualTargetId: "at-1",
          strategyProgramId: "p-1",
          strategicDirectionId: "dir-from-at",
          programDirectionId: "dir-from-program",
        },
      ],
      krInitiativeLinks: [],
    });
    expect(r.directionId).toBe("dir-from-program");
    expect(r.source).toBe("change_annual_target");
  });

  it("derives from initiative program via KR", () => {
    const r = deriveOkrStrategicDirection({
      leadingStrategicDirectionId: null,
      changeAnnualTargetLinks: [],
      krInitiativeLinks: [{ initiativeId: "i-1", programDirectionId: "dir-kr" }],
    });
    expect(r.directionId).toBe("dir-kr");
    expect(r.source).toBe("initiative_program");
  });

  it("warns when only legacy direct direction exists", () => {
    const r = deriveOkrStrategicDirection({
      leadingStrategicDirectionId: "legacy",
      changeAnnualTargetLinks: [],
      krInitiativeLinks: [],
    });
    expect(r.directionId).toBe("legacy");
    expect(r.warning).toBe("no_change_anchor");
  });
});
