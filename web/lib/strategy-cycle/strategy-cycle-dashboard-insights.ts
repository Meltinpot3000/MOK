import type { AnalysisEntryOverviewStats } from "@/lib/strategy-cycle/analysis-entry-overview";
import type { StrategicDesignKpis } from "@/lib/strategy-cycle/strategic-design-insights";

export type MetricStatus = "good" | "warning" | "critical" | "unknown";

export type StrategyCycleReadinessStatus =
  | "draft"
  | "in_progress"
  | "review_recommended"
  | "ready_for_review";

export type InterpretedMetric = {
  label: string;
  value: number | null;
  displayValue: string;
  status: MetricStatus;
  interpretation: string;
};

export type StrategyCycleActionItem = {
  title: string;
  description: string;
  status: MetricStatus;
  href: string;
};

export type LinkDensityBucketKey = "zero" | "one" | "two_to_three" | "four_plus";

export type LinkDensityItem = {
  id: string;
  label: string;
  linkCount: number;
  linkedDirections: {
    id: string;
    label: string;
  }[];
};

export type LinkDensityBucket = {
  key: LinkDensityBucketKey;
  label: string;
  count: number;
  status: MetricStatus;
  items: LinkDensityItem[];
};

export type LinkDensityDonutModel = {
  title: string;
  description: string;
  total: number;
  buckets: LinkDensityBucket[];
};

export const LINK_DENSITY_BUCKET_COLORS: Record<LinkDensityBucketKey, string> = {
  zero: "#ef4444",
  one: "#f59e0b",
  two_to_three: "#10b981",
  four_plus: "#0ea5e9",
};

export type StrategyCycleDashboardModel = {
  readiness: {
    status: StrategyCycleReadinessStatus;
    label: string;
    description: string;
  };
  managementSummary: {
    title: string;
    bullets: string[];
    ctaHref: string;
    ctaLabel: string;
  };
  designKpis: {
    challengeAnchoring: InterpretedMetric;
    criticalGaps: InterpretedMetric;
    focusConcentration: InterpretedMetric;
    objectiveSupport: InterpretedMetric;
  };
  objectiveReadiness: {
    reviewReady: number;
    unclear: number;
    critical: number;
    label: string;
    portfolioLabel: string;
    portfolioStatus: MetricStatus;
  };
  analysisMaturity: {
    completionRate: number | null;
    label: string;
    status: MetricStatus;
  };
  actionItems: StrategyCycleActionItem[];
  linkDensity: {
    objectivesToDirections: LinkDensityDonutModel;
    challengesToDirections: LinkDensityDonutModel;
  };
};

export type LinkDensityEntityInput = {
  id: string;
  label: string;
};

export type DirectionObjectiveLinkInput = {
  objective_id: string;
  strategic_direction_id: string;
};

export type ChallengeDirectionLinkInput = {
  strategic_challenge_id: string;
  strategic_direction_id: string;
};

export type ObjectiveReadinessInput = {
  ai_objective_score?: number | string | null;
  ai_evaluation_status?: string | null;
};

export type BuildStrategyCycleDashboardModelInput = {
  counts: {
    objectives: number;
    challenges: number;
    directions: number;
    programs: number;
    initiatives: number;
  };
  analysisEntrySummary: AnalysisEntryOverviewStats;
  kpis: StrategicDesignKpis;
  objectives: ObjectiveReadinessInput[];
  objectiveAvgScore: number | null;
  portfolioBalanceScore: number | null;
  linkDensityEntities: {
    objectives: LinkDensityEntityInput[];
    challenges: LinkDensityEntityInput[];
    directions: LinkDensityEntityInput[];
    directionObjectiveLinks: DirectionObjectiveLinkInput[];
    challengeDirectionLinks: ChallengeDirectionLinkInput[];
  };
};

const DESIGN_DASHBOARD_HREF = "/strategy-cycle?l1=strategic-directions&l2=dashboard";
const DESIGN_HREF = "/strategy-cycle?l1=strategic-directions&l2=design";
const CHALLENGES_HREF = "/strategy-cycle?l1=strategic-directions&l2=challenges";
const ANALYSIS_HREF = "/strategy-cycle?l1=corporate-strategy&l2=summary";
const OBJECTIVES_HREF = "/strategy-cycle?l1=objectives";

function finiteNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function metricStatusLabelDe(status: MetricStatus): string {
  switch (status) {
    case "good":
      return "Gut";
    case "warning":
      return "Prüfen";
    case "critical":
      return "Kritisch";
    default:
      return "Keine Daten";
  }
}

export function metricStatusPrefixDe(status: MetricStatus): string {
  switch (status) {
    case "good":
      return "Gut";
    case "warning":
      return "Prüfen";
    case "critical":
      return "Kritisch";
    default:
      return "";
  }
}

export function readinessStatusBadgeClass(status: StrategyCycleReadinessStatus): string {
  switch (status) {
    case "ready_for_review":
      return "border-emerald-300 bg-emerald-50 text-emerald-800";
    case "review_recommended":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "in_progress":
      return "border-red-300 bg-red-50 text-red-800";
    case "draft":
      return "border-zinc-300 bg-zinc-100 text-zinc-600";
    default:
      return "border-zinc-300 bg-zinc-100 text-zinc-600";
  }
}

export function metricStatusBadgeClass(status: MetricStatus): string {
  switch (status) {
    case "good":
      return "border-emerald-300 bg-emerald-50 text-emerald-800";
    case "warning":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "critical":
      return "border-red-300 bg-red-50 text-red-800";
    default:
      return "border-zinc-300 bg-zinc-100 text-zinc-600";
  }
}

export function evaluateChallengeAnchoringStatus(value: number | null): MetricStatus {
  if (value == null) return "unknown";
  if (value >= 80) return "good";
  if (value >= 50) return "warning";
  return "critical";
}

export function evaluateCriticalGapsStatus(value: number | null): MetricStatus {
  if (value == null || !Number.isFinite(value)) return "unknown";
  if (value === 0) return "good";
  if (value <= 2) return "warning";
  return "critical";
}

export function evaluateFocusConcentrationStatus(pct: number | null): MetricStatus {
  if (pct == null) return "unknown";
  if (pct >= 40) return "good";
  if (pct >= 25) return "warning";
  return "critical";
}

export function evaluateObjectiveSupportStatus(pct: number | null): MetricStatus {
  if (pct == null) return "unknown";
  if (pct >= 70) return "good";
  if (pct >= 40) return "warning";
  return "critical";
}

export function evaluateAnalysisMaturityStatus(completionRate: number | null): MetricStatus {
  if (completionRate == null) return "unknown";
  if (completionRate >= 0.8) return "good";
  if (completionRate >= 0.5) return "warning";
  return "critical";
}

function unknownMetric(label: string): InterpretedMetric {
  return {
    label,
    value: null,
    displayValue: "—",
    status: "unknown",
    interpretation: "Noch keine ausreichenden Daten.",
  };
}

function interpretChallengeAnchoring(kpis: StrategicDesignKpis): InterpretedMetric {
  const value = kpis.coverageChallengeShare;
  if (value == null || !Number.isFinite(value)) {
    return unknownMetric("Herausforderungs-Verankerung");
  }
  const status = evaluateChallengeAnchoringStatus(value);
  const prefix = metricStatusPrefixDe(status);
  const interpretation =
    status === "good"
      ? `${prefix} – fast alle Stoßrichtungen sind mit Herausforderungen verbunden.`
      : status === "warning"
        ? `${prefix} – ein Teil der Stoßrichtungen ist noch nicht ausreichend verankert.`
        : `${prefix} – viele Stoßrichtungen fehlen in der Herausforderungs-Verankerung.`;
  return {
    label: "Herausforderungs-Verankerung",
    value,
    displayValue: `${Math.round(value)}%`,
    status,
    interpretation,
  };
}

function interpretCriticalGaps(kpis: StrategicDesignKpis): InterpretedMetric {
  const value = finiteNumber(kpis.criticalGaps);
  if (value == null) {
    return unknownMetric("Kritische Lücken");
  }
  const status = evaluateCriticalGapsStatus(value);
  const prefix = metricStatusPrefixDe(status);
  const interpretation =
    status === "good"
      ? `${prefix} – keine unadressierten strategischen Herausforderungen erkannt.`
      : status === "warning"
        ? `${prefix} – ${value === 1 ? "eine strategische Lücke" : `${value} strategische Lücken`} sollten geprüft werden.`
        : `${prefix} – mehrere strategische Lücken erfordern Aufmerksamkeit.`;
  return {
    label: "Kritische Lücken",
    value,
    displayValue: String(value),
    status,
    interpretation,
  };
}

function interpretFocusConcentration(kpis: StrategicDesignKpis): InterpretedMetric {
  const raw = kpis.focusIndex;
  if (raw == null || !Number.isFinite(raw)) {
    return unknownMetric("Fokus-Konzentration");
  }
  const value = Math.round(raw * 100);
  const status = evaluateFocusConcentrationStatus(value);
  const prefix = metricStatusPrefixDe(status);
  const interpretation =
    status === "good"
      ? `${prefix} – die strategische Energie ist gut konzentriert.`
      : status === "warning"
        ? `${prefix} – Strategie ist möglicherweise breit verteilt.`
        : `${prefix} – mögliche strategische Streuung prüfen.`;
  return {
    label: "Fokus-Konzentration",
    value,
    displayValue: `${value}%`,
    status,
    interpretation,
  };
}

function interpretObjectiveSupport(kpis: StrategicDesignKpis): InterpretedMetric {
  const raw = kpis.objectiveAlignmentMaturity;
  if (raw == null || !Number.isFinite(raw)) {
    return unknownMetric("Zielunterstützung");
  }
  const value = Math.round(raw * 100);
  const status = evaluateObjectiveSupportStatus(value);
  const prefix = metricStatusPrefixDe(status);
  const interpretation =
    status === "good"
      ? `${prefix} – die meisten Ziele sind durch Stoßrichtungen gestützt.`
      : status === "warning"
        ? `${prefix} – ein Teil der Ziele sollte mit Stoßrichtungen verknüpft werden.`
        : `${prefix} – viele Ziele sind noch nicht klar durch Stoßrichtungen gestützt.`;
  return {
    label: "Zielunterstützung",
    value,
    displayValue: `${value}%`,
    status,
    interpretation,
  };
}

export function interpretDesignKpis(kpis: StrategicDesignKpis): StrategyCycleDashboardModel["designKpis"] {
  return {
    challengeAnchoring: interpretChallengeAnchoring(kpis),
    criticalGaps: interpretCriticalGaps(kpis),
    focusConcentration: interpretFocusConcentration(kpis),
    objectiveSupport: interpretObjectiveSupport(kpis),
  };
}

export function evaluateObjectiveReadiness(
  objectives: ObjectiveReadinessInput[],
  portfolioBalanceScore: number | null
): StrategyCycleDashboardModel["objectiveReadiness"] {
  let reviewReady = 0;
  let unclear = 0;
  let critical = 0;

  for (const objective of objectives) {
    const evalStatus = (objective.ai_evaluation_status ?? "").trim();
    const score = finiteNumber(objective.ai_objective_score);

    if (evalStatus === "outdated") {
      unclear += 1;
      continue;
    }

    if (score == null) {
      critical += 1;
      continue;
    }

    if (score >= 3.5) {
      reviewReady += 1;
    } else if (score >= 2.0) {
      unclear += 1;
    } else {
      critical += 1;
    }
  }

  let portfolioLabel: string;
  let portfolioStatus: MetricStatus;
  if (portfolioBalanceScore == null || !Number.isFinite(portfolioBalanceScore)) {
    portfolioLabel = "Portfolio-Balance noch nicht bewertbar";
    portfolioStatus = "unknown";
  } else if (portfolioBalanceScore < 3) {
    portfolioLabel = "Portfolio-Balance unausgewogen";
    portfolioStatus = "warning";
  } else {
    portfolioLabel = "Portfolio-Balance ausgewogen";
    portfolioStatus = "good";
  }

  const label =
    objectives.length === 0
      ? "Noch keine Ziele erfasst"
      : `${reviewReady} reviewfähig · ${unclear} unklar · ${critical} kritisch`;

  return {
    reviewReady,
    unclear,
    critical,
    label,
    portfolioLabel,
    portfolioStatus,
  };
}

export function evaluateAnalysisMaturity(
  summary: AnalysisEntryOverviewStats
): StrategyCycleDashboardModel["analysisMaturity"] {
  if (summary.total <= 0) {
    return {
      completionRate: null,
      label: "Noch keine Analyse-Einträge",
      status: "unknown",
    };
  }

  const completionRate = summary.directEntryCount / summary.total;
  const status = evaluateAnalysisMaturityStatus(completionRate);
  const label =
    status === "good"
      ? "Analysebasis gut"
      : status === "warning"
        ? "Analysebasis im Aufbau"
        : status === "critical"
          ? "Analysebasis unvollständig"
          : "Analysebasis noch nicht bewertbar";

  return { completionRate, label, status };
}

export function evaluateStrategyCycleReadiness(input: {
  counts: BuildStrategyCycleDashboardModelInput["counts"];
  designKpis: StrategyCycleDashboardModel["designKpis"];
  analysisMaturity: StrategyCycleDashboardModel["analysisMaturity"];
}): StrategyCycleDashboardModel["readiness"] {
  const { counts, designKpis, analysisMaturity } = input;
  const metrics = [
    designKpis.challengeAnchoring,
    designKpis.criticalGaps,
    designKpis.focusConcentration,
    designKpis.objectiveSupport,
  ];

  const criticalGapsValue = designKpis.criticalGaps.value;
  const hasCriticalDesignKpi = metrics.some((m) => m.status === "critical");
  const warningCount = metrics.filter((m) => m.status === "warning").length;

  if (counts.objectives === 0 && counts.directions === 0 && counts.challenges === 0) {
    return {
      status: "draft",
      label: "Entwurf",
      description:
        "Der Strategiezyklus ist noch im Aufbau. Erfassen Sie zunächst Ziele, Herausforderungen oder Stoßrichtungen.",
    };
  }

  const analysisIncomplete =
    analysisMaturity.completionRate != null && analysisMaturity.completionRate < 0.5;

  if (hasCriticalDesignKpi || (criticalGapsValue != null && criticalGapsValue > 2) || analysisIncomplete) {
    return {
      status: "in_progress",
      label: "In Bearbeitung",
      description:
        "Der Strategiezyklus enthält noch kritische Lücken oder eine unvollständige Analysebasis. Vor einem Review sollten diese Punkte bearbeitet werden.",
    };
  }

  const readyForReview =
    criticalGapsValue === 0 &&
    designKpis.objectiveSupport.status === "good" &&
    analysisMaturity.status === "good" &&
    !hasCriticalDesignKpi &&
    warningCount <= 1;

  if (readyForReview) {
    return {
      status: "ready_for_review",
      label: "Reviewfähig",
      description:
        "Der Strategiezyklus ist konsistent aufgebaut. Die wesentlichen Design-Kennzahlen und die Analysebasis unterstützen ein strategisches Review.",
    };
  }

  return {
    status: "review_recommended",
    label: "In Bearbeitung – Design Review empfohlen",
    description:
      "Der Strategiezyklus ist weitgehend gefüllt, weist aber noch Verbesserungspotenzial auf. Ein Design Review vor der Freigabe wird empfohlen.",
  };
}

const LINK_DENSITY_BUCKET_LABELS: Record<LinkDensityBucketKey, string> = {
  zero: "0 Verknüpfungen",
  one: "1 Verknüpfung",
  two_to_three: "2–3 Verknüpfungen",
  four_plus: "4+ Verknüpfungen",
};

const LINK_DENSITY_BUCKET_ORDER: LinkDensityBucketKey[] = [
  "zero",
  "one",
  "two_to_three",
  "four_plus",
];

export function linkCountToBucketKey(count: number): LinkDensityBucketKey {
  if (count <= 0) return "zero";
  if (count === 1) return "one";
  if (count <= 3) return "two_to_three";
  return "four_plus";
}

export function objectiveLinkBucketStatus(key: LinkDensityBucketKey): MetricStatus {
  switch (key) {
    case "zero":
      return "critical";
    case "one":
      return "warning";
    case "two_to_three":
      return "good";
    case "four_plus":
      return "warning";
    default:
      return "unknown";
  }
}

export function challengeLinkBucketStatus(key: LinkDensityBucketKey): MetricStatus {
  switch (key) {
    case "zero":
      return "critical";
    case "one":
      return "warning";
    case "two_to_three":
    case "four_plus":
      return "good";
    default:
      return "unknown";
  }
}

export function linkDensityModalTitle(
  objectType: "objective" | "challenge",
  bucket: LinkDensityBucket
): string {
  const noun = objectType === "objective" ? "Ziele" : "Herausforderungen";
  return `${noun} mit ${bucket.label} zu Stoßrichtungen`;
}

function buildDirectionLabelMap(directions: LinkDensityEntityInput[]): Map<string, string> {
  return new Map(directions.map((d) => [d.id, d.label]));
}

function buildLinkDensityDonut(input: {
  title: string;
  description: string;
  entities: LinkDensityEntityInput[];
  linkMap: Map<string, Set<string>>;
  directionLabels: Map<string, string>;
  bucketStatus: (key: LinkDensityBucketKey) => MetricStatus;
}): LinkDensityDonutModel {
  const bucketItems = new Map<LinkDensityBucketKey, LinkDensityItem[]>(
    LINK_DENSITY_BUCKET_ORDER.map((key) => [key, []])
  );

  for (const entity of input.entities) {
    const directionIds = [...(input.linkMap.get(entity.id) ?? new Set<string>())];
    const linkCount = directionIds.length;
    const key = linkCountToBucketKey(linkCount);
    const items = bucketItems.get(key) ?? [];
    items.push({
      id: entity.id,
      label: entity.label,
      linkCount,
      linkedDirections: directionIds.map((id) => ({
        id,
        label: input.directionLabels.get(id) ?? id,
      })),
    });
    bucketItems.set(key, items);
  }

  const buckets: LinkDensityBucket[] = LINK_DENSITY_BUCKET_ORDER.map((key) => ({
    key,
    label: LINK_DENSITY_BUCKET_LABELS[key],
    count: bucketItems.get(key)?.length ?? 0,
    status: input.bucketStatus(key),
    items: bucketItems.get(key) ?? [],
  }));

  return {
    title: input.title,
    description: input.description,
    total: input.entities.length,
    buckets,
  };
}

export function buildLinkDensityModels(input: {
  objectives: LinkDensityEntityInput[];
  challenges: LinkDensityEntityInput[];
  directions: LinkDensityEntityInput[];
  directionObjectiveLinks: DirectionObjectiveLinkInput[];
  challengeDirectionLinks: ChallengeDirectionLinkInput[];
}): StrategyCycleDashboardModel["linkDensity"] {
  const directionLabels = buildDirectionLabelMap(input.directions);

  const objectiveToDirections = new Map<string, Set<string>>();
  for (const link of input.directionObjectiveLinks) {
    const current = objectiveToDirections.get(link.objective_id) ?? new Set<string>();
    current.add(link.strategic_direction_id);
    objectiveToDirections.set(link.objective_id, current);
  }

  const challengeToDirections = new Map<string, Set<string>>();
  for (const link of input.challengeDirectionLinks) {
    const current = challengeToDirections.get(link.strategic_challenge_id) ?? new Set<string>();
    current.add(link.strategic_direction_id);
    challengeToDirections.set(link.strategic_challenge_id, current);
  }

  return {
    objectivesToDirections: buildLinkDensityDonut({
      title: "Ziele nach Stoßrichtungs-Verknüpfungen",
      description: "Wie stark sind strategische Ziele durch Stoßrichtungen unterstützt?",
      entities: input.objectives,
      linkMap: objectiveToDirections,
      directionLabels,
      bucketStatus: objectiveLinkBucketStatus,
    }),
    challengesToDirections: buildLinkDensityDonut({
      title: "Herausforderungen nach Stoßrichtungs-Verknüpfungen",
      description: "Welche Herausforderungen sind durch Stoßrichtungen adressiert?",
      entities: input.challenges,
      linkMap: challengeToDirections,
      directionLabels,
      bucketStatus: challengeLinkBucketStatus,
    }),
  };
}

export function buildManagementSummary(input: {
  readiness: StrategyCycleDashboardModel["readiness"];
  designKpis: StrategyCycleDashboardModel["designKpis"];
  objectiveReadiness: StrategyCycleDashboardModel["objectiveReadiness"];
  analysisMaturity: StrategyCycleDashboardModel["analysisMaturity"];
  analysisEntrySummary: AnalysisEntryOverviewStats;
  linkDensity: StrategyCycleDashboardModel["linkDensity"];
}): StrategyCycleDashboardModel["managementSummary"] {
  const bullets: string[] = [];

  if (input.designKpis.criticalGaps.status === "good") {
    bullets.push("Keine kritischen strategischen Lücken erkannt.");
  } else if (input.designKpis.criticalGaps.status === "warning") {
    bullets.push(
      `${input.designKpis.criticalGaps.displayValue} kritische Lücke(n) sollten vor einem Review geprüft werden.`
    );
  } else if (input.designKpis.criticalGaps.status === "critical") {
    bullets.push("Mehrere kritische strategische Lücken erfordern Aufmerksamkeit.");
  }

  if (input.designKpis.challengeAnchoring.status !== "unknown") {
    bullets.push(
      `${input.designKpis.challengeAnchoring.displayValue} der Stoßrichtungen sind mit Herausforderungen verankert (${metricStatusLabelDe(input.designKpis.challengeAnchoring.status).toLowerCase()}).`
    );
  }

  if (input.designKpis.objectiveSupport.status === "critical") {
    bullets.push(
      `Die Zielunterstützung liegt bei ${input.designKpis.objectiveSupport.displayValue} und sollte geprüft werden.`
    );
  } else if (input.designKpis.objectiveSupport.status === "warning") {
    bullets.push(
      `Die Zielunterstützung liegt bei ${input.designKpis.objectiveSupport.displayValue}; Verknüpfungen zwischen Zielen und Stoßrichtungen prüfen.`
    );
  } else if (input.designKpis.objectiveSupport.status === "good") {
    bullets.push("Die Zielunterstützung durch Stoßrichtungen ist gut.");
  }

  if (input.designKpis.focusConcentration.status === "warning") {
    bullets.push(
      `Die Fokus-Konzentration liegt bei ${input.designKpis.focusConcentration.displayValue}; mögliche strategische Streuung prüfen.`
    );
  } else if (input.designKpis.focusConcentration.status === "critical") {
    bullets.push(
      `Die Fokus-Konzentration liegt bei ${input.designKpis.focusConcentration.displayValue} und deutet auf breite Verteilung hin.`
    );
  } else if (input.designKpis.focusConcentration.status === "good") {
    bullets.push("Die Fokus-Konzentration zeigt eine klare strategische Schwerpunktsetzung.");
  }

  if (input.objectiveReadiness.critical > 0) {
    bullets.push(
      `${input.objectiveReadiness.critical} Ziel(e) mit kritischem Reifegrad — Zielqualität prüfen.`
    );
  }

  if (input.analysisMaturity.status === "warning" || input.analysisMaturity.status === "critical") {
    bullets.push(
      `${input.analysisEntrySummary.directEntryCount} von ${input.analysisEntrySummary.total} Analyse-Einträgen sind mit Herausforderungen verknüpft; Analysebasis vervollständigen.`
    );
  }

  const objectivesWithoutLinks = input.linkDensity.objectivesToDirections.buckets.find(
    (b) => b.key === "zero"
  )?.count;
  if (objectivesWithoutLinks != null && objectivesWithoutLinks > 0) {
    bullets.push(
      `${objectivesWithoutLinks} strategische Ziel(e) haben noch keine Verknüpfung zu Stoßrichtungen.`
    );
  }

  const challengesWithoutLinks = input.linkDensity.challengesToDirections.buckets.find(
    (b) => b.key === "zero"
  )?.count;
  if (challengesWithoutLinks != null && challengesWithoutLinks > 0) {
    bullets.push(
      `${challengesWithoutLinks} Herausforderung(en) sind noch nicht durch Stoßrichtungen adressiert.`
    );
  }

  if (bullets.length === 0) {
    bullets.push(input.readiness.description);
  }

  return {
    title: "Management Summary",
    bullets: bullets.slice(0, 5),
    ctaHref: DESIGN_DASHBOARD_HREF,
    ctaLabel: "Zum Strategischen Design",
  };
}

const ACTION_STATUS_ORDER: Record<MetricStatus, number> = {
  critical: 0,
  warning: 1,
  unknown: 2,
  good: 3,
};

export function buildStrategyCycleActionItems(input: {
  designKpis: StrategyCycleDashboardModel["designKpis"];
  objectiveReadiness: StrategyCycleDashboardModel["objectiveReadiness"];
  analysisMaturity: StrategyCycleDashboardModel["analysisMaturity"];
  analysisEntrySummary: AnalysisEntryOverviewStats;
  linkDensity: StrategyCycleDashboardModel["linkDensity"];
}): StrategyCycleActionItem[] {
  const items: StrategyCycleActionItem[] = [];

  const objectivesZero =
    input.linkDensity.objectivesToDirections.buckets.find((b) => b.key === "zero")?.count ?? 0;
  if (objectivesZero > 0) {
    items.push({
      title: "Ziele ohne Stoßrichtungsbezug prüfen",
      description: `${objectivesZero} strategische Ziel(e) haben keine Verknüpfung zu Stoßrichtungen.`,
      status: "critical",
      href: OBJECTIVES_HREF,
    });
  }

  const challengesZero =
    input.linkDensity.challengesToDirections.buckets.find((b) => b.key === "zero")?.count ?? 0;
  if (challengesZero > 0) {
    items.push({
      title: "Herausforderungen ohne Stoßrichtungsbezug prüfen",
      description: `${challengesZero} Herausforderung(en) sind durch keine Stoßrichtung adressiert.`,
      status: "critical",
      href: CHALLENGES_HREF,
    });
  }

  const objectivesFourPlus =
    input.linkDensity.objectivesToDirections.buckets.find((b) => b.key === "four_plus")?.count ?? 0;
  if (objectivesFourPlus > 0) {
    items.push({
      title: "Ziel-Fokus prüfen",
      description: `${objectivesFourPlus} Ziel(e) mit 4+ Stoßrichtungs-Verknüpfungen — mögliche Überladung prüfen.`,
      status: "warning",
      href: DESIGN_HREF,
    });
  }

  if (
    input.designKpis.objectiveSupport.status === "critical" ||
    input.designKpis.objectiveSupport.status === "warning"
  ) {
    items.push({
      title: "Zielunterstützung erhöhen",
      description: `Nur ${input.designKpis.objectiveSupport.displayValue} der Ziele sind klar durch Stoßrichtungen gestützt. Bitte Ziel-Stoßrichtungs-Verknüpfungen prüfen.`,
      status: input.designKpis.objectiveSupport.status,
      href: DESIGN_HREF,
    });
  }

  if (
    input.designKpis.focusConcentration.status === "critical" ||
    input.designKpis.focusConcentration.status === "warning"
  ) {
    items.push({
      title: "Fokus prüfen",
      description: `Die Fokus-Konzentration liegt bei ${input.designKpis.focusConcentration.displayValue}. Prüfen, ob zu viele Stoßrichtungen parallel verfolgt werden.`,
      status: input.designKpis.focusConcentration.status,
      href: DESIGN_HREF,
    });
  }

  if (
    input.designKpis.criticalGaps.status === "critical" ||
    input.designKpis.criticalGaps.status === "warning"
  ) {
    items.push({
      title: "Kritische Lücken schließen",
      description: `${input.designKpis.criticalGaps.displayValue} strategische Lücke(n) ohne ausreichende Stoßrichtungs-Verankerung. Herausforderungen und Stoßrichtungen abstimmen.`,
      status: input.designKpis.criticalGaps.status,
      href: CHALLENGES_HREF,
    });
  }

  if (
    input.designKpis.challengeAnchoring.status === "critical" ||
    input.designKpis.challengeAnchoring.status === "warning"
  ) {
    items.push({
      title: "Herausforderungs-Verankerung stärken",
      description: `Nur ${input.designKpis.challengeAnchoring.displayValue} der Stoßrichtungen sind mit Herausforderungen verankert. Verknüpfungen im strategischen Design prüfen.`,
      status: input.designKpis.challengeAnchoring.status,
      href: DESIGN_HREF,
    });
  }

  if (input.analysisMaturity.status === "critical" || input.analysisMaturity.status === "warning") {
    items.push({
      title: "Analysebasis vervollständigen",
      description: `${input.analysisEntrySummary.directEntryCount} von ${input.analysisEntrySummary.total} Analyse-Einträgen sind vorhanden. Weitere strategische Erkenntnisse ergänzen.`,
      status: input.analysisMaturity.status,
      href: ANALYSIS_HREF,
    });
  }

  if (input.objectiveReadiness.critical > 0 || input.objectiveReadiness.unclear > 0) {
    items.push({
      title: "Zielqualität prüfen",
      description: `${input.objectiveReadiness.label}. Sentinel-Bewertungen und Zieldefinitionen überarbeiten.`,
      status: input.objectiveReadiness.critical > 0 ? "critical" : "warning",
      href: OBJECTIVES_HREF,
    });
  }

  if (input.objectiveReadiness.portfolioStatus === "warning") {
    items.push({
      title: "Portfolio-Balance ausgleichen",
      description: input.objectiveReadiness.portfolioLabel,
      status: "warning",
      href: OBJECTIVES_HREF,
    });
  }

  return items
    .sort((a, b) => ACTION_STATUS_ORDER[a.status] - ACTION_STATUS_ORDER[b.status])
    .slice(0, 5);
}

export function buildStrategyCycleDashboardModel(
  input: BuildStrategyCycleDashboardModelInput
): StrategyCycleDashboardModel {
  const designKpis = interpretDesignKpis(input.kpis);
  const objectiveReadiness = evaluateObjectiveReadiness(
    input.objectives,
    input.portfolioBalanceScore
  );
  const analysisMaturity = evaluateAnalysisMaturity(input.analysisEntrySummary);
  const linkDensity = buildLinkDensityModels(input.linkDensityEntities);
  const readiness = evaluateStrategyCycleReadiness({
    counts: input.counts,
    designKpis,
    analysisMaturity,
  });
  const managementSummary = buildManagementSummary({
    readiness,
    designKpis,
    objectiveReadiness,
    analysisMaturity,
    analysisEntrySummary: input.analysisEntrySummary,
    linkDensity,
  });
  const actionItems = buildStrategyCycleActionItems({
    designKpis,
    objectiveReadiness,
    analysisMaturity,
    analysisEntrySummary: input.analysisEntrySummary,
    linkDensity,
  });

  return {
    readiness,
    managementSummary,
    designKpis,
    objectiveReadiness,
    analysisMaturity,
    actionItems,
    linkDensity,
  };
}
