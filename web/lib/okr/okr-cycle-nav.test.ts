import { describe, expect, it } from "vitest";
import { resolveNextOkrCycleId } from "./okr-cycle-nav";

describe("resolveNextOkrCycleId", () => {
  const cycles = [
    { id: "a", start_date: "2025-01-01" },
    { id: "b", start_date: "2025-04-01" },
    { id: "c", start_date: "2025-07-01" },
  ];

  it("returns null without current id", () => {
    expect(resolveNextOkrCycleId(cycles, null)).toBeNull();
    expect(resolveNextOkrCycleId(cycles, "")).toBeNull();
  });

  it("returns null for unknown current id", () => {
    expect(resolveNextOkrCycleId(cycles, "zzz")).toBeNull();
  });

  it("returns null for last cycle", () => {
    expect(resolveNextOkrCycleId(cycles, "c")).toBeNull();
  });

  it("returns chronological successor even when input order is shuffled", () => {
    const shuffled = [cycles[2], cycles[0], cycles[1]];
    expect(resolveNextOkrCycleId(shuffled, "a")).toBe("b");
    expect(resolveNextOkrCycleId(shuffled, "b")).toBe("c");
  });

  it("returns first successor for single-entry list", () => {
    expect(resolveNextOkrCycleId([{ id: "only", start_date: "2025-01-01" }], "only")).toBeNull();
  });
});
