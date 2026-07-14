import { describe, expect, it } from "vitest";
import { enrichDesignFieldSuggestionsForCoverage } from "@/lib/strategy-cycle/design-field-suggestions-coverage";
import type { ClusterCandidate } from "@/lib/strategy-cycle/design-field-suggestions-prep";

describe("enrichDesignFieldSuggestionsForCoverage", () => {
  const partitions: ClusterCandidate[] = [
    {
      candidateId: "mgmt-partition-1",
      directionIds: ["d1", "d2", "d3"],
      signals: ["canonical_theme"],
      score: 0.55,
      reasonDe: "Cluster wegen kanonische Themen.",
    },
    {
      candidateId: "mgmt-partition-2",
      directionIds: ["d4", "d5"],
      signals: ["keyword_overlap"],
      score: 0.45,
      reasonDe: "Cluster wegen ähnliche Begriffe.",
    },
    {
      candidateId: "mgmt-partition-3",
      directionIds: ["d6", "d7", "d8"],
      signals: ["shared_objectives"],
      score: 0.5,
      reasonDe: "Cluster wegen gemeinsame Ziele.",
    },
  ];

  const context = {
    directions: [
      { id: "d1", title: "I_C12_01 - Engineering skills", grouping: "Innovation und Engineering" },
      { id: "d2", title: "Digital platform integration" },
      { id: "d3", title: "Digital automation systems" },
      { id: "d4", title: "OPEX reduction" },
      { id: "d5", title: "Production cost efficiency" },
      { id: "d6", title: "Leadership culture" },
      { id: "d7", title: "Staff development" },
      { id: "d8", title: "Management roles" },
      { id: "d9", title: "I_C10_01 - Build up expertise" },
    ],
    challenges: [
      { id: "c10", title: "10 Rebuilding the knowledge position & knowhow", challenge_score: 80 },
      { id: "c12", title: "12 Ensure processes and skills in engineering", challenge_score: 75 },
    ],
    objectives: [],
    challengeDirectionLinks: [
      { strategic_direction_id: "d1", strategic_challenge_id: "c10", contribution_level: "high" },
      { strategic_direction_id: "d1", strategic_challenge_id: "c12", contribution_level: "high" },
    ],
    directionObjectiveLinks: [],
    managementPartitions: partitions,
    titleByDirectionId: {
      d1: "I_C12_01 - Engineering skills",
      d2: "Digital platform integration",
      d3: "Digital automation systems",
      d4: "OPEX reduction",
      d5: "Production cost efficiency",
      d6: "Leadership culture",
      d7: "Staff development",
      d8: "Management roles",
      d9: "I_C10_01 - Build up expertise",
    },
  };

  it("assigns Build up expertise to Innovation und Engineering via canonical scoring", () => {
    const result = enrichDesignFieldSuggestionsForCoverage(
      {
        suggestions: [
          {
            label: "Innovation und Engineering",
            description: "x",
            strategicIntent: "y",
            directionIds: ["d1"],
            directionTitles: ["I_C12_01 - Engineering skills"],
            confidence: 70,
            confidenceTier: "medium",
            confidenceLabelDe: "mittel",
            assignmentConfidence: "medium",
            rationaleDe: "z",
            directionAssignments: {
              d1: {
                source: "approved",
                confidence: "high",
                score: 1,
                reasons: ["Bestehend"],
              },
            },
          },
        ],
        unassignedDirectionIds: ["d9"],
        warningDe: null,
      },
      context
    );

    const innovation = result.suggestions.find((s) => s.label === "Innovation und Engineering");
    expect(innovation?.directionIds).toContain("d9");
    expect(innovation?.directionAssignments.d9?.confidence).toMatch(/medium|high/);
    expect(innovation?.directionAssignments.d9?.reasons.length).toBeGreaterThan(0);
    expect(result.unassignedDirectionIds).not.toContain("d9");
  });

  it("creates additional suggestions when fewer than three remain", () => {
    const result = enrichDesignFieldSuggestionsForCoverage(
      {
        suggestions: [
          {
            label: "Einzel",
            description: "x",
            strategicIntent: "y",
            directionIds: ["d1"],
            directionTitles: ["I_C12_01 - Engineering skills"],
            confidence: 90,
            confidenceTier: "high",
            confidenceLabelDe: "hoch",
            assignmentConfidence: "high",
            rationaleDe: "z",
            directionAssignments: {},
          },
        ],
        unassignedDirectionIds: ["d2", "d3", "d4", "d5", "d6", "d7", "d8", "d9"],
        warningDe: "Nur 1 gültige Vorschläge",
      },
      context
    );

    expect(result.suggestions.length).toBeGreaterThanOrEqual(2);
    const assignedCount = result.suggestions.reduce((sum, s) => sum + s.directionIds.length, 0);
    expect(assignedCount / context.directions.length).toBeGreaterThanOrEqual(0.7);
  });

  it("merges separate leadership singleton suggestions for C9 and C4", () => {
    const result = enrichDesignFieldSuggestionsForCoverage(
      {
        suggestions: [
          {
            label: "Corporate leadership culture",
            description: "LLM",
            strategicIntent: "y",
            directionIds: ["c9"],
            directionTitles: ["I_C9_01 - corporate_leadership culture"],
            confidence: 72,
            confidenceTier: "medium",
            confidenceLabelDe: "mittel",
            assignmentConfidence: "medium",
            rationaleDe: "z",
            directionAssignments: {
              c9: {
                source: "llm",
                confidence: "medium",
                score: 0.7,
                reasons: ["LLM"],
              },
            },
          },
          {
            label: "Management and staff development",
            description: "LLM",
            strategicIntent: "y",
            directionIds: ["c4"],
            directionTitles: ["I_C4_01 - Management and staff development"],
            confidence: 74,
            confidenceTier: "medium",
            confidenceLabelDe: "mittel",
            assignmentConfidence: "medium",
            rationaleDe: "z",
            directionAssignments: {
              c4: {
                source: "llm",
                confidence: "medium",
                score: 0.72,
                reasons: ["LLM"],
              },
            },
          },
        ],
        unassignedDirectionIds: [],
        warningDe: null,
      },
      {
        ...context,
        directions: [
          { id: "c9", title: "I_C9_01 - corporate_leadership culture" },
          { id: "c4", title: "I_C4_01 - Management and staff development" },
        ],
        managementPartitions: [
          {
            candidateId: "org-partition",
            directionIds: ["c9", "c4"],
            signals: ["canonical_theme"],
            score: 0.65,
            reasonDe: "Cluster wegen Führung und Personalentwicklung.",
          },
        ],
        titleByDirectionId: {
          c9: "I_C9_01 - corporate_leadership culture",
          c4: "I_C4_01 - Management and staff development",
        },
      }
    );

    const merged = result.suggestions.find(
      (s) => s.directionIds.includes("c9") && s.directionIds.includes("c4")
    );
    expect(merged).toBeDefined();
    expect(merged?.label).toBe("Organisation, Führung und Fähigkeiten");
    expect(result.suggestions.length).toBe(1);
  });
});
