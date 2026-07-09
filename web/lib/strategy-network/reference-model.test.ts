import { describe, expect, it } from "vitest";
import { getReferenceNetworkGraph } from "@/lib/strategy-network/reference-model";

describe("getReferenceNetworkGraph", () => {
  const graph = getReferenceNetworkGraph();
  const nodeIds = new Set(graph.nodes.map((n) => n.id));

  it("hat gültige Kantenreferenzen", () => {
    for (const edge of graph.edges) {
      expect(nodeIds.has(edge.sourceId), `source ${edge.sourceId} for ${edge.id}`).toBe(true);
      expect(nodeIds.has(edge.targetId), `target ${edge.targetId} for ${edge.id}`).toBe(true);
    }
  });

  it("deckt den Hauptpfad Analyse → Herausforderung → Stoßrichtung → Jahresziel → OKR ab", () => {
    const edgePairs = new Set(graph.edges.map((e) => `${e.sourceId}->${e.targetId}`));
    expect(edgePairs.has("analysis_entry->challenge")).toBe(true);
    expect(edgePairs.has("challenge->direction")).toBe(true);
    expect(edgePairs.has("direction->annual_target")).toBe(true);
    expect(edgePairs.has("direction->okr_objective")).toBe(true);
    expect(edgePairs.has("okr_objective->key_result")).toBe(true);
    expect(edgePairs.has("key_result->annual_target")).toBe(true);
  });

  it("ordnet Herausforderungen dem Strategiezyklus zu", () => {
    const challenge = graph.nodes.find((n) => n.id === "challenge");
    expect(challenge?.zone).toBe("strategy");
  });

  it("ordnet Review nicht dem Strategiezyklus zu", () => {
    const review = graph.nodes.find((n) => n.id === "review_session");
    expect(review?.zone).toBe("review");
  });
});
