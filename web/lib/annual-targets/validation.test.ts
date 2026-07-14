import { describe, expect, it } from "vitest";
import {
  hasBlockingIssues,
  validateAnnualTargetActivation,
  validateAnnualTargetDraft,
} from "@/lib/annual-targets/validation";
import { emptySmartFormulation } from "@/lib/annual-targets/types";

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
  smartFormulation: {
    ...emptySmartFormulation(),
    specific: "Beschreibung",
    measurable: "10% Wachstum",
  },
  executionMode: "run" as const,
};

describe("annual-target validation", () => {
  it("erlaubt Run-Draft mit Stoßrichtung", () => {
    const issues = validateAnnualTargetDraft(basePayload);
    expect(hasBlockingIssues(issues)).toBe(false);
  });

  it("blockiert Run ohne Stoßrichtung", () => {
    const issues = validateAnnualTargetDraft({
      ...basePayload,
      strategicDirectionId: "",
    });
    expect(hasBlockingIssues(issues)).toBe(true);
  });

  it("blockiert Change ohne Programm", () => {
    const issues = validateAnnualTargetDraft({
      ...basePayload,
      executionMode: "change",
      strategyProgramId: null,
    });
    expect(hasBlockingIssues(issues)).toBe(true);
  });

  it("blockiert Aktivierung ohne Messlogik/SMART-M", () => {
    const issues = validateAnnualTargetActivation(
      {
        ...basePayload,
        measurementLogic: "",
        smartFormulation: emptySmartFormulation(),
        status: "active",
      },
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
