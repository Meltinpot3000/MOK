import { describe, expect, it } from "vitest";

import { redactContextForExternalModel, strictestClassification } from "./redaction";
import type { AiContextPackage } from "@/lib/ai/types";

function makePkg(): AiContextPackage {
  return {
    question: "q",
    taskType: "internal_lookup",
    domains: [],
    scope: {},
    internalContext: {
      objects: [
        {
          objectType: "okr_objective",
          objectId: "o1",
          title: "T",
          summary: "contact user@example.com",
          fields: { salary: 100000, title: "OKR" },
          relevanceScore: 0.5,
          classification: "internal",
        },
        {
          objectType: "okr_objective",
          objectId: "o2",
          title: "R",
          summary: "restricted",
          fields: { id: "o2" },
          relevanceScore: 0.9,
          classification: "restricted",
        },
      ],
    },
    constraints: {
      doNotInventInternalFacts: true,
      citeInternalObjects: true,
      writeActionsAllowed: false,
    },
  };
}

describe("strictestClassification", () => {
  it("waehlt restricted vor confidential", () => {
    expect(strictestClassification(["internal", "restricted", "confidential"])).toBe("restricted");
  });
});

describe("redactContextForExternalModel", () => {
  it("laesst local unveraendert", () => {
    const pkg = makePkg();
    const { contextPackage, redactedFieldCount } = redactContextForExternalModel(pkg, "local");
    expect(contextPackage.internalContext.objects).toHaveLength(2);
    expect(redactedFieldCount).toBe(0);
  });

  it("filtert restricted und redigiert fuer fast_external", () => {
    const { contextPackage, redactedFieldCount } = redactContextForExternalModel(makePkg(), "fast_external");
    expect(contextPackage.internalContext.objects).toHaveLength(1);
    expect(contextPackage.internalContext.objects[0].summary).toMatch(/\[email\]/);
    expect(contextPackage.internalContext.objects[0].fields.salary).toBe("[redacted]");
    expect(redactedFieldCount).toBeGreaterThan(0);
  });
});
