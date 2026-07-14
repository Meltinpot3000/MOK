import { describe, expect, it } from "vitest";
import {
  clampUiScore,
  computeAnalysisToChallengePassungRaw,
  computeAnalysisToChallengeRaw,
  keywordSimilarity01,
  normalizeAnalysisSuggestions,
  normalizeRelativeToBest,
  pathScoreFromEdgeScores,
  scoreToImpactPathStatus,
} from "@/lib/strategy-cycle/impact-path-scoring";

describe("impact-path-scoring", () => {
  it("clampUiScore bounds to 0–100", () => {
    expect(clampUiScore(-5)).toBe(0);
    expect(clampUiScore(150)).toBe(100);
    expect(clampUiScore(66.4)).toBe(66);
  });

  it("scoreToImpactPathStatus uses normalized thresholds", () => {
    expect(scoreToImpactPathStatus(0)).toBe("unknown");
    expect(scoreToImpactPathStatus(70)).toBe("green");
    expect(scoreToImpactPathStatus(45)).toBe("yellow");
    expect(scoreToImpactPathStatus(10)).toBe("red");
  });

  it("normalizeRelativeToBest scales against best fit", () => {
    expect(normalizeRelativeToBest(80, 80)).toBe(100);
    expect(normalizeRelativeToBest(40, 80)).toBe(50);
    expect(normalizeRelativeToBest(10, 0)).toBe(0);
  });

  it("normalizeAnalysisSuggestions normalizes per analysis entry candidates", () => {
    const scores = normalizeAnalysisSuggestions([
      { key: "a:ch1", raw: 0.8 },
      { key: "a:ch2", raw: 0.4 },
    ]);
    expect(scores.get("a:ch1")).toBe(100);
    expect(scores.get("a:ch2")).toBe(50);
  });

  it("computeAnalysisToChallengeRaw combines evidence signals", () => {
    const raw = computeAnalysisToChallengeRaw({
      clusterProximity01: 1,
      keywordSimilarity01: 1,
      evidenceProximity01: 1,
      candidatePriority01: 1,
    });
    expect(raw).toBeCloseTo(1, 5);
  });

  it("pathScoreFromEdgeScores uses minimum of edges", () => {
    expect(pathScoreFromEdgeScores([100, 80, 60])).toBe(60);
    expect(pathScoreFromEdgeScores([0, 50])).toBe(50);
    expect(pathScoreFromEdgeScores([0, 0])).toBe(0);
  });

  it("normalizeRelativeToBest never returns score above 100", () => {
    expect(normalizeRelativeToBest(200, 100)).toBe(100);
  });

  it("computeAnalysisToChallengePassungRaw returns 0 for unrelated texts", () => {
    const keyword = keywordSimilarity01(
      "Aufbau eines modularen Serviceportfolios Standardisierte Servicebausteine",
      "[Seed] Demo-Herausforderung Matrix-Anker Seed Challenge Direction Links"
    );
    expect(computeAnalysisToChallengePassungRaw(keyword, 0)).toBe(0);
  });
});
