import { describe, expect, it } from "vitest";
import { computeAnalysisNetworkStaleFlags } from "./analysis-network-stale";
import type { AnalysisEntry } from "./queries";

function entry(p: Partial<AnalysisEntry> & Pick<AnalysisEntry, "id">): AnalysisEntry {
  return {
    analysis_type: "environment",
    sub_type: null,
    title: "t",
    description: null,
    impact_level: 3,
    uncertainty_level: 3,
    quality_score: 50,
    quality_band: "medium",
    quality_source: "rule",
    quality_explanation: null,
    quality_fallback_reason: null,
    quality_provider: null,
    quality_model: null,
    quality_prompt_version: null,
    graph_layout_x: null,
    graph_layout_y: null,
    graph_layout_z: null,
    graph_layout_confidence: null,
    graph_layout_reason: null,
    graph_layout_source: null,
    graph_layout_fallback_reason: null,
    graph_layout_provider: null,
    graph_layout_model: null,
    graph_layout_prompt_version: null,
    semantic_embedding_model: null,
    semantic_embedding_version: null,
    semantic_embedding_status: null,
    created_at: "2020-01-01T00:00:00.000Z",
    ...p,
    updated_at: p.updated_at ?? "2020-01-01T00:00:00.000Z",
  } as AnalysisEntry;
}

describe("computeAnalysisNetworkStaleFlags", () => {
  it("marks quality stale when entry newer than quality_calculated_at", () => {
    const flags = computeAnalysisNetworkStaleFlags({
      entries: [
        entry({
          id: "1",
          updated_at: "2025-01-02T00:00:00.000Z",
          quality_calculated_at: "2025-01-01T00:00:00.000Z",
          graph_layout_calculated_at: "2025-01-02T00:00:00.000Z",
          semantic_embedding_calculated_at: "2025-01-02T00:00:00.000Z",
          semantic_embedding_status: "ready",
        }),
      ],
      approvedLinks: [],
      linkDrafts: [],
      gapFindings: [{ created_at: "2025-01-03T00:00:00.000Z" }],
    });
    expect(flags.staleQualityBackfill).toBe(true);
    expect(flags.staleGraphLayout).toBe(false);
  });

  it("marks graph stale when link newer than layout", () => {
    const flags = computeAnalysisNetworkStaleFlags({
      entries: [
        entry({
          id: "1",
          updated_at: "2025-01-01T00:00:00.000Z",
          quality_calculated_at: "2025-01-01T00:00:00.000Z",
          graph_layout_calculated_at: "2025-01-01T00:00:00.000Z",
          semantic_embedding_calculated_at: "2025-01-01T00:00:00.000Z",
          semantic_embedding_status: "ready",
        }),
      ],
      approvedLinks: [{ updated_at: "2025-01-05T00:00:00.000Z" }],
      linkDrafts: [],
      gapFindings: [{ created_at: "2025-01-01T00:00:00.000Z" }],
    });
    expect(flags.staleGraphLayout).toBe(true);
    expect(flags.staleLinkDraftGeneration).toBe(true);
  });
});
