import { describe, expect, it } from "vitest";
import {
  UNGROUPED_FIELD_ID,
  classifyDesignFieldStatus,
  computeDesignFieldsTreemap,
  type DesignFieldDirection,
} from "@/lib/strategy-cycle/design-fields-treemap";
import { squarifyTreemap, squarifyHierarchicalTreemap } from "@/lib/ui/squarify-treemap";
import { layoutBinaryTreemap } from "@/lib/ui/binary-treemap";

function dir(
  overrides: Partial<DesignFieldDirection> & { directionId: string; title: string }
): DesignFieldDirection {
  return {
    score: 10,
    challengeImpact: 20,
    objectiveAlignment: 5,
    linkedChallengeTitles: [],
    linkedObjectiveTitles: [],
    hasStrongObjectiveLink: false,
    ...overrides,
  };
}

describe("computeDesignFieldsTreemap", () => {
  it("returns none state when no groupings exist", () => {
    const r = computeDesignFieldsTreemap({
      strategicDirections: [
        { id: "d1", title: "A", grouping: null },
        { id: "d2", title: "B", grouping: "  " },
      ],
      challenges: [],
      objectives: [],
      challengeDirectionLinks: [],
      directionObjectiveLinks: [],
    });
    expect(r.portfolioState).toBe("none");
    expect(r.nodes).toHaveLength(1);
    expect(r.nodes[0].id).toBe(UNGROUPED_FIELD_ID);
    expect(r.nodes[0].nodeKind).toBe("ungrouped_backlog");
    expect(r.nodes[0].status).toBe("weak");
    expect(r.nodes[0].layoutWeight).toBe(r.nodes[0].weight);
    expect(r.summaryFinding).toContain("Noch keine Designfelder definiert");
  });

  it("groups by grouping and adds ungrouped backlog tile", () => {
    const r = computeDesignFieldsTreemap({
      strategicDirections: [
        { id: "d1", title: "A", grouping: "Wachstum" },
        { id: "d2", title: "B", grouping: "Wachstum" },
        { id: "d3", title: "C", grouping: null },
      ],
      challenges: [{ id: "c1", title: "Ch1", challenge_score: 80 }],
      objectives: [{ id: "o1", title: "Z1", importance_score: 5 }],
      challengeDirectionLinks: [
        { strategic_challenge_id: "c1", strategic_direction_id: "d1", contribution_level: "high" },
      ],
      directionObjectiveLinks: [
        { strategic_direction_id: "d1", objective_id: "o1", contribution_level: "high" },
      ],
    });
    expect(r.portfolioState).toBe("partial");
    expect(r.assignedCount).toBe(2);
    expect(r.nodes.some((n) => n.label === "Wachstum" && n.nodeKind === "strategic_field")).toBe(true);
    expect(r.nodes.some((n) => n.nodeKind === "ungrouped_backlog")).toBe(true);
    const field = r.nodes.find((n) => n.label === "Wachstum");
    expect(field?.directionCount).toBe(2);
    expect(field?.weight).toBeGreaterThan(0);
  });

  it("ungrouped backlog always weak status with structure hint", () => {
    const r = computeDesignFieldsTreemap({
      strategicDirections: [{ id: "d1", title: "A" }],
      challenges: [],
      objectives: [],
      challengeDirectionLinks: [],
      directionObjectiveLinks: [],
    });
    const backlog = r.nodes[0];
    expect(backlog.nodeKind).toBe("ungrouped_backlog");
    expect(backlog.status).toBe("weak");
    expect(backlog.structureHint).toContain("noch keinem Designfeld");
  });

  it("weight is sum of direction scores independent of status", () => {
    const r = computeDesignFieldsTreemap({
      strategicDirections: [
        { id: "d1", title: "Strong", grouping: "F1" },
        { id: "d2", title: "Weak", grouping: "F2" },
      ],
      challenges: [
        { id: "c1", title: "Ch", challenge_score: 90 },
        { id: "c2", title: "Ch2", challenge_score: 90 },
      ],
      objectives: [
        { id: "o1", title: "Z", importance_score: 5 },
        { id: "o2", title: "Z2", importance_score: 5 },
      ],
      challengeDirectionLinks: [
        { strategic_challenge_id: "c1", strategic_direction_id: "d1", contribution_level: "high" },
        { strategic_challenge_id: "c2", strategic_direction_id: "d2", contribution_level: "high" },
      ],
      directionObjectiveLinks: [
        { strategic_direction_id: "d1", objective_id: "o1", contribution_level: "high" },
      ],
    });
    const f1 = r.nodes.find((n) => n.label === "F1");
    const f2 = r.nodes.find((n) => n.label === "F2");
    expect(f1?.weight).toBeGreaterThan(f2?.weight ?? 0);
    expect(f1?.status).not.toBe(f2?.status);
  });

  it("caps ungrouped backlog layout weight when strategic fields exist", () => {
    const directions = Array.from({ length: 10 }, (_, i) => ({
      id: `u${i}`,
      title: `Ungrouped ${i}`,
      grouping: null as string | null,
    }));
    const r = computeDesignFieldsTreemap({
      strategicDirections: [
        { id: "d1", title: "Grouped", grouping: "Feld A" },
        ...directions,
      ],
      challenges: Array.from({ length: 10 }, (_, i) => ({
        id: `c${i}`,
        title: `Ch ${i}`,
        challenge_score: 70,
      })),
      objectives: [],
      challengeDirectionLinks: directions.map((d, i) => ({
        strategic_challenge_id: `c${i}`,
        strategic_direction_id: d.id,
        contribution_level: "high" as const,
      })),
      directionObjectiveLinks: [],
    });
    const backlog = r.nodes.find((n) => n.nodeKind === "ungrouped_backlog");
    const strategic = r.nodes.find((n) => n.nodeKind === "strategic_field");
    expect(backlog).toBeDefined();
    expect(strategic).toBeDefined();
    expect(backlog!.layoutWeight).toBeLessThan(backlog!.weight);
  });
});

describe("classifyDesignFieldStatus", () => {
  it("marks weak when objective support is low", () => {
    const status = classifyDesignFieldStatus(
      [dir({ directionId: "d1", title: "X", challengeImpact: 50, objectiveAlignment: 0 })],
      50,
      20
    );
    expect(status).toBe("weak");
  });
});

describe("binary treemap integration", () => {
  it("binary layout gives largest item dominant area", () => {
    const rects = layoutBinaryTreemap(
      [
        { id: "a", weight: 120 },
        { id: "b", weight: 40 },
      ],
      400,
      200
    );
    const a = rects.find((r) => r.id === "a")!;
    const b = rects.find((r) => r.id === "b")!;
    expect(a.width * a.height).toBeGreaterThan(b.width * b.height);
  });
});

describe("squarifyTreemap", () => {
  it("uses weight only for layout areas", () => {
    const rects = squarifyTreemap(
      [
        { id: "a", weight: 100 },
        { id: "b", weight: 50 },
      ],
      400,
      200
    );
    expect(rects).toHaveLength(2);
    const a = rects.find((r) => r.id === "a");
    const b = rects.find((r) => r.id === "b");
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    const areaA = (a?.width ?? 0) * (a?.height ?? 0);
    const areaB = (b?.width ?? 0) * (b?.height ?? 0);
    expect(areaA).toBeGreaterThan(areaB);
  });

  it("same weight yields same area regardless of id", () => {
    const r1 = squarifyTreemap(
      [
        { id: "strong", weight: 80 },
        { id: "weak", weight: 20 },
      ],
      300,
      200
    );
    const r2 = squarifyTreemap(
      [
        { id: "a", weight: 80 },
        { id: "b", weight: 20 },
      ],
      300,
      200
    );
    const area = (r: { width: number; height: number }) => r.width * r.height;
    const big1 = r1.find((x) => x.id === "strong");
    const big2 = r2.find((x) => x.id === "a");
    expect(area(big1!)).toBeCloseTo(area(big2!), 0);
  });
});

describe("squarifyHierarchicalTreemap", () => {
  it("nests direction rects inside field rects within bounds", () => {
    const rects = squarifyHierarchicalTreemap(
      [
        {
          id: "f1",
          weight: 100,
          children: [
            { id: "f1::d1", weight: 60 },
            { id: "f1::d2", weight: 40 },
          ],
        },
        { id: "f2", weight: 50, children: [{ id: "f2::d3", weight: 20 }] },
      ],
      400,
      240
    );
    const fields = rects.filter((r) => r.kind === "field");
    const directions = rects.filter((r) => r.kind === "direction");
    expect(fields).toHaveLength(2);
    expect(directions.length).toBeGreaterThanOrEqual(2);
    for (const d of directions) {
      const parent = fields.find((f) => f.id === d.parentId);
      expect(parent).toBeDefined();
      expect(d.x).toBeGreaterThanOrEqual(parent!.x);
      expect(d.y).toBeGreaterThanOrEqual(parent!.y);
      expect(d.x + d.width).toBeLessThanOrEqual(parent!.x + parent!.width + 1);
      expect(d.y + d.height).toBeLessThanOrEqual(parent!.y + parent!.height + 1);
    }
  });
});
