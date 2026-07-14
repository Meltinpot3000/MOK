import { describe, expect, it } from "vitest";
import {
  canConnectNodes,
  edgeKindForNodePair,
  findDropTargetNodeId,
  handlesForNodeKind,
  resolveImpactPathHandleVisibility,
} from "@/lib/strategy-cycle/impact-path-connect";
import type { ImpactPathEdge, ImpactPathNode } from "@/lib/strategy-cycle/impact-path-graph";
import { buildImpactPathEdgeId } from "@/lib/strategy-cycle/impact-path-graph";

const analysis: ImpactPathNode = { id: "a1", kind: "analysis_entry", title: "A" };
const challenge: ImpactPathNode = { id: "c1", kind: "challenge", title: "C" };
const direction: ImpactPathNode = { id: "d1", kind: "direction", title: "D" };
const objective: ImpactPathNode = { id: "o1", kind: "objective", title: "O" };

describe("impact-path-connect", () => {
  it("exposes column-aware handles", () => {
    expect(handlesForNodeKind("analysis_entry")).toEqual(["out"]);
    expect(handlesForNodeKind("challenge")).toEqual(["in", "out"]);
    expect(handlesForNodeKind("objective")).toEqual(["in"]);
  });

  it("resolves edge kinds for adjacent columns only", () => {
    expect(edgeKindForNodePair("analysis_entry", "challenge")).toBe("analysis_to_challenge");
    expect(edgeKindForNodePair("challenge", "direction")).toBe("challenge_to_direction");
    expect(edgeKindForNodePair("analysis_entry", "direction")).toBeNull();
  });

  it("blocks duplicate active links", () => {
    const edges: ImpactPathEdge[] = [
      {
        id: buildImpactPathEdgeId("challenge_to_direction", "c1", "d1"),
        kind: "challenge_to_direction",
        sourceId: "c1",
        targetId: "d1",
        state: "existing",
        score: 80,
        status: "green",
        explanationDe: "",
      },
    ];
    expect(canConnectNodes(edges, challenge, direction)).toBe(false);
    expect(canConnectNodes(edges, analysis, challenge)).toBe(true);
  });

  it("shows handles on selected node and connectable neighbors", () => {
    const visible = resolveImpactPathHandleVisibility({
      nodes: [analysis, challenge, direction],
      edges: [],
      selectedNodeId: "c1",
      dragSourceNodeId: null,
    });
    const byId = new Map(visible.map((v) => [v.nodeId, v.sides]));
    expect(byId.get("c1")).toEqual(expect.arrayContaining(["in", "out"]));
    expect(byId.get("a1")).toEqual(["out"]);
    expect(byId.get("d1")).toEqual(["in"]);
  });

  it("finds drop target near in-handle", () => {
    const targetId = findDropTargetNodeId({
      nodes: [analysis, challenge],
      positioned: [
        {
          ...analysis,
          titleLines: [analysis.title],
          x: 40,
          y: 80,
          width: 168,
          height: 56,
          column: 0,
        },
        {
          ...challenge,
          titleLines: [challenge.title],
          x: 288,
          y: 80,
          width: 168,
          height: 56,
          column: 1,
        },
      ],
      edges: [],
      sourceNodeId: "a1",
      pointerX: 288,
      pointerY: 108,
    });
    expect(targetId).toBe("c1");
  });
});
