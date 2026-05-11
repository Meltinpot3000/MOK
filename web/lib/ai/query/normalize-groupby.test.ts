import { describe, expect, it } from "vitest";

import { normalizeGroupBy } from "./query-types";

describe("normalizeGroupBy", () => {
  it("normalisiert owner-aliases", () => {
    expect(normalizeGroupBy("owners")).toBe("owner");
    expect(normalizeGroupBy("ownerMembership")).toBe("owner");
  });

  it("normalisiert status/assignee", () => {
    expect(normalizeGroupBy("status")).toBe("status");
    expect(normalizeGroupBy("assignedTo")).toBe("assignee");
  });
});

