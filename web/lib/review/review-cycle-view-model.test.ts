import { describe, expect, it } from "vitest";
import { resolveStrategicDirectionForInitiative } from "@/lib/review/review-cycle-view-model";

describe("resolveStrategicDirectionForInitiative", () => {
  const programById = new Map([
    ["prog-1", { id: "prog-1", strategic_direction_id: "dir-1" }],
  ]);
  const annualTargetById = new Map([
    ["at-1", { id: "at-1", strategic_direction_id: "dir-legacy" }],
  ]);

  it("prefers program direction", () => {
    const r = resolveStrategicDirectionForInitiative(
      { id: "i-1", program_id: "prog-1" },
      programById,
      [],
      annualTargetById
    );
    expect(r.directionId).toBe("dir-1");
    expect(r.resolvedDirectionSource).toBe("program");
  });

  it("falls back to legacy annual target link with nachpflege flag", () => {
    const r = resolveStrategicDirectionForInitiative(
      { id: "i-2", program_id: null },
      programById,
      [{ initiative_id: "i-2", annual_target_id: "at-1" }],
      annualTargetById
    );
    expect(r.directionId).toBe("dir-legacy");
    expect(r.resolvedDirectionSource).toBe("legacy_annual_target");
    expect(r.legacyNachpflege).toBe(true);
  });
});
