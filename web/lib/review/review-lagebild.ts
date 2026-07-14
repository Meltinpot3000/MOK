/**
 * Lagebild-Aggregation für den Reviewzyklus (Reiter „Lagebild“).
 */
import { computeContentVsTimeDeltaPp, computeReviewCycleContentProgress } from "@/lib/ceo/cycle-content-progress";
import { deriveInitiativeHealth } from "./initiative-health";
import type { ReviewAttentionItem } from "./review-attention-rules";
import type { EnrichedStrategicDirectionReviewSummary } from "./review-direction-status";
import type { ReviewCycleInitiativeInput, ReviewCycleKpis } from "./review-cycle-view-model";

export type ReviewLagebildSnapshot = {
  weightedContentProgress: number | null;
  timeProgressPercent: number;
  deltaPp: number | null;
  directionsOnTrackCount: number;
  directionsAtRiskCount: number;
  directionsOffTrackCount: number;
  directionsUnsupportedCount: number;
  directionsUnclearCount: number;
  /** Alias-Semantik: keine operative Abdeckung (nicht „ohne Initiative“). */
  directionsWithoutExecutionCount: number;
  /** Attention-Signale auf Stoßrichtungs-Ebene (ohne Initiative), z. B. Coverage. */
  directionSignalCount: number;
  /** Attention-Signale mit Initiative-Bezug. */
  initiativeSignalCount: number;
  /** @deprecated Summe; bevorzugt directionSignalCount + initiativeSignalCount. */
  openSignalCount: number;
  overdueReviewCount: number;
  /** Anzahl review_feedback-Einträge im Zyklus (kein open/closed-Workflow). */
  strategyImpulseCount: number;
  topDirectionsByAttention: Array<{
    directionId: string;
    title: string;
    reviewStatus: string;
    signalCount: number;
    maxSeverity: number;
  }>;
  topCriticalInitiatives: Array<{
    initiativeId: string;
    title: string;
    score: number;
    health: string;
    weight: number;
    endDate: string | null;
  }>;
  kpis: ReviewCycleKpis;
};

const SEVERITY_SCORE: Record<string, number> = { high: 3, medium: 2, low: 1 };

function criticalInitiativeScore(row: ReviewCycleInitiativeInput): number {
  const health = deriveInitiativeHealth(row);
  const healthScore = health === "off_track" ? 100 : health === "at_risk" ? 60 : 10;
  let dueScore = 0;
  if (row.end_date) {
    const days = Math.ceil(
      (new Date(row.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (days < 0) dueScore = 50;
    else if (days < 14) dueScore = 30;
  }
  return row.weight * 10 + healthScore + dueScore;
}

export function buildReviewLagebildSnapshot(input: {
  enrichedSummaries: EnrichedStrategicDirectionReviewSummary[];
  initiativeRows: ReviewCycleInitiativeInput[];
  attentionItems: ReviewAttentionItem[];
  kpis: ReviewCycleKpis;
  timeProgressPercent: number;
  reviewFeedbackCount: number;
}): ReviewLagebildSnapshot {
  const { enrichedSummaries, initiativeRows, attentionItems, kpis, timeProgressPercent } = input;

  const content = computeReviewCycleContentProgress(
    initiativeRows.map((r) => ({
      progress_percent: r.progress_percent,
      weight: r.weight,
      status: r.status,
    }))
  );
  const deltaPp = computeContentVsTimeDeltaPp(
    content.contentProgressPercent,
    timeProgressPercent
  );

  const activeDirections = enrichedSummaries.filter((d) => d.status === "active");

  const directionsOnTrackCount = activeDirections.filter((d) => d.reviewStatus === "on_track").length;
  const directionsAtRiskCount = activeDirections.filter((d) => d.reviewStatus === "at_risk").length;
  const directionsOffTrackCount = activeDirections.filter((d) => d.reviewStatus === "off_track").length;
  const directionsUnsupportedCount = activeDirections.filter(
    (d) => d.reviewStatus === "no_coverage"
  ).length;
  const directionsUnclearCount = activeDirections.filter((d) => d.reviewStatus === "unclear").length;
  const directionsWithoutExecutionCount = activeDirections.filter(
    (d) => !d.coverage.hasAnyCoverage
  ).length;

  const overdueReviewCount = attentionItems.filter(
    (a) => a.issueType === "stale_review" || a.issueType === "never_reviewed"
  ).length;

  const directionSignalCount = attentionItems.filter((a) => a.initiativeId === null).length;
  const initiativeSignalCount = attentionItems.filter((a) => a.initiativeId !== null).length;

  const attentionByDirection = new Map<string, ReviewAttentionItem[]>();
  for (const item of attentionItems) {
    if (!item.directionId) continue;
    const list = attentionByDirection.get(item.directionId) ?? [];
    list.push(item);
    attentionByDirection.set(item.directionId, list);
  }

  const topDirectionsByAttention = [...enrichedSummaries]
    .map((d) => {
      const signals = attentionByDirection.get(d.directionId) ?? [];
      const maxSeverity = signals.reduce(
        (max, s) => Math.max(max, SEVERITY_SCORE[s.severity] ?? 0),
        0
      );
      return {
        directionId: d.directionId,
        title: d.title,
        reviewStatus: d.reviewStatus,
        signalCount: signals.length,
        maxSeverity,
      };
    })
    .filter((d) => d.signalCount > 0)
    .sort((a, b) => b.maxSeverity - a.maxSeverity || b.signalCount - a.signalCount)
    .slice(0, 5);

  const topCriticalInitiatives = initiativeRows
    .filter((i) => {
      const h = deriveInitiativeHealth(i);
      return h === "off_track" || h === "at_risk";
    })
    .map((i) => ({
      initiativeId: i.id,
      title: i.title,
      score: criticalInitiativeScore(i),
      health: deriveInitiativeHealth(i),
      weight: i.weight,
      endDate: i.end_date ?? null,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    weightedContentProgress: content.contentProgressPercent,
    timeProgressPercent,
    deltaPp,
    directionsOnTrackCount,
    directionsAtRiskCount,
    directionsOffTrackCount,
    directionsUnsupportedCount,
    directionsUnclearCount,
    directionsWithoutExecutionCount,
    directionSignalCount,
    initiativeSignalCount,
    openSignalCount: attentionItems.length,
    overdueReviewCount,
    strategyImpulseCount: input.reviewFeedbackCount,
    topDirectionsByAttention,
    topCriticalInitiatives,
    kpis,
  };
}
