import { describe, expect, it } from "vitest";
import { buildDesignReviewHints } from "@/lib/strategy-cycle/design-review-hints";
import type { StrategicDesignConflict } from "@/lib/strategy-cycle/strategic-design-insights";

describe("buildDesignReviewHints", () => {
  const fitConflict: StrategicDesignConflict = {
    type: "correlation_weak",
    challengeId: "ch1",
    objectiveId: "obj1",
    challengeTitle: "Challenge A",
    objectiveTitle: "Objective B",
    score: 42,
    explanationDe: "Passungshinweis (Herausforderung → Ziel): schwache oder unsichere Übereinstimmung im Modell (Score 42).",
  };

  const unsupportedObjective: StrategicDesignConflict = {
    type: "unsupported_objective",
    objectiveId: "obj2",
    objectiveTitle: "Objective C",
    explanationDe: "Wichtiges Ziel mit schwacher oder dünner Anbindung an Stoßrichtungen im Modell — Unterstützung und Verknüpfungen prüfen.",
  };

  const misalignedDirection: StrategicDesignConflict = {
    type: "misaligned_direction",
    directionId: "dir1",
    directionTitle: "Direction D",
    challengeImpact: 80,
    objectiveAlignment: 20,
    explanationDe: "Hohe Problemlast über Herausforderungen, aber geringe Anbindung an Ziele über diese Stoßrichtung — Zielverankerung im Modell prüfen.",
  };

  const overrideCell = {
    key: "obj1:ch1:dir1",
    cellKey: "ch1:obj1",
    challengeId: "ch1",
    objectiveId: "obj1",
    challengeTitle: "Challenge A",
    objectiveTitle: "Objective B",
    directionId: "dir1",
    directionTitle: "Direction D",
    autoScore: 72,
    autoStatus: "green" as const,
    effectiveStatus: "red" as const,
    overrideNote: "Fachlich bewusst abweichend",
  };

  it("maps correlation_weak to fit with Passungshinweis badge", () => {
    const result = buildDesignReviewHints({
      conflicts: [fitConflict],
      conflictCells: [],
    });

    expect(result.fit).toHaveLength(1);
    expect(result.fit[0]?.badgeLabelDe).toBe("Passungshinweis");
    expect(result.fit[0]?.relationLabelDe).toBe("Herausforderung → Ziel");
    expect(result.fit[0]?.titleDe).toContain("→");
    expect(result.fit[0]?.titleDe).not.toContain("↔");
    expect(result.fit[0]?.badgeLabelDe).not.toContain("Konflikt");
  });

  it("maps unsupported_objective to anchoring with subtype", () => {
    const result = buildDesignReviewHints({
      conflicts: [unsupportedObjective],
      conflictCells: [],
    });

    expect(result.anchoring).toHaveLength(1);
    expect(result.anchoring[0]?.subtypeLabelDe).toBe("Ziel schwach angebunden");
    expect(result.anchoring[0]?.relationLabelDe).toBe("Ziel → Stoßrichtungen");
    expect(result.anchoring[0]?.actionHref).toContain("strategy-matrix");
  });

  it("maps misaligned_direction to anchoring with direction subtype", () => {
    const result = buildDesignReviewHints({
      conflicts: [misalignedDirection],
      conflictCells: [],
    });

    expect(result.anchoring).toHaveLength(1);
    expect(result.anchoring[0]?.subtypeLabelDe).toBe("Stoßrichtung mit schwachem Zielbeitrag");
    expect(result.anchoring[0]?.relationLabelDe).toBe("Stoßrichtung → Ziele");
  });

  it("maps conflictCells to override category", () => {
    const result = buildDesignReviewHints({
      conflicts: [],
      conflictCells: [overrideCell],
    });

    expect(result.override).toHaveLength(1);
    expect(result.override[0]?.badgeLabelDe).toBe("Override");
    expect(result.override[0]?.hintDe).toContain("Stoßrichtung: Direction D");
    expect(result.override[0]?.actionHref).toContain("summary");
  });

  it("summary total matches item counts and openReviewHintsCount in standard case", () => {
    const conflicts = [fitConflict, unsupportedObjective, misalignedDirection];
    const result = buildDesignReviewHints({
      conflicts,
      conflictCells: [overrideCell],
      openReviewHintsCount: conflicts.length + 1,
    });

    expect(result.summary).toEqual({
      fit: 1,
      anchoring: 2,
      override: 1,
      total: 4,
    });
    expect(result.snapshotDelta).toBeUndefined();
  });

  it("sets snapshotDelta when counts diverge without throwing", () => {
    const result = buildDesignReviewHints({
      conflicts: [fitConflict],
      conflictCells: [],
      openReviewHintsCount: 5,
    });

    expect(result.summary.total).toBe(1);
    expect(result.snapshotDelta).toBe(4);
  });

  it("uses UTF-8 labels without escaped unicode sequences", () => {
    const result = buildDesignReviewHints({
      conflicts: [fitConflict, unsupportedObjective],
      conflictCells: [],
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/\\u2194/);
    expect(serialized).toContain("Herausforderung → Ziel");
    expect(serialized).toContain("Stoßrichtungen");
    expect(fitConflict.explanationDe).toContain("Übereinstimmung");
  });
});
