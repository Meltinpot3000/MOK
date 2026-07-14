import type { CorrelationConflictDetail, CorrelationStatus } from "@/lib/strategy-cycle/correlation";
import type { DesignReadinessSnapshotResult } from "@/lib/strategy-cycle/design-readiness-snapshot";
import {
  buildDirectionMetrics,
  type StrategicDesignInsightsResult,
} from "@/lib/strategy-cycle/strategic-design-insights";
import { descriptionQualityListHref } from "@/lib/strategy-cycle/description-quality-view";
import {
  evaluateDescriptionQuality,
  type DescriptionSeverity,
} from "@/lib/strategy-cycle/strategy-object-description-quality";

export type ReviewCategory =
  | "insufficient_description"
  | "missing_connections"
  | "questionable_connections"
  | "professional_overrides";

export type ReviewSeverity = "low" | "medium" | "high";

export type ReviewCheckpointItem = {
  id: string;
  category: ReviewCategory;
  objectTypeDe: string;
  subtypeLabelDe?: string;
  relationLabelDe?: string;
  titleDe: string;
  hintDe: string;
  actionLabelDe: string;
  actionHref: string;
  score?: number;
  severity: ReviewSeverity;
};

export type ReviewCategorySummary = {
  count: number;
  maxSeverity: ReviewSeverity | null;
};

export type DesignQualityConnectionReviewResult = {
  insufficientDescription: ReviewCheckpointItem[];
  missingConnections: ReviewCheckpointItem[];
  questionableConnections: ReviewCheckpointItem[];
  professionalOverrides: ReviewCheckpointItem[];
  summary: {
    insufficientDescription: number;
    missingConnections: number;
    questionableConnections: number;
    professionalOverrides: number;
    total: number;
  };
  categoryMeta: Record<
    ReviewCategory,
    {
      titleDe: string;
      explanationDe: string;
      primaryActionLabelDe: string;
      primaryActionHref: string;
      emptyTextDe: string;
    }
  >;
  snapshotDelta?: number;
};

export const DESIGN_QUALITY_REVIEW_TOP_N = 5;

const HREF_CHALLENGES_DESC_REVIEW = descriptionQualityListHref({
  l1: "strategic-directions",
  l2: "challenges",
  qualityFilter: "needs_work",
});
const HREF_CHALLENGES = "/strategy-cycle?l1=strategic-directions&l2=challenges";
const HREF_DESIGN = "/strategy-cycle?l1=strategic-directions&l2=design";
const HREF_OBJECTIVES = "/strategy-cycle?l1=objectives";
const HREF_MATRIX = "/strategy-cycle?l1=strategic-directions&l2=strategy-matrix";
const HREF_PASSUNG = "/strategy-cycle?l1=strategic-directions&l2=summary";

function impactPathHref(focusObjectId?: string): string {
  if (!focusObjectId) return HREF_PASSUNG;
  return `${HREF_PASSUNG}&focus=${encodeURIComponent(focusObjectId)}`;
}

const CATEGORY_META: DesignQualityConnectionReviewResult["categoryMeta"] = {
  insufficient_description: {
    titleDe: "Mangelnde Beschreibung",
    explanationDe:
      "Objekte zuerst analysefähig beschreiben, bevor Passungs- und Verbindungsprüfungen belastbar sind.",
    primaryActionLabelDe: "Objektbeschreibung schärfen",
    primaryActionHref: HREF_CHALLENGES,
    emptyTextDe: "Keine Objekte mit unzureichender Beschreibung.",
  },
  missing_connections: {
    titleDe: "Fehlende Verbindungen",
    explanationDe: "Vermutlich fehlende Verknüpfungen zwischen Analyse, Herausforderungen, Stoßrichtungen und Zielen.",
    primaryActionLabelDe: "In Verknüpfungsmatrix prüfen",
    primaryActionHref: HREF_MATRIX,
    emptyTextDe: "Keine offensichtlich fehlenden Verbindungen.",
  },
  questionable_connections: {
    titleDe: "Fragwürdige Verbindungen",
    explanationDe: "Bestehende Verknüpfungen mit schwacher Modellpassung oder dünner Evidenz.",
    primaryActionLabelDe: "In Strategische Wirkpfade prüfen",
    primaryActionHref: HREF_PASSUNG,
    emptyTextDe: "Keine fragwürdigen Verbindungen nach aktuellen Schwellen.",
  },
  professional_overrides: {
    titleDe: "Fachliche Overrides",
    explanationDe: "Abweichungen zwischen automatischer Bewertung und manueller fachlicher Korrektur.",
    primaryActionLabelDe: "Override in Strategische Wirkpfade prüfen",
    primaryActionHref: HREF_PASSUNG,
    emptyTextDe: "Keine manuellen Overrides vorhanden.",
  },
};

function correlationStatusLabelDe(status: CorrelationStatus): string {
  if (status === "green") return "Grün";
  if (status === "yellow") return "Gelb";
  if (status === "red") return "Rot";
  return "Unklar";
}

function descriptionSeverityToReview(severity: DescriptionSeverity): ReviewSeverity {
  return severity;
}

function severityRank(severity: ReviewSeverity): number {
  if (severity === "high") return 0;
  if (severity === "medium") return 1;
  return 2;
}

export function sortReviewCheckpoints(items: ReviewCheckpointItem[]): ReviewCheckpointItem[] {
  return [...items].sort(
    (a, b) =>
      severityRank(a.severity) - severityRank(b.severity) ||
      a.titleDe.localeCompare(b.titleDe, "de")
  );
}

function maxSeverity(items: ReviewCheckpointItem[]): ReviewSeverity | null {
  if (items.length === 0) return null;
  return items.reduce<ReviewSeverity>(
    (max, item) => (severityRank(item.severity) < severityRank(max) ? item.severity : max),
    "low"
  );
}

export type DesignQualityWorkspaceInput = {
  challenges: Array<{
    id: string;
    title: string;
    description?: string | null;
    source_analysis_entry_id?: string | null;
  }>;
  directions: Array<{ id: string; title: string; description?: string | null; priority?: number | string | null }>;
  objectives: Array<{
    id: string;
    title: string;
    description?: string | null;
    importance_score?: number | string | null;
    ai_clarity_score?: number | string | null;
  }>;
  analysisItems: Array<{ id: string; title?: string; description?: string | null }>;
  challengeAnalysisLinks: Array<{ strategic_challenge_id: string; analysis_entry_id: string }>;
  challengeDirectionLinks: Array<{
    strategic_challenge_id: string;
    strategic_direction_id: string;
    contribution_level?: string | null;
  }>;
  directionObjectiveLinks: Array<{
    strategic_direction_id: string;
    objective_id: string;
    contribution_level?: string | null;
  }>;
};

export type BuildDesignQualityConnectionReviewInput = {
  workspace: DesignQualityWorkspaceInput;
  insights: StrategicDesignInsightsResult;
  readinessSnapshot: DesignReadinessSnapshotResult;
  conflictCells: CorrelationConflictDetail[];
  openReviewHintsCount?: number;
};

function hrefForDescriptionQualityObject(
  kind: "challenge" | "direction" | "objective" | "analysis_entry",
  objectId: string,
  severity: DescriptionSeverity
): string {
  if (kind === "analysis_entry") {
    return "/strategy-cycle?l1=corporate-strategy&l2=summary";
  }
  return descriptionQualityListHref({
    l1: kind === "objective" ? "objectives" : "strategic-directions",
    l2: kind === "challenge" ? "challenges" : kind === "direction" ? "design" : undefined,
    objectId,
    qualityFilter: severity === "high" ? "rework" : "needs_work",
  });
}

function buildInsufficientDescriptionItems(
  workspace: DesignQualityWorkspaceInput
): ReviewCheckpointItem[] {
  const analysisLinksByChallenge = new Map<string, Set<string>>();
  for (const link of workspace.challengeAnalysisLinks) {
    const set = analysisLinksByChallenge.get(link.strategic_challenge_id) ?? new Set();
    set.add(link.analysis_entry_id);
    analysisLinksByChallenge.set(link.strategic_challenge_id, set);
  }

  const challengeIdsByDirection = new Map<string, Set<string>>();
  const objectiveIdsByDirection = new Map<string, Set<string>>();
  for (const link of workspace.challengeDirectionLinks) {
    const set = challengeIdsByDirection.get(link.strategic_direction_id) ?? new Set();
    set.add(link.strategic_challenge_id);
    challengeIdsByDirection.set(link.strategic_direction_id, set);
  }
  for (const link of workspace.directionObjectiveLinks) {
    const set = objectiveIdsByDirection.get(link.strategic_direction_id) ?? new Set();
    set.add(link.objective_id);
    objectiveIdsByDirection.set(link.strategic_direction_id, set);
  }

  const items: ReviewCheckpointItem[] = [];

  const pushIfNeeded = (
    kind: "challenge" | "direction" | "objective" | "analysis_entry",
    id: string,
    title: string,
    extra: Omit<Parameters<typeof evaluateDescriptionQuality>[0], "kind" | "title">
  ) => {
    const result = evaluateDescriptionQuality({ kind, title, ...extra });
    if (result.isAnalysable || !result.severity) return;
    items.push({
      id: `desc:${kind}:${id}`,
      category: "insufficient_description",
      objectTypeDe:
        kind === "challenge"
          ? "Herausforderung"
          : kind === "direction"
            ? "Stoßrichtung"
            : kind === "objective"
              ? "Ziel"
              : "Analyse-Eintrag",
      subtypeLabelDe: "Beschreibung prüfen",
      titleDe: title,
      hintDe: result.hintDe || "Objekt ist noch nicht ausreichend analysefähig beschrieben.",
      actionLabelDe: "Objektbeschreibung schärfen",
      actionHref: hrefForDescriptionQualityObject(kind, id, result.severity),
      severity: descriptionSeverityToReview(result.severity),
    });
  };

  for (const challenge of workspace.challenges) {
    const hasAnalysisBasis =
      Boolean(challenge.source_analysis_entry_id) ||
      (analysisLinksByChallenge.get(challenge.id)?.size ?? 0) > 0;
    pushIfNeeded("challenge", challenge.id, challenge.title, {
      description: challenge.description,
      hasAnalysisBasis,
    });
  }

  for (const direction of workspace.directions) {
    pushIfNeeded("direction", direction.id, direction.title, {
      description: direction.description,
      hasLinkedChallenges: (challengeIdsByDirection.get(direction.id)?.size ?? 0) > 0,
      hasLinkedObjectives: (objectiveIdsByDirection.get(direction.id)?.size ?? 0) > 0,
    });
  }

  for (const objective of workspace.objectives) {
    pushIfNeeded("objective", objective.id, objective.title, {
      description: objective.description,
      aiClarityScore:
        objective.ai_clarity_score != null ? Number(objective.ai_clarity_score) : null,
    });
  }

  for (const entry of workspace.analysisItems) {
    pushIfNeeded("analysis_entry", entry.id, entry.title ?? entry.id, {
      description: entry.description,
    });
  }

  return sortReviewCheckpoints(items);
}

function buildEntryIdsWithRelevantChallenge(workspace: DesignQualityWorkspaceInput): Set<string> {
  const linked = new Set<string>();
  const analysisLinksByChallenge = new Map<string, Set<string>>();
  for (const link of workspace.challengeAnalysisLinks) {
    const set = analysisLinksByChallenge.get(link.strategic_challenge_id) ?? new Set();
    set.add(link.analysis_entry_id);
    analysisLinksByChallenge.set(link.strategic_challenge_id, set);
  }
  for (const challenge of workspace.challenges) {
    if (challenge.source_analysis_entry_id) linked.add(challenge.source_analysis_entry_id);
    for (const entryId of analysisLinksByChallenge.get(challenge.id) ?? []) {
      linked.add(entryId);
    }
  }
  return linked;
}

function buildMissingConnectionItems(
  workspace: DesignQualityWorkspaceInput,
  insights: StrategicDesignInsightsResult,
  snapshot: DesignReadinessSnapshotResult
): ReviewCheckpointItem[] {
  const items: ReviewCheckpointItem[] = [];
  const linkedEntryIds = buildEntryIdsWithRelevantChallenge(workspace);

  for (const entry of workspace.analysisItems) {
    if (linkedEntryIds.has(entry.id)) continue;
    items.push({
      id: `missing:analysis:${entry.id}`,
      category: "missing_connections",
      objectTypeDe: "Analyse-Eintrag",
      subtypeLabelDe: "Ohne Herausforderung",
      relationLabelDe: "Analyse → Herausforderung",
      titleDe: entry.title ?? entry.id,
      hintDe: "Analyse-Erkenntnis ist noch nicht in eine bewertete Herausforderung überführt.",
      actionLabelDe: "In Verknüpfungsmatrix prüfen",
      actionHref: HREF_MATRIX,
      severity: "medium",
    });
  }

  for (const ch of insights.unaddressedChallenges) {
    items.push({
      id: `missing:challenge-direction:${ch.challengeId}`,
      category: "missing_connections",
      objectTypeDe: "Herausforderung",
      subtypeLabelDe: "Ohne Stoßrichtungsantwort",
      relationLabelDe: "Herausforderung → Stoßrichtung",
      titleDe: ch.title,
      hintDe: ch.explanationDe,
      actionLabelDe: "In Verknüpfungsmatrix prüfen",
      actionHref: HREF_MATRIX,
      severity: "high",
      score: ch.challengeScore,
    });
  }

  const dirMetrics = buildDirectionMetrics(
    workspace.directions,
    workspace.challenges,
    workspace.objectives,
    workspace.challengeDirectionLinks,
    workspace.directionObjectiveLinks
  );

  for (const d of dirMetrics) {
    const hasChallengeLinks = d.linkedChallengeTitles.length > 0;
    const hasObjectiveLinks = d.linkedObjectiveTitles.length > 0;
    if (hasChallengeLinks && !hasObjectiveLinks) {
      items.push({
        id: `missing:direction-objectives:${d.directionId}`,
        category: "missing_connections",
        objectTypeDe: "Stoßrichtung",
        subtypeLabelDe: "Ohne Zielbeitrag",
        relationLabelDe: "Stoßrichtung → Ziele",
        titleDe: d.title,
        hintDe: "Stoßrichtung adressiert Probleme, aber ohne erkennbaren Zielbeitrag im Modell.",
        actionLabelDe: "In Verknüpfungsmatrix prüfen",
        actionHref: HREF_MATRIX,
        severity: "medium",
      });
    }
  }

  for (const conflict of insights.conflicts) {
    if (conflict.type !== "unsupported_objective") continue;
    items.push({
      id: `missing:objective-support:${conflict.objectiveId}`,
      category: "missing_connections",
      objectTypeDe: "Ziel",
      subtypeLabelDe: "Ziel schwach angebunden",
      relationLabelDe: "Ziel → Stoßrichtungen",
      titleDe: conflict.objectiveTitle,
      hintDe: conflict.explanationDe,
      actionLabelDe: "In Verknüpfungsmatrix prüfen",
      actionHref: HREF_MATRIX,
      severity: "high",
    });
  }

  const chInd = snapshot.context.challengesFocus.industries;
  const chBm = snapshot.context.challengesFocus.businessModels;
  if (chInd.status === "weak" || chBm.status === "weak") {
    items.push({
      id: "missing:context:challenges",
      category: "missing_connections",
      objectTypeDe: "Kontext",
      subtypeLabelDe: "Herausforderungen",
      titleDe: "Industrie- und Geschäftsmodellkontext (Herausforderungen)",
      hintDe: `Kontextabdeckung bei Herausforderungen unvollständig (Industrien ${chInd.covered}/${chInd.total}, Geschäftsmodelle ${chBm.covered}/${chBm.total}).`,
      actionLabelDe: "In Verknüpfungsmatrix prüfen",
      actionHref: HREF_MATRIX,
      severity: "medium",
    });
  }

  const dirInd = snapshot.context.directionsFocus.industries;
  const dirBm = snapshot.context.directionsFocus.businessModels;
  if (dirInd.status === "weak" || dirBm.status === "weak") {
    items.push({
      id: "missing:context:directions",
      category: "missing_connections",
      objectTypeDe: "Kontext",
      subtypeLabelDe: "Stoßrichtungen",
      titleDe: "Industrie- und Geschäftsmodellkontext (Stoßrichtungen)",
      hintDe: `Kontextabdeckung bei Stoßrichtungen unvollständig (Industrien ${dirInd.covered}/${dirInd.total}, Geschäftsmodelle ${dirBm.covered}/${dirBm.total}).`,
      actionLabelDe: "In Verknüpfungsmatrix prüfen",
      actionHref: HREF_MATRIX,
      severity: "medium",
    });
  }

  return sortReviewCheckpoints(items);
}

function buildQuestionableConnectionItems(
  insights: StrategicDesignInsightsResult
): ReviewCheckpointItem[] {
  const items: ReviewCheckpointItem[] = [];

  for (const conflict of insights.conflicts) {
    if (conflict.type === "correlation_weak") {
      items.push({
        id: `questionable:fit:${conflict.challengeId}:${conflict.objectiveId}`,
        category: "questionable_connections",
        objectTypeDe: "Passungshinweis",
        subtypeLabelDe: "Herausforderung → Ziel",
        relationLabelDe: "Herausforderung → Ziel",
        titleDe: `${conflict.challengeTitle} → ${conflict.objectiveTitle}`,
        hintDe: conflict.explanationDe,
        actionLabelDe: "In Strategische Wirkpfade prüfen",
        actionHref: impactPathHref(conflict.challengeId),
        severity: "medium",
      });
    } else if (conflict.type === "misaligned_direction") {
      items.push({
        id: `questionable:direction:${conflict.directionId}`,
        category: "questionable_connections",
        objectTypeDe: "Stoßrichtung",
        subtypeLabelDe: "Schwache Evidenz",
        relationLabelDe: "Stoßrichtung → Ziele",
        titleDe: conflict.directionTitle,
        hintDe: conflict.explanationDe,
        actionLabelDe: "In Strategische Wirkpfade prüfen",
        actionHref: impactPathHref(conflict.directionId),
        severity: "high",
      });
    }
  }

  for (const obj of insights.limitedChallengeBackingObjectives) {
    items.push({
      id: `questionable:objective-backing:${obj.objectiveId}`,
      category: "questionable_connections",
      objectTypeDe: "Ziel",
      subtypeLabelDe: "Schwache Problem-Basis",
      relationLabelDe: "Ziel → Herausforderungen",
      titleDe: obj.title,
      hintDe: obj.explanationDe,
      actionLabelDe: "In Strategische Wirkpfade prüfen",
      actionHref: impactPathHref(obj.objectiveId),
      severity: "medium",
      score: obj.challengeBacking,
    });
  }

  return sortReviewCheckpoints(items);
}

function buildOverrideItems(conflictCells: CorrelationConflictDetail[]): ReviewCheckpointItem[] {
  return sortReviewCheckpoints(
    conflictCells.map((conflict) => {
      const autoLabel = correlationStatusLabelDe(conflict.autoStatus);
      const effectiveLabel = correlationStatusLabelDe(conflict.effectiveStatus);
      const hasNote = Boolean(conflict.overrideNote?.trim());
      const hintParts = [
        `Stoßrichtung: ${conflict.directionTitle}`,
        `Auto: ${autoLabel} (${conflict.autoScore}) → Override: ${effectiveLabel}`,
      ];
      if (hasNote) hintParts.push(conflict.overrideNote!.trim());

      return {
        id: `override:${conflict.key}`,
        category: "professional_overrides",
        objectTypeDe: "Override",
        subtypeLabelDe: hasNote ? undefined : "Ohne Begründung",
        relationLabelDe: "Herausforderung → Ziel",
        titleDe: `${conflict.challengeTitle} → ${conflict.objectiveTitle}`,
        hintDe: hintParts.join(" · "),
        actionLabelDe: "Override in Strategische Wirkpfade prüfen",
        actionHref: impactPathHref(conflict.challengeId),
        score: conflict.autoScore,
        severity: hasNote ? ("medium" as const) : ("high" as const),
      };
    })
  );
}

export function buildDesignQualityConnectionReview(
  input: BuildDesignQualityConnectionReviewInput
): DesignQualityConnectionReviewResult {
  const insufficientDescription = buildInsufficientDescriptionItems(input.workspace);
  const missingConnections = buildMissingConnectionItems(
    input.workspace,
    input.insights,
    input.readinessSnapshot
  );
  const questionableConnections = buildQuestionableConnectionItems(input.insights);
  const professionalOverrides = buildOverrideItems(input.conflictCells);

  const summary = {
    insufficientDescription: insufficientDescription.length,
    missingConnections: missingConnections.length,
    questionableConnections: questionableConnections.length,
    professionalOverrides: professionalOverrides.length,
    total:
      insufficientDescription.length +
      missingConnections.length +
      questionableConnections.length +
      professionalOverrides.length,
  };

  const result: DesignQualityConnectionReviewResult = {
    insufficientDescription,
    missingConnections,
    questionableConnections,
    professionalOverrides,
    summary,
    categoryMeta: CATEGORY_META,
  };

  if (
    input.openReviewHintsCount != null &&
    Number.isFinite(input.openReviewHintsCount) &&
    input.openReviewHintsCount !== summary.total
  ) {
    result.snapshotDelta = input.openReviewHintsCount - summary.total;
  }

  return result;
}

export function categoryItems(
  review: DesignQualityConnectionReviewResult,
  category: ReviewCategory
): ReviewCheckpointItem[] {
  switch (category) {
    case "insufficient_description":
      return review.insufficientDescription;
    case "missing_connections":
      return review.missingConnections;
    case "questionable_connections":
      return review.questionableConnections;
    case "professional_overrides":
      return review.professionalOverrides;
  }
}

export function categorySummary(
  review: DesignQualityConnectionReviewResult,
  category: ReviewCategory
): ReviewCategorySummary {
  const items = categoryItems(review, category);
  return { count: items.length, maxSeverity: maxSeverity(items) };
}

/** @deprecated Use buildDesignQualityConnectionReview */
export { buildDesignReviewHints } from "@/lib/strategy-cycle/design-review-hints";
