import { describe, expect, it } from "vitest";
import {
  assignmentKindsForObjectType,
  readAssignmentIds,
  toggleAssignmentId,
  writeAssignmentIds,
} from "./assignments";

describe("assignmentKindsForObjectType", () => {
  it("includes analysis_entry only for challenges", () => {
    expect(assignmentKindsForObjectType("strategic_challenge")).toContain("analysis_entry");
    expect(assignmentKindsForObjectType("strategic_objective")).not.toContain("analysis_entry");
    expect(assignmentKindsForObjectType("strategic_direction")).not.toContain("analysis_entry");
  });
});

describe("analysis_entry payload", () => {
  it("round-trips in definition payload", () => {
    const payload = writeAssignmentIds(null, "analysis_entry", ["e1", "e2"]);
    expect(readAssignmentIds(payload, "analysis_entry")).toEqual(["e1", "e2"]);
    const toggled = toggleAssignmentId(payload, "analysis_entry", "e3", "link");
    expect(readAssignmentIds(toggled, "analysis_entry")).toEqual(["e1", "e2", "e3"]);
  });
});
