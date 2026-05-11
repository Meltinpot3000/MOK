import { describe, expect, it, vi } from "vitest";

import { runQueryPipeline } from "./query-pipelines";
import type { QueryPlan } from "./query-types";

describe("composite pipeline", () => {
  it("liefert top-n plus anteile via composite ops", async () => {
    const execute = vi.fn(async (toolName: string) => {
      if (toolName === "get_okr_objective_owner_counts") {
        return {
          toolName,
          success: true,
          outputSummary: "owner-counts",
          data: {
            totalObjectives: 5,
            ownerRanking: [
              {
                ownerDisplayName: "Carmelo",
                objectiveCount: 4,
                objectiveIds: ["o1", "o2", "o3", "o4"],
              },
              {
                ownerDisplayName: "Karl",
                objectiveCount: 1,
                objectiveIds: ["o5"],
              },
            ],
          },
        };
      }
      return { toolName, success: true, outputSummary: "ok", data: {} };
    });
    const plan: QueryPlan = {
      queryClass: "composite",
      domain: "okr",
      domainCandidates: ["okr"],
      optionalContextDomains: [],
      queryText: "Top-3 Owner inkl. Anteil",
      analysisOps: ["rank", "share", "count_total"],
      targetEntity: "okr_objective",
      metric: "share",
      groupBy: "owner",
      scope: {
        cycle: "current",
        organizationScope: "visible",
        objectType: "okr_objective",
        objectId: null,
        timeHorizon: null,
      },
    };
    const result = await runQueryPipeline(plan, {
      executePermissionedTool: execute,
      userContext: {
        userId: "u1",
        membershipId: "m1",
        organizationId: "org1",
        organizationName: "Org",
        roleCodes: [],
        permissionCodes: new Set(),
      },
    });
    expect(result.contract.queryClass).toBe("composite");
    if (result.contract.queryClass === "composite") {
      expect(result.contract.retrievalStatus).toBe("ok");
      expect(result.contract.missingOps).toEqual([]);
      expect(Array.isArray(result.contract.metrics.topShare)).toBe(true);
      expect(result.contract.compositeDiagnostics?.pipelineVariant).toBe("top_n_share");
      expect(result.contract.compositeDiagnostics?.rawTotal).toBe(5);
      expect(result.contract.compositeDiagnostics?.finalTotal).toBe(2);
      expect(result.contract.compositeDiagnosticsSteps?.length).toBe(1);
      expect(result.contract.compositeDiagnosticsSteps?.[0]?.pipelineVariant).toBe("top_n_share");
      expect(result.contract.compositeDiagnostics).toEqual(
        result.contract.compositeDiagnosticsSteps?.[result.contract.compositeDiagnosticsSteps.length - 1]
      );
    }
  });

  it("liefert nested distribution owner x status", async () => {
    const execute = vi.fn(async (toolName: string) => {
      if (toolName === "get_visible_okr_objectives") {
        return {
          toolName,
          success: true,
          outputSummary: "objectives",
          data: {
            objectives: [
              { id: "o1", title: "A", status: "active", rollupStatus: "on_track" },
              { id: "o2", title: "B", status: "active", rollupStatus: "off_track" },
            ],
          },
        };
      }
      if (toolName === "get_okr_objective_owner_counts") {
        return {
          toolName,
          success: true,
          outputSummary: "owners",
          data: {
            ownerRanking: [{ ownerDisplayName: "Carmelo", objectiveCount: 2, objectiveIds: ["o1", "o2"] }],
          },
        };
      }
      return { toolName, success: true, outputSummary: "ok", data: {} };
    });
    const plan: QueryPlan = {
      queryClass: "composite",
      domain: "okr",
      domainCandidates: ["okr"],
      optionalContextDomains: [],
      queryText: "Owner + Statusmix",
      analysisOps: ["nested_distribution", "distribution", "rank"],
      targetEntity: "okr_objective",
      metric: "share",
      groupBy: "owner",
      scope: {
        cycle: "current",
        organizationScope: "visible",
        objectType: "okr_objective",
        objectId: null,
        timeHorizon: null,
      },
    };
    const result = await runQueryPipeline(plan, {
      executePermissionedTool: execute,
      userContext: {
        userId: "u1",
        membershipId: "m1",
        organizationId: "org1",
        organizationName: "Org",
        roleCodes: [],
        permissionCodes: new Set(),
      },
    });
    if (result.contract.queryClass === "composite") {
      expect(result.contract.retrievalStatus).toBe("ok");
      expect(result.contract.coveredOps).toContain("nested_distribution");
      expect(Array.isArray(result.contract.metrics.nestedDistribution)).toBe(true);
      expect(result.contract.compositeDiagnostics?.pipelineVariant).toBe("nested_distribution_owner_status");
      expect(result.contract.compositeDiagnostics?.rawTotal).toBe(2);
      expect(result.contract.compositeDiagnosticsSteps?.map((s) => s.pipelineVariant)).toEqual([
        "nested_distribution_owner_status",
      ]);
    }
  });

  it("degradiert strategy_join mit missingOps statt legacy", async () => {
    const execute = vi.fn(async (toolName: string) => ({
      toolName,
      success: true,
      outputSummary: "ok",
      data: {},
    }));
    const plan: QueryPlan = {
      queryClass: "composite",
      domain: "strategy",
      domainCandidates: ["strategy", "okr"],
      optionalContextDomains: [],
      queryText: "Strategische Richtungen mit meisten Objectives",
      analysisOps: ["strategy_join", "join", "rank", "count_total"],
      targetEntity: "strategy",
      metric: "count",
      groupBy: "strategy",
      scope: {
        cycle: "current",
        organizationScope: "visible",
        objectType: "strategy",
        objectId: null,
        timeHorizon: null,
      },
    };
    const result = await runQueryPipeline(plan, {
      executePermissionedTool: execute,
      userContext: {
        userId: "u1",
        membershipId: "m1",
        organizationId: "org1",
        organizationName: "Org",
        roleCodes: [],
        permissionCodes: new Set(),
      },
    });
    if (result.contract.queryClass === "composite") {
      expect(result.contract.retrievalStatus).toBe("partial");
      expect(result.contract.missingOps).toContain("strategy_join");
      expect(result.contract.missingOps).toContain("join");
    }
  });
});
