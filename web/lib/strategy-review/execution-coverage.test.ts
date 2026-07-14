import { describe, expect, it } from "vitest";
import {
  buildCoverageIndex,
  coverageForSubject,
  coverageHasAny,
  coverageTooltipLines,
  emptyExecutionCoverage,
} from "./execution-coverage";

describe("buildCoverageIndex", () => {
  it("aggregiert Programme, Jahresziele, Initiativen und OKRs inkl. Titel", () => {
    const index = buildCoverageIndex({
      programs: [
        {
          id: "p1",
          title: "Programm Alpha",
          strategic_direction_id: "d1",
          strategic_challenge_id: "c1",
          supported_objective_ids: ["o1"],
        },
      ],
      annualTargets: [
        { id: "at1", title: "JZ Eins", strategic_direction_id: "d1", strategy_program_id: "p1" },
        { id: "at2", title: "JZ Zwei", strategic_direction_id: "d1", strategy_program_id: null },
      ],
      initiatives: [
        { id: "i1", title: "Init A", program_id: "p1" },
        { id: "i2", title: "Init B", program_id: "p1" },
      ],
      okrsByStrategyObjectiveId: {
        o1: [
          { id: "okr-s1", title: "OKR S1" },
          { id: "okr-s2", title: "OKR S2" },
          { id: "okr-s3", title: "OKR S3" },
        ],
      },
      okrsByAnnualTargetId: {
        at1: [
          { id: "okr-at1a", title: "OKR AT1a" },
          { id: "okr-at1b", title: "OKR AT1b" },
        ],
        at2: [{ id: "okr-at2", title: "OKR AT2" }],
      },
      directionObjectiveLinks: [
        { strategic_direction_id: "d1", strategy_objective_id: "o1" },
        { strategic_direction_id: "d1", strategy_objective_id: "o2" },
      ],
      challengeDirectionLinks: [
        { strategic_challenge_id: "c1", strategic_direction_id: "d1" },
      ],
    });

    expect(coverageForSubject(index, "focus_area", "d1")).toEqual({
      programCount: 1,
      annualTargetCount: 2,
      initiativeCount: 2,
      okrCount: 3,
      programTitles: ["Programm Alpha"],
      annualTargetTitles: ["JZ Eins", "JZ Zwei"],
      initiativeTitles: ["Init A", "Init B"],
      okrTitles: ["OKR AT1a", "OKR AT1b", "OKR AT2"],
    });
    expect(coverageForSubject(index, "challenge", "c1").programCount).toBe(1);
    expect(coverageForSubject(index, "challenge", "c1").initiativeCount).toBe(2);
    expect(coverageForSubject(index, "challenge", "c1").annualTargetCount).toBe(2);
    expect(coverageForSubject(index, "challenge", "c1").initiativeTitles).toEqual([
      "Init A",
      "Init B",
    ]);
    expect(coverageForSubject(index, "program", "p1")).toEqual({
      programCount: 1,
      annualTargetCount: 1,
      initiativeCount: 2,
      okrCount: 2,
      programTitles: ["Programm Alpha"],
      annualTargetTitles: ["JZ Eins"],
      initiativeTitles: ["Init A", "Init B"],
      okrTitles: ["OKR AT1a", "OKR AT1b"],
    });
    expect(coverageForSubject(index, "objective", "o1").programCount).toBe(1);
    expect(coverageForSubject(index, "objective", "o1").okrCount).toBe(6); // 3 direct + 3 via JZ→Stoßrichtung
    expect(coverageForSubject(index, "objective", "o1").okrTitles).toEqual([
      "OKR AT1a",
      "OKR AT1b",
      "OKR AT2",
      "OKR S1",
      "OKR S2",
      "OKR S3",
    ]);
    expect(coverageForSubject(index, "objective", "o2").programCount).toBe(1);
    expect(coverageHasAny(coverageForSubject(index, "focus_area", "d1"))).toBe(true);
    expect(coverageHasAny(emptyExecutionCoverage())).toBe(false);
  });

  it("attributes challenge coverage via direction links even without program.strategic_challenge_id", () => {
    const index = buildCoverageIndex({
      programs: [
        {
          id: "p1",
          title: "P1",
          strategic_direction_id: "d1",
          strategic_challenge_id: null,
          supported_objective_ids: [],
        },
      ],
      annualTargets: [
        { id: "at1", title: "AT1", strategic_direction_id: "d1", strategy_program_id: "p1" },
      ],
      initiatives: [{ id: "i1", title: "I1", program_id: "p1" }],
      okrsByStrategyObjectiveId: {},
      directionObjectiveLinks: [],
      challengeDirectionLinks: [
        { strategic_challenge_id: "c1", strategic_direction_id: "d1" },
      ],
    });
    expect(coverageForSubject(index, "challenge", "c1")).toEqual({
      programCount: 1,
      annualTargetCount: 1,
      initiativeCount: 1,
      okrCount: 0,
      programTitles: ["P1"],
      annualTargetTitles: ["AT1"],
      initiativeTitles: ["I1"],
      okrTitles: [],
    });
  });

  it("vermeidet Doppelzählung von Programmen über supported + direction", () => {
    const index = buildCoverageIndex({
      programs: [
        {
          id: "p1",
          title: "P1",
          strategic_direction_id: "d1",
          strategic_challenge_id: null,
          supported_objective_ids: ["o1"],
        },
      ],
      annualTargets: [],
      initiatives: [],
      okrsByStrategyObjectiveId: {},
      directionObjectiveLinks: [
        { strategic_direction_id: "d1", strategy_objective_id: "o1" },
      ],
    });
    expect(coverageForSubject(index, "objective", "o1").programCount).toBe(1);
    expect(coverageForSubject(index, "objective", "o1").programTitles).toEqual(["P1"]);
  });
});

describe("coverageTooltipLines", () => {
  it("listet Bezeichnungen zeilenweise", () => {
    expect(coverageTooltipLines(["A", "B"], "leer")).toBe("A\nB");
    expect(coverageTooltipLines([], "leer")).toBe("leer");
  });
});
