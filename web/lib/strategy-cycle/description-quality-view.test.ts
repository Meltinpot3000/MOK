import { describe, expect, it } from "vitest";
import {
  buildDescriptionQualityViewModel,
  descriptionQualityDisplayLabelDe,
  matchesDescriptionQualityFilter,
  parseDescriptionQualityFilter,
  primaryDescriptionQualityListHref,
  toDescriptionQualityDisplayStatus,
} from "@/lib/strategy-cycle/description-quality-view";

describe("description-quality-view", () => {
  it("maps analysable results to OK", () => {
    const vm = buildDescriptionQualityViewModel("challenge", {
      kind: "challenge",
      title: "Marktanteil in Kernsegmenten sichern",
      description:
        "Der Marktanteil sinkt seit zwei Jahren in den Kernsegmenten. Ursache ist Preisdruck und verzögerte Produktlaunches. Das gefährdet Umsatz und strategische Positionierung gegenüber Wettbewerbern.",
      hasAnalysisBasis: true,
    });
    expect(vm.displayStatus).toBe("ok");
    expect(descriptionQualityDisplayLabelDe(vm.displayStatus)).toBe("OK");
  });

  it("maps high severity to Nacharbeiten", () => {
    const vm = buildDescriptionQualityViewModel("objective", {
      kind: "objective",
      title: "Umsatz steigern",
      description: "Umsatz steigern",
    });
    expect(vm.displayStatus).toBe("rework");
    expect(vm.issueLabelsDe.length).toBeGreaterThan(0);
  });

  it("filters rows by quality status", () => {
    expect(matchesDescriptionQualityFilter("rework", "needs_work")).toBe(true);
    expect(matchesDescriptionQualityFilter("review", "needs_work")).toBe(true);
    expect(matchesDescriptionQualityFilter("ok", "needs_work")).toBe(false);
    expect(matchesDescriptionQualityFilter("ok", "ok")).toBe(true);
  });

  it("parses quality filter query values", () => {
    expect(parseDescriptionQualityFilter("needs_work")).toBe("needs_work");
    expect(parseDescriptionQualityFilter("unknown")).toBe("");
  });

  it("derives display status from evaluation result", () => {
    expect(toDescriptionQualityDisplayStatus({ isAnalysable: true, severity: null })).toBe("ok");
    expect(toDescriptionQualityDisplayStatus({ isAnalysable: false, severity: "medium" })).toBe(
      "review"
    );
    expect(toDescriptionQualityDisplayStatus({ isAnalysable: false, severity: "high" })).toBe(
      "rework"
    );
    expect(toDescriptionQualityDisplayStatus({ isAnalysable: false, severity: null })).toBe(
      "no_data"
    );
  });

  it("prefers directions for primary description quality link when most affected", () => {
    expect(
      primaryDescriptionQualityListHref({ challenges: 1, directions: 3, objectives: 1 })
    ).toContain("l2=design");
    expect(
      primaryDescriptionQualityListHref({ challenges: 1, directions: 3, objectives: 1 })
    ).toContain("review=description_quality");
  });
});
