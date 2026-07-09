import { describe, expect, it } from "vitest";
import {
  getStrategyRevisionStatusMessage,
  normalizeStrategyRevisionErrorCode,
} from "@/lib/strategy-objects/revision-status-messages";

describe("revision-status-messages", () => {
  it("mappt draft-created Erfolg", () => {
    expect(getStrategyRevisionStatusMessage(undefined, "draft-created")?.type).toBe("success");
  });

  it("mappt strategy-object Fehlercodes", () => {
    expect(
      getStrategyRevisionStatusMessage("strategy-object-draft-already-exists", undefined)?.text
    ).toContain("offener Revisionsentwurf");
  });

  it("normalisiert rohe DB-Fehlertexte", () => {
    expect(normalizeStrategyRevisionErrorCode("function digest(text, unknown) does not exist")).toBe(
      "draft-create-failed"
    );
  });
});
