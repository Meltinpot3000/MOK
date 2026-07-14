import { isObjectiveEligibleForDirectionLink } from "@/lib/strategy-cycle/objective-direction-link-eligibility";
import type { StrategicDesignKpis } from "@/lib/strategy-cycle/strategic-design-insights";
import { normalizedCoverageWeight } from "@/lib/strategy-cycle/strategic-design-insights";
import { STRATEGIC_DESIGN_INSIGHT_THRESHOLDS } from "@/lib/strategy-cycle/strategic-design-insight-thresholds";
import { isStrategicDirectionEligibleForPrograms } from "@/lib/strategy-objects/direction-program-eligibility";
import type { StrategyObjectVersioningMeta } from "@/lib/strategy-objects/types";

const MIN_W = STRATEGIC_DESIGN_INSIGHT_THRESHOLDS.coverageKpiMinW;

export type DesignReadinessFocus = "challenges" | "directions";

export type ReadinessStatus = "strong" | "medium" | "weak" | "unknown";
export type ReadinessBand = "high" | "medium" | "low" | "unknown";

export type DisplayLifecycleBucket =
  | "active"
  | "approved"
  | "draft"
  | "paused"
  | "retired"
  | "inactive";

export type LifecycleDisplayCounts = {
  active: number;
  approved: number;
  draft: number;
  paused: number;
  retired: number;
  inactive?: number;
};

export type CoverageSummary = {
  covered: number;
  total: number;
  percentage: number | null;
  status: ReadinessStatus;
  label: string;
  hint: string;
};

export type FocusDetailAction = {
  priority: number;
  label: string;
  description: string;
  targetTab?:
    | "challenges"
    | "design"
    | "strategy-matrix"
    | "summary"
    | "corporate-strategy-summary";
};

export type FocusDetailSummary = {
  title: string;
  readinessBand: ReadinessBand;
  kpis: Array<{
    label: string;
    value: string;
    hint: string;
    status?: ReadinessStatus;
  }>;
  /** Befund: Wo ist die Kette schwach? */
  finding: string;
  /** Review-Fokus: Was ist als Nächstes zu tun? */
  reviewFocus: string;
  actions: FocusDetailAction[];
};

export type DistributionItem = {
  id: string;
  label: string;
  activeCount: number;
  inactiveCount: number;
  totalCount: number;
};

export type DistributionGroup = {
  totalAssignments: number;
  activeAssignments: number;
  inactiveAssignments: number;
  items: DistributionItem[];
  emptyHint: string | null;
};

export type ContextDistributions = {
  challengesFocus: {
    industries: DistributionGroup;
    businessModels: DistributionGroup;
  };
  directionsFocus: {
    industries: DistributionGroup;
    businessModels: DistributionGroup;
  };
};

export type DesignReadinessSnapshotResult = {
  overall: {
    readinessScore: number | null;
    readinessBand: ReadinessBand;
    openReviewHintsCount: number;
    challengeReadinessScore: number | null;
    challengeReadinessBand: ReadinessBand;
    directionReadinessScore: number | null;
    directionReadinessBand: ReadinessBand;
  };
  flow: {
    analysis: {
      total: number;
      linkedToActiveChallenges: number;
      coveragePct: number | null;
      priorityAOpenCount: number;
      status: ReadinessStatus;
      hint: string;
    };
    challenges: {
      total: number;
      readinessRelevant: number;
      lifecycleCounts: LifecycleDisplayCounts;
      analysisBasedCount: number;
      directlySetCount: number;
      withoutAnalysisBasisCount: number;
      withDirectionCount: number;
      directionResponsePct: number | null;
      status: ReadinessStatus;
      hint: string;
    };
    directions: {
      total: number;
      eligible: number;
      lifecycleCounts: LifecycleDisplayCounts;
      challengeCoveragePct: number | null;
      challengesCoveredCount: number;
      challengesCoverageTotal: number;
      objectiveCoveragePct: number | null;
      status: ReadinessStatus;
      hint: string;
    };
    objectives: {
      totalEligible: number;
      coveredByEligibleDirections: number;
      coveragePct: number | null;
      status: ReadinessStatus;
      hint: string;
    };
  };
  context: {
    challengesFocus: {
      industries: CoverageSummary;
      businessModels: CoverageSummary;
    };
    directionsFocus: {
      industries: CoverageSummary;
      businessModels: CoverageSummary;
    };
  };
  contextDistributions: ContextDistributions;
  focusDetails: {
    challenges: FocusDetailSummary;
    directions: FocusDetailSummary;
  };
};

type VersionedItem = { id: string; versioning?: StrategyObjectVersioningMeta | null };

export type ComputeDesignReadinessSnapshotInput = {
  analysisItems: Array<{
    id: string;
    title?: string;
    impact_level?: number | null;
    quality_band?: "high" | "medium" | "low" | null;
  }>;
  analysisClusters?: unknown[];
  directions: Array<VersionedItem & { grouping?: string | null }>;
  challenges: Array<
    VersionedItem & {
      source_analysis_entry_id?: string | null;
    }
  >;
  objectives: Array<
    VersionedItem & {
      importance_score?: number | string | null;
    }
  >;
  industries: Array<{ id: string; title?: string; name?: string }>;
  businessModels: Array<{ id: string; title?: string; name?: string }>;
  challengeAnalysisLinks: Array<{
    strategic_challenge_id: string;
    analysis_entry_id: string;
  }>;
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
  challengeIndustries: Array<{ strategic_challenge_id: string; industry_id: string }>;
  challengeBusinessModels: Array<{
    strategic_challenge_id: string;
    business_model_id: string;
  }>;
  directionIndustries: Array<{ strategic_direction_id: string; industry_id: string }>;
  directionBusinessModels: Array<{
    strategic_direction_id: string;
    business_model_id: string;
  }>;
  insightsKpis?: StrategicDesignKpis;
  openReviewHintsCount: number;
};

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

export function statusFromPct(value: number | null): ReadinessStatus {
  if (value == null) return "unknown";
  if (value >= 80) return "strong";
  if (value >= 60) return "medium";
  return "weak";
}

export function bandFromScore(score: number | null): ReadinessBand {
  if (score == null || !Number.isFinite(score)) return "unknown";
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function averageScores(a: number | null, b: number | null): number | null {
  const vals = [a, b].filter((v): v is number => v != null && Number.isFinite(v));
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
}

function isRetired(versioning: StrategyObjectVersioningMeta): boolean {
  const identity = versioning.identity_lifecycle_state;
  const op = versioning.operational_status;
  return (
    identity === "retired" ||
    identity === "archived" ||
    op === "retired" ||
    op === "removed" ||
    op === "archived"
  );
}

/** Display-only lifecycle bucket; does not change portfolio lifecycle. */
export function classifyChallengeDisplayLifecycle(
  versioning?: StrategyObjectVersioningMeta | null
): DisplayLifecycleBucket {
  if (!versioning) return "inactive";
  if (isRetired(versioning)) return "retired";
  if (
    versioning.operational_status === "on_hold" &&
    versioning.identity_lifecycle_state === "active" &&
    versioning.revision_state === "current"
  ) {
    return "paused";
  }
  if (versioning.revision_state === "pending_approval") return "approved";
  if (
    versioning.identity_lifecycle_state === "draft" ||
    versioning.revision_state === "draft"
  ) {
    return "draft";
  }
  if (
    versioning.identity_lifecycle_state === "active" &&
    versioning.revision_state === "current"
  ) {
    return "active";
  }
  if (versioning.identity_lifecycle_state === "inactive") return "inactive";
  return "inactive";
}

/** Display-only lifecycle bucket; does not change portfolio lifecycle. */
export function classifyDirectionDisplayLifecycle(
  versioning?: StrategyObjectVersioningMeta | null
): DisplayLifecycleBucket {
  if (!versioning) return "inactive";
  if (isRetired(versioning)) return "retired";
  if (
    versioning.operational_status === "on_hold" &&
    versioning.identity_lifecycle_state === "active" &&
    versioning.revision_state === "current"
  ) {
    return "paused";
  }
  if (versioning.revision_state === "pending_approval") return "approved";
  if (
    versioning.identity_lifecycle_state === "draft" ||
    versioning.revision_state === "draft"
  ) {
    return "draft";
  }
  if (isStrategicDirectionEligibleForPrograms(versioning)) return "active";
  if (versioning.identity_lifecycle_state === "inactive") return "inactive";
  return "inactive";
}

export function isChallengeReadinessRelevant(
  versioning?: StrategyObjectVersioningMeta | null
): boolean {
  const bucket = classifyChallengeDisplayLifecycle(versioning);
  return bucket === "active" || bucket === "approved";
}

function countLifecycle<T extends VersionedItem>(
  items: T[],
  classifier: (v?: StrategyObjectVersioningMeta | null) => DisplayLifecycleBucket
): LifecycleDisplayCounts {
  const counts: LifecycleDisplayCounts = {
    active: 0,
    approved: 0,
    draft: 0,
    paused: 0,
    retired: 0,
    inactive: 0,
  };
  for (const item of items) {
    counts[classifier(item.versioning)] += 1;
  }
  return counts;
}

/** MVP-Proxy für „Prio A“: quality_band high oder impact_level >= 4 */
export function isPriorityAAnalysisEntry(entry: {
  impact_level?: number | null;
  quality_band?: string | null;
}): boolean {
  if (entry.quality_band === "high") return true;
  const impact = Number(entry.impact_level ?? 0);
  return Number.isFinite(impact) && impact >= 4;
}

function dimensionLabel(item: { title?: string; name?: string }): string {
  return item.title?.trim() || item.name?.trim() || "Unbenannt";
}

type DistributionLink = { entityId: string; dimensionId: string };

export function buildDistributionGroup(
  catalog: Array<{ id: string; title?: string; name?: string }>,
  links: DistributionLink[],
  isEntityActive: (entityId: string) => boolean,
  emptyHint: string
): DistributionGroup {
  const countsByDimension = new Map<string, { active: number; inactive: number }>();

  for (const link of links) {
    const bucket = countsByDimension.get(link.dimensionId) ?? { active: 0, inactive: 0 };
    if (isEntityActive(link.entityId)) bucket.active += 1;
    else bucket.inactive += 1;
    countsByDimension.set(link.dimensionId, bucket);
  }

  let activeAssignments = 0;
  let inactiveAssignments = 0;
  const catalogIds = new Set(catalog.map((d) => d.id));

  const items: DistributionItem[] = catalog.map((dim) => {
    const c = countsByDimension.get(dim.id) ?? { active: 0, inactive: 0 };
    activeAssignments += c.active;
    inactiveAssignments += c.inactive;
    return {
      id: dim.id,
      label: dimensionLabel(dim),
      activeCount: c.active,
      inactiveCount: c.inactive,
      totalCount: c.active + c.inactive,
    };
  });

  let orphanActive = 0;
  let orphanInactive = 0;
  for (const [dimId, c] of countsByDimension) {
    if (catalogIds.has(dimId)) continue;
    orphanActive += c.active;
    orphanInactive += c.inactive;
  }
  if (orphanActive + orphanInactive > 0) {
    activeAssignments += orphanActive;
    inactiveAssignments += orphanInactive;
    items.push({
      id: "__other__",
      label: "Sonstige",
      activeCount: orphanActive,
      inactiveCount: orphanInactive,
      totalCount: orphanActive + orphanInactive,
    });
  }

  items.sort(
    (a, b) => b.totalCount - a.totalCount || a.label.localeCompare(b.label, "de")
  );

  const totalAssignments = activeAssignments + inactiveAssignments;

  return {
    totalAssignments,
    activeAssignments,
    inactiveAssignments,
    items,
    emptyHint: totalAssignments === 0 ? emptyHint : null,
  };
}

export const DISTRIBUTION_CATEGORY_COLORS: Array<{ active: string; inactive: string }> = [
  { active: "#0f766e", inactive: "#99f6e4" },
  { active: "#c2410c", inactive: "#fed7aa" },
  { active: "#15803d", inactive: "#bbf7d0" },
  { active: "#1d4ed8", inactive: "#bfdbfe" },
  { active: "#7e22ce", inactive: "#e9d5ff" },
  { active: "#be185d", inactive: "#fbcfe8" },
  { active: "#b45309", inactive: "#fde68a" },
  { active: "#475569", inactive: "#cbd5e1" },
];

function buildContextDistributions(
  input: ComputeDesignReadinessSnapshotInput,
  readinessRelevantChallengeIds: Set<string>,
  eligibleDirectionIds: Set<string>
): ContextDistributions {
  const challengeIndustryLinks: DistributionLink[] = input.challengeIndustries.map((r) => ({
    entityId: r.strategic_challenge_id,
    dimensionId: r.industry_id,
  }));
  const challengeBmLinks: DistributionLink[] = input.challengeBusinessModels.map((r) => ({
    entityId: r.strategic_challenge_id,
    dimensionId: r.business_model_id,
  }));
  const directionIndustryLinks: DistributionLink[] = input.directionIndustries.map((r) => ({
    entityId: r.strategic_direction_id,
    dimensionId: r.industry_id,
  }));
  const directionBmLinks: DistributionLink[] = input.directionBusinessModels.map((r) => ({
    entityId: r.strategic_direction_id,
    dimensionId: r.business_model_id,
  }));

  const isChallengeActive = (id: string) => readinessRelevantChallengeIds.has(id);
  const isDirectionActive = (id: string) => eligibleDirectionIds.has(id);

  return {
    challengesFocus: {
      industries: buildDistributionGroup(
        input.industries,
        challengeIndustryLinks,
        isChallengeActive,
        "Bitte Industrien oder Geschäftsmodelle an Herausforderungen pflegen."
      ),
      businessModels: buildDistributionGroup(
        input.businessModels,
        challengeBmLinks,
        isChallengeActive,
        "Bitte Industrien oder Geschäftsmodelle an Herausforderungen pflegen."
      ),
    },
    directionsFocus: {
      industries: buildDistributionGroup(
        input.industries,
        directionIndustryLinks,
        isDirectionActive,
        "Bitte Industrien oder Geschäftsmodelle an Stoßrichtungen pflegen."
      ),
      businessModels: buildDistributionGroup(
        input.businessModels,
        directionBmLinks,
        isDirectionActive,
        "Bitte Industrien oder Geschäftsmodelle an Stoßrichtungen pflegen."
      ),
    },
  };
}

function formatGermanList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} und ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} und ${items[items.length - 1]}`;
}

function buildCoverageSummary(
  covered: number,
  total: number,
  entityLabel: string,
  focus: DesignReadinessFocus
): CoverageSummary {
  const percentage = pct(covered, total);
  const status = statusFromPct(percentage);
  let hint = "";
  if (total === 0) {
    hint = `Keine ${entityLabel} im Katalog definiert.`;
  } else if (covered === 0) {
    hint =
      focus === "challenges"
        ? entityLabel === "Industrien"
          ? "Keine aktiven Herausforderungen sind aktuell mit Industrien verknüpft."
          : "Keine aktiven Herausforderungen sind aktuell mit Geschäftsmodellen verknüpft."
        : entityLabel === "Industrien"
          ? "Keine wirksamen Stoßrichtungen sind aktuell mit Industrien verknüpft."
          : "Keine wirksamen Stoßrichtungen sind aktuell mit Geschäftsmodellen verknüpft.";
  } else if (covered >= total) {
    hint = `${entityLabel} sind im aktuellen Fokus vollständig abgedeckt.`;
  } else if (status === "medium") {
    hint = `Ein Teil der ${entityLabel} ist im aktuellen Fokus noch nicht verankert.`;
  } else {
    hint = `${entityLabel} sind im aktuellen Fokus noch lückenhaft abgedeckt.`;
  }
  return {
    covered,
    total,
    percentage,
    status,
    label: entityLabel,
    hint,
  };
}

export function challengeHasAnalysisBasis(
  challengeId: string,
  sourceEntryId: string | null | undefined,
  analysisLinksByChallenge: Map<string, Set<string>>
): boolean {
  if (sourceEntryId) return true;
  return (analysisLinksByChallenge.get(challengeId)?.size ?? 0) > 0;
}

function maxLinkWeightForChallenge(
  challengeId: string,
  eligibleDirectionIds: Set<string>,
  links: ComputeDesignReadinessSnapshotInput["challengeDirectionLinks"]
): number {
  let maxW = 0;
  for (const link of links) {
    if (link.strategic_challenge_id !== challengeId) continue;
    if (!eligibleDirectionIds.has(link.strategic_direction_id)) continue;
    maxW = Math.max(maxW, normalizedCoverageWeight(link.contribution_level));
  }
  return maxW;
}

function maxLinkWeightForObjective(
  objectiveId: string,
  eligibleDirectionIds: Set<string>,
  links: ComputeDesignReadinessSnapshotInput["directionObjectiveLinks"]
): number {
  let maxW = 0;
  for (const link of links) {
    if (link.objective_id !== objectiveId) continue;
    if (!eligibleDirectionIds.has(link.strategic_direction_id)) continue;
    maxW = Math.max(maxW, normalizedCoverageWeight(link.contribution_level));
  }
  return maxW;
}

export function buildChallengeReadinessFinding(snapshot: DesignReadinessSnapshotResult): {
  finding: string;
  reviewFocus: string;
} {
  const { flow, context, overall } = snapshot;
  const band = overall.challengeReadinessBand;

  if (band === "unknown") {
    return {
      finding: "Für die Herausforderungsebene fehlt noch eine belastbare Datenbasis.",
      reviewFocus: "Zuerst Herausforderungen im Design anlegen oder freigeben.",
    };
  }

  const critical: string[] = [];
  if (flow.analysis.status === "weak" || flow.analysis.status === "medium") {
    critical.push("die geringe Analyseverwertung");
  }
  if (flow.challenges.directlySetCount > 0) {
    critical.push("viele managementgesetzte Herausforderungen");
  }
  if (
    flow.challenges.directionResponsePct != null &&
    flow.challenges.directionResponsePct < 60
  ) {
    critical.push("die noch unvollständige Stoßrichtungsantwort");
  }
  if (
    context.challengesFocus.industries.total > 0 &&
    context.challengesFocus.industries.covered === 0
  ) {
    critical.push("fehlende Industrie-Kontexte");
  }
  if (
    context.challengesFocus.businessModels.total > 0 &&
    context.challengesFocus.businessModels.covered === 0
  ) {
    critical.push("fehlende Geschäftsmodell-Kontexte");
  }
  if (flow.analysis.priorityAOpenCount > 0 && critical.length < 3) {
    critical.push("offene hochpriorisierte Analysepunkte");
  }

  const finding =
    critical.length > 0
      ? `Die Ableitungskette ist aktuell noch schwach. Besonders kritisch sind ${formatGermanList(critical.slice(0, 3))}.`
      : band === "high"
        ? "Die Herausforderungsebene ist durchgängig tragfähig — Analyse, Kontext und Stoßrichtungsantwort sind konsistent."
        : "Die Herausforderungsebene ist grundsätzlich tragfähig, mit punktuellen Lücken in der Ableitung.";

  const reviewSteps: string[] = [];
  if (flow.analysis.priorityAOpenCount > 0 || flow.analysis.status === "weak") {
    reviewSteps.push("Analysepunkte in Herausforderungen überführen");
  }
  if (flow.challenges.directlySetCount > 0) {
    reviewSteps.push("Herkunft managementgesetzter Herausforderungen klären");
  }
  if (
    context.challengesFocus.industries.status === "weak" ||
    context.challengesFocus.businessModels.status === "weak"
  ) {
    reviewSteps.push("Industrien und Geschäftsmodelle zuordnen");
  }
  if (flow.challenges.directionResponsePct != null && flow.challenges.directionResponsePct < 60) {
    reviewSteps.push("Zielbeiträge der Stoßrichtungen nachziehen");
  }

  const reviewFocus =
    reviewSteps.length > 0
      ? `Zuerst ${reviewSteps.join(", ")}.`
      : "Kein dringender Review-Fokus — punktuelle Qualitätsprüfung reicht.";

  return { finding, reviewFocus };
}

export function buildDirectionReadinessFinding(snapshot: DesignReadinessSnapshotResult): {
  finding: string;
  reviewFocus: string;
} {
  const { flow, context, overall } = snapshot;
  const band = overall.directionReadinessBand;

  if (band === "unknown") {
    return {
      finding: "Für die Stoßrichtungsebene fehlt noch eine belastbare Datenbasis.",
      reviewFocus: "Zuerst wirksam aktive Stoßrichtungen im Design freigeben.",
    };
  }

  const critical: string[] = [];
  if (flow.directions.challengeCoveragePct != null && flow.directions.challengeCoveragePct < 60) {
    critical.push("die unvollständige Herausforderungsabdeckung");
  }
  if (flow.objectives.coveragePct != null && flow.objectives.coveragePct < 60) {
    critical.push("der schwache Zielbezug");
  }
  if (
    context.directionsFocus.industries.total > 0 &&
    context.directionsFocus.industries.covered === 0
  ) {
    critical.push("fehlende Industrie-Kontexte");
  }
  if (
    context.directionsFocus.businessModels.total > 0 &&
    context.directionsFocus.businessModels.covered === 0
  ) {
    critical.push("fehlende Geschäftsmodell-Kontexte");
  }

  const lc = flow.directions.lifecycleCounts;
  if (lc.draft + lc.paused > lc.active && flow.directions.eligible > 0 && critical.length < 3) {
    critical.push("viele Entwürfe oder pausierte Stoßrichtungen im Portfolio");
  }

  const finding =
    critical.length > 0
      ? `Als Bindeglied sind Stoßrichtungen noch schwach — besonders ${formatGermanList(critical.slice(0, 3))}.`
      : band === "high"
        ? "Wirksam aktive Stoßrichtungen tragen Herausforderungen, Ziele und Kontext konsistent."
        : "Das Stoßrichtungs-Portfolio ist grundsätzlich tragfähig, mit Lücken in der Verknüpfung.";

  const reviewSteps: string[] = [];
  if (flow.objectives.coveragePct != null && flow.objectives.coveragePct < 60) {
    reviewSteps.push("Zielbeiträge wirksam aktiver Stoßrichtungen ergänzen");
  }
  if (flow.directions.challengeCoveragePct != null && flow.directions.challengeCoveragePct < 60) {
    reviewSteps.push("Herausforderung–Stoßrichtung-Verknüpfungen prüfen");
  }
  if (
    context.directionsFocus.industries.status === "weak" ||
    context.directionsFocus.businessModels.status === "weak"
  ) {
    reviewSteps.push("Kontext an Stoßrichtungen spiegeln");
  }

  const reviewFocus =
    reviewSteps.length > 0
      ? `Zuerst ${reviewSteps.join(", ")}.`
      : "Kein dringender Review-Fokus — Portfolio-Struktur und Passung punktuell prüfen.";

  return { finding, reviewFocus };
}

function buildChallengeActions(snapshot: DesignReadinessSnapshotResult): FocusDetailAction[] {
  const actions: FocusDetailAction[] = [];
  let priority = 1;
  const { flow, context } = snapshot;

  if (
    flow.analysis.priorityAOpenCount > 0 ||
    flow.analysis.status === "weak" ||
    flow.analysis.status === "medium"
  ) {
    actions.push({
      priority: priority++,
      label: "Analysebasis prüfen",
      description: `${flow.analysis.priorityAOpenCount} hochpriorisierte Analysepunkte ohne bewertete Herausforderung — Erkenntnisse in Herausforderungen überführen.`,
      targetTab: "corporate-strategy-summary",
    });
  }

  if (flow.challenges.directlySetCount > 0) {
    actions.push({
      priority: priority++,
      label: "Herkunft klären",
      description: `${flow.challenges.directlySetCount} managementgesetzte Herausforderungen — Herkunft dokumentieren oder Analysebezug nachziehen.`,
      targetTab: "challenges",
    });
  }

  if (
    context.challengesFocus.industries.status === "weak" ||
    context.challengesFocus.businessModels.status === "weak"
  ) {
    actions.push({
      priority: priority++,
      label: "Kontext zuordnen",
      description: "Industrien und Geschäftsmodelle an Herausforderungen pflegen.",
      targetTab: "challenges",
    });
  }

  if (
    flow.challenges.directionResponsePct != null &&
    (flow.challenges.status === "weak" || flow.challenges.status === "medium")
  ) {
    actions.push({
      priority: priority++,
      label: "Verknüpfungen prüfen",
      description:
        "Stoßrichtungsantworten auf offene Herausforderungen in der Verknüpfungsmatrix setzen.",
      targetTab: "strategy-matrix",
    });
  }

  return actions;
}

function buildDirectionActions(
  snapshot: DesignReadinessSnapshotResult,
  designFieldCount: number
): FocusDetailAction[] {
  const actions: FocusDetailAction[] = [];
  let priority = 1;
  const { flow, context } = snapshot;

  if (flow.objectives.status === "weak" || flow.objectives.status === "medium") {
    actions.push({
      priority: priority++,
      label: "Zielbeiträge prüfen",
      description:
        "Wirksam aktive Stoßrichtungen mit strategischen Zielen verknüpfen und Gewichte setzen.",
      targetTab: "design",
    });
  }

  if (
    flow.directions.challengeCoveragePct != null &&
    (flow.directions.status === "weak" || flow.directions.status === "medium")
  ) {
    actions.push({
      priority: priority++,
      label: "Verknüpfungen prüfen",
      description:
        "Herausforderung–Stoßrichtung-Links mit ausreichender Abdeckungsstärke ergänzen.",
      targetTab: "strategy-matrix",
    });
  }

  if (
    context.directionsFocus.industries.status === "weak" ||
    context.directionsFocus.businessModels.status === "weak"
  ) {
    actions.push({
      priority: priority++,
      label: "Kontext zuordnen",
      description: "Wirksam aktive Stoßrichtungen gegen Industrien und Geschäftsmodelle spiegeln.",
      targetTab: "design",
    });
  }

  if (designFieldCount < 2 && flow.directions.eligible > 0) {
    actions.push({
      priority: priority++,
      label: "Designfelder bilden",
      description:
        "Stoßrichtungen in Designfelder (Grouping) clustern, um das Portfolio zu strukturieren.",
      targetTab: "design",
    });
  }

  return actions;
}

function weightedScore(parts: Array<{ w: number; v: number | null }>): number | null {
  const usable = parts.filter((p) => p.v != null);
  if (usable.length === 0) return null;
  const weightSum = usable.reduce((s, p) => s + p.w, 0);
  const score = usable.reduce((s, p) => s + p.w * (p.v as number), 0) / weightSum;
  return Math.round(score);
}

export function computeDesignReadinessSnapshot(
  input: ComputeDesignReadinessSnapshotInput
): DesignReadinessSnapshotResult {
  const eligibleDirectionIds = new Set(
    input.directions
      .filter((d) => isStrategicDirectionEligibleForPrograms(d.versioning))
      .map((d) => d.id)
  );

  const readinessRelevantChallengeIds = new Set(
    input.challenges
      .filter((c) => isChallengeReadinessRelevant(c.versioning))
      .map((c) => c.id)
  );

  const analysisLinksByChallenge = new Map<string, Set<string>>();
  for (const link of input.challengeAnalysisLinks) {
    const set = analysisLinksByChallenge.get(link.strategic_challenge_id) ?? new Set();
    set.add(link.analysis_entry_id);
    analysisLinksByChallenge.set(link.strategic_challenge_id, set);
  }

  const challengeById = new Map(input.challenges.map((c) => [c.id, c]));

  const entryIdsWithRelevantChallenge = new Set<string>();
  for (const challenge of input.challenges) {
    if (!readinessRelevantChallengeIds.has(challenge.id)) continue;
    const sourceId = challenge.source_analysis_entry_id;
    if (sourceId) entryIdsWithRelevantChallenge.add(sourceId);
    for (const entryId of analysisLinksByChallenge.get(challenge.id) ?? []) {
      entryIdsWithRelevantChallenge.add(entryId);
    }
  }

  const analysisTotal = input.analysisItems.length;
  const analysisLinked = input.analysisItems.filter((e) =>
    entryIdsWithRelevantChallenge.has(e.id)
  ).length;
  const analysisCoveragePct = pct(analysisLinked, analysisTotal);

  // MVP-Proxy für „Prio A“: quality_band === "high" oder impact_level >= 4
  const priorityAOpenCount = input.analysisItems.filter(
    (e) => isPriorityAAnalysisEntry(e) && !entryIdsWithRelevantChallenge.has(e.id)
  ).length;

  const challengeLifecycle = countLifecycle(input.challenges, classifyChallengeDisplayLifecycle);
  const directionLifecycle = countLifecycle(input.directions, classifyDirectionDisplayLifecycle);

  const readinessRelevant = readinessRelevantChallengeIds.size;
  let analysisBasedCount = 0;
  let directlySetCount = 0;
  let withDirectionCount = 0;

  for (const id of readinessRelevantChallengeIds) {
    const ch = challengeById.get(id);
    if (!ch) continue;
    const hasAnalysis = challengeHasAnalysisBasis(
      id,
      ch.source_analysis_entry_id,
      analysisLinksByChallenge
    );
    if (hasAnalysis) analysisBasedCount += 1;
    else directlySetCount += 1;

    const hasEligibleDir = input.challengeDirectionLinks.some(
      (l) =>
        l.strategic_challenge_id === id &&
        eligibleDirectionIds.has(l.strategic_direction_id)
    );
    if (hasEligibleDir) withDirectionCount += 1;
  }

  const directionResponsePct = pct(withDirectionCount, readinessRelevant);

  const challengeIndustryIds = new Set<string>();
  for (const row of input.challengeIndustries) {
    if (readinessRelevantChallengeIds.has(row.strategic_challenge_id)) {
      challengeIndustryIds.add(row.industry_id);
    }
  }
  const challengeBmIds = new Set<string>();
  for (const row of input.challengeBusinessModels) {
    if (readinessRelevantChallengeIds.has(row.strategic_challenge_id)) {
      challengeBmIds.add(row.business_model_id);
    }
  }

  const directionIndustryIds = new Set<string>();
  for (const row of input.directionIndustries) {
    if (eligibleDirectionIds.has(row.strategic_direction_id)) {
      directionIndustryIds.add(row.industry_id);
    }
  }
  const directionBmIds = new Set<string>();
  for (const row of input.directionBusinessModels) {
    if (eligibleDirectionIds.has(row.strategic_direction_id)) {
      directionBmIds.add(row.business_model_id);
    }
  }

  const industryTotal = input.industries.length;
  const bmTotal = input.businessModels.length;

  const challengesFocusIndustries = buildCoverageSummary(
    challengeIndustryIds.size,
    industryTotal,
    "Industrien",
    "challenges"
  );
  const challengesFocusBm = buildCoverageSummary(
    challengeBmIds.size,
    bmTotal,
    "Geschäftsmodelle",
    "challenges"
  );
  const directionsFocusIndustries = buildCoverageSummary(
    directionIndustryIds.size,
    industryTotal,
    "Industrien",
    "directions"
  );
  const directionsFocusBm = buildCoverageSummary(
    directionBmIds.size,
    bmTotal,
    "Geschäftsmodelle",
    "directions"
  );

  let dirChallengeCovered = 0;
  for (const id of readinessRelevantChallengeIds) {
    if (maxLinkWeightForChallenge(id, eligibleDirectionIds, input.challengeDirectionLinks) >= MIN_W) {
      dirChallengeCovered += 1;
    }
  }
  const directionChallengeCoveragePct = pct(dirChallengeCovered, readinessRelevant);

  const eligibleObjectives = input.objectives.filter((o) =>
    isObjectiveEligibleForDirectionLink(o.versioning)
  );
  let objectivesCovered = 0;
  for (const obj of eligibleObjectives) {
    if (
      maxLinkWeightForObjective(obj.id, eligibleDirectionIds, input.directionObjectiveLinks) >= MIN_W
    ) {
      objectivesCovered += 1;
    }
  }
  const objectiveCoveragePct = pct(objectivesCovered, eligibleObjectives.length);

  const analysisUtilizationScore = averageScores(
    analysisCoveragePct,
    pct(analysisBasedCount, readinessRelevant)
  );
  const challengeLifecycleMaturity =
    input.challenges.length > 0
      ? pct(challengeLifecycle.active + challengeLifecycle.approved, input.challenges.length)
      : null;

  const challengeReadinessScore = weightedScore([
    { w: 0.3, v: analysisUtilizationScore },
    { w: 0.35, v: directionResponsePct },
    { w: 0.15, v: challengesFocusIndustries.percentage },
    { w: 0.15, v: challengesFocusBm.percentage },
    { w: 0.05, v: challengeLifecycleMaturity },
  ]);

  const directionReadinessScore = weightedScore([
    { w: 0.35, v: directionChallengeCoveragePct },
    { w: 0.35, v: objectiveCoveragePct },
    { w: 0.15, v: directionsFocusIndustries.percentage },
    { w: 0.15, v: directionsFocusBm.percentage },
  ]);

  const overallScore = averageScores(challengeReadinessScore, directionReadinessScore);

  const designFieldLabels = new Set(
    input.directions
      .map((d) => d.grouping?.trim())
      .filter((g): g is string => Boolean(g))
  );

  const challengeStatus = statusFromPct(directionResponsePct);
  const directionAvgPct =
    directionChallengeCoveragePct != null && objectiveCoveragePct != null
      ? Math.round((directionChallengeCoveragePct + objectiveCoveragePct) / 2)
      : directionChallengeCoveragePct ?? objectiveCoveragePct;
  const directionStatus = statusFromPct(directionAvgPct);

  const snapshot: DesignReadinessSnapshotResult = {
    overall: {
      readinessScore: overallScore,
      readinessBand: bandFromScore(overallScore),
      openReviewHintsCount: input.openReviewHintsCount,
      challengeReadinessScore,
      challengeReadinessBand: bandFromScore(challengeReadinessScore),
      directionReadinessScore,
      directionReadinessBand: bandFromScore(directionReadinessScore),
    },
    flow: {
      analysis: {
        total: analysisTotal,
        linkedToActiveChallenges: analysisLinked,
        coveragePct: analysisCoveragePct,
        priorityAOpenCount,
        status: statusFromPct(analysisCoveragePct),
        hint:
          analysisTotal === 0
            ? "Keine Analyse-Einträge im Zyklus."
            : analysisCoveragePct != null && analysisCoveragePct >= 60
              ? "Die meisten Analyse-Einträge sind strategisch verarbeitet."
              : "Viele Analyse-Einträge sind noch nicht in aktive Herausforderungen überführt.",
      },
      challenges: {
        total: input.challenges.length,
        readinessRelevant,
        lifecycleCounts: challengeLifecycle,
        analysisBasedCount,
        directlySetCount,
        withoutAnalysisBasisCount: directlySetCount,
        withDirectionCount,
        directionResponsePct,
        status: challengeStatus,
        hint:
          readinessRelevant === 0
            ? "Keine Herausforderungen werden im aktuellen Design bewertet."
            : directionResponsePct != null && directionResponsePct >= 60
              ? "Die meisten bewerteten Herausforderungen haben eine Stoßrichtungsantwort."
              : "Mehrere bewertete Herausforderungen warten noch auf eine Stoßrichtungsantwort.",
      },
      directions: {
        total: input.directions.length,
        eligible: eligibleDirectionIds.size,
        lifecycleCounts: directionLifecycle,
        challengeCoveragePct: directionChallengeCoveragePct,
        challengesCoveredCount: dirChallengeCovered,
        challengesCoverageTotal: readinessRelevant,
        objectiveCoveragePct,
        status: directionStatus,
        hint:
          eligibleDirectionIds.size === 0
            ? "Keine wirksam aktiven Stoßrichtungen im Design."
            : directionChallengeCoveragePct != null && directionChallengeCoveragePct >= 60
              ? "Wirksam aktive Stoßrichtungen adressieren die meisten Herausforderungen."
              : "Wirksam aktive Stoßrichtungen decken noch nicht alle Herausforderungen ab.",
      },
      objectives: {
        totalEligible: eligibleObjectives.length,
        coveredByEligibleDirections: objectivesCovered,
        coveragePct: objectiveCoveragePct,
        status: statusFromPct(objectiveCoveragePct),
        hint:
          eligibleObjectives.length === 0
            ? "Keine verknüpfbaren Ziele im Zyklus."
            : objectiveCoveragePct != null && objectiveCoveragePct >= 60
              ? "Ziele sind weitgehend durch wirksam aktive Stoßrichtungen unterstützt."
              : objectivesCovered === 0
                ? "Keine Ziele ausreichend durch wirksame Stoßrichtungen unterstützt."
                : "Mehrere Ziele sind noch nicht ausreichend durch wirksame Stoßrichtungen unterstützt.",
      },
    },
    context: {
      challengesFocus: {
        industries: challengesFocusIndustries,
        businessModels: challengesFocusBm,
      },
      directionsFocus: {
        industries: directionsFocusIndustries,
        businessModels: directionsFocusBm,
      },
    },
    contextDistributions: buildContextDistributions(
      input,
      readinessRelevantChallengeIds,
      eligibleDirectionIds
    ),
    focusDetails: {
      challenges: {
        title: "Fokus: Herausforderungen",
        readinessBand: bandFromScore(challengeReadinessScore),
        kpis: [],
        finding: "",
        reviewFocus: "",
        actions: [],
      },
      directions: {
        title: "Fokus: Stoßrichtungen",
        readinessBand: bandFromScore(directionReadinessScore),
        kpis: [],
        finding: "",
        reviewFocus: "",
        actions: [],
      },
    },
  };

  snapshot.focusDetails.challenges.kpis = [
    {
      label: "Analyseverwertung",
      value: analysisCoveragePct != null ? `${analysisCoveragePct}%` : "—",
      hint: `${analysisLinked} von ${analysisTotal} Analyse-Einträgen in aktive Herausforderungen überführt`,
      status: statusFromPct(analysisCoveragePct),
    },
    {
      label: "Analysefundierung",
      value:
        readinessRelevant > 0 ? `${analysisBasedCount} von ${readinessRelevant}` : "—",
      hint: "Bewertete Herausforderungen mit Analysebezug (Pills oder Quelleintrag)",
      status: statusFromPct(pct(analysisBasedCount, readinessRelevant)),
    },
    {
      label: "Direkt gesetzt",
      value: String(directlySetCount),
      hint: "Managementgesetzt — Herkunft optional prüfen",
      status: directlySetCount === 0 ? "strong" : "medium",
    },
    {
      label: "Stoßrichtungsantwort",
      value: directionResponsePct != null ? `${directionResponsePct}%` : "—",
      hint: `${withDirectionCount} von ${readinessRelevant} bewerteten Herausforderungen mit wirksam aktiver Stoßrichtung`,
      status: statusFromPct(directionResponsePct),
    },
    {
      label: "Prio-A offen",
      value: String(priorityAOpenCount),
      hint: "Hochpriorisierte Analysepunkte ohne bewertete Herausforderung",
      status: priorityAOpenCount === 0 ? "strong" : "weak",
    },
  ];

  snapshot.focusDetails.directions.kpis = [
    {
      label: "Wirksam aktiv",
      value: `${eligibleDirectionIds.size} von ${input.directions.length}`,
      hint: "Stoßrichtungen gemäß Programm-Eligibility",
      status: eligibleDirectionIds.size > 0 ? "medium" : "weak",
    },
    {
      label: "Herausforderungsabdeckung",
      value: directionChallengeCoveragePct != null ? `${directionChallengeCoveragePct}%` : "—",
      hint: `Starke Verknüpfung (Gewicht ≥ ${MIN_W}) zu wirksam aktiven Stoßrichtungen`,
      status: statusFromPct(directionChallengeCoveragePct),
    },
    {
      label: "Zielverankerung",
      value: objectiveCoveragePct != null ? `${objectiveCoveragePct}%` : "—",
      hint: `${objectivesCovered} von ${eligibleObjectives.length} verknüpfbaren Zielen`,
      status: statusFromPct(objectiveCoveragePct),
    },
    {
      label: "Industrien",
      value: `${directionIndustryIds.size}/${industryTotal}`,
      hint: directionsFocusIndustries.hint,
      status: directionsFocusIndustries.status,
    },
    {
      label: "Geschäftsmodelle",
      value: `${directionBmIds.size}/${bmTotal}`,
      hint: directionsFocusBm.hint,
      status: directionsFocusBm.status,
    },
  ];

  const challengeFinding = buildChallengeReadinessFinding(snapshot);
  snapshot.focusDetails.challenges.finding = challengeFinding.finding;
  snapshot.focusDetails.challenges.reviewFocus = challengeFinding.reviewFocus;
  const directionFinding = buildDirectionReadinessFinding(snapshot);
  snapshot.focusDetails.directions.finding = directionFinding.finding;
  snapshot.focusDetails.directions.reviewFocus = directionFinding.reviewFocus;
  snapshot.focusDetails.challenges.actions = buildChallengeActions(snapshot);
  snapshot.focusDetails.directions.actions = buildDirectionActions(
    snapshot,
    designFieldLabels.size
  );

  return snapshot;
}

export function readinessBandLabelDe(band: ReadinessBand): string {
  switch (band) {
    case "high":
      return "Tragfähig";
    case "medium":
      return "Prüfen";
    case "low":
      return "Nacharbeiten";
    default:
      return "Keine Daten";
  }
}

export function readinessStatusLabelDe(status: ReadinessStatus): string {
  switch (status) {
    case "strong":
      return "Tragfähig";
    case "medium":
      return "Prüfen";
    case "weak":
      return "Nacharbeiten";
    default:
      return "Keine Daten";
  }
}

export function readinessBandsDiverge(
  a: ReadinessBand,
  b: ReadinessBand
): boolean {
  const order: Record<ReadinessBand, number> = {
    unknown: -1,
    low: 0,
    medium: 1,
    high: 2,
  };
  if (a === "unknown" || b === "unknown") return false;
  return Math.abs(order[a] - order[b]) >= 2;
}
