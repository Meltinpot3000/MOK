import { describe, expect, it } from "vitest";
import {
  definitionFieldInputClass,
  isStrategyObjectDefinitionLocked,
} from "@/lib/strategy-objects/governance";

describe("isStrategyObjectDefinitionLocked", () => {
  it("sperrt bei current Revision und active Lifecycle", () => {
    expect(
      isStrategyObjectDefinitionLocked({
        objectType: "strategic_objective",
        versioning: {
          object_identity_id: "identity-1",
          revision_id: "revision-1",
          revision_number: 1,
          revision_state: "current",
          identity_lifecycle_state: "active",
        },
      })
    ).toBe(true);
  });

  it("entsperrt bei current Revision und draft Lifecycle", () => {
    expect(
      isStrategyObjectDefinitionLocked({
        objectType: "strategic_direction",
        versioning: {
          object_identity_id: "identity-1",
          revision_id: "revision-1",
          revision_number: 1,
          revision_state: "current",
          identity_lifecycle_state: "draft",
        },
      })
    ).toBe(false);
  });

  it("entsperrt bei draft Revision", () => {
    expect(
      isStrategyObjectDefinitionLocked({
        objectType: "strategic_challenge",
        versioning: {
          object_identity_id: "identity-1",
          revision_id: "revision-1",
          revision_number: 2,
          revision_state: "draft",
          identity_lifecycle_state: "active",
        },
      })
    ).toBe(false);
  });

  it("entsperrt ohne Versioning-Metadaten", () => {
    expect(
      isStrategyObjectDefinitionLocked({
        objectType: "strategic_objective",
      })
    ).toBe(false);
  });
});

describe("definitionFieldInputClass", () => {
  it("ergänzt Lock-Styling bei gesperrten Feldern", () => {
    const css = definitionFieldInputClass(true, "base");
    expect(css).toContain("base");
    expect(css).toContain("cursor-not-allowed");
  });

  it("behält Basisklasse bei entsperrten Feldern", () => {
    expect(definitionFieldInputClass(false, "base")).toBe("base");
  });
});
