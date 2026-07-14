import { describe, expect, it } from "vitest";
import {
  buildStrategyReviewChainHubs,
  buildStrategyReviewChainHubsFromPayload,
  collectThemeItems,
  computeThemeOpenEnds,
  gapHintsForHub,
  preReadPayloadHasChainLinks,
  themeCounts,
} from "@/lib/strategy-review/pre-read-chain";

describe("buildStrategyReviewChainHubs", () => {
  it("aggregates challenges, objectives and programs around a direction", () => {
    const hubs = buildStrategyReviewChainHubs({
      directions: [{ id: "d1", title: "Digital" }],
      challenges: [{ id: "c1", title: "Talent" }],
      objectives: [{ id: "o1", title: "NPS" }],
      programs: [
        {
          id: "p1",
          title: "Change A",
          strategic_direction_id: "d1",
          status: "active",
          ownerLabel: "Anna",
        },
      ],
      challengeDirectionLinks: [
        { strategic_challenge_id: "c1", strategic_direction_id: "d1" },
      ],
      directionObjectiveLinks: [
        { strategic_direction_id: "d1", strategy_objective_id: "o1" },
      ],
    });

    expect(hubs).toHaveLength(1);
    expect(hubs[0].challengeCount).toBe(1);
    expect(hubs[0].objectiveCount).toBe(1);
    expect(hubs[0].programCount).toBe(1);
    expect(hubs[0].gapFlags.hasAnyGap).toBe(false);
    expect(hubs[0].programs[0].ownerLabel).toBe("Anna");
  });

  it("flags missing chain sides", () => {
    const hubs = buildStrategyReviewChainHubs({
      directions: [{ id: "d1", title: "Lean" }],
      challenges: [],
      objectives: [],
      programs: [],
      challengeDirectionLinks: [],
      directionObjectiveLinks: [],
    });
    expect(hubs[0].gapFlags).toEqual({
      missingChallenges: true,
      missingObjectives: true,
      missingPrograms: true,
      hasAnyGap: true,
    });
    expect(gapHintsForHub(hubs[0])).toHaveLength(3);
  });

  it("builds from payload with links", () => {
    const hubs = buildStrategyReviewChainHubsFromPayload({
      focus_areas: [{ id: "d1", title: "Hub" }],
      challenges: [{ id: "c1", title: "C" }],
      objectives: [{ id: "o1", title: "O" }],
      programs: [{ id: "p1", title: "P", strategic_direction_id: "d1", status: "draft" }],
      links: {
        challenge_direction: [
          { strategic_challenge_id: "c1", strategic_direction_id: "d1" },
        ],
        direction_objective: [
          { strategic_direction_id: "d1", strategy_objective_id: "o1" },
        ],
      },
    });
    expect(hubs[0].challengeCount).toBe(1);
    expect(hubs[0].objectiveCount).toBe(1);
    expect(hubs[0].programCount).toBe(1);
    expect(preReadPayloadHasChainLinks(hubs[0] as unknown as Record<string, unknown>)).toBe(false);
    expect(
      preReadPayloadHasChainLinks({
        links: { challenge_direction: [] },
      })
    ).toBe(true);
  });

  it("uses strategy-cycle objective catalog instead of linked-only hubs", () => {
    const hubs = buildStrategyReviewChainHubs({
      directions: [{ id: "d1", title: "Digital" }],
      challenges: [],
      objectives: [{ id: "o1", title: "Linked" }],
      programs: [],
      challengeDirectionLinks: [],
      directionObjectiveLinks: [
        { strategic_direction_id: "d1", strategy_objective_id: "o1" },
      ],
    });
    const catalog = [
      { id: "o1", title: "Linked" },
      { id: "o2", title: "Unlinked L1" },
      { id: "o3", title: "Another L1" },
    ];
    expect(collectThemeItems(hubs, "objectives")).toHaveLength(1);
    expect(collectThemeItems(hubs, "objectives", { objectives: catalog })).toHaveLength(3);
    expect(themeCounts(hubs, { objectives: catalog }).objectives).toBe(3);
  });

  it("flags objectives without implementation path as open ends", () => {
    const hubs = buildStrategyReviewChainHubs({
      directions: [{ id: "d1", title: "Digital" }],
      challenges: [],
      objectives: [{ id: "o1", title: "Linked" }],
      programs: [],
      challengeDirectionLinks: [],
      directionObjectiveLinks: [
        { strategic_direction_id: "d1", strategy_objective_id: "o1" },
      ],
    });
    const open = computeThemeOpenEnds(hubs, {
      objectives: [
        { id: "o1", title: "Linked" },
        { id: "o2", title: "Orphan" },
      ],
    });
    expect(open.objectives?.count).toBe(2);
    expect(open.objectives?.shortLabel).toBe("ohne Umsetzungsplan");
    expect(open.directions?.shortLabel).toBe("ohne Programm");
  });

  it("flags challenges without direction as open ends, not directions without challenges", () => {
    const hubs = buildStrategyReviewChainHubs({
      directions: [
        { id: "d1", title: "Digital" },
        { id: "d2", title: "Ops" },
      ],
      challenges: [
        { id: "c1", title: "Linked" },
        { id: "c2", title: "Orphan A" },
        { id: "c3", title: "Orphan B" },
      ],
      objectives: [],
      programs: [{ id: "p1", title: "P", strategic_direction_id: "d1" }],
      challengeDirectionLinks: [
        { strategic_challenge_id: "c1", strategic_direction_id: "d1" },
      ],
      directionObjectiveLinks: [],
    });
    const open = computeThemeOpenEnds(hubs, {
      challenges: [
        { id: "c1", title: "Linked" },
        { id: "c2", title: "Orphan A" },
        { id: "c3", title: "Orphan B" },
      ],
    });
    expect(open.challenges?.count).toBe(2);
    expect(open.challenges?.shortLabel).toBe("ohne Stoßrichtung");
    expect(open.challenges?.fullLabel).toBe("2 Handlungsbedarf ohne Stoßrichtung");
  });

  it("flags programs without annual targets and initiatives as unsupported", () => {
    const hubs = buildStrategyReviewChainHubs({
      directions: [{ id: "d1", title: "Digital" }],
      challenges: [],
      objectives: [],
      programs: [
        { id: "p1", title: "Thin", strategic_direction_id: "d1" },
        { id: "p2", title: "Supported", strategic_direction_id: "d1" },
      ],
      challengeDirectionLinks: [],
      directionObjectiveLinks: [],
    });
    const coverage = {
      challenge: {},
      focus_area: {},
      objective: {},
      program: {
        p1: {
          programCount: 1,
          annualTargetCount: 0,
          initiativeCount: 0,
          okrCount: 0,
        },
        p2: {
          programCount: 1,
          annualTargetCount: 1,
          initiativeCount: 0,
          okrCount: 0,
        },
      },
    };
    const open = computeThemeOpenEnds(hubs, undefined, coverage);
    expect(open.programs?.count).toBe(1);
    expect(open.programs?.shortLabel).toBe("nicht unterstützt");
    expect(open.programs?.fullLabel).toContain("ohne Jahresziele/Initiativen");
  });

  it("schließt archivierte und stillgelegte Objekte aus Grafik und Listen aus", () => {
    const hubs = buildStrategyReviewChainHubs({
      directions: [
        { id: "d1", title: "Aktiv", lifecycleState: "active" },
        { id: "d2", title: "Archiv", lifecycleState: "archived" },
      ],
      challenges: [
        { id: "c1", title: "C1", lifecycleState: "active" },
        { id: "c2", title: "C2 archived", lifecycleState: "archived" },
      ],
      objectives: [
        { id: "o1", title: "O1", lifecycleState: "active" },
        { id: "o2", title: "O2 retired", lifecycleState: "retired" },
      ],
      programs: [],
      challengeDirectionLinks: [
        { strategic_challenge_id: "c1", strategic_direction_id: "d1" },
        { strategic_challenge_id: "c2", strategic_direction_id: "d1" },
      ],
      directionObjectiveLinks: [
        { strategic_direction_id: "d1", strategy_objective_id: "o1" },
        { strategic_direction_id: "d1", strategy_objective_id: "o2" },
      ],
    });
    expect(hubs).toHaveLength(1);
    expect(hubs[0]?.direction.id).toBe("d1");
    expect(collectThemeItems(hubs, "challenges").map((c) => c.id)).toEqual(["c1"]);
    expect(collectThemeItems(hubs, "objectives").map((o) => o.id)).toEqual(["o1"]);
    expect(collectThemeItems(hubs, "directions").map((d) => d.id)).toEqual(["d1"]);
  });
});
