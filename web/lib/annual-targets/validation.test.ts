import { describe, expect, it } from "vitest";
import {
  hasBlockingIssues,
  validateAnnualTargetActivation,
  validateAnnualTargetDraft,
} from "@/lib/annual-targets/validation";

const basePayload = {
  title: "Umsatz steigern",
  targetYear: 2026,
  ownerMembershipId: "m-1",
  strategicDirectionId: "d-1",
  description: "Beschreibung",
  measurementLogic: "10% Wachstum",
  progressPercent: 0,
  status: "draft" as const,
  annualTargetType: "strategic_commitment" as const,
  progressCalculationMode: "manual" as const,
  derivationNote: "",
  strategicObjectiveId: null,
  strategyProgramId: null,
  bonusWeight: null,
  baseline: null,
  currentMeasure: null,
};

describe("annual-target validation", () => {
  it("erlaubt Draft ohne strategisches Ziel mit Warnung", () => {
    const issues = validateAnnualTargetDraft(basePayload);
    expect(hasBlockingIssues(issues)).toBe(false);
    expect(issues.some((i) => i.severity === "warning")).toBe(true);
  });

  it("blockiert Aktivierung ohne Messlogik", () => {
    const issues = validateAnnualTargetActivation(
      { ...basePayload, measurementLogic: "", status: "active" },
      { requireSignature: false, signatureMode: "none", activationRequiresSignedStatus: true },
      "not_required"
    );
    expect(hasBlockingIssues(issues)).toBe(true);
  });

  it("blockiert Aktivierung bei Signaturpflicht ohne signed", () => {
    const issues = validateAnnualTargetActivation(
      { ...basePayload, status: "active" },
      { requireSignature: true, signatureMode: "internal_acknowledgement", activationRequiresSignedStatus: true },
      "sent"
    );
    expect(hasBlockingIssues(issues)).toBe(true);
  });
});
