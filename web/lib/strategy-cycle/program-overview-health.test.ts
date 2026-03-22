import { describe, expect, it } from "vitest";
import { deriveProgramOverviewHealth } from "./program-overview-health";

describe("deriveProgramOverviewHealth", () => {
  it("returns grey when no active initiatives", () => {
    expect(deriveProgramOverviewHealth({ initiativeActiveCount: 0, progressPercent: 100 })).toBe("grey");
  });

  it("uses progress bands when at least one active initiative", () => {
    expect(deriveProgramOverviewHealth({ initiativeActiveCount: 1, progressPercent: 70 })).toBe("green");
    expect(deriveProgramOverviewHealth({ initiativeActiveCount: 2, progressPercent: 69.9 })).toBe("yellow");
    expect(deriveProgramOverviewHealth({ initiativeActiveCount: 1, progressPercent: 30 })).toBe("yellow");
    expect(deriveProgramOverviewHealth({ initiativeActiveCount: 1, progressPercent: 29 })).toBe("red");
  });

  it("treats non-finite progress as grey even with active initiatives", () => {
    expect(deriveProgramOverviewHealth({ initiativeActiveCount: 1, progressPercent: Number.NaN })).toBe("grey");
  });
});
