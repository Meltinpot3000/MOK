import { describe, expect, it } from "vitest";
import { linearCycleProgressPercent } from "@/lib/ceo/planning-cycle-time-progress";

describe("linearCycleProgressPercent (Cycle Map Ring)", () => {
  it("Anfang April: früher im Quartal nur wenige Prozent, nicht 33 % durch Monats-Heuristik", () => {
    const start = "2026-04-01T00:00:00.000Z";
    const end = "2026-06-30T00:00:00.000Z";
    const weekIn = Date.parse("2026-04-07T12:00:00.000Z");
    const span = Date.parse(end) - Date.parse(start);
    const expected = ((weekIn - Date.parse(start)) / span) * 100;
    expect(linearCycleProgressPercent(start, end, weekIn)).toBeCloseTo(expected, 5);
    expect(linearCycleProgressPercent(start, end, weekIn)).toBeLessThan(10);
  });

  it("Zyklusmitte ≈ 50 %", () => {
    const start = "2026-04-01T00:00:00.000Z";
    const end = "2026-06-30T23:59:59.000Z";
    const mid = Date.parse(start) + (Date.parse(end) - Date.parse(start)) / 2;
    expect(linearCycleProgressPercent(start, end, mid)).toBeCloseTo(50, 0);
  });

  it("ungültiges Fenster → 0", () => {
    expect(linearCycleProgressPercent("x", "2026-06-30T00:00:00.000Z", Date.now())).toBe(0);
  });
});
