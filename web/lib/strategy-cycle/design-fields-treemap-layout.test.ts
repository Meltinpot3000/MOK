import { describe, expect, it } from "vitest";
import { layoutBinaryTreemap } from "@/lib/ui/binary-treemap";
import {
  assertTreemapWithinCanvas,
  buildDesignFieldTreemapInputs,
  childNodesInsideParentBody,
  computeUnassignedDisplayWeight,
  isLinearStripLayout,
  layoutDesignFieldTreemap,
} from "@/lib/strategy-cycle/design-fields-treemap-layout";
import {
  DESIGN_FIELD_PALETTE,
  STATUS_STYLES,
  UNASSIGNED_FIELD_STYLE,
  paletteForField,
  statusBadgeClass,
} from "@/components/ceo/strategy-cycle/design-fields/design-fields-ui";
import type { DesignFieldNode } from "@/lib/strategy-cycle/design-fields-treemap";
import { UNGROUPED_FIELD_ID } from "@/lib/strategy-cycle/design-fields-treemap";

function node(overrides: Partial<DesignFieldNode> & Pick<DesignFieldNode, "id" | "label">): DesignFieldNode {
  return {
    nodeKind: "strategic_field",
    directionCount: 1,
    weight: 10,
    layoutWeight: 10,
    status: "medium",
    shortStatus: "HF mittel · Ziele mittel",
    structureHint: null,
    topDirections: [],
    directions: [{ directionId: "d1", title: "SR 1", score: 10, challengeImpact: 5, objectiveAlignment: 3, linkedChallengeTitles: [], linkedObjectiveTitles: [], hasStrongObjectiveLink: false }],
    challengeTitles: [],
    objectiveTitles: [],
    reviewHints: [],
    ...overrides,
  };
}

describe("layoutBinaryTreemap", () => {
  it("keeps all nodes inside canvas with positive dimensions", () => {
    const rects = layoutBinaryTreemap(
      [
        { id: "a", weight: 100 },
        { id: "b", weight: 50 },
        { id: "c", weight: 30 },
        { id: "d", weight: 20 },
      ],
      640,
      420
    );
    expect(rects).toHaveLength(4);
    for (const r of rects) {
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(640.5);
      expect(r.y + r.height).toBeLessThanOrEqual(420.5);
    }
  });

  it("assigns largest node the biggest area", () => {
    const rects = layoutBinaryTreemap(
      [
        { id: "big", weight: 200 },
        { id: "mid", weight: 80 },
        { id: "small", weight: 20 },
      ],
      500,
      300
    );
    const area = (id: string) => {
      const r = rects.find((x) => x.id === id)!;
      return r.width * r.height;
    };
    expect(area("big")).toBeGreaterThan(area("mid"));
    expect(area("mid")).toBeGreaterThan(area("small"));
  });

  it("does not lay out four equal nodes as a single strip on wide canvas", () => {
    const rects = layoutBinaryTreemap(
      [
        { id: "a", weight: 25 },
        { id: "b", weight: 25 },
        { id: "c", weight: 25 },
        { id: "d", weight: 25 },
      ],
      800,
      400
    );
    const sameY = rects.every((r) => Math.abs(r.y - rects[0].y) < 2);
    const sameX = rects.every((r) => Math.abs(r.x - rects[0].x) < 2);
    expect(sameY && sameX).toBe(false);
  });

  it("marks tiny and compact nodes", () => {
    const rects = layoutBinaryTreemap([{ id: "only", weight: 1 }], 30, 20);
    expect(rects[0]?.tiny).toBe(true);
    expect(rects[0]?.compact).toBe(true);
  });
});

describe("layoutDesignFieldTreemap", () => {
  it("lays out hierarchical nodes within canvas and parent body", () => {
    const inputs = buildDesignFieldTreemapInputs([
      node({
        id: "field:a",
        label: "Feld A",
        weight: 60,
        layoutWeight: 60,
        directions: [
          { directionId: "d1", title: "A1", score: 35, challengeImpact: 1, objectiveAlignment: 1, linkedChallengeTitles: [], linkedObjectiveTitles: [], hasStrongObjectiveLink: false },
          { directionId: "d2", title: "A2", score: 25, challengeImpact: 1, objectiveAlignment: 1, linkedChallengeTitles: [], linkedObjectiveTitles: [], hasStrongObjectiveLink: false },
        ],
      }),
      node({
        id: "field:b",
        label: "Feld B",
        weight: 40,
        layoutWeight: 40,
        directions: [
          { directionId: "d3", title: "B1", score: 40, challengeImpact: 1, objectiveAlignment: 1, linkedChallengeTitles: [], linkedObjectiveTitles: [], hasStrongObjectiveLink: false },
        ],
      }),
    ]);

    const layout = layoutDesignFieldTreemap(inputs, 640, 420);
    expect(assertTreemapWithinCanvas(layout, 640, 420)).toBe(true);

    const fields = layout.filter((n) => n.type === "designField");
    expect(isLinearStripLayout(fields)).toBe(false);
    expect(childNodesInsideParentBody(layout, "field:a")).toBe(true);
    expect(childNodesInsideParentBody(layout, "field:b")).toBe(true);
  });

  it("uses display weight for unassigned without changing actual weight", () => {
    const actual = 150;
    const display = computeUnassignedDisplayWeight(actual, [30, 22]);
    expect(display).toBeLessThan(actual);

    const inputs = buildDesignFieldTreemapInputs([
      node({ id: "field:a", label: "A", weight: 30, layoutWeight: 30 }),
      node({
        id: UNGROUPED_FIELD_ID,
        label: "Ohne Designfeld",
        nodeKind: "ungrouped_backlog",
        weight: actual,
        layoutWeight: display,
        directionCount: 10,
        directions: Array.from({ length: 10 }, (_, i) => ({
          directionId: `u${i}`,
          title: `U${i}`,
          score: 15,
          challengeImpact: 0,
          objectiveAlignment: 0,
          linkedChallengeTitles: [],
          linkedObjectiveTitles: [],
          hasStrongObjectiveLink: false,
        })),
      }),
    ]);

    const unassigned = inputs.find((f) => f.isUnassigned);
    expect(unassigned?.weight).toBe(actual);
    expect(unassigned?.displayWeight).toBeLessThan(actual);

    const layout = layoutDesignFieldTreemap(inputs, 640, 420);
    const fieldNodes = layout.filter((n) => n.type === "designField");
    const unassignedRect = fieldNodes.find((n) => n.isUnassigned);
    const regularRect = fieldNodes.find((n) => !n.isUnassigned);
    expect(unassignedRect).toBeDefined();
    expect(regularRect).toBeDefined();
    const unassignedArea = (unassignedRect!.width * unassignedRect!.height);
    const totalArea = fieldNodes.reduce((s, n) => s + n.width * n.height, 0);
    expect(unassignedArea / totalArea).toBeLessThan(0.75);
  });
});

describe("design field palette and status styles", () => {
  it("maps statuses to distinct badge classes", () => {
    expect(statusBadgeClass("good")).toContain("emerald");
    expect(statusBadgeClass("warning")).toContain("amber");
    expect(statusBadgeClass("critical")).toContain("red");
    expect(statusBadgeClass("unknown")).toContain("zinc");
  });

  it("uses distinct palette colors for regular fields and dashed orange for unassigned", () => {
    expect(paletteForField(0).header).toContain("sky");
    expect(paletteForField(1).header).toContain("emerald");
    expect(DESIGN_FIELD_PALETTE.length).toBeGreaterThanOrEqual(5);
    expect(UNASSIGNED_FIELD_STYLE.dashed).toContain("dashed");
    expect(paletteForField(-1, true).bg).toContain("orange");
    expect(STATUS_STYLES.critical.badge).toContain("red");
  });
});
