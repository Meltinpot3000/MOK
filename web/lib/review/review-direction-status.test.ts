import { describe, expect, it } from "vitest";
import {
  deriveDirectionOperationalCoverage,
  deriveDirectionReviewStatus,
  primaryCoverageTypeLabelDe,
} from "@/lib/review/review-direction-status";
import type { ReviewCycleInitiativeInput } from "@/lib/review/review-cycle-view-model";

function initiative(
  overrides: Partial<ReviewCycleInitiativeInput> & { id: string }
): ReviewCycleInitiativeInput {
  return {
    id: overrides.id,
    title: overrides.title ?? "Initiative",
    status: overrides.status ?? "active",
    priority: overrides.priority ?? 3,
    program_id: overrides.program_id ?? "prog-1",
    program_title: overrides.program_title ?? "PIP",
    owner_membership_id: overrides.owner_membership_id ?? "owner-1",
    owner_display_name: overrides.owner_display_name ?? "Owner",
    weight: overrides.weight ?? 3,
    progress_percent: overrides.progress_percent ?? 50,
    review_comment: overrides.review_comment ?? null,
    last_review_update_at: overrides.last_review_update_at ?? "2026-01-15T00:00:00Z",
    directionId: overrides.directionId ?? "dir-1",
    resolvedDirectionSource: overrides.resolvedDirectionSource ?? "program",
    execution_health_override: overrides.execution_health_override ?? null,
    start_date: overrides.start_date ?? null,
    end_date: overrides.end_date ?? null,
  };
}

const baseSummary = {
  directionId: "dir-1",
  title: "Richtung A",
  status: "active",
  priority: 1,
  directionProgress: 40,
  activeInitiativeCount: 1,
  criticalInitiativeCount: 0,
  lastReviewUpdateAt: "2026-01-15T00:00:00Z",
  executionHealthStatus: "on_track" as const,
};

const programs = [{ id: "prog-1", strategic_direction_id: "dir-1" }];
const programStatusById = new Map([["prog-1", "active"]]);
const emptyOkr = new Set<string>();

describe("deriveDirectionOperationalCoverage", () => {
  it("counts active run and change annual targets", () => {
    const coverage = deriveDirectionOperationalCoverage(
      "dir-1",
      [],
      new Map(),
      [],
      [
        {
          id: "at-run",
          strategic_direction_id: "dir-1",
          strategy_program_id: null,
          status: "active",
        },
        {
          id: "at-change",
          strategic_direction_id: "dir-1",
          strategy_program_id: "prog-1",
          status: "active",
        },
        {
          id: "at-draft",
          strategic_direction_id: "dir-1",
          strategy_program_id: null,
          status: "draft",
        },
      ],
      emptyOkr
    );
    expect(coverage.annualTargetCoverage).toBe(true);
    expect(coverage.runAnnualTargetCount).toBe(1);
    expect(coverage.changeAnnualTargetCount).toBe(1);
    expect(coverage.activeAnnualTargetCount).toBe(2);
    expect(coverage.hasAnyCoverage).toBe(true);
  });

  it("ignores legacy annual_target initiative path for initiativeCoverage", () => {
    const coverage = deriveDirectionOperationalCoverage(
      "dir-1",
      programs,
      programStatusById,
      [
        initiative({
          id: "i1",
          resolvedDirectionSource: "legacy_annual_target",
          status: "active",
        }),
      ],
      [],
      emptyOkr
    );
    expect(coverage.initiativeCoverage).toBe(false);
    expect(coverage.programCoverage).toBe(true);
  });

  it("counts planned|active|at_risk initiatives via program", () => {
    const coverage = deriveDirectionOperationalCoverage(
      "dir-1",
      programs,
      programStatusById,
      [initiative({ id: "i1", status: "planned" })],
      [],
      emptyOkr
    );
    expect(coverage.initiativeCoverage).toBe(true);
  });
});

describe("deriveDirectionReviewStatus", () => {
  it("returns no_coverage when nothing covers an active direction", () => {
    const result = deriveDirectionReviewStatus({
      direction: { id: "dir-1", status: "active", priority: 1 },
      summary: { ...baseSummary, activeInitiativeCount: 0 },
      programs: [],
      programStatusById: new Map(),
      initiativeRows: [],
      annualTargets: [],
      directionIdsWithOkrCoverage: emptyOkr,
      attentionItems: [],
      timeProgressPercent: 30,
      deltaPp: null,
    });
    expect(result.reviewStatus).toBe("no_coverage");
    expect(result.coverage.hasAnyCoverage).toBe(false);
  });

  it("active run annual target alone is on_track, not no_coverage", () => {
    const result = deriveDirectionReviewStatus({
      direction: { id: "dir-1", status: "active", priority: 1 },
      summary: { ...baseSummary, activeInitiativeCount: 0 },
      programs: [],
      programStatusById: new Map(),
      initiativeRows: [],
      annualTargets: [
        {
          id: "at-1",
          strategic_direction_id: "dir-1",
          strategy_program_id: null,
          status: "active",
        },
      ],
      directionIdsWithOkrCoverage: emptyOkr,
      attentionItems: [],
      timeProgressPercent: 30,
      deltaPp: null,
    });
    expect(result.reviewStatus).toBe("on_track");
    expect(result.coverage.annualTargetCoverage).toBe(true);
    expect(result.coverage.primaryCoverageType).toBe("annual_target");
    expect(primaryCoverageTypeLabelDe(result.coverage)).toBe("Run-Jahresziel vorhanden");
  });

  it("active change annual target alone is on_track", () => {
    const result = deriveDirectionReviewStatus({
      direction: { id: "dir-1", status: "active", priority: 1 },
      summary: { ...baseSummary, activeInitiativeCount: 0 },
      programs: [],
      programStatusById: new Map(),
      initiativeRows: [],
      annualTargets: [
        {
          id: "at-1",
          strategic_direction_id: "dir-1",
          strategy_program_id: "prog-1",
          status: "active",
        },
      ],
      directionIdsWithOkrCoverage: emptyOkr,
      attentionItems: [],
      timeProgressPercent: 30,
      deltaPp: null,
    });
    expect(result.reviewStatus).toBe("on_track");
    expect(primaryCoverageTypeLabelDe(result.coverage)).toBe("Change-Jahresziel vorhanden");
  });

  it("program alone is unclear with hint, not on_track", () => {
    const result = deriveDirectionReviewStatus({
      direction: { id: "dir-1", status: "active", priority: 1 },
      summary: { ...baseSummary, activeInitiativeCount: 0 },
      programs,
      programStatusById,
      initiativeRows: [],
      annualTargets: [],
      directionIdsWithOkrCoverage: emptyOkr,
      attentionItems: [],
      timeProgressPercent: 30,
      deltaPp: null,
    });
    expect(result.reviewStatus).toBe("unclear");
    expect(result.statusHintDe).toBe("Programm vorhanden, Umsetzung unklar");
    expect(result.coverage.programCoverage).toBe(true);
    expect(result.coverage.hasAnyCoverage).toBe(true);
  });

  it("okrCoverage alone is on_track", () => {
    const result = deriveDirectionReviewStatus({
      direction: { id: "dir-1", status: "active", priority: 1 },
      summary: { ...baseSummary, activeInitiativeCount: 0 },
      programs: [],
      programStatusById: new Map(),
      initiativeRows: [],
      annualTargets: [],
      directionIdsWithOkrCoverage: new Set(["dir-1"]),
      attentionItems: [],
      timeProgressPercent: 30,
      deltaPp: null,
    });
    expect(result.reviewStatus).toBe("on_track");
    expect(result.coverage.okrCoverage).toBe(true);
  });

  it("returns off_track for blocked initiative", () => {
    const rows = [
      initiative({
        id: "i1",
        execution_health_override: "off_track",
      }),
    ];
    const result = deriveDirectionReviewStatus({
      direction: { id: "dir-1", status: "active", priority: 1 },
      summary: baseSummary,
      programs,
      programStatusById,
      initiativeRows: rows,
      annualTargets: [],
      directionIdsWithOkrCoverage: emptyOkr,
      attentionItems: [],
      timeProgressPercent: 50,
      deltaPp: -20,
    });
    expect(result.reviewStatus).toBe("off_track");
  });

  it("returns at_risk for never_reviewed, not unclear", () => {
    const rows = [initiative({ id: "i1", last_review_update_at: null })];
    const result = deriveDirectionReviewStatus({
      direction: { id: "dir-1", status: "active", priority: 1 },
      summary: baseSummary,
      programs,
      programStatusById,
      initiativeRows: rows,
      annualTargets: [],
      directionIdsWithOkrCoverage: emptyOkr,
      attentionItems: [
        {
          id: "stale-i1",
          issueType: "never_reviewed",
          severity: "low",
          title: "Noch kein Review",
          detail: "…",
          directionId: "dir-1",
          initiativeId: "i1",
        },
      ],
      timeProgressPercent: 10,
      deltaPp: -30,
    });
    expect(result.reviewStatus).toBe("at_risk");
  });

  it("does not trigger at_risk from delta when cycle time progress is low", () => {
    const rows = [initiative({ id: "i1", progress_percent: 5 })];
    const result = deriveDirectionReviewStatus({
      direction: { id: "dir-1", status: "active", priority: 1 },
      summary: { ...baseSummary, directionProgress: 5 },
      programs,
      programStatusById,
      initiativeRows: rows,
      annualTargets: [],
      directionIdsWithOkrCoverage: emptyOkr,
      attentionItems: [],
      timeProgressPercent: 10,
      deltaPp: -25,
    });
    expect(result.reviewStatus).toBe("on_track");
  });

  it("triggers at_risk from delta when cycle progressed and active execution exists", () => {
    const rows = [initiative({ id: "i1", progress_percent: 10 })];
    const result = deriveDirectionReviewStatus({
      direction: { id: "dir-1", status: "active", priority: 1 },
      summary: { ...baseSummary, directionProgress: 10 },
      programs,
      programStatusById,
      initiativeRows: rows,
      annualTargets: [],
      directionIdsWithOkrCoverage: emptyOkr,
      attentionItems: [],
      timeProgressPercent: 40,
      deltaPp: -20,
    });
    expect(result.reviewStatus).toBe("at_risk");
  });

  it("returns on_track when active initiative without signals", () => {
    const rows = [initiative({ id: "i1" })];
    const result = deriveDirectionReviewStatus({
      direction: { id: "dir-1", status: "active", priority: 1 },
      summary: baseSummary,
      programs,
      programStatusById,
      initiativeRows: rows,
      annualTargets: [],
      directionIdsWithOkrCoverage: emptyOkr,
      attentionItems: [],
      timeProgressPercent: 30,
      deltaPp: 5,
    });
    expect(result.reviewStatus).toBe("on_track");
  });
});
