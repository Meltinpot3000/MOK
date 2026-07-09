import { describe, expect, it } from "vitest";
import { getNextStatusForAction } from "@/lib/annual-targets/lifecycle";

const noSig = { requireSignature: false, signatureMode: "none" as const, activationRequiresSignedStatus: true };
const withSig = {
  requireSignature: true,
  signatureMode: "internal_acknowledgement" as const,
  activationRequiresSignedStatus: true,
};

describe("annual-target lifecycle", () => {
  it("trennt signed und active", () => {
    expect(getNextStatusForAction("signed", "activate", withSig)).toBe("active");
    expect(getNextStatusForAction("signed", "activate", noSig)).toBe("active");
  });

  it("approved ohne Signatur geht direkt zu active", () => {
    expect(getNextStatusForAction("approved", "activate", noSig)).toBe("active");
    expect(getNextStatusForAction("approved", "activate", withSig)).toBe(null);
  });

  it("approved mit Signatur geht zu sent_for_signature", () => {
    expect(getNextStatusForAction("approved", "send_for_signature", withSig)).toBe("sent_for_signature");
  });
});
