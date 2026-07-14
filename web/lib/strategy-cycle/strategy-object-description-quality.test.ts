import { describe, expect, it } from "vitest";
import {
  evaluateDescriptionQuality,
} from "@/lib/strategy-cycle/strategy-object-description-quality";

describe("evaluateDescriptionQuality", () => {
  it("flags missing description as high severity", () => {
    const result = evaluateDescriptionQuality({
      kind: "challenge",
      title: "Lieferkettenrisiko",
      description: "",
      hasAnalysisBasis: false,
    });
    expect(result.isAnalysable).toBe(false);
    expect(result.issues).toContain("missing");
    expect(result.severity).toBe("high");
  });

  it("flags only too_short as medium severity", () => {
    const result = evaluateDescriptionQuality({
      kind: "objective",
      title: "Umsatzwachstum EMEA",
      description: "Marktanteil in EMEA durch Partnerschaften bis 2027 steigern.",
      aiClarityScore: 4,
    });
    expect(result.issues).toContain("too_short");
    expect(result.issues).not.toContain("missing");
    expect(result.severity).toBe("medium");
  });

  it("does not flag challenge without analysis pill when description is sufficient", () => {
    const description =
      "Lieferengpässe bei kritischen Rohstoffen erhöhen Kosten und Verzögerungen in der Produktion; wir müssen Alternativlieferanten und Pufferbestände aufbauen.";
    const result = evaluateDescriptionQuality({
      kind: "challenge",
      title: "Lieferkettenrisiko",
      description,
      hasAnalysisBasis: false,
    });
    expect(result.isAnalysable).toBe(true);
    expect(result.issues).not.toContain("no_analysis_basis");
  });

  it("flags challenge without analysis basis only with insufficient description", () => {
    const result = evaluateDescriptionQuality({
      kind: "challenge",
      title: "Lieferkettenrisiko",
      description: "wichtig",
      hasAnalysisBasis: false,
    });
    expect(result.isAnalysable).toBe(false);
    expect(result.issues).toContain("no_analysis_basis");
    expect(result.severity).toBe("high");
  });

  it("does not flag optional heuristics alone", () => {
    const description =
      "Wir steigern den Marktanteil in EMEA messbar von 12 auf 18 Prozent bis 2027 durch gezielte Vertriebspartnerschaften und Produktlokalisierung.";
    const result = evaluateDescriptionQuality({
      kind: "objective",
      title: "Marktanteil EMEA",
      description,
      aiClarityScore: 2,
    });
    expect(result.isAnalysable).toBe(true);
  });
});
