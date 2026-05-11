import type { CompositeContract } from "@/lib/ai/answers/answer-contracts";
import type { AiUserContext } from "@/lib/ai/types";

import type { CompositePipelineDiagnostics } from "./composite-diagnostics";
import { summarizeCounts } from "./composite-diagnostics";
import type { ExecutePermissionedToolFn, QueryPipelineResult, QueryPlan } from "./query-types";

type OwnerRankingRow = {
  ownerDisplayName?: string;
  objectiveCount: number;
  objectiveIds?: string[];
};

type ObjectiveRow = {
  id: string;
  title: string;
  status?: string | null;
  ownerMembershipId?: string | null;
  rollupProgressPercent?: number | null;
  rollupStatus?: string | null;
};

type OkrCycleRow = {
  id: string;
  startDate?: string;
};

type InitiativeRow = {
  id: string;
  title: string;
  status?: string | null;
};

function buildBaseContract(plan: QueryPlan): CompositeContract {
  return {
    queryClass: "composite",
    domain: plan.domain ?? "okr",
    targetEntity: plan.targetEntity ?? null,
    scope: {
      cycle: plan.scope.cycle,
      organizationScope: plan.scope.organizationScope,
      objectType: plan.scope.objectType,
    },
    metrics: {},
    coveredItems: [],
    uncoveredItems: [],
    relationPath: [],
    anomalies: [],
    insights: [],
    evidenceIds: [],
    confidence: "medium",
    retrievalStatus: "ok",
    missingCapabilities: [],
    missingTools: [],
    requestedOps: [...plan.analysisOps],
    coveredOps: [],
    missingOps: [],
  };
}

function finalizeCoverage(contract: CompositeContract): void {
  const requested = contract.requestedOps.length > 0 ? contract.requestedOps : [...contract.coveredOps];
  const covered = [...new Set(contract.coveredOps)];
  contract.requestedOps = [...new Set(requested)];
  contract.coveredOps = covered;
  contract.missingOps = contract.requestedOps.filter((op) => !covered.includes(op));
  if (contract.missingOps.length > 0 && contract.retrievalStatus === "ok") {
    contract.retrievalStatus = "partial";
  }
}

export async function runCompositePipeline(args: {
  plan: QueryPlan;
  executePermissionedTool: ExecutePermissionedToolFn;
  userContext: AiUserContext;
}): Promise<QueryPipelineResult> {
  const usedToolCalls: QueryPipelineResult["usedToolCalls"] = [];
  const warnings: string[] = [];
  const contract = buildBaseContract(args.plan);

  const track = (result: Awaited<ReturnType<ExecutePermissionedToolFn>>, inputSummary: string) => {
    usedToolCalls.push({
      toolName: result.toolName,
      inputSummary,
      outputSummary: result.outputSummary,
      success: result.success,
    });
    if (!result.success) {
      if (result.error === "tool_not_registered") contract.missingTools.push(result.toolName);
      if (result.error === "missing_capability") contract.missingCapabilities.push(result.toolName);
      if (contract.retrievalStatus === "ok") contract.retrievalStatus = "partial";
    }
    return result;
  };

  const ops = new Set(args.plan.analysisOps);

  const diagnosticSteps: CompositePipelineDiagnostics[] = [];

  /** Summary bleibt gleich dem letzten Step (Rueckwaertskompatibilitaet). */
  function recordCompositeDiagnosticsStep(step: CompositePipelineDiagnostics): void {
    diagnosticSteps.push(step);
    contract.compositeDiagnostics = step;
  }

  // Case 1: compare current vs previous cycle ranking
  if (ops.has("compare_periods")) {
    const cycle = track(await args.executePermissionedTool("get_current_okr_cycle", {}), "{}");
    const cycleData =
      cycle.success && cycle.data && typeof cycle.data === "object"
        ? (cycle.data as { cycleInstanceId?: string; okrCycles?: OkrCycleRow[] })
        : null;
    const cycleInstanceId = cycleData?.cycleInstanceId ?? null;
    const cycles = [...(cycleData?.okrCycles ?? [])].sort((a, b) =>
      (b.startDate ?? "").localeCompare(a.startDate ?? "")
    );
    const currentCycle = cycles[0]?.id ?? null;
    const prevCycle = cycles[1]?.id ?? null;

    const currentRanking = track(
      await args.executePermissionedTool("get_okr_objective_owner_counts", {
        cycleInstanceId: cycleInstanceId ?? undefined,
        preferredOkrCycleId: currentCycle ?? undefined,
        limitOwners: 3,
      }),
      JSON.stringify({
        cycleInstanceId: cycleInstanceId ?? undefined,
        preferredOkrCycleId: currentCycle ?? undefined,
        limitOwners: 3,
      })
    );
    const prevRanking =
      prevCycle != null
        ? track(
            await args.executePermissionedTool("get_okr_objective_owner_counts", {
              cycleInstanceId: cycleInstanceId ?? undefined,
              preferredOkrCycleId: prevCycle,
              limitOwners: 3,
            }),
            JSON.stringify({
              cycleInstanceId: cycleInstanceId ?? undefined,
              preferredOkrCycleId: prevCycle,
              limitOwners: 3,
            })
          )
        : null;

    const curRows =
      currentRanking.success && currentRanking.data && typeof currentRanking.data === "object"
        ? (((currentRanking.data as { ownerRanking?: OwnerRankingRow[] }).ownerRanking ?? []).filter(
            (r) => (r.objectiveCount ?? 0) > 0
          ) as OwnerRankingRow[])
        : [];
    const prevRows =
      prevRanking?.success && prevRanking.data && typeof prevRanking.data === "object"
        ? (((prevRanking.data as { ownerRanking?: OwnerRankingRow[] }).ownerRanking ?? []).filter(
            (r) => (r.objectiveCount ?? 0) > 0
          ) as OwnerRankingRow[])
        : [];
    const curTop = curRows[0] ?? null;
    const prevTop = prevRows[0] ?? null;
    contract.metrics.compare = {
      currentTopOwner: curTop?.ownerDisplayName ?? null,
      currentTopCount: curTop?.objectiveCount ?? null,
      previousTopOwner: prevTop?.ownerDisplayName ?? null,
      previousTopCount: prevTop?.objectiveCount ?? null,
      delta:
        curTop?.objectiveCount != null && prevTop?.objectiveCount != null
          ? curTop.objectiveCount - prevTop.objectiveCount
          : null,
    };
    if (curTop) contract.evidenceIds.push(...(curTop.objectiveIds ?? []));
    if (prevTop) contract.evidenceIds.push(...(prevTop.objectiveIds ?? []));
    contract.insights.push(
      curTop
        ? `Aktueller Top-Owner: ${curTop.ownerDisplayName ?? "unbekannt"} (${curTop.objectiveCount}).`
        : "Kein Top-Owner fuer den aktuellen Zyklus ermittelbar."
    );
    contract.coveredOps.push("rank", "compare_periods", "count_total");
    if (!prevCycle) warnings.push("previous_cycle_missing");

    const sumRankRows = (rows: OwnerRankingRow[]) =>
      rows.reduce((s, r) => s + (r.objectiveCount ?? 0), 0);
    const joinedTotals = sumRankRows(curRows) + sumRankRows(prevRows);
    const diagCompare: CompositePipelineDiagnostics = {
      pipelineVariant: "compare_periods",
      rawTotal: joinedTotals,
      afterScopeFilter: joinedTotals,
      afterStatusOrTypeFilter: null,
      afterJoinFilter: joinedTotals,
      finalTotal: (curTop ? 1 : 0) + (prevTop ? 1 : 0),
      checkedMembershipIds: [args.userContext.membershipId],
      checkedScopeIds: [cycleInstanceId, currentCycle, prevCycle].filter((x): x is string => Boolean(x)),
      retrievalStatusReason: prevCycle
        ? "ok: Ranking fuer aktuellen und vorherigen OKR-Zyklus."
        : "partial: kein vorheriger Zyklus in okrCycles.",
    };
    recordCompositeDiagnosticsStep(diagCompare);
    usedToolCalls.push({
      toolName: "composite_pipeline_trace_compare_periods",
      inputSummary: summarizeCounts("compare_periods", diagCompare),
      outputSummary: JSON.stringify(diagCompare),
      success: true,
    });
  }

  // Case 2: Top-N + share
  if (ops.has("share") && ops.has("rank")) {
    const counts = track(
      await args.executePermissionedTool("get_okr_objective_owner_counts", {
        cycle: "current",
        limitOwners: 10,
      }),
      JSON.stringify({ cycle: "current", limitOwners: 10 })
    );
    const data =
      counts.success && counts.data && typeof counts.data === "object"
        ? (counts.data as {
            totalObjectives?: number;
            ownerRanking?: OwnerRankingRow[];
          })
        : null;
    const total = data?.totalObjectives ?? null;
    const rows = (data?.ownerRanking ?? []).filter((r) => (r.objectiveCount ?? 0) > 0).slice(0, 3);
    contract.metrics.topShare = rows.map((row) => ({
      owner: row.ownerDisplayName ?? "unbekannt",
      count: row.objectiveCount,
      share: total && total > 0 ? row.objectiveCount / total : null,
    }));
    for (const row of rows) contract.evidenceIds.push(...(row.objectiveIds ?? []));
    if (rows.length > 0) {
      contract.insights.push(`Top-3 inkl. Anteil am Gesamtbestand wurde berechnet (Gesamt: ${total ?? "n/a"}).`);
    }
    contract.coveredOps.push("rank", "share", "count_total");

    const filteredOwners = (data?.ownerRanking ?? []).filter((r) => (r.objectiveCount ?? 0) > 0);
    const diagShare: CompositePipelineDiagnostics = {
      pipelineVariant: "top_n_share",
      rawTotal: total ?? null,
      afterScopeFilter: total ?? null,
      afterStatusOrTypeFilter: null,
      afterJoinFilter: filteredOwners.length,
      finalTotal: rows.length,
      checkedMembershipIds: [args.userContext.membershipId],
      checkedScopeIds: [args.userContext.organizationId],
      retrievalStatusReason:
        total != null ? "ok: Gesamtbestand und Owner-Ranking aus Tool." : "partial: totalObjectives fehlt.",
    };
    recordCompositeDiagnosticsStep(diagShare);
    usedToolCalls.push({
      toolName: "composite_pipeline_trace_top_share",
      inputSummary: summarizeCounts("top_n_share", diagShare),
      outputSummary: JSON.stringify(diagShare),
      success: true,
    });
  }

  // Case 3: Ownerless + KR existence
  if (ops.has("lookup") && ops.has("exists")) {
    const objectives = track(
      await args.executePermissionedTool("get_visible_okr_objectives", {
        limit: 100,
      }),
      JSON.stringify({ limit: 100 })
    );
    const objectiveRows =
      objectives.success && objectives.data && typeof objectives.data === "object"
        ? ((objectives.data as { objectives?: Array<{ id: string; title: string; ownerMembershipId?: string | null }> })
            .objectives ?? [])
        : [];
    const ownerless = objectiveRows.filter((o) => o.ownerMembershipId == null);
    const ids = ownerless.map((o) => o.id).slice(0, 50);
    const kr =
      ids.length > 0
        ? track(
            await args.executePermissionedTool("get_key_results_for_objectives", { okrObjectiveIds: ids }),
            JSON.stringify({ okrObjectiveIds: ids })
          )
        : null;
    const krRows =
      kr?.success && kr.data && typeof kr.data === "object"
        ? ((kr.data as { keyResults?: Array<{ objectiveId?: string }> }).keyResults ?? [])
        : [];
    const withKr = new Set(krRows.map((k) => k.objectiveId).filter(Boolean));
    contract.metrics.ownerlessKrCheck = ownerless.map((o) => ({
      objectiveId: o.id,
      title: o.title,
      hasKeyResults: withKr.has(o.id),
    }));
    contract.evidenceIds.push(...ownerless.map((o) => o.id));
    contract.insights.push(`Ownerless-Objectives geprueft: ${ownerless.length}.`);
    contract.coveredOps.push("lookup", "exists", "join");

    const diagOwnerless: CompositePipelineDiagnostics = {
      pipelineVariant: "ownerless_kr_exists",
      rawTotal: objectiveRows.length,
      afterScopeFilter: ownerless.length,
      afterStatusOrTypeFilter: ownerless.length,
      afterJoinFilter: withKr.size > 0 ? ownerless.filter((o) => withKr.has(o.id)).length : ownerless.length,
      finalTotal: ownerless.length,
      checkedMembershipIds: [args.userContext.membershipId],
      checkedScopeIds: [args.userContext.organizationId],
      retrievalStatusReason: "ok: Ownerlose Objectives und KR-Existenz aus Tools.",
    };
    recordCompositeDiagnosticsStep(diagOwnerless);
    usedToolCalls.push({
      toolName: "composite_pipeline_trace_ownerless_kr",
      inputSummary: summarizeCounts("ownerless_kr_exists", diagOwnerless),
      outputSummary: JSON.stringify(diagOwnerless),
      success: true,
    });
  }

  // Case 4: nested distribution (owner x status)
  if (ops.has("nested_distribution")) {
    const objectives = track(
      await args.executePermissionedTool("get_visible_okr_objectives", {
        limit: 100,
      }),
      JSON.stringify({ limit: 100 })
    );
    const ownerCounts = track(
      await args.executePermissionedTool("get_okr_objective_owner_counts", {
        cycle: "current",
        limitOwners: 50,
      }),
      JSON.stringify({ cycle: "current", limitOwners: 50 })
    );
    const objectiveRows =
      objectives.success && objectives.data && typeof objectives.data === "object"
        ? (((objectives.data as { objectives?: ObjectiveRow[] }).objectives ?? []) as ObjectiveRow[])
        : [];
    const rankingRows =
      ownerCounts.success && ownerCounts.data && typeof ownerCounts.data === "object"
        ? (((ownerCounts.data as { ownerRanking?: OwnerRankingRow[] }).ownerRanking ?? []) as OwnerRankingRow[])
        : [];
    const objectiveToOwnerName = new Map<string, string>();
    for (const row of rankingRows) {
      const label = row.ownerDisplayName ?? "unbekannt";
      for (const objectiveId of row.objectiveIds ?? []) objectiveToOwnerName.set(objectiveId, label);
    }
    const bucketsMap = new Map<string, Map<string, number>>();
    for (const objective of objectiveRows) {
      const owner = objectiveToOwnerName.get(objective.id) ?? "ohne_owner";
      const status = objective.rollupStatus ?? objective.status ?? "unknown";
      const ownerBucket = bucketsMap.get(owner) ?? new Map<string, number>();
      ownerBucket.set(status, (ownerBucket.get(status) ?? 0) + 1);
      bucketsMap.set(owner, ownerBucket);
    }
    const nestedDistribution = Array.from(bucketsMap.entries())
      .map(([owner, statuses]) => ({
        owner,
        total: Array.from(statuses.values()).reduce((sum, n) => sum + n, 0),
        buckets: Array.from(statuses.entries()).map(([status, count]) => ({ key: status, count })),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    contract.metrics.nestedDistribution = nestedDistribution;
    contract.insights.push(
      `Nested-Distribution berechnet: ${nestedDistribution.length} Owner-Buckets.`
    );
    contract.coveredOps.push("nested_distribution", "distribution", "rank");
    for (const objective of objectiveRows.slice(0, 50)) contract.evidenceIds.push(objective.id);

    const diagNested: CompositePipelineDiagnostics = {
      pipelineVariant: "nested_distribution_owner_status",
      rawTotal: objectiveRows.length,
      afterScopeFilter: objectiveRows.length,
      afterStatusOrTypeFilter: objectiveRows.length,
      afterJoinFilter: objectiveRows.length,
      finalTotal: nestedDistribution.length,
      checkedMembershipIds: [args.userContext.membershipId],
      checkedScopeIds: [args.userContext.organizationId],
      retrievalStatusReason: "ok: Objectives mit Owner-Zuordnung aus Ranking und Status-Mix.",
    };
    recordCompositeDiagnosticsStep(diagNested);
    usedToolCalls.push({
      toolName: "composite_pipeline_trace_nested_distribution",
      inputSummary: summarizeCounts("nested_distribution", diagNested),
      outputSummary: JSON.stringify(diagNested),
      success: true,
    });
  }

  // Case 5: coverage (initiative -> objective -> key_results)
  if (ops.has("coverage")) {
    contract.relationPath = ["initiative", "objective", "key_result"];
    const initiatives = track(
      await args.executePermissionedTool("get_visible_initiatives", {
        limit: 50,
      }),
      JSON.stringify({ limit: 50 })
    );
    const objectives = track(
      await args.executePermissionedTool("get_visible_okr_objectives", {
        limit: 100,
      }),
      JSON.stringify({ limit: 100 })
    );
    const initiativeRows =
      initiatives.success && initiatives.data && typeof initiatives.data === "object"
        ? (((initiatives.data as { initiatives?: InitiativeRow[] }).initiatives ?? []) as InitiativeRow[])
        : [];
    const objectiveRows =
      objectives.success && objectives.data && typeof objectives.data === "object"
        ? (((objectives.data as { objectives?: ObjectiveRow[] }).objectives ?? []) as ObjectiveRow[])
        : [];
    const activeObjectiveIds = objectiveRows
      .filter((o) => (o.status ?? "").toLowerCase() === "active")
      .map((o) => o.id);
    const krResult =
      activeObjectiveIds.length > 0
        ? track(
            await args.executePermissionedTool("get_key_results_for_objectives", {
              okrObjectiveIds: activeObjectiveIds.slice(0, 50),
            }),
            JSON.stringify({ okrObjectiveIds: activeObjectiveIds.slice(0, 50) })
          )
        : null;
    const krObjectiveIds =
      krResult?.success && krResult.data && typeof krResult.data === "object"
        ? new Set(
            (((krResult.data as { keyResults?: Array<{ objectiveId?: string }> }).keyResults ?? []).map(
              (k) => k.objectiveId
            ).filter(Boolean) as string[])
          )
        : new Set<string>();
    // Eindeutige Initiative->Objective Relation ist derzeit im Tooling nicht vorhanden.
    for (const initiative of initiativeRows) {
      contract.uncoveredItems.push({
        id: initiative.id,
        label: initiative.title,
        reason: "missing_relation:initiative_objective",
        evidenceIds: [initiative.id],
      });
      contract.evidenceIds.push(initiative.id);
    }
    if (activeObjectiveIds.length > 0 && krObjectiveIds.size > 0) {
      contract.insights.push(
        `Aktive Objectives mit KR wurden gefunden (${krObjectiveIds.size}), aber ohne eindeutige Initiative-Objective Relation.`
      );
      contract.coveredItems.push({
        id: "objective_kr_coverage_baseline",
        label: `Aktive Objectives mit KR: ${krObjectiveIds.size}`,
        evidenceIds: Array.from(krObjectiveIds).slice(0, 20),
      });
    }
    contract.coveredOps.push("exists");

    const diagCoverage: CompositePipelineDiagnostics = {
      pipelineVariant: "initiative_objective_kr_coverage",
      rawTotal: initiativeRows.length + objectiveRows.length,
      afterScopeFilter: objectiveRows.length,
      afterStatusOrTypeFilter: activeObjectiveIds.length,
      afterJoinFilter: krObjectiveIds.size,
      finalTotal: contract.coveredItems.length,
      checkedMembershipIds: [args.userContext.membershipId],
      checkedScopeIds: [args.userContext.organizationId],
      retrievalStatusReason:
        "partial: Initiative–Objective-Kante nicht eindeutig; KR-Baseline nur fuer aktive Objectives.",
    };
    recordCompositeDiagnosticsStep(diagCoverage);
    usedToolCalls.push({
      toolName: "composite_pipeline_trace_coverage",
      inputSummary: summarizeCounts("coverage", diagCoverage),
      outputSummary: JSON.stringify(diagCoverage),
      success: true,
    });
  }

  // Case 6: anomaly check
  if (ops.has("anomaly_check")) {
    const objectives = track(
      await args.executePermissionedTool("get_visible_okr_objectives", {
        limit: 100,
      }),
      JSON.stringify({ limit: 100 })
    );
    const ownerCounts = track(
      await args.executePermissionedTool("get_okr_objective_owner_counts", {
        cycle: "current",
        limitOwners: 50,
      }),
      JSON.stringify({ cycle: "current", limitOwners: 50 })
    );
    const objectiveRows =
      objectives.success && objectives.data && typeof objectives.data === "object"
        ? (((objectives.data as { objectives?: ObjectiveRow[] }).objectives ?? []) as ObjectiveRow[])
        : [];
    const rankingRows =
      ownerCounts.success && ownerCounts.data && typeof ownerCounts.data === "object"
        ? (((ownerCounts.data as { ownerRanking?: OwnerRankingRow[] }).ownerRanking ?? []) as OwnerRankingRow[])
        : [];
    const objectiveToOwnerName = new Map<string, string>();
    for (const row of rankingRows) {
      const label = row.ownerDisplayName ?? "unbekannt";
      for (const objectiveId of row.objectiveIds ?? []) objectiveToOwnerName.set(objectiveId, label);
    }
    const anomalies = objectiveRows
      .flatMap((objective) => {
        const progress = objective.rollupProgressPercent ?? null;
        const status = (objective.rollupStatus ?? objective.status ?? "").toLowerCase();
        if (progress == null || !status) return [];
        if (progress >= 70 && (status === "off_track" || status === "at_risk")) {
          return [
            {
              id: objective.id,
              label: `${objective.title} (Owner: ${objectiveToOwnerName.get(objective.id) ?? "unbekannt"})`,
              ruleId: "high_progress_critical_status",
              violatedCondition: `progress>=70 && status=${status}`,
              evidenceIds: [objective.id],
            },
          ];
        }
        if (progress <= 30 && status === "on_track") {
          return [
            {
              id: objective.id,
              label: `${objective.title} (Owner: ${objectiveToOwnerName.get(objective.id) ?? "unbekannt"})`,
              ruleId: "low_progress_on_track",
              violatedCondition: "progress<=30 && status=on_track",
              evidenceIds: [objective.id],
            },
          ];
        }
        return [];
      })
      .slice(0, 20);
    contract.anomalies = anomalies;
    if (anomalies.length > 0) {
      contract.insights.push(`Anomalien erkannt: ${anomalies.length}.`);
      for (const anomaly of anomalies) contract.evidenceIds.push(...anomaly.evidenceIds);
    } else {
      contract.insights.push("Keine Regelverletzungen fuer anomaly_check gefunden.");
    }
    contract.coveredOps.push("anomaly_check", "lookup");

    const diagAnomaly: CompositePipelineDiagnostics = {
      pipelineVariant: "anomaly_check",
      rawTotal: objectiveRows.length,
      afterScopeFilter: objectiveRows.length,
      afterStatusOrTypeFilter: objectiveRows.filter((o) => (o.rollupProgressPercent ?? null) != null).length,
      afterJoinFilter: anomalies.length,
      finalTotal: anomalies.length,
      checkedMembershipIds: [args.userContext.membershipId],
      checkedScopeIds: [args.userContext.organizationId],
      retrievalStatusReason:
        anomalies.length > 0 ? `ok: ${anomalies.length} Anomalien nach Regeln.` : "ok: keine Regelverletzungen.",
    };
    recordCompositeDiagnosticsStep(diagAnomaly);
    usedToolCalls.push({
      toolName: "composite_pipeline_trace_anomaly",
      inputSummary: summarizeCounts("anomaly_check", diagAnomaly),
      outputSummary: JSON.stringify(diagAnomaly),
      success: true,
    });
  }

  // Case 7: strategy join (degradation when relation is not unambiguous)
  if (ops.has("strategy_join")) {
    contract.relationPath = ["strategy", "objective", "owner"];
    warnings.push("strategy_relation_not_available");
    contract.insights.push(
      "Strategy->Objective->Owner Relation ist im aktuellen Tooling nicht eindeutig aufloesbar."
    );

    const diagStrategy: CompositePipelineDiagnostics = {
      pipelineVariant: "strategy_join_degraded",
      rawTotal: null,
      afterScopeFilter: null,
      afterStatusOrTypeFilter: null,
      afterJoinFilter: null,
      finalTotal: null,
      checkedMembershipIds: [args.userContext.membershipId],
      checkedScopeIds: [args.userContext.organizationId],
      retrievalStatusReason:
        "partial: strategy_join nicht aufloesbar — Legacy/Fallback nur wenn Orchestrator nicht anders routet.",
    };
    recordCompositeDiagnosticsStep(diagStrategy);
    usedToolCalls.push({
      toolName: "composite_pipeline_trace_strategy_join",
      inputSummary: summarizeCounts("strategy_join", diagStrategy),
      outputSummary: JSON.stringify(diagStrategy),
      success: true,
    });
  }

  if (diagnosticSteps.length === 0) {
    recordCompositeDiagnosticsStep({
      pipelineVariant: ops.size ? Array.from(ops).join(",") : "none",
      rawTotal: null,
      afterScopeFilter: null,
      afterStatusOrTypeFilter: null,
      afterJoinFilter: null,
      finalTotal: null,
      checkedMembershipIds: [args.userContext.membershipId],
      checkedScopeIds: [args.userContext.organizationId],
      retrievalStatusReason:
        ops.size === 0 ? "no_analysis_ops_in_plan" : "no_composite_branch_executed",
    });
  }

  contract.compositeDiagnosticsSteps = diagnosticSteps;
  contract.compositeDiagnostics = diagnosticSteps[diagnosticSteps.length - 1];

  usedToolCalls.push({
    toolName: "composite_pipeline_trace_all_steps",
    inputSummary: JSON.stringify({ stepCount: diagnosticSteps.length }),
    outputSummary: JSON.stringify(diagnosticSteps),
    success: true,
  });

  finalizeCoverage(contract);
  if (contract.missingCapabilities.length > 0 || contract.missingTools.length > 0) {
    contract.retrievalStatus = "failed";
  }
  contract.confidence =
    contract.retrievalStatus === "failed"
      ? "low"
      : contract.missingOps.length > 0
        ? "medium"
        : "high";

  return {
    contract,
    evidence: contract.evidenceIds.map((id) => ({ id, objectType: "okr_objective" })),
    warnings,
    usedToolCalls,
    contractSource: "pipeline",
  };
}
