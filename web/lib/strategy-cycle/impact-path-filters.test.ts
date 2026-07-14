import { describe, expect, it } from "vitest";
import {
  collectFullPathClosure,
  collectFullPathClosureForEdge,
  computeLongestPathDepthThroughNode,
  findNodeIdsByPathDepthRange,
} from "@/lib/strategy-cycle/impact-path-focus";
import { resolveImpactPathHighlightIds } from "@/components/ceo/strategy-cycle/impact-path/ImpactPathFilters";

describe("impact-path-focus", () => {
  const chain = [
    { sourceId: "analysis", targetId: "challenge" },
    { sourceId: "challenge", targetId: "direction" },
    { sourceId: "direction", targetId: "objective" },
  ];

  it("computes path depth as longest chain through node", () => {
    const depths = computeLongestPathDepthThroughNode(
      ["analysis", "challenge", "direction", "objective", "lonely"],
      chain
    );
    expect(depths.get("analysis")).toBe(3);
    expect(depths.get("challenge")).toBe(3);
    expect(depths.get("direction")).toBe(3);
    expect(depths.get("objective")).toBe(3);
    expect(depths.get("lonely")).toBe(0);
  });

  it("finds nodes on partial paths by depth range", () => {
    const partial = [
      { sourceId: "analysis", targetId: "challenge" },
      { sourceId: "challenge", targetId: "direction" },
    ];
    const ids = findNodeIdsByPathDepthRange(
      ["analysis", "challenge", "direction", "objective"],
      partial,
      2,
      2
    );
    expect(ids).toEqual(["analysis", "challenge", "direction"]);
  });

  it("collects full upstream and downstream from middle node", () => {
    expect(collectFullPathClosure(["challenge"], chain)).toEqual(
      new Set(["analysis", "challenge", "direction", "objective"])
    );
  });

  it("collects full path through selected edge", () => {
    expect(collectFullPathClosureForEdge("challenge", "direction", chain)).toEqual(
      new Set(["analysis", "challenge", "direction", "objective"])
    );
  });
});

describe("impact-path-filters", () => {
  it("highlights full paths for nodes matching path depth range", () => {
    const ids = resolveImpactPathHighlightIds({
      graphNodeIds: ["analysis", "challenge", "direction", "objective", "lonely"],
      edges: [
        { sourceId: "analysis", targetId: "challenge" },
        { sourceId: "challenge", targetId: "direction" },
        { sourceId: "direction", targetId: "objective" },
      ],
      focusMode: true,
      pathDepthMin: 0,
      pathDepthMax: 0,
      selectedNodeId: null,
      selectedEdgeId: null,
      allEdges: [],
    });
    expect(ids).toEqual(new Set(["lonely"]));
  });

  it("highlights complete path when a node is selected", () => {
    const ids = resolveImpactPathHighlightIds({
      graphNodeIds: ["analysis", "challenge", "direction", "objective"],
      edges: [
        { sourceId: "analysis", targetId: "challenge" },
        { sourceId: "challenge", targetId: "direction" },
        { sourceId: "direction", targetId: "objective" },
      ],
      focusMode: true,
      pathDepthMin: 0,
      pathDepthMax: 0,
      selectedNodeId: "challenge",
      selectedEdgeId: null,
      allEdges: [],
    });
    expect(ids).toEqual(new Set(["analysis", "challenge", "direction", "objective"]));
  });
});
