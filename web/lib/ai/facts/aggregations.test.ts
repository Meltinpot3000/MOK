import { describe, expect, it } from "vitest";

import { countBy, distributionByKey, rankByCount } from "./aggregations";

describe("aggregations", () => {
  it("zaehlt und rankt stabil", () => {
    const items = [{ owner: "b" }, { owner: "a" }, { owner: "a" }];
    const counts = countBy(items, (x) => x.owner);
    const ranked = rankByCount(counts);
    expect(ranked).toEqual([
      { key: "a", count: 2, rank: 1 },
      { key: "b", count: 1, rank: 2 },
    ]);
  });

  it("berechnet Distribution mit Shares", () => {
    const items = [{ status: "open" }, { status: "open" }, { status: "done" }];
    const dist = distributionByKey(items, (x) => x.status);
    expect(dist.total).toBe(3);
    expect(dist.buckets).toEqual([
      { label: "open", count: 2, share: 2 / 3 },
      { label: "done", count: 1, share: 1 / 3 },
    ]);
  });
});

