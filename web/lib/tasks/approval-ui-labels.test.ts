import { describe, expect, it } from "vitest";
import {
  formatApprovalTaskTitleDe,
  taskStatusLabelDe,
  taskTypeLabelDe,
} from "@/lib/tasks/approval-ui-labels";

describe("approval-ui-labels", () => {
  it("translates approval task title prefix", () => {
    expect(formatApprovalTaskTitleDe("Approval: Test")).toBe("Freigabe: Test");
  });

  it("labels task type and status in German", () => {
    expect(taskTypeLabelDe("approval")).toBe("Freigabe");
    expect(taskStatusLabelDe("open")).toBe("Offen");
  });
});
