import { describe, expect, it } from "vitest";
import { buildAnalysisEntryOverviewStats, deriveQualityBandFromScore } from "./analysis-entry-overview";
import type { AnalysisEntry } from "@/lib/strategy-cycle/queries";

function entry(
  id: string,
  q: Partial<Pick<AnalysisEntry, "quality_score" | "quality_band">>
): AnalysisEntry {
  return {
    id,
    analysis_type: "environment",
    sub_type: null,
    title: id,
    description: null,
    impact_level: null,
    uncertainty_level: null,
    quality_score: q.quality_score ?? null,
    quality_band: q.quality_band ?? null,
    quality_source: null,
    quality_explanation: null,
    quality_calculated_at: null,
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
    graph_layout_calculated_at: null,
    semantic_embedding_model: null,
    semantic_embedding_version: null,
    semantic_embedding_calculated_at: null,
    semantic_embedding_status: null,
    created_at: "",
    updated_at: "",
  };
}

describe("deriveQualityBandFromScore", () => {
  it("maps thresholds", () => {
    expect(deriveQualityBandFromScore(80)).toBe("high");
    expect(deriveQualityBandFromScore(75)).toBe("high");
    expect(deriveQualityBandFromScore(60)).toBe("medium");
    expect(deriveQualityBandFromScore(50)).toBe("medium");
    expect(deriveQualityBandFromScore(49)).toBe("low");
  });
});

describe("buildAnalysisEntryOverviewStats", () => {
  it("returns zeros for empty entries", () => {
    const s = buildAnalysisEntryOverviewStats([], [], new Set(), new Map());
    expect(s.total).toBe(0);
    expect(s.inChallengesUnique).toBe(0);
    expect(s.onlyAnalysis).toBe(0);
  });

  it("counts quality bands from score and explicit band", () => {
    const entries = [
      entry("a", { quality_band: "high" }),
      entry("b", { quality_score: 60 }),
      entry("c", { quality_score: 40 }),
    ];
    const s = buildAnalysisEntryOverviewStats(entries, [], new Set(), new Map());
    expect(s.qualityHigh).toBe(1);
    expect(s.qualityMedium).toBe(1);
    expect(s.qualityLow).toBe(1);
    expect(s.onlyAnalysis).toBe(3);
  });

  it("marks entries referenced by challenge as in Herausforderungen", () => {
    const entries = [entry("e1", {}), entry("e2", {})];
    const challenges = [{ source_analysis_entry_id: "e1" }];
    const s = buildAnalysisEntryOverviewStats(entries, challenges, new Set(), new Map());
    expect(s.inChallengesUnique).toBe(1);
    expect(s.onlyAnalysis).toBe(1);
    expect(s.directEntryCount).toBe(1);
    expect(s.clusterOnlyEntryCount).toBe(0);
    expect(s.directOnlyEntryCount).toBe(1);
  });

  it("includes cluster members for promoted clusters", () => {
    const entries = [entry("e1", {}), entry("e2", {})];
    const promoted = new Set(["c1"]);
    const members = new Map<string, Array<{ entry_id: string }>>([
      ["c1", [{ entry_id: "e2" }]],
    ]);
    const s = buildAnalysisEntryOverviewStats(entries, [], promoted, members);
    expect(s.inChallengesUnique).toBe(1);
    expect(s.onlyAnalysis).toBe(1);
    expect(s.clusterOnlyEntryCount).toBe(1);
    expect(s.directOnlyEntryCount).toBe(0);
  });

  it("deduplicates direct and cluster path and counts both overlap", () => {
    const entries = [entry("e1", {})];
    const challenges = [{ source_analysis_entry_id: "e1" }];
    const promoted = new Set(["c1"]);
    const members = new Map<string, Array<{ entry_id: string }>>([
      ["c1", [{ entry_id: "e1" }]],
    ]);
    const s = buildAnalysisEntryOverviewStats(entries, challenges, promoted, members);
    expect(s.inChallengesUnique).toBe(1);
    expect(s.directEntryCount).toBe(1);
    expect(s.clusterOnlyEntryCount).toBe(0);
    expect(s.bothDirectAndClusterCount).toBe(1);
    expect(s.directOnlyEntryCount).toBe(0);
  });
});
