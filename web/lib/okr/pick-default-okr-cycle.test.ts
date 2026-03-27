import { describe, expect, it } from "vitest";
import { pickDefaultOkrCycle, type OkrCyclePickRow } from "./pick-default-okr-cycle";

function c(
  partial: Partial<OkrCyclePickRow> & Pick<OkrCyclePickRow, "id" | "start_date" | "end_date">
): OkrCyclePickRow {
  return {
    id: partial.id,
    start_date: partial.start_date,
    end_date: partial.end_date,
    status: partial.status ?? "active",
  };
}

describe("pickDefaultOkrCycle", () => {
  const ref = new Date("2025-03-15T12:00:00.000Z");

  it("prefers the cycle that contains referenceDate over a newer active future cycle", () => {
    const id = pickDefaultOkrCycle(
      [
        c({ id: "q1", start_date: "2025-01-01", end_date: "2025-03-31", status: "active" }),
        c({ id: "q2", start_date: "2025-04-01", end_date: "2025-06-30", status: "active" }),
      ],
      ref
    );
    expect(id).toBe("q1");
  });

  it("within the current window, prefers active over draft when both span today", () => {
    const id = pickDefaultOkrCycle(
      [
        c({ id: "draft", start_date: "2025-01-01", end_date: "2025-03-31", status: "draft" }),
        c({ id: "live", start_date: "2025-02-01", end_date: "2025-03-31", status: "active" }),
      ],
      ref
    );
    expect(id).toBe("live");
  });

  it("when no cycle contains the date, picks the interval closest to reference (past can win)", () => {
    const id = pickDefaultOkrCycle(
      [
        c({ id: "past", start_date: "2024-01-01", end_date: "2024-12-31", status: "active" }),
        c({ id: "next", start_date: "2025-06-01", end_date: "2025-08-31", status: "active" }),
      ],
      ref
    );
    expect(id).toBe("past");
  });

  it("when no cycle contains the date, picks nearest future if it is closer", () => {
    const may = new Date("2025-05-15T12:00:00.000Z");
    const id = pickDefaultOkrCycle(
      [
        c({ id: "past", start_date: "2024-01-01", end_date: "2024-12-31", status: "active" }),
        c({ id: "next", start_date: "2025-06-01", end_date: "2025-08-31", status: "active" }),
      ],
      may
    );
    expect(id).toBe("next");
  });
});
