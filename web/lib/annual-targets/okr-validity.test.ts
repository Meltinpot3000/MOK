import { describe, expect, it } from "vitest";
import { isAnnualTargetOkrValid } from "@/lib/annual-targets/okr-validity";

describe("isAnnualTargetOkrValid", () => {
  const row = {
    status: "active",
    targetYear: 2026,
    ownerMembershipId: "owner-1",
    signatureStatus: "signed",
    strategyProgramId: "prog-1",
  };

  it("ist gültig wenn active, Jahr, Owner und Signatur passen", () => {
    expect(
      isAnnualTargetOkrValid(
        row,
        "owner-1",
        2026,
        { requireSignature: true, signatureMode: "internal_acknowledgement", activationRequiresSignedStatus: true }
      )
    ).toBe(true);
  });

  it("ist ungültig ohne Signatur bei Pflicht", () => {
    expect(
      isAnnualTargetOkrValid({ ...row, signatureStatus: "sent", strategyProgramId: "prog-1" }, "owner-1", 2026, {
        requireSignature: true,
        signatureMode: "internal_acknowledgement",
        activationRequiresSignedStatus: true,
      })
    ).toBe(false);
  });

  it("ist ungültig für Run-Jahresziele ohne Programm", () => {
    expect(
      isAnnualTargetOkrValid(
        { ...row, strategyProgramId: null },
        "owner-1",
        2026,
        { requireSignature: false, signatureMode: "none", activationRequiresSignedStatus: false }
      )
    ).toBe(false);
  });
});
