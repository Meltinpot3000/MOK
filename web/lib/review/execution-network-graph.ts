/**
 * Umsetzungsnetzwerk-Graph für den Reviewzyklus.
 * Stoßrichtung → Programm → Change-Jahresziel / Initiative
 * Stoßrichtung → Run-Jahresziel (direkt)
 */
import type { ReviewAttentionItem } from "./review-attention-rules";
import {
  primaryCoverageTypeLabelDe,
  type EnrichedStrategicDirectionReviewSummary,
} from "./review-direction-status";
import type { ReviewStatus } from "./key-result-progress";
import { deriveInitiativeHealth } from "./initiative-health";
import type { ReviewCycleInitiativeInput, ReviewCycleProgramRow } from "./review-cycle-view-model";

export type InitiativeTargetLinkRow = {
  initiative_id: string;
  annual_target_id: string;
};

export type ExecutionNetworkNodeKind =
  | "direction"
  | "program"
  | "annual_target"
  | "initiative"
  | "signal"
  | "feedback";

export type ExecutionNetworkEdgeStyle = "solid" | "dashed";

export type ExecutionNetworkNode = {
  id: string;
  kind: ExecutionNetworkNodeKind;
  title: string;
  subtitle?: string;
  health: ReviewStatus | "no_coverage" | "unclear" | "neutral";
  weight?: number;
  badge?: string;
  directionId?: string;
  initiativeId?: string;
  programId?: string;
  annualTargetId?: string;
  signalIssueType?: string;
  feedbackType?: string;
};

export type ExecutionNetworkEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  style: ExecutionNetworkEdgeStyle;
  weight?: number;
  health: ReviewStatus | "no_coverage" | "unclear" | "neutral";
};

export type ExecutionNetworkGraph = {
  nodes: ExecutionNetworkNode[];
  edges: ExecutionNetworkEdge[];
};

export type ReviewFeedbackRow = {
  id: string;
  feedback_type: string;
  object_type: string;
  object_id: string;
  comment: string | null;
};

export type BuildExecutionNetworkGraphInput = {
  enrichedSummaries: EnrichedStrategicDirectionReviewSummary[];
  programs: Array<ReviewCycleProgramRow & { title: string; status?: string }>;
  annualTargets: Array<{
    id: string;
    strategic_direction_id: string;
    strategy_program_id: string | null;
    title: string;
    progress_percent: number;
    status?: string;
  }>;
  initiativeRows: ReviewCycleInitiativeInput[];
  initiativeTargetLinks: InitiativeTargetLinkRow[];
  attentionItems: ReviewAttentionItem[];
  reviewFeedback: ReviewFeedbackRow[];
};

function healthFromDirectionStatus(
  status: EnrichedStrategicDirectionReviewSummary["reviewStatus"]
): ExecutionNetworkNode["health"] {
  if (status === "no_coverage") return "no_coverage";
  if (status === "unclear") return "unclear";
  return status;
}

function healthFromInitiative(row: ReviewCycleInitiativeInput): ReviewStatus {
  return deriveInitiativeHealth(row);
}

export function buildExecutionNetworkGraph(
  input: BuildExecutionNetworkGraphInput
): ExecutionNetworkGraph {
  const nodes: ExecutionNetworkNode[] = [];
  const edges: ExecutionNetworkEdge[] = [];
  const nodeIds = new Set<string>();

  const addNode = (node: ExecutionNetworkNode) => {
    if (nodeIds.has(node.id)) return;
    nodeIds.add(node.id);
    nodes.push(node);
  };

  const addEdge = (edge: ExecutionNetworkEdge) => {
    edges.push(edge);
  };

  const programsByDirection = new Map<string, typeof input.programs>();
  for (const p of input.programs) {
    if (!p.strategic_direction_id) continue;
    const list = programsByDirection.get(p.strategic_direction_id) ?? [];
    list.push(p);
    programsByDirection.set(p.strategic_direction_id, list);
  }

  const changeTargetsByProgram = new Map<string, typeof input.annualTargets>();
  const runTargetsByDirection = new Map<string, typeof input.annualTargets>();
  for (const t of input.annualTargets) {
    if (t.strategy_program_id) {
      const list = changeTargetsByProgram.get(t.strategy_program_id) ?? [];
      list.push(t);
      changeTargetsByProgram.set(t.strategy_program_id, list);
    } else {
      const list = runTargetsByDirection.get(t.strategic_direction_id) ?? [];
      list.push(t);
      runTargetsByDirection.set(t.strategic_direction_id, list);
    }
  }

  for (const summary of input.enrichedSummaries) {
    if (summary.status !== "active" && summary.status !== "on_hold") continue;

    const dirId = `dir:${summary.directionId}`;
    addNode({
      id: dirId,
      kind: "direction",
      title: summary.title,
      health: healthFromDirectionStatus(summary.reviewStatus),
      directionId: summary.directionId,
      badge:
        summary.statusHintDe ??
        (summary.coverage ? primaryCoverageTypeLabelDe(summary.coverage) : undefined),
    });

    const directionPrograms = programsByDirection.get(summary.directionId) ?? [];
    const midColumnIds: string[] = [];

    for (const runTarget of runTargetsByDirection.get(summary.directionId) ?? []) {
      const targetId = `at:${runTarget.id}`;
      midColumnIds.push(targetId);
      addNode({
        id: targetId,
        kind: "annual_target",
        title: runTarget.title,
        subtitle: "Run-Jahresziel",
        health: "neutral",
        directionId: summary.directionId,
        annualTargetId: runTarget.id,
        badge: `${Math.round(runTarget.progress_percent)}%`,
      });
      addEdge({
        id: `e:${dirId}-${targetId}`,
        sourceId: dirId,
        targetId,
        style: "solid",
        health: "neutral",
      });
    }

    for (const program of directionPrograms) {
      const progId = `prog:${program.id}`;
      midColumnIds.push(progId);
      addNode({
        id: progId,
        kind: "program",
        title: program.title,
        subtitle: "Programm",
        health: program.status === "active" ? "on_track" : "neutral",
        directionId: summary.directionId,
        programId: program.id,
        badge: "PIP",
      });
      addEdge({
        id: `e:${dirId}-${progId}`,
        sourceId: dirId,
        targetId: progId,
        style: "solid",
        health: "on_track",
      });

      const programChangeTargets = changeTargetsByProgram.get(program.id) ?? [];
      for (const target of programChangeTargets) {
        const targetId = `at:${target.id}`;
        midColumnIds.push(targetId);
        addNode({
          id: targetId,
          kind: "annual_target",
          title: target.title,
          subtitle: "Change-Jahresziel",
          health: "neutral",
          directionId: summary.directionId,
          annualTargetId: target.id,
          programId: program.id,
          badge: `${Math.round(target.progress_percent)}%`,
        });
        addEdge({
          id: `e:${progId}-${targetId}`,
          sourceId: progId,
          targetId,
          style: "solid",
          health: "neutral",
        });
      }
    }

    const directionInitiatives = input.initiativeRows.filter(
      (i) =>
        i.directionId === summary.directionId &&
        (i.resolvedDirectionSource === "program" || i.resolvedDirectionSource === "legacy_annual_target")
    );

    for (const initiative of directionInitiatives) {
      const initId = `init:${initiative.id}`;
      const h = healthFromInitiative(initiative);
      addNode({
        id: initId,
        kind: "initiative",
        title: initiative.title,
        health: h,
        weight: initiative.weight,
        directionId: summary.directionId,
        initiativeId: initiative.id,
        programId: initiative.program_id ?? undefined,
        badge: `${initiative.progress_percent}%`,
      });

      let linkedMid = false;
      if (initiative.program_id && initiative.resolvedDirectionSource === "program") {
        const progId = `prog:${initiative.program_id}`;
        if (nodeIds.has(progId)) {
          addEdge({
            id: `e:${progId}-${initId}`,
            sourceId: progId,
            targetId: initId,
            style: "solid",
            weight: initiative.weight,
            health: h,
          });
          linkedMid = true;
        }
      }

      if (!linkedMid && initiative.resolvedDirectionSource === "legacy_annual_target") {
        const linkedTargetIds = input.initiativeTargetLinks
          .filter((l) => l.initiative_id === initiative.id)
          .map((l) => l.annual_target_id);
        for (const tid of linkedTargetIds) {
          const atId = `at:${tid}`;
          if (nodeIds.has(atId)) {
            addEdge({
              id: `e:${atId}-${initId}`,
              sourceId: atId,
              targetId: initId,
              style: "dashed",
              weight: initiative.weight,
              health: h,
            });
            linkedMid = true;
            break;
          }
        }
      }

      if (!linkedMid && midColumnIds.length > 0) {
        addEdge({
          id: `e:${midColumnIds[0]}-${initId}`,
          sourceId: midColumnIds[0]!,
          targetId: initId,
          style: "dashed",
          weight: initiative.weight,
          health: h,
        });
      } else if (!linkedMid) {
        addEdge({
          id: `e:${dirId}-${initId}`,
          sourceId: dirId,
          targetId: initId,
          style: "dashed",
          weight: initiative.weight,
          health: h,
        });
      }
    }

    const directionSignals = input.attentionItems.filter(
      (a) => a.directionId === summary.directionId || a.initiativeId !== null
    );
    const relevantSignals = directionSignals.filter((a) => {
      if (a.directionId === summary.directionId) return true;
      if (!a.initiativeId) return false;
      const row = input.initiativeRows.find((i) => i.id === a.initiativeId);
      return row?.directionId === summary.directionId;
    });

    for (const signal of relevantSignals) {
      const sigId = `sig:${signal.id}`;
      const severityHealth: ReviewStatus =
        signal.severity === "high" ? "off_track" : signal.severity === "medium" ? "at_risk" : "on_track";
      addNode({
        id: sigId,
        kind: "signal",
        title: signal.title,
        subtitle: signal.issueType,
        health: severityHealth,
        directionId: summary.directionId,
        initiativeId: signal.initiativeId ?? undefined,
        signalIssueType: signal.issueType,
      });

      if (signal.initiativeId) {
        const initId = `init:${signal.initiativeId}`;
        if (nodeIds.has(initId)) {
          addEdge({
            id: `e:${initId}-${sigId}`,
            sourceId: initId,
            targetId: sigId,
            style: "solid",
            health: severityHealth,
          });
        } else {
          addEdge({
            id: `e:${dirId}-${sigId}`,
            sourceId: dirId,
            targetId: sigId,
            style: "dashed",
            health: severityHealth,
          });
        }
      } else {
        addEdge({
          id: `e:${dirId}-${sigId}`,
          sourceId: dirId,
          targetId: sigId,
          style: "solid",
          health: severityHealth,
        });
      }
    }

    const directionFeedback = input.reviewFeedback.filter(
      (f) =>
        (f.object_type === "strategic_direction" && f.object_id === summary.directionId) ||
        (f.object_type === "initiative" &&
          input.initiativeRows.find((i) => i.id === f.object_id)?.directionId === summary.directionId)
    );

    for (const fb of directionFeedback) {
      const fbId = `fb:${fb.id}`;
      addNode({
        id: fbId,
        kind: "feedback",
        title: fb.feedback_type.replace(/_/g, " "),
        subtitle: "Strategie-Impuls",
        health: "at_risk",
        directionId: summary.directionId,
        feedbackType: fb.feedback_type,
      });
      addEdge({
        id: `e:${dirId}-${fbId}`,
        sourceId: dirId,
        targetId: fbId,
        style: "dashed",
        health: "at_risk",
      });
    }
  }

  return { nodes, edges };
}
