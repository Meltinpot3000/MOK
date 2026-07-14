import { describe, expect, it } from "vitest";
import {
  canonicalizeStrategicThemes,
  labelFromCanonicalThemes,
  strategicThemeAffinity,
} from "@/lib/strategy-cycle/design-field-canonicalization";
import {
  buildDesignFieldSemanticProfile,
  buildDirectionSemanticContext,
  scoreDirectionToDesignField,
} from "@/lib/strategy-cycle/design-field-cluster-scoring";

describe("canonicalizeStrategicThemes", () => {
  it("maps expertise and engineering vocabulary to canonical themes", () => {
    expect(canonicalizeStrategicThemes("Build up expertise")).toContain("capabilities");
    expect(canonicalizeStrategicThemes("Build up expertise")).toContain("knowledge");
    expect(canonicalizeStrategicThemes("Engineering skills")).toContain("engineering");
    expect(canonicalizeStrategicThemes("Engineering skills")).toContain("capabilities");
    expect(canonicalizeStrategicThemes("Rebuilding the knowledge position & knowhow")).toContain(
      "knowledge"
    );
    expect(canonicalizeStrategicThemes("Rebuilding the knowledge position & knowhow")).toContain(
      "capabilities"
    );
  });

  it("derives stable management labels from themes", () => {
    expect(labelFromCanonicalThemes(["engineering", "capabilities", "knowledge"])).toBe(
      "Innovation und Engineering"
    );
    expect(labelFromCanonicalThemes(["operations", "digitalization"])).toBe(
      "Operative Exzellenz und Digitalisierung"
    );
    expect(labelFromCanonicalThemes(["organization_leadership", "capabilities"])).toBe(
      "Organisation, Führung und Fähigkeiten"
    );
  });

  it("maps staff development to organisation and capabilities without engineering false positive", () => {
    const themes = canonicalizeStrategicThemes("I_C4_01 - Management and staff development");
    expect(themes).toContain("organization_leadership");
    expect(themes).toContain("capabilities");
    expect(themes).not.toContain("engineering");
  });

  it("links organisation and capabilities themes via affinity", () => {
    const c4 = canonicalizeStrategicThemes("I_C4_01 - Management and staff development");
    const c10 = canonicalizeStrategicThemes("I_C10_01 - Build up expertise");
    expect(strategicThemeAffinity(c4, c10)).toBeGreaterThanOrEqual(0.55);
  });

  it("links corporate leadership culture with management development", () => {
    const c9 = canonicalizeStrategicThemes("I_C9_01 - corporate_leadership culture");
    const c4 = canonicalizeStrategicThemes("I_C4_01 - Management and staff development");
    expect(c9).toContain("organization_leadership");
    expect(c4).toContain("organization_leadership");
    expect(strategicThemeAffinity(c9, c4)).toBeGreaterThanOrEqual(0.65);
  });
});

describe("scoreDirectionToDesignField — talent cluster", () => {
  const orgField = buildDesignFieldSemanticProfile({
    designFieldId: "field:org",
    label: "Organisation, Führung und Fähigkeiten",
    description: null,
    assignedDirections: [
      {
        directionId: "c4",
        title: "I_C4_01 - Management and staff development",
        description: null,
        linkedChallenges: [],
        linkedObjectives: [],
      },
    ],
  });

  const buildUpExpertise = buildDirectionSemanticContext({
    directionId: "c10",
    title: "I_C10_01 - Build up expertise",
    description: null,
    linkedChallenges: [],
    linkedObjectives: [],
  });

  it("matches Build up expertise to Organisation, Führung und Fähigkeiten at least medium", () => {
    const result = scoreDirectionToDesignField(buildUpExpertise, orgField);
    expect(["medium", "high"]).toContain(result.confidence);
    expect(result.reasons.some((r) => r.includes("capabilities"))).toBe(true);
  });
});

describe("scoreDirectionToDesignField — Build up expertise", () => {
  const engineeringField = buildDesignFieldSemanticProfile({
    designFieldId: "field:innovation-engineering",
    label: "Innovation und Engineering",
    description: null,
    assignedDirections: [
      {
        directionId: "d-engineering-skills",
        title: "I_C12_01 - Engineering skills",
        description: null,
        linkedChallenges: [
          { title: "10 Rebuilding the knowledge position & knowhow" },
          { title: "12 Ensure processes and skills in engineering" },
        ],
        linkedObjectives: [],
      },
    ],
  });

  const buildUpExpertise = buildDirectionSemanticContext({
    directionId: "d-build-expertise",
    title: "I_C10_01 - Build up expertise",
    description: null,
    linkedChallenges: [],
    linkedObjectives: [],
  });

  it("matches Build up expertise to Innovation und Engineering at least medium", () => {
    const result = scoreDirectionToDesignField(buildUpExpertise, engineeringField);
    expect(["medium", "high"]).toContain(result.confidence);
    expect(result.designFieldLabel).toBe("Innovation und Engineering");
    expect(result.reasons.some((r) => r.includes("capabilities"))).toBe(true);
    expect(result.reasons.some((r) => r.includes("knowledge"))).toBe(true);
  });
});
