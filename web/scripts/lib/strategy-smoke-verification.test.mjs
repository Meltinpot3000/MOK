import { describe, expect, it } from "vitest";

import {
  deriveRunQuality,
  hasDegradationSignal,
  scanAnswerQualityFlags,
  evaluateStrategyQuestion,
  buildRunSummary,
} from "./strategy-smoke-verification.mjs";

describe("deriveRunQuality", () => {
  it("returns planner_unreachable when not reachable", () => {
    expect(
      deriveRunQuality({
        provider: "ollama",
        baseUrl: "http://localhost:11434",
        model: "m",
        reachable: false,
        modelAvailable: false,
      })
    ).toBe("planner_unavailable");
  });

  it("returns verification_ready when reachable, model ok, generate ok", () => {
    expect(
      deriveRunQuality({
        provider: "ollama",
        baseUrl: "http://localhost:11434",
        model: "m",
        reachable: true,
        modelAvailable: true,
        generateOk: true,
      })
    ).toBe("verification_ready");
  });

  it("returns technical_only when generate fails", () => {
    expect(
      deriveRunQuality({
        provider: "ollama",
        baseUrl: "http://localhost:11434",
        model: "m",
        reachable: true,
        modelAvailable: true,
        generateOk: false,
      })
    ).toBe("technical_only");
  });
});

describe("hasDegradationSignal", () => {
  it("detects partial + missingOps", () => {
    expect(
      hasDegradationSignal({
        retrievalStatus: "partial",
        missingOps: ["x"],
        coveredOps: [],
      })
    ).toBe(true);
  });

  it("false without partial/failed", () => {
    expect(
      hasDegradationSignal({
        retrievalStatus: "ok",
        missingOps: ["x"],
      })
    ).toBe(false);
  });
});

describe("scanAnswerQualityFlags", () => {
  it("flags smoke fast stub", () => {
    const f = scanAnswerQualityFlags("Smoke fast mode: no synthesis.", null);
    expect(f.containsPlaceholderText).toBe(true);
  });
});

describe("evaluateStrategyQuestion integration", () => {
  const pfOk = { reachable: true, modelAvailable: true };
  const pfBad = { reachable: false, modelAvailable: false };

  it("fails fast-mode stub when planner ready", () => {
    const ev = evaluateStrategyQuestion({
      catalogEntry: {
        id: "x",
        question: "q",
        expected: {
          path: "pipeline",
          queryClass: ["composite"],
          requiredContract: true,
          allowPartial: true,
          requiredDiagnostics: false,
          allowDegradation: true,
          requiredMissingOps: false,
        },
      },
      result: {
        answer: "Smoke fast mode: no synthesis.",
        diagnostics: {
          dispatch: { selectedPath: "pipeline" },
          plan: { queryClass: "composite", usedFallback: false },
          tools: [{ toolName: "t", success: true }],
        },
        contract: {
          queryClass: "composite",
          retrievalStatus: "ok",
          coveredOps: [],
          missingOps: [],
        },
      },
      plannerPreflight: pfOk,
      runQuality: "verification_ready",
    });
    expect(ev.pass).toBe(false);
    expect(ev.failReasons.some((r) => r.includes("placeholder"))).toBe(true);
  });

  it("marks planner unavailable run", () => {
    const ev = evaluateStrategyQuestion({
      catalogEntry: {
        id: "x",
        question: "q",
        expected: {
          path: "pipeline",
          queryClass: ["composite"],
          requiredContract: false,
          allowPartial: true,
          requiredDiagnostics: false,
          allowDegradation: true,
          requiredMissingOps: false,
        },
      },
      result: {
        diagnostics: { dispatch: { selectedPath: "pipeline" }, plan: {}, tools: [] },
      },
      plannerPreflight: pfBad,
      runQuality: "planner_unavailable",
    });
    expect(ev.pass).toBe(false);
    expect(ev.failReasons).toContain("run_planner_unavailable_not_domain_verified");
  });
});

describe("buildRunSummary", () => {
  it("counts paths", () => {
    const s = buildRunSummary(
      [
        {
          id: "a",
          question: "q1",
          evaluation: {
            actualPath: "pipeline",
            actualQueryClass: "composite",
            hasCompositeContract: true,
            pass: true,
            failReasons: [],
          },
        },
        {
          id: "b",
          question: "q2",
          evaluation: {
            actualPath: "legacy",
            actualQueryClass: "unknown",
            hasCompositeContract: false,
            pass: false,
            failReasons: ["x"],
          },
        },
      ],
      {
        totalQuestions: 2,
        runQuality: "verification_ready",
        plannerPreflight: { reachable: true, modelAvailable: true },
      }
    );
    expect(s.pipelineCount).toBe(1);
    expect(s.legacyCount).toBe(1);
    expect(s.unknownCount).toBe(1);
    expect(s.passed).toBe(1);
    expect(s.failed).toBe(1);
  });
});
