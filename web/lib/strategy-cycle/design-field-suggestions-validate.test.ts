import { describe, expect, it } from "vitest";
import {
  mapConfidenceTier,
  validateDesignFieldSuggestions,
} from "@/lib/strategy-cycle/design-field-suggestions-validate";

describe("mapConfidenceTier", () => {
  it("maps thresholds to German labels", () => {
    expect(mapConfidenceTier(85)).toEqual({ tier: "high", labelDe: "hoch" });
    expect(mapConfidenceTier(70)).toEqual({ tier: "medium", labelDe: "mittel" });
    expect(mapConfidenceTier(40)).toEqual({ tier: "low", labelDe: "niedrig" });
  });
});

describe("validateDesignFieldSuggestions", () => {
  const allowed = ["d1", "d2", "d3"];
  const titles = { d1: "A", d2: "B", d3: "C" };

  it("dedupes direction ids globally and clamps text", () => {
    const result = validateDesignFieldSuggestions(
      {
        suggestions: [
          {
            label: "Wachstum",
            description: "Beschreibung",
            strategic_intent: "Intent",
            direction_ids: ["d1", "d2", "unknown"],
            confidence: 82,
            rationale_de: "Weil ähnlich",
          },
          {
            label: "Duplikat",
            description: "x",
            strategic_intent: "y",
            direction_ids: ["d2", "d3"],
            confidence: 50,
            rationale_de: "z",
          },
        ],
      },
      allowed,
      titles
    );

    expect(result.suggestions).toHaveLength(2);
    expect(result.suggestions[0]?.directionIds).toEqual(["d1", "d2"]);
    expect(result.suggestions[0]?.confidenceTier).toBe("high");
    expect(result.suggestions[0]?.assignmentConfidence).toBe("high");
    expect(result.suggestions[1]?.directionIds).toEqual(["d3"]);
    expect(result.suggestions[1]?.confidenceLabelDe).toBe("niedrig");
    expect(result.unassignedDirectionIds).toEqual([]);
  });

  it("warns when fewer than three suggestions remain", () => {
    const result = validateDesignFieldSuggestions(
      {
        suggestions: [
          {
            label: "Einzel",
            description: "x",
            strategic_intent: "y",
            direction_ids: ["d1"],
            confidence: 90,
            rationale_de: "z",
          },
        ],
      },
      allowed,
      titles
    );
    expect(result.warningDe).toContain("Nur 1 gültige");
  });
});
