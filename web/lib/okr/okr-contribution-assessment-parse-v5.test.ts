import { describe, expect, it } from "vitest";
import { parseOkrContributionAssessmentV4Response } from "@/lib/analysis-network/providers";

describe("parseOkrContributionAssessment (v5)", () => {
  const okrId = "okr-1";
  const dirId = "dir-1";
  const soIds = ["so-1", "so-2"];

  it("parses alignment high + formulation low → overall capped", () => {
    const parsed = parseOkrContributionAssessmentV4Response(
      JSON.stringify({
        okr_id: okrId,
        strategic_direction_contribution: {
          strategic_direction_id: dirId,
          alignment_level: "high",
          formulation_level: "low",
          scope_fit_level: "medium",
          overall_level: "high",
          reason: "Passt zur Richtung, Formulierung schwach.",
          improvement_hint: "KRs messbar machen.",
        },
        strategy_objective_contributions: [
          { objective_id: "so-1", relevance: "not_relevant", reason: "—" },
          { objective_id: "so-2", relevance: "not_relevant", reason: "—" },
        ],
        initiative_contributions: [],
      }),
      okrId,
      dirId,
      [],
      soIds
    );
    expect(parsed?.strategicDirectionContribution.overallLevel).toBe("low");
    expect(parsed?.strategicDirectionContribution.formulationLevel).toBe("low");
    expect(parsed?.strategicDirectionContribution.scopeFitLevel).toBe("medium");
  });

  it("scope_fit high (überladen) caps overall even with high alignment", () => {
    const parsed = parseOkrContributionAssessmentV4Response(
      JSON.stringify({
        okr_id: okrId,
        strategic_direction_contribution: {
          strategic_direction_id: dirId,
          alignment_level: "high",
          formulation_level: "high",
          scope_fit_level: "high",
          overall_level: "high",
          reason: "Fit gut, aber zu viel für ein Quartal.",
          improvement_hint: "Scope auf ein Quartal reduzieren.",
        },
        strategy_objective_contributions: [
          { objective_id: "so-1", relevance: "not_relevant", reason: "—" },
          { objective_id: "so-2", relevance: "not_relevant", reason: "—" },
        ],
        initiative_contributions: [],
      }),
      okrId,
      dirId,
      [],
      soIds
    );
    expect(parsed?.strategicDirectionContribution.scopeFitLevel).toBe("high");
    expect(parsed?.strategicDirectionContribution.overallLevel).toBe("low");
  });

  it("falls back to ambition_level as formulation (v4 JSON)", () => {
    const parsed = parseOkrContributionAssessmentV4Response(
      JSON.stringify({
        okr_id: okrId,
        strategic_direction_contribution: {
          strategic_direction_id: dirId,
          alignment_level: "medium",
          ambition_level: "medium",
          overall_level: "medium",
          reason: "Legacy.",
          improvement_hint: "Mehr Hebel.",
        },
        strategy_objective_contributions: [
          { objective_id: "so-1", relevance: "not_relevant", reason: "—" },
          { objective_id: "so-2", relevance: "not_relevant", reason: "—" },
        ],
        initiative_contributions: [],
      }),
      okrId,
      dirId,
      [],
      soIds
    );
    expect(parsed?.strategicDirectionContribution.formulationLevel).toBe("medium");
    expect(parsed?.strategicDirectionContribution.scopeFitLevel).toBe("medium");
  });
});
