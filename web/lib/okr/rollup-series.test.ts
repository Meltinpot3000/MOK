import { describe, expect, it } from "vitest";
import {
  resampleProgressSeriesToWeeks,
  startOfWeekLocalMs,
} from "@/lib/okr/rollup-series";

const MS_DAY = 24 * 60 * 60 * 1000;
const MS_WEEK = 7 * MS_DAY;

describe("resampleProgressSeriesToWeeks", () => {
  it("erzeugt einen Punkt pro Kalenderwoche mit Fortschritt am Wochenende", () => {
    const monday = startOfWeekLocalMs(Date.parse("2026-04-06T12:00:00"));
    const points = resampleProgressSeriesToWeeks([
      { t: monday + 2 * MS_DAY, y: 10 },
      { t: monday + 9 * MS_DAY, y: 50 },
    ]);
    expect(points).toHaveLength(2);
    expect(points[0]?.t).toBe(monday);
    expect(points[0]?.y).toBe(10);
    expect(points[1]?.y).toBe(50);
  });

  it("füllt Wochen ohne Check-in mit letztem bekannten Wert", () => {
    const w0 = startOfWeekLocalMs(Date.parse("2026-01-05T10:00:00"));
    const points = resampleProgressSeriesToWeeks([{ t: w0 + MS_DAY, y: 30 }]);
    expect(points).toHaveLength(1);
    expect(points[0]?.y).toBe(30);
  });

  it("liefert leeres Array bei leerer Eingabe", () => {
    expect(resampleProgressSeriesToWeeks([])).toEqual([]);
  });
});

describe("startOfWeekLocalMs", () => {
  it("normalisiert auf Montag 00:00 lokal", () => {
    const wed = Date.parse("2026-04-08T15:30:00");
    const mon = startOfWeekLocalMs(wed);
    const d = new Date(mon);
    expect(d.getDay()).toBe(1);
    expect(d.getHours()).toBe(0);
  });
});
