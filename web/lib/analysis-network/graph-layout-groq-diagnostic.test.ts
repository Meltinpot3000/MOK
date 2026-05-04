import { describe, expect, it } from "vitest";
import {
  diagnoseGraphLayoutGroqPipeline,
  diagnoseGraphLayoutParse,
} from "@/lib/analysis-network/providers";

describe("diagnoseGraphLayoutParse", () => {
  it("leere Antwort", () => {
    const d = diagnoseGraphLayoutParse("", ["a", "b"]);
    expect(d.accepted).toBe(false);
    expect(d.reasonCode).toBe("empty_response");
    expect(d.summaryDe).toMatch(/keinen Text/);
  });

  it("unter Parser-Schwelle (50 %)", () => {
    const raw = JSON.stringify({
      layoutVersion: "analysis-graph-layout-v1",
      nodes: [{ id: "a", x: 0, y: 0, z: 0, confidence: 0.5 }],
      globalReasoning: "test",
    });
    const ids = ["a", "b", "c", "d"];
    const d = diagnoseGraphLayoutParse(raw, ids, { minimumCoverageRatio: 0.5 });
    expect(d.accepted).toBe(false);
    expect(d.reasonCode).toBe("below_threshold");
    expect(d.parsedCount).toBe(1);
    expect(d.minimumRequired).toBe(2);
    expect(d.summaryDe).toMatch(/mindestens 2/);
    expect(d.missingIds).toContain("b");
  });

  it("OK bei ausreichend Knoten", () => {
    const nodes = [
      { id: "a", x: 0, y: 0, z: 0, confidence: 0.5 },
      { id: "b", x: 0.1, y: 0.1, z: 0.1, confidence: 0.5 },
    ];
    const raw = JSON.stringify({
      layoutVersion: "v1",
      nodes,
      globalReasoning: "ok",
    });
    const d = diagnoseGraphLayoutParse(raw, ["a", "b"], { minimumCoverageRatio: 0.5 });
    expect(d.accepted).toBe(true);
    expect(d.reasonCode).toBe("ok");
  });

  it("unerwartete IDs im JSON werden gemeldet", () => {
    const raw = JSON.stringify({
      layoutVersion: "v1",
      nodes: [
        { id: "a", x: 0, y: 0, z: 0, confidence: 0.5 },
        { id: "unknown", x: 0, y: 0, z: 0, confidence: 0.5 },
      ],
      globalReasoning: "",
    });
    const d = diagnoseGraphLayoutParse(raw, ["a", "b"], { minimumCoverageRatio: 0.5 });
    expect(d.unexpectedIdsInResponse).toContain("unknown");
  });
});

describe("diagnoseGraphLayoutGroqPipeline (E2E Groq)", () => {
  it(
    "ruft Groq auf und liefert Schritte + Diagnose (überspringt ohne GROQ_API_KEY)",
    async () => {
      if (!process.env.GROQ_API_KEY) {
        console.warn("[graph-layout] Übersprungen: GROQ_API_KEY nicht gesetzt.");
        return;
      }
      const nodes = [
        {
          id: "11111111-1111-1111-1111-111111111101",
          title: "Knoten A",
          analysisType: "environment",
          subType: null,
          impact: 4,
          uncertainty: 3,
          description: "Test",
          qualityScore: 50,
        },
        {
          id: "11111111-1111-1111-1111-111111111102",
          title: "Knoten B",
          analysisType: "company",
          subType: null,
          impact: 3,
          uncertainty: 3,
          description: "Test",
          qualityScore: 50,
        },
      ];
      const report = await diagnoseGraphLayoutGroqPipeline({
        nodes,
        edges: [
          {
            source: nodes[0].id,
            target: nodes[1].id,
            linkType: "related",
            confidence: 0.8,
            strength: 3,
          },
        ],
        strategyReferenceText: null,
        maxOutputTokens: 4096,
      });
      expect(report.steps.length).toBeGreaterThanOrEqual(1);
      expect(report.steps[0].phase).toBe("full");
      expect(report.steps[0].parse).toBeDefined();
      expect(report.summaryDe.length).toBeGreaterThan(0);
      if (report.missingNodeIds.length > 0) {
        expect(report.summaryDe).toMatch(/Groq-only|Parser|gültig|JSON|Text/i);
      }
    },
    120_000
  );
});
