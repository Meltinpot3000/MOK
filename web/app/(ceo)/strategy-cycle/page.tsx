import { redirect } from "next/navigation";
import {
  approveLinkDraft,
  attachFindingToChallenge,
  createStrategicChallengeInCycle,
  createPipInitiativeInCycle,
  createStrategyProgramInCycle,
  createAnalysisEntry,
  createStrategicDirectionInCycle,
  backfillEntryQuality,
  dismissChallengeCandidate,
  deleteAnalysisEntry,
  generateLinkDrafts,
  linkDirectionToChallengePredecessor,
  linkDirectionToClusterInCycle,
  linkDirectionToGapInCycle,
  linkDirectionToObjectiveInCycle,
  linkInitiativeToTargetPredecessor,
  promoteChallengeCandidate,
  promoteClusterToStrategicChallenge,
  promoteToStrategicChallenge,
  recomputeClusters,
  recomputeGraphLayout,
  recomputeGaps,
  rejectLinkDraft,
  saveStrategyReferenceText,
  saveClusterObjectiveRelation,
  linkStrategicChallengeToBusinessModelInCycle,
  linkStrategicChallengeToIndustryInCycle,
  linkStrategicDirectionToBusinessModelInCycle,
  linkStrategicDirectionToIndustryInCycle,
  unlinkStrategicChallengeFromBusinessModelInCycle,
  unlinkStrategicChallengeFromIndustryInCycle,
  unlinkStrategicDirectionFromBusinessModelInCycle,
  unlinkStrategicDirectionFromIndustryInCycle,
  unlinkDirectionChallengePredecessor,
  unlinkDirectionFromClusterInCycle,
  unlinkDirectionFromGapInCycle,
  unlinkDirectionFromObjectiveInCycle,
  unlinkInitiativeTargetPredecessor,
  updateStrategicChallengeAssessment,
  updateStrategicDirectionAssessment,
  updateAnalysisEntry,
} from "@/app/(ceo)/strategy-cycle/actions";
import StrategyMatrixPage from "@/app/(ceo)/strategy-matrix/page";
import { AnalysisVisualizationWorkspace } from "@/components/analysis-visualization/AnalysisVisualizationWorkspace";
import { AiWaitOverlay } from "@/components/ceo/AiWaitOverlay";
import { LiveRangeInput } from "@/components/ceo/LiveRangeInput";
import { getTenantBranding } from "@/lib/ceo/queries";
import { getActivePlanningCycle, getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { readStrategyReferenceFieldsFromBrandingConfig } from "@/lib/strategy-cycle/strategy-reference";
import { getStrategyCycleWorkspaceData } from "@/lib/strategy-cycle/queries";

type StrategyCycleViewPageProps = {
  searchParams: Promise<{
    l1?: string;
    l2?: string;
    tab?: string;
    drawer_direction_id?: string;
    error?: string;
    success?: string;
    sort?: string;
    min_score?: string;
    quality_band?: string;
  }>;
};

const STRATEGY_CYCLE_TABS = [
  "summary",
  "strategy-matrix",
  "environment",
  "company",
  "competitor",
  "swot",
  "workshop",
  "other",
] as const;

const L1_TABS = [
  "mission-vision-culture-values",
  "corporate-strategy",
  "strategic-directions",
  "pips",
] as const;

const ANALYSIS_TYPES = [
  "environment",
  "company",
  "competitor",
  "swot",
  "workshop",
  "other",
] as const;

const SWOT_SUB_TYPES = ["strength", "weakness", "opportunity", "threat"] as const;
const PESTEL_AREA_META: Array<{ key: string; label: string; tintPercent: number }> = [
  { key: "political", label: "Political", tintPercent: 12 },
  { key: "economic", label: "Economic", tintPercent: 20 },
  { key: "social", label: "Social", tintPercent: 28 },
  { key: "technological", label: "Technological", tintPercent: 36 },
  { key: "ecological", label: "Ecological", tintPercent: 44 },
  { key: "legal", label: "Legal", tintPercent: 52 },
];

function getTabTitle(tab: string) {
  switch (tab) {
    case "summary":
      return "Zusammenfassung";
    case "strategy-matrix":
      return "Strategie-Matrix";
    case "environment":
      return "Umfeldanalyse";
    case "company":
      return "Unternehmensanalyse";
    case "competitor":
      return "Wettbewerbsanalyse";
    case "swot":
      return "SWOT";
    case "workshop":
      return "Workshop-Erkenntnisse";
    default:
      return "Sonstige Analyse";
  }
}

function getL1TabTitle(tab: string) {
  switch (tab) {
    case "mission-vision-culture-values":
      return "Mission, Vision, Kultur & Werte";
    case "corporate-strategy":
      return "Unternehmensstrategie";
    case "strategic-directions":
      return "Strategische Stossrichtungen";
    case "pips":
      return "PIPs";
    default:
      return "Unternehmensstrategie";
  }
}

function getStGallenHint(tab: string) {
  if (tab === "summary")
    return "Strategische Gesamtsicht mit Netzwerk und Tabellen-Scan aller Analysepunkte.";
  if (tab === "strategy-matrix")
    return "Matrix zur Ausrichtung von strategischen Herausforderungen, Stossrichtungen und Jahreszielen.";
  if (tab === "environment") return "St. Gallen: Umwelt-Sphaeren und Anspruchsgruppen systematisch erfassen.";
  if (tab === "company") return "St. Gallen: interne Faehigkeiten, Ressourcen und Prozesse bewerten.";
  if (tab === "competitor") return "St. Gallen: Wettbewerbsposition und Differenzierungskraefte analysieren.";
  if (tab === "swot") return "St. Gallen: interne/ externe Faktoren als S-W-O-T verdichten.";
  return "Strategische Befunde strukturiert dokumentieren und priorisieren.";
}

function isPestelSubType(value: string | null | undefined) {
  if (!value) return false;
  return PESTEL_AREA_META.some((item) => item.key === value);
}

function getPestelAreaStyle(subType: string | null | undefined) {
  const area = PESTEL_AREA_META.find((item) => item.key === subType);
  if (!area) return null;
  const tint = area.tintPercent;
  return {
    label: area.label,
    style: {
      background: `color-mix(in srgb, var(--brand-primary) ${tint}%, white)`,
      borderColor: `color-mix(in srgb, var(--brand-primary) ${Math.min(tint + 18, 72)}%, white)`,
      color: "color-mix(in srgb, var(--brand-secondary) 78%, #27272a)",
    },
  };
}

function getStatusMessage(error: string | undefined, success: string | undefined) {
  if (error === "missing-title")
    return { type: "error", text: "Bitte einen Titel erfassen." };
  if (error === "invalid-impact")
    return { type: "error", text: "Wirkung muss zwischen 1 und 5 liegen." };
  if (error === "invalid-uncertainty")
    return { type: "error", text: "Unsicherheits-Score muss zwischen 1 und 5 liegen." };
  if (error === "high-impact-justification")
    return {
      type: "error",
      text: "Bei hoher Wirkung (4-5) braucht es eine belastbare Begruendung (mind. 40 Zeichen).",
    };
  if (error === "invalid-subtype")
    return { type: "error", text: "Der Sub-Typ passt nicht zum ausgewaehlten Analysebereich." };
  if (error === "not-found")
    return { type: "error", text: "Analyse-Eintrag wurde nicht gefunden oder ist nicht mehr verfuegbar." };
  if (error === "missing-link")
    return { type: "error", text: "Bitte gueltige Verknuepfung auswaehlen." };
  if (success === "saved")
    return { type: "success", text: "Analyse-Eintrag wurde gespeichert." };
  if (success === "updated")
    return { type: "success", text: "Analyse-Eintrag wurde aktualisiert." };
  if (success === "deleted")
    return { type: "success", text: "Analyse-Eintrag wurde geloescht." };
  if (success === "promoted")
    return { type: "success", text: "Eintrag wurde als strategische Herausforderung in die Matrix uebernommen." };
  if (success === "links-generated")
    return { type: "success", text: "Link-Entwuerfe wurden neu generiert." };
  if (success === "link-approved")
    return { type: "success", text: "Link-Entwurf wurde freigegeben." };
  if (success === "link-rejected")
    return { type: "success", text: "Link-Entwurf wurde verworfen." };
  if (success === "clusters-recomputed")
    return { type: "success", text: "Cluster wurden neu berechnet." };
  if (success === "gaps-recomputed")
    return { type: "success", text: "Lueckenanalyse wurde neu berechnet." };
  if (success === "graph-layout-recomputed")
    return { type: "success", text: "Graph-Layout wurde neu berechnet." };
  if (success === "quality-backfilled")
    return { type: "success", text: "Bestehende Analysepunkte wurden neu bewertet und im Graph aktualisiert." };
  if (success === "graph-layout-queued")
    return { type: "success", text: "Graph-Layout Job wurde gestartet und laeuft im Hintergrund." };
  if (success === "quality-backfill-queued")
    return { type: "success", text: "Quality-Backfill Job wurde gestartet und laeuft im Hintergrund." };
  if (success === "cluster-promoted")
    return { type: "success", text: "Cluster wurde als strategische Herausforderung uebernommen." };
  if (success === "finding-linked")
    return { type: "success", text: "Befund wurde einer bestehenden Herausforderung zugeordnet." };
  if (success === "direction-created")
    return { type: "success", text: "Strategische Stossrichtung wurde erstellt." };
  if (success === "challenge-created")
    return { type: "success", text: "Strategische Herausforderung wurde erstellt." };
  if (success === "initiative-created")
    return { type: "success", text: "PIP wurde erstellt." };
  if (success === "program-created")
    return { type: "success", text: "Programm wurde erstellt." };
  if (success === "assessment-updated")
    return { type: "success", text: "Relevanz- und Risiko-Bewertung wurde gespeichert." };
  if (success === "linked")
    return { type: "success", text: "Predecessor-Verknuepfung wurde gespeichert." };
  if (success === "unlinked")
    return { type: "success", text: "Predecessor-Verknuepfung wurde entfernt." };
  if (success === "strategy-reference-saved")
    return { type: "success", text: "Mission, Vision, Kultur und Werte wurden gespeichert." };
  return null;
}

function getPriorityZone(impact: number | null, uncertainty: number | null) {
  const i = impact ?? 3;
  const u = uncertainty ?? 3;
  if (i >= 4 && u <= 2) return "Sofortiger strategischer Hebel";
  if (i >= 4 && u >= 3) return "Strategische Wette (Unsicherheit managen)";
  if (i <= 2 && u >= 4) return "Beobachten / Monitoring";
  return "Weiter analysieren / priorisieren";
}

function getMatrixCellClass(score: number) {
  if (score >= 75) return "border-emerald-300 bg-emerald-50 text-emerald-900";
  if (score >= 50) return "border-amber-300 bg-amber-50 text-amber-900";
  if (score >= 25) return "border-zinc-300 bg-zinc-100 text-zinc-800";
  return "border-zinc-200 bg-white text-zinc-700";
}

function getQualityBandLabel(band: string) {
  if (band === "high") return "Hohe Qualitaet";
  if (band === "medium") return "Mittlere Qualitaet";
  return "Niedrige Qualitaet";
}

function deriveQualityBand(score: number): "high" | "medium" | "low" {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function readTriScores(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const tri = (metadata as Record<string, unknown>).triScores;
  if (!tri || typeof tri !== "object") return null;
  const row = tri as Record<string, unknown>;
  const proximityScore = Number(row.proximityScore ?? 0);
  const supportScore = Number(row.supportScore ?? 0);
  const repulsionScore = Number(row.repulsionScore ?? 0);
  if (!Number.isFinite(proximityScore) || !Number.isFinite(supportScore) || !Number.isFinite(repulsionScore)) {
    return null;
  }
  return {
    proximityScore: Math.max(0, Math.min(1, proximityScore)),
    supportScore: Math.max(0, Math.min(1, supportScore)),
    repulsionScore: Math.max(0, Math.min(1, repulsionScore)),
  };
}

export default async function StrategyCycleViewPage({ searchParams }: StrategyCycleViewPageProps) {
  const resolvedSearchParams = await searchParams;
  const legacyTab = resolvedSearchParams.tab;
  const requestedL1 = String(resolvedSearchParams.l1 ?? "").trim();
  const requestedL2 = String(resolvedSearchParams.l2 ?? legacyTab ?? "summary").trim();
  const activeL1 = L1_TABS.includes(requestedL1 as (typeof L1_TABS)[number])
    ? requestedL1
    : legacyTab
      ? "corporate-strategy"
      : "mission-vision-culture-values";
  const activeTab =
    activeL1 === "corporate-strategy" &&
    STRATEGY_CYCLE_TABS.includes(requestedL2 as (typeof STRATEGY_CYCLE_TABS)[number])
      ? requestedL2
      : "summary";
  const actionTab = ANALYSIS_TYPES.includes(activeTab as (typeof ANALYSIS_TYPES)[number]) ? activeTab : "environment";

  const pageAccess = await getSidebarAccessContext("strategy-cycle");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");
  const canWrite = pageAccess.canWrite;

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  const selectedCycle = await getActivePlanningCycle(context.organizationId);

  if (!selectedCycle) {
    return (
      <section className="brand-card p-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Strategiezyklus</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Kein Planungszyklus vorhanden. Bitte zuerst einen Zyklus anlegen.
        </p>
      </section>
    );
  }

  const workspace = await getStrategyCycleWorkspaceData(context.organizationId, selectedCycle.id);
  const branding = await getTenantBranding(context.organizationId);
  const strategyReferenceFields = readStrategyReferenceFieldsFromBrandingConfig(branding?.branding_config ?? null);
  const entries = ANALYSIS_TYPES.includes(activeTab as (typeof ANALYSIS_TYPES)[number])
    ? workspace.grouped[activeTab as keyof typeof workspace.grouped] ?? []
    : [];
  const sort = resolvedSearchParams.sort === "updated_desc" ? "updated_desc" : "score_desc";
  const minScoreRaw = Number(resolvedSearchParams.min_score ?? "0");
  const minScore = Number.isFinite(minScoreRaw) ? Math.max(0, Math.min(100, minScoreRaw)) : 0;
  const qualityBandFilter =
    resolvedSearchParams.quality_band === "high" ||
    resolvedSearchParams.quality_band === "medium" ||
    resolvedSearchParams.quality_band === "low"
      ? resolvedSearchParams.quality_band
      : "all";

  const enrichedAllEntries = workspace.entries.map((entry) => {
    const qualityScore =
      typeof entry.quality_score === "number" && Number.isFinite(entry.quality_score)
        ? entry.quality_score
        : 0;
    return {
      ...entry,
      qualityScore,
      qualityBand: entry.quality_band ?? deriveQualityBand(qualityScore),
      qualitySource: entry.quality_source ?? "rule",
      qualityExplanation: entry.quality_explanation ?? null,
    };
  });
  const activeEntryIds = new Set(entries.map((entry) => entry.id));
  const enrichedEntries = enrichedAllEntries.filter((entry) => activeEntryIds.has(entry.id));

  const filteredEntries = enrichedEntries
    .filter((entry) => entry.qualityScore >= minScore)
    .filter((entry) => (qualityBandFilter === "all" ? true : entry.qualityBand === qualityBandFilter))
    .sort((a, b) => {
      if (sort === "updated_desc") return b.updated_at.localeCompare(a.updated_at);
      return b.qualityScore - a.qualityScore;
    });

  const statusMessage = getStatusMessage(resolvedSearchParams.error, resolvedSearchParams.success);
  const challengeOptions = (workspace.existingChallenges ?? [])
    .map((challenge) => ({
      id: challenge.id,
      title: challenge.title,
      sourceAnalysisEntryId: challenge.source_analysis_entry_id ?? null,
    }))
    .filter((item, index, all) => all.findIndex((x) => x.id === item.id) === index);
  const challengeIdsByDirection = new Map<string, string[]>();
  for (const link of workspace.challengeDirectionLinks ?? []) {
    const current = challengeIdsByDirection.get(link.strategic_direction_id) ?? [];
    current.push(link.strategic_challenge_id);
    challengeIdsByDirection.set(link.strategic_direction_id, current);
  }
  const clusterIdsByDirection = new Map<string, string[]>();
  for (const link of workspace.directionClusterLinks ?? []) {
    const current = clusterIdsByDirection.get(link.strategic_direction_id) ?? [];
    current.push(link.cluster_id);
    clusterIdsByDirection.set(link.strategic_direction_id, current);
  }
  const objectiveIdsByDirection = new Map<string, string[]>();
  for (const link of workspace.directionObjectiveLinks ?? []) {
    const current = objectiveIdsByDirection.get(link.strategic_direction_id) ?? [];
    current.push(link.objective_id);
    objectiveIdsByDirection.set(link.strategic_direction_id, current);
  }
  const gapRelationIdsByDirection = new Map<string, string[]>();
  for (const link of workspace.directionGapLinks ?? []) {
    const current = gapRelationIdsByDirection.get(link.strategic_direction_id) ?? [];
    current.push(link.cluster_objective_relation_id);
    gapRelationIdsByDirection.set(link.strategic_direction_id, current);
  }
  const objectiveById = new Map(
    (workspace.objectives ?? []).map((objective) => [objective.id, objective] as const)
  );
  const clusterById = new Map((workspace.clusters ?? []).map((cluster) => [cluster.id, cluster] as const));
  const relationByClusterObjective = new Map<string, { id: string; relationStrength: number; gapScore: number }>();
  for (const relation of workspace.clusterObjectiveRelations ?? []) {
    relationByClusterObjective.set(`${relation.cluster_id}:${relation.objective_id}`, {
      id: relation.id,
      relationStrength: Number(relation.relation_strength ?? 0),
      gapScore: Number(relation.gap_score ?? 0),
    });
  }
  const directionCountByChallengeId = new Map<string, number>();
  for (const link of workspace.challengeDirectionLinks ?? []) {
    directionCountByChallengeId.set(
      link.strategic_challenge_id,
      (directionCountByChallengeId.get(link.strategic_challenge_id) ?? 0) + 1
    );
  }
  const directionIndustryIdsById = new Map<string, string[]>();
  for (const row of workspace.directionIndustries ?? []) {
    const current = directionIndustryIdsById.get(row.strategic_direction_id) ?? [];
    current.push(row.industry_id);
    directionIndustryIdsById.set(row.strategic_direction_id, current);
  }
  const directionBusinessModelIdsById = new Map<string, string[]>();
  for (const row of workspace.directionBusinessModels ?? []) {
    const current = directionBusinessModelIdsById.get(row.strategic_direction_id) ?? [];
    current.push(row.business_model_id);
    directionBusinessModelIdsById.set(row.strategic_direction_id, current);
  }
  const challengeIndustryIdsById = new Map<string, string[]>();
  for (const row of workspace.challengeIndustries ?? []) {
    const current = challengeIndustryIdsById.get(row.strategic_challenge_id) ?? [];
    current.push(row.industry_id);
    challengeIndustryIdsById.set(row.strategic_challenge_id, current);
  }
  const challengeBusinessModelIdsById = new Map<string, string[]>();
  for (const row of workspace.challengeBusinessModels ?? []) {
    const current = challengeBusinessModelIdsById.get(row.strategic_challenge_id) ?? [];
    current.push(row.business_model_id);
    challengeBusinessModelIdsById.set(row.strategic_challenge_id, current);
  }
  const targetIdsByInitiative = new Map<string, string[]>();
  for (const link of workspace.initiativeTargetLinks ?? []) {
    const current = targetIdsByInitiative.get(link.initiative_id) ?? [];
    current.push(link.annual_target_id);
    targetIdsByInitiative.set(link.initiative_id, current);
  }
  const programsByDirectionId = new Map<string, Array<{ id: string; title: string }>>();
  for (const program of workspace.programs ?? []) {
    const directionId = String(program.strategic_direction_id ?? "");
    if (!directionId) continue;
    const current = programsByDirectionId.get(directionId) ?? [];
    current.push({ id: program.id, title: program.title });
    programsByDirectionId.set(directionId, current);
  }
  const directionById = new Map(
    (workspace.strategicDirections ?? []).map((direction) => [direction.id, direction] as const)
  );
  const topChallenges = [...(workspace.challenges ?? [])]
    .sort((a, b) => Number(b.challenge_score ?? 0) - Number(a.challenge_score ?? 0))
    .slice(0, 5);
  const topDirections = [...(workspace.strategicDirections ?? [])]
    .sort((a, b) => Number(b.direction_score ?? 0) - Number(a.direction_score ?? 0))
    .slice(0, 5);
  const uncoveredChallenges = (workspace.challenges ?? []).filter(
    (challenge) => (directionCountByChallengeId.get(challenge.id) ?? 0) === 0
  );
  const challengeHeatmapCounts = new Map<string, number>();
  for (const challenge of workspace.challenges ?? []) {
    const impact = Math.max(1, Math.min(5, Number(challenge.impact_score ?? 3)));
    const urgency = Math.max(1, Math.min(5, Number(challenge.urgency_score ?? 3)));
    const key = `${impact}:${urgency}`;
    challengeHeatmapCounts.set(key, (challengeHeatmapCounts.get(key) ?? 0) + 1);
  }
  const entryDimensionsRecord = Object.fromEntries(workspace.entryDimensionsByEntryId.entries());
  const entryDirectionIdsRecord = Object.fromEntries(workspace.entryDirectionIdsByEntryId.entries());
  const promotedEntryIds = [...workspace.promotedBySourceId.keys()];
  const llmLayoutByEntryId: Record<
    string,
    { x: number; y: number; z: number; confidence: number; reason?: string }
  > = Object.fromEntries(
    enrichedAllEntries
      .filter(
        (entry) =>
          typeof entry.graph_layout_x === "number" &&
          typeof entry.graph_layout_y === "number" &&
          typeof entry.graph_layout_z === "number"
      )
      .map((entry) => [
        entry.id,
        {
          x: entry.graph_layout_x as number,
          y: entry.graph_layout_y as number,
          z: entry.graph_layout_z as number,
          confidence:
            typeof entry.graph_layout_confidence === "number" ? entry.graph_layout_confidence : 0.5,
          reason: entry.graph_layout_reason ?? undefined,
        },
      ])
  );
  const graphLayoutLlmCount = enrichedAllEntries.filter((entry) => entry.graph_layout_source === "llm").length;
  const graphLayoutRuleCount = enrichedAllEntries.filter((entry) => entry.graph_layout_source === "rule").length;
  const activeOrFailedJobs = (workspace.backgroundJobs ?? []).filter(
    (job) => job.status === "pending" || job.status === "running" || job.status === "failed"
  );
  const runningJobs = activeOrFailedJobs.filter((job) => job.status === "pending" || job.status === "running");
  const hasRunningQualityBackfill = runningJobs.some((job) => job.job_type === "quality_backfill");
  const hasRunningGraphLayout = runningJobs.some((job) => job.job_type === "graph_layout_recompute");
  const contributionWeightByPair = new Map<string, number>();
  for (const link of workspace.challengeDirectionLinks ?? []) {
    const key = `${link.strategic_challenge_id}:${link.strategic_direction_id}`;
    const contribution = String((link as { contribution_level?: string }).contribution_level ?? "medium");
    const weight = contribution === "high" ? 3 : contribution === "low" ? 1 : 2;
    contributionWeightByPair.set(key, weight);
  }
  const strategicMatrixRows = (workspace.challenges ?? []).map((challenge) => {
    const challengeScore = Number(challenge.challenge_score ?? 0);
    const challengeIndustrySet = new Set(challengeIndustryIdsById.get(challenge.id) ?? []);
    const challengeBusinessModelSet = new Set(challengeBusinessModelIdsById.get(challenge.id) ?? []);
    const cells = (workspace.strategicDirections ?? []).map((direction) => {
      const pairKey = `${challenge.id}:${direction.id}`;
      const isLinked = contributionWeightByPair.has(pairKey);
      const contributionWeight = contributionWeightByPair.get(pairKey) ?? 0;
      const directionScore = Number(direction.direction_score ?? 0);
      const normalizedScore = Math.min(1, (challengeScore + directionScore) / 10);
      const directionIndustrySet = new Set(directionIndustryIdsById.get(direction.id) ?? []);
      const directionBusinessModelSet = new Set(directionBusinessModelIdsById.get(direction.id) ?? []);
      const industryOverlap = [...challengeIndustrySet].filter((id) => directionIndustrySet.has(id)).length;
      const businessOverlap = [...challengeBusinessModelSet].filter((id) => directionBusinessModelSet.has(id)).length;
      const overlapTotal =
        Math.max(challengeIndustrySet.size, directionIndustrySet.size) +
        Math.max(challengeBusinessModelSet.size, directionBusinessModelSet.size);
      const overlapRatio = overlapTotal > 0 ? (industryOverlap + businessOverlap) / overlapTotal : 0;
      const score = Math.max(
        0,
        Math.min(
          100,
          Math.round((isLinked ? 40 : 8) + normalizedScore * 40 + overlapRatio * 12 + contributionWeight * 4)
        )
      );
      return {
        directionId: direction.id,
        directionTitle: direction.title,
        isLinked,
        contributionWeight,
        overlapCount: industryOverlap + businessOverlap,
        score,
      };
    });
    return {
      challengeId: challenge.id,
      challengeTitle: challenge.title,
      cells,
    };
  });

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Strategiezyklus</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Arbeitsbereich Strategiezyklus</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Erfasse Signale strukturiert und leite daraus fokussierte strategische Herausforderungen ab.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Zyklus: {selectedCycle.name} ({selectedCycle.code})
        </p>
      </header>

      {!canWrite ? (
        <p className="brand-surface p-3 text-sm text-zinc-600">
          Diese Rolle hat Leserechte. Erstellen/Bearbeiten ist deaktiviert.
        </p>
      ) : null}
      {statusMessage ? (
        <p
          className={`rounded-md border p-3 text-sm ${
            statusMessage.type === "error"
              ? "border-red-300 bg-red-50 text-red-800"
              : "border-emerald-300 bg-emerald-50 text-emerald-800"
          }`}
        >
          {statusMessage.text}
        </p>
      ) : null}

      <section className="brand-card p-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          {L1_TABS.map((tab) => (
            <a
              key={tab}
              href={`/strategy-cycle?l1=${tab}`}
              className={`rounded-md border px-3 py-1.5 text-xs ${
                activeL1 === tab
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {getL1TabTitle(tab)}
            </a>
          ))}
        </div>
        {activeL1 === "corporate-strategy" ? (
          <>
            <div className="flex flex-wrap gap-2">
              {STRATEGY_CYCLE_TABS.map((tab) => (
                <a
                  key={tab}
                  href={`/strategy-cycle?l1=corporate-strategy&l2=${tab}&sort=${sort}&min_score=${minScore}&quality_band=${qualityBandFilter}`}
                  className={`rounded-md border px-3 py-1.5 text-xs ${
                    activeTab === tab
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {getTabTitle(tab)}
                </a>
              ))}
            </div>
            <p className="text-sm text-zinc-600">{getStGallenHint(activeTab)}</p>
          </>
        ) : null}
      </section>

      {activeL1 === "mission-vision-culture-values" ? (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <article className="brand-card p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold text-zinc-900">Mission, Vision, Kultur, Werte & Fuehrung</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Hinterlege die Leitbild-Bausteine als Freitext und pflege sie laufend.
            </p>
            <form action={saveStrategyReferenceText} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block text-sm text-zinc-700">
                <span className="mb-1 block font-medium">Mission</span>
                <textarea
                  name="strategy_reference_mission"
                  defaultValue={strategyReferenceFields.mission}
                  rows={6}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Unternehmensauftrag und Zweck..."
                />
              </label>
              <label className="block text-sm text-zinc-700">
                <span className="mb-1 block font-medium">Vision</span>
                <textarea
                  name="strategy_reference_vision"
                  defaultValue={strategyReferenceFields.vision}
                  rows={6}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Langfristiges Zukunftsbild..."
                />
              </label>
              <label className="block text-sm text-zinc-700">
                <span className="mb-1 block font-medium">Kultur</span>
                <textarea
                  name="strategy_reference_culture"
                  defaultValue={strategyReferenceFields.culture}
                  rows={6}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Zusammenarbeit, Verhalten und Prinzipien..."
                />
              </label>
              <label className="block text-sm text-zinc-700">
                <span className="mb-1 block font-medium">Werte</span>
                <textarea
                  name="strategy_reference_values"
                  defaultValue={strategyReferenceFields.values}
                  rows={6}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Werte und Entscheidungsgrundsaetze..."
                />
              </label>
              <label className="block text-sm text-zinc-700 md:col-span-2">
                <span className="mb-1 block font-medium">Leadership</span>
                <textarea
                  name="strategy_reference_leadership"
                  defaultValue={strategyReferenceFields.leadership}
                  rows={6}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Fuehrungsprinzipien und Erwartung an Leadership-Verhalten..."
                />
              </label>
              <div className="md:col-span-2">
              <button type="submit" disabled={!canWrite} className="brand-btn px-4 py-2 text-sm">
                Speichern
              </button>
              </div>
            </form>
          </article>
        </section>
      ) : null}

      {activeL1 === "strategic-directions" ? (
        <section className="space-y-4">
          <article className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="brand-card p-6">
              <h2 className="text-lg font-semibold text-zinc-900">Strategische Herausforderung erfassen</h2>
              <p className="mt-1 text-sm text-zinc-600">Manuell oder unabhaengig von Analyse-Eintraegen anlegen und bewerten.</p>
              <form action={createStrategicChallengeInCycle} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  name="title"
                  required
                  placeholder="Neue strategische Herausforderung"
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm md:col-span-2"
                />
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Problemstatement und Kontext"
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm md:col-span-2"
                />
                <label className="text-xs text-zinc-600">
                  Prioritaet
                  <input
                    type="number"
                    name="priority"
                    defaultValue={3}
                    min={1}
                    max={5}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-zinc-600">
                  Impact
                  <input
                    type="number"
                    name="impact_score"
                    defaultValue={3}
                    min={1}
                    max={5}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-zinc-600">
                  Urgency
                  <input
                    type="number"
                    name="urgency_score"
                    defaultValue={3}
                    min={1}
                    max={5}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-zinc-600">
                  Scope
                  <input
                    type="number"
                    name="scope_score"
                    defaultValue={3}
                    min={1}
                    max={5}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-zinc-600">
                  Root Cause
                  <input
                    type="number"
                    name="root_cause_score"
                    defaultValue={3}
                    min={1}
                    max={5}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <div className="md:col-span-2">
                  <button type="submit" disabled={!canWrite} className="brand-btn px-4 py-2 text-sm">
                    Herausforderung speichern
                  </button>
                </div>
              </form>
            </div>
            <div className="brand-card p-6">
              <h2 className="text-lg font-semibold text-zinc-900">Strategische Stossrichtung erfassen</h2>
              <p className="mt-1 text-sm text-zinc-600">Unabhaengig erstellen und direkt mit Herausforderungen verknuepfen.</p>
              <form action={createStrategicDirectionInCycle} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  name="title"
                  required
                  placeholder="Neue strategische Stossrichtung"
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm md:col-span-2"
                />
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Loesungslogik (solution-agnostic)"
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm md:col-span-2"
                />
                <label className="text-xs text-zinc-600">
                  Prioritaet
                  <input
                    type="number"
                    name="priority"
                    defaultValue={3}
                    min={1}
                    max={5}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-zinc-600">
                  Strategic Value
                  <input
                    type="number"
                    name="strategic_value_score"
                    defaultValue={3}
                    min={1}
                    max={5}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-zinc-600">
                  Capability Fit
                  <input
                    type="number"
                    name="capability_fit_score"
                    defaultValue={3}
                    min={1}
                    max={5}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-zinc-600">
                  Feasibility
                  <input
                    type="number"
                    name="feasibility_score"
                    defaultValue={3}
                    min={1}
                    max={5}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-zinc-600">
                  Risk
                  <input
                    type="number"
                    name="risk_score"
                    defaultValue={3}
                    min={1}
                    max={5}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-zinc-600">
                  Cluster (Pflicht fuer active)
                  <select
                    name="cluster_id"
                    defaultValue=""
                    className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">Optional waehlen</option>
                    {(workspace.clusters ?? []).map((cluster) => (
                      <option key={cluster.id} value={cluster.id}>
                        {cluster.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-zinc-600">
                  Objective (Pflicht fuer active)
                  <select
                    name="objective_id"
                    defaultValue=""
                    className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">Optional waehlen</option>
                    {(workspace.objectives ?? []).map((objective) => (
                      <option key={objective.id} value={objective.id}>
                        {objective.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="md:col-span-2">
                  <button type="submit" disabled={!canWrite} className="brand-btn px-4 py-2 text-sm">
                    Stossrichtung speichern
                  </button>
                </div>
              </form>
            </div>
          </article>

          <article className="brand-card p-6">
            <h3 className="text-base font-semibold text-zinc-900">Strategische Herausforderungen</h3>
            <div className="mt-4 space-y-3">
              {(workspace.challenges ?? []).length === 0 ? (
                <p className="brand-surface p-3 text-sm text-zinc-600">Noch keine strategischen Herausforderungen vorhanden.</p>
              ) : (
                (workspace.challenges ?? []).map((challenge) => {
                  const impactScore = challenge.impact_score ?? 3;
                  const urgencyScore = challenge.urgency_score ?? 3;
                  const scopeScore = challenge.scope_score ?? 3;
                  const rootCauseScore = challenge.root_cause_score ?? 3;
                  const challengeIndustryIds = new Set(challengeIndustryIdsById.get(challenge.id) ?? []);
                  const challengeBusinessModelIds = new Set(challengeBusinessModelIdsById.get(challenge.id) ?? []);
                  return (
                    <div key={challenge.id} className="brand-surface space-y-3 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-zinc-900">{challenge.title}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                            Verknuepfte Stossrichtungen: {directionCountByChallengeId.get(challenge.id) ?? 0}
                          </span>
                          <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                            Challenge Score: {Number(challenge.challenge_score ?? 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      {challenge.description ? (
                        <p className="text-xs text-zinc-600">{challenge.description}</p>
                      ) : null}
                      <form action={updateStrategicChallengeAssessment} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="strategic_challenge_id" value={challenge.id} />
                        <label className="text-xs text-zinc-600">
                          Beschreibung
                          <input
                            name="description"
                            defaultValue={challenge.description ?? ""}
                            className="ml-2 w-72 rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                        </label>
                        <label className="text-xs text-zinc-600">
                          Impact
                          <input
                            type="number"
                            name="impact_score"
                            defaultValue={impactScore}
                            min={1}
                            max={5}
                            className="ml-2 w-16 rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                        </label>
                        <label className="text-xs text-zinc-600">
                          Urgency
                          <input
                            type="number"
                            name="urgency_score"
                            defaultValue={urgencyScore}
                            min={1}
                            max={5}
                            className="ml-2 w-16 rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                        </label>
                        <label className="text-xs text-zinc-600">
                          Scope
                          <input
                            type="number"
                            name="scope_score"
                            defaultValue={scopeScore}
                            min={1}
                            max={5}
                            className="ml-2 w-16 rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                        </label>
                        <label className="text-xs text-zinc-600">
                          Root
                          <input
                            type="number"
                            name="root_cause_score"
                            defaultValue={rootCauseScore}
                            min={1}
                            max={5}
                            className="ml-2 w-16 rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                        </label>
                        <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-3 py-1.5 text-xs">
                          Bewertung speichern
                        </button>
                      </form>
                      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                        <form action={linkStrategicChallengeToIndustryInCycle} className="flex gap-2">
                          <input type="hidden" name="strategic_challenge_id" value={challenge.id} />
                          <select
                            name="industry_id"
                            defaultValue=""
                            className="min-w-[180px] rounded border border-zinc-300 px-2 py-1.5 text-xs"
                          >
                            <option value="">Industrie verknuepfen</option>
                            {(workspace.availableDimensions.industries ?? []).map((industry) => (
                              <option key={industry.id} value={industry.id}>
                                {industry.name}
                              </option>
                            ))}
                          </select>
                          <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-3 py-1.5 text-xs">
                            Verknuepfen
                          </button>
                        </form>
                        <form action={linkStrategicChallengeToBusinessModelInCycle} className="flex gap-2">
                          <input type="hidden" name="strategic_challenge_id" value={challenge.id} />
                          <select
                            name="business_model_id"
                            defaultValue=""
                            className="min-w-[180px] rounded border border-zinc-300 px-2 py-1.5 text-xs"
                          >
                            <option value="">Geschaeftsmodell verknuepfen</option>
                            {(workspace.availableDimensions.businessModels ?? []).map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.name}
                              </option>
                            ))}
                          </select>
                          <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-3 py-1.5 text-xs">
                            Verknuepfen
                          </button>
                        </form>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(workspace.availableDimensions.industries ?? [])
                          .filter((industry) => challengeIndustryIds.has(industry.id))
                          .map((industry) => (
                            <form
                              key={`${challenge.id}-industry-${industry.id}`}
                              action={unlinkStrategicChallengeFromIndustryInCycle}
                              className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700"
                            >
                              <input type="hidden" name="strategic_challenge_id" value={challenge.id} />
                              <input type="hidden" name="industry_id" value={industry.id} />
                              <span>{industry.name}</span>
                              <button type="submit" disabled={!canWrite} className="text-red-700">
                                x
                              </button>
                            </form>
                          ))}
                        {(workspace.availableDimensions.businessModels ?? [])
                          .filter((model) => challengeBusinessModelIds.has(model.id))
                          .map((model) => (
                            <form
                              key={`${challenge.id}-business-${model.id}`}
                              action={unlinkStrategicChallengeFromBusinessModelInCycle}
                              className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700"
                            >
                              <input type="hidden" name="strategic_challenge_id" value={challenge.id} />
                              <input type="hidden" name="business_model_id" value={model.id} />
                              <span>{model.name}</span>
                              <button type="submit" disabled={!canWrite} className="text-red-700">
                                x
                              </button>
                            </form>
                          ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </article>
          <article className="brand-card p-6">
            <h3 className="text-base font-semibold text-zinc-900">Heatmap (Impact x Urgency)</h3>
            <p className="mt-1 text-xs text-zinc-600">
              Hohe Werte oben rechts markieren prioritär zu adressierende Herausforderungen.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[520px] border-collapse">
                <thead>
                  <tr>
                    <th className="border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700">Impact \\ Urgency</th>
                    {[1, 2, 3, 4, 5].map((urgency) => (
                      <th key={`u-${urgency}`} className="border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700">
                        {urgency}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[5, 4, 3, 2, 1].map((impact) => (
                    <tr key={`i-${impact}`}>
                      <th className="border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700">{impact}</th>
                      {[1, 2, 3, 4, 5].map((urgency) => {
                        const count = challengeHeatmapCounts.get(`${impact}:${urgency}`) ?? 0;
                        const tone =
                          impact >= 4 && urgency >= 4
                            ? "bg-emerald-100 text-emerald-900"
                            : impact >= 3 && urgency >= 3
                              ? "bg-amber-100 text-amber-900"
                              : "bg-white text-zinc-700";
                        return (
                          <td key={`${impact}-${urgency}`} className="border border-zinc-200 p-0">
                            <div className={`px-2 py-2 text-center text-xs ${tone}`}>{count}</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="brand-card p-6">
            <h3 className="text-base font-semibold text-zinc-900">Predecessors aus Corporate Strategy</h3>
            <div className="mt-4 space-y-3">
              {(workspace.strategicDirections ?? []).length === 0 ? (
                <p className="brand-surface p-3 text-sm text-zinc-600">Noch keine strategischen Stossrichtungen vorhanden.</p>
              ) : (
                (workspace.strategicDirections ?? []).map((direction) => {
                  const linkedChallengeIds = new Set(challengeIdsByDirection.get(direction.id) ?? []);
                  const linkedClusterIds = new Set(clusterIdsByDirection.get(direction.id) ?? []);
                  const linkedObjectiveIds = new Set(objectiveIdsByDirection.get(direction.id) ?? []);
                  const linkedGapRelationIds = new Set(gapRelationIdsByDirection.get(direction.id) ?? []);
                  const directionIndustryIds = new Set(directionIndustryIdsById.get(direction.id) ?? []);
                  const directionBusinessModelIds = new Set(directionBusinessModelIdsById.get(direction.id) ?? []);
                  const strategicValueScore = direction.strategic_value_score ?? 3;
                  const capabilityFitScore = direction.capability_fit_score ?? 3;
                  const feasibilityScore = direction.feasibility_score ?? 3;
                  const riskScore = direction.risk_level ?? 3;
                  const coverage = workspace.directionCoverageById.get(direction.id) ?? {
                    linked: 0,
                    total: workspace.challenges.length,
                    percent: 0,
                  };
                  return (
                    <div key={direction.id} className="brand-surface space-y-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-zinc-900">{direction.title}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                            Abdeckung {coverage.percent}% ({coverage.linked}/{coverage.total || 0})
                          </span>
                          <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                            Direction Score: {Number(direction.direction_score ?? 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      {direction.description ? (
                        <p className="text-xs text-zinc-600">{direction.description}</p>
                      ) : null}
                      <form action={updateStrategicDirectionAssessment} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="strategic_direction_id" value={direction.id} />
                        <label className="text-xs text-zinc-600">
                          Beschreibung
                          <input
                            name="description"
                            defaultValue={direction.description ?? ""}
                            className="ml-2 w-72 rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                        </label>
                        <label className="text-xs text-zinc-600">
                          Strategic
                          <input
                            type="number"
                            name="strategic_value_score"
                            defaultValue={strategicValueScore}
                            min={1}
                            max={5}
                            className="ml-2 w-16 rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                        </label>
                        <label className="text-xs text-zinc-600">
                          Capability
                          <input
                            type="number"
                            name="capability_fit_score"
                            defaultValue={capabilityFitScore}
                            min={1}
                            max={5}
                            className="ml-2 w-16 rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                        </label>
                        <label className="text-xs text-zinc-600">
                          Feasibility
                          <input
                            type="number"
                            name="feasibility_score"
                            defaultValue={feasibilityScore}
                            min={1}
                            max={5}
                            className="ml-2 w-16 rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                        </label>
                        <label className="text-xs text-zinc-600">
                          Risk
                          <input
                            type="number"
                            name="risk_score"
                            defaultValue={riskScore}
                            min={1}
                            max={5}
                            className="ml-2 w-16 rounded border border-zinc-300 px-2 py-1 text-xs"
                          />
                        </label>
                        <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-3 py-1.5 text-xs">
                          Bewertung speichern
                        </button>
                      </form>
                      <form action={linkDirectionToChallengePredecessor} className="flex flex-wrap gap-2">
                        <input type="hidden" name="strategic_direction_id" value={direction.id} />
                        <select
                          name="strategic_challenge_id"
                          defaultValue=""
                          className="min-w-[260px] rounded-md border border-zinc-300 px-2 py-1.5 text-xs"
                        >
                          <option value="">Vorgaenger-Herausforderung verknuepfen</option>
                          {challengeOptions.map((challenge) => (
                            <option key={challenge.id} value={challenge.id}>
                              {challenge.title}
                            </option>
                          ))}
                        </select>
                        <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-3 py-1.5 text-xs">
                          Verknuepfen
                        </button>
                      </form>
                      <form action={linkDirectionToClusterInCycle} className="flex flex-wrap gap-2">
                        <input type="hidden" name="strategic_direction_id" value={direction.id} />
                        <select
                          name="cluster_id"
                          defaultValue=""
                          className="min-w-[220px] rounded-md border border-zinc-300 px-2 py-1.5 text-xs"
                        >
                          <option value="">Cluster verknuepfen</option>
                          {(workspace.clusters ?? []).map((cluster) => (
                            <option key={cluster.id} value={cluster.id}>
                              {cluster.label}
                            </option>
                          ))}
                        </select>
                        <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-3 py-1.5 text-xs">
                          Cluster verknuepfen
                        </button>
                      </form>
                      <form action={linkDirectionToObjectiveInCycle} className="flex flex-wrap gap-2">
                        <input type="hidden" name="strategic_direction_id" value={direction.id} />
                        <select
                          name="objective_id"
                          defaultValue=""
                          className="min-w-[220px] rounded-md border border-zinc-300 px-2 py-1.5 text-xs"
                        >
                          <option value="">Objective verknuepfen</option>
                          {(workspace.objectives ?? []).map((objective) => (
                            <option key={objective.id} value={objective.id}>
                              {objective.title}
                            </option>
                          ))}
                        </select>
                        <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-3 py-1.5 text-xs">
                          Objective verknuepfen
                        </button>
                      </form>
                      <form action={linkDirectionToGapInCycle} className="flex flex-wrap gap-2">
                        <input type="hidden" name="strategic_direction_id" value={direction.id} />
                        <select
                          name="cluster_objective_relation_id"
                          defaultValue=""
                          className="min-w-[260px] rounded-md border border-zinc-300 px-2 py-1.5 text-xs"
                        >
                          <option value="">Gap verknuepfen</option>
                          {(workspace.clusterObjectiveRelations ?? []).map((relation) => {
                            const cluster = clusterById.get(relation.cluster_id);
                            const objective = objectiveById.get(relation.objective_id);
                            return (
                              <option key={relation.id} value={relation.id}>
                                {(cluster?.label ?? relation.cluster_id)}
                                {" -> "}
                                {(objective?.title ?? relation.objective_id)} ({Number(relation.gap_score ?? 0).toFixed(2)})
                              </option>
                            );
                          })}
                        </select>
                        <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-3 py-1.5 text-xs">
                          Gap verknuepfen
                        </button>
                      </form>
                      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                        <form action={linkStrategicDirectionToIndustryInCycle} className="flex gap-2">
                          <input type="hidden" name="strategic_direction_id" value={direction.id} />
                          <select
                            name="industry_id"
                            defaultValue=""
                            className="min-w-[180px] rounded border border-zinc-300 px-2 py-1.5 text-xs"
                          >
                            <option value="">Industrie verknuepfen</option>
                            {(workspace.availableDimensions.industries ?? []).map((industry) => (
                              <option key={industry.id} value={industry.id}>
                                {industry.name}
                              </option>
                            ))}
                          </select>
                          <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-3 py-1.5 text-xs">
                            Verknuepfen
                          </button>
                        </form>
                        <form action={linkStrategicDirectionToBusinessModelInCycle} className="flex gap-2">
                          <input type="hidden" name="strategic_direction_id" value={direction.id} />
                          <select
                            name="business_model_id"
                            defaultValue=""
                            className="min-w-[180px] rounded border border-zinc-300 px-2 py-1.5 text-xs"
                          >
                            <option value="">Geschaeftsmodell verknuepfen</option>
                            {(workspace.availableDimensions.businessModels ?? []).map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.name}
                              </option>
                            ))}
                          </select>
                          <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-3 py-1.5 text-xs">
                            Verknuepfen
                          </button>
                        </form>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(workspace.challenges ?? [])
                          .filter((challenge) => linkedChallengeIds.has(challenge.id))
                          .map((challenge) => (
                            <form
                              key={`${direction.id}-${challenge.id}`}
                              action={unlinkDirectionChallengePredecessor}
                              className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700"
                            >
                              <input type="hidden" name="strategic_direction_id" value={direction.id} />
                              <input type="hidden" name="strategic_challenge_id" value={challenge.id} />
                              <span>{challenge.title}</span>
                              <button type="submit" disabled={!canWrite} className="text-red-700">
                                x
                              </button>
                            </form>
                          ))}
                        {(workspace.clusters ?? [])
                          .filter((cluster) => linkedClusterIds.has(cluster.id))
                          .map((cluster) => (
                            <form
                              key={`${direction.id}-cluster-${cluster.id}`}
                              action={unlinkDirectionFromClusterInCycle}
                              className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700"
                            >
                              <input type="hidden" name="strategic_direction_id" value={direction.id} />
                              <input type="hidden" name="cluster_id" value={cluster.id} />
                              <span>Cluster: {cluster.label}</span>
                              <button type="submit" disabled={!canWrite} className="text-red-700">
                                x
                              </button>
                            </form>
                          ))}
                        {(workspace.objectives ?? [])
                          .filter((objective) => linkedObjectiveIds.has(objective.id))
                          .map((objective) => (
                            <form
                              key={`${direction.id}-objective-${objective.id}`}
                              action={unlinkDirectionFromObjectiveInCycle}
                              className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700"
                            >
                              <input type="hidden" name="strategic_direction_id" value={direction.id} />
                              <input type="hidden" name="objective_id" value={objective.id} />
                              <span>Objective: {objective.title}</span>
                              <button type="submit" disabled={!canWrite} className="text-red-700">
                                x
                              </button>
                            </form>
                          ))}
                        {(workspace.clusterObjectiveRelations ?? [])
                          .filter((relation) => linkedGapRelationIds.has(relation.id))
                          .map((relation) => (
                            <form
                              key={`${direction.id}-gap-${relation.id}`}
                              action={unlinkDirectionFromGapInCycle}
                              className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700"
                            >
                              <input type="hidden" name="strategic_direction_id" value={direction.id} />
                              <input type="hidden" name="cluster_objective_relation_id" value={relation.id} />
                              <span>
                                Gap {Number(relation.gap_score ?? 0).toFixed(2)}
                              </span>
                              <button type="submit" disabled={!canWrite} className="text-red-700">
                                x
                              </button>
                            </form>
                          ))}
                        {(programsByDirectionId.get(direction.id) ?? []).map((program) => (
                          <span
                            key={`${direction.id}-program-${program.id}`}
                            className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs text-emerald-800"
                          >
                            Programm: {program.title}
                          </span>
                        ))}
                        {(workspace.availableDimensions.industries ?? [])
                          .filter((industry) => directionIndustryIds.has(industry.id))
                          .map((industry) => (
                            <form
                              key={`${direction.id}-industry-${industry.id}`}
                              action={unlinkStrategicDirectionFromIndustryInCycle}
                              className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700"
                            >
                              <input type="hidden" name="strategic_direction_id" value={direction.id} />
                              <input type="hidden" name="industry_id" value={industry.id} />
                              <span>{industry.name}</span>
                              <button type="submit" disabled={!canWrite} className="text-red-700">
                                x
                              </button>
                            </form>
                          ))}
                        {(workspace.availableDimensions.businessModels ?? [])
                          .filter((model) => directionBusinessModelIds.has(model.id))
                          .map((model) => (
                            <form
                              key={`${direction.id}-business-${model.id}`}
                              action={unlinkStrategicDirectionFromBusinessModelInCycle}
                              className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs text-zinc-700"
                            >
                              <input type="hidden" name="strategic_direction_id" value={direction.id} />
                              <input type="hidden" name="business_model_id" value={model.id} />
                              <span>{model.name}</span>
                              <button type="submit" disabled={!canWrite} className="text-red-700">
                                x
                              </button>
                            </form>
                          ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </article>

          <article className="brand-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-zinc-900">Mapping-Matrix Herausforderungen x Stossrichtungen</h3>
              <div className="flex items-center gap-2 text-xs">
                <span className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-900">hoch</span>
                <span className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-amber-900">mittel</span>
                <span className="rounded border border-zinc-300 bg-zinc-100 px-2 py-1 text-zinc-800">niedrig</span>
              </div>
            </div>
            <p className="mt-1 text-xs text-zinc-600">
              Score kombiniert Link-Status, Challenge-/Direction-Score und Ueberschneidungen bei Industrie/Geschaeftsmodell.
            </p>
            {(workspace.challenges ?? []).length === 0 || (workspace.strategicDirections ?? []).length === 0 ? (
              <p className="mt-4 brand-surface p-3 text-sm text-zinc-600">
                Fuer die Matrix werden mindestens eine Herausforderung und eine Stossrichtung benoetigt.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-[860px] border-collapse">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-semibold text-zinc-700">
                        Herausforderung
                      </th>
                      {(workspace.strategicDirections ?? []).map((direction) => (
                        <th key={direction.id} className="border border-zinc-200 bg-zinc-50 px-2 py-2 text-left text-xs font-semibold text-zinc-700">
                          {direction.title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {strategicMatrixRows.map((row) => (
                      <tr key={row.challengeId}>
                        <td className="sticky left-0 z-10 border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800">
                          {row.challengeTitle}
                        </td>
                        {row.cells.map((cell) => (
                          <td key={`${row.challengeId}-${cell.directionId}`} className="border border-zinc-200 p-1 align-top">
                            <div className={`rounded border px-2 py-1 text-xs ${getMatrixCellClass(cell.score)}`}>
                              <div className="flex items-center justify-between gap-2">
                                <span>Score {cell.score}</span>
                                <span>{cell.isLinked ? "verknuepft" : "offen"}</span>
                              </div>
                              <div className="mt-1 text-[11px] opacity-80">
                                Beitrag {cell.contributionWeight}/3 | Overlap {cell.overlapCount}
                              </div>
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
          <article className="brand-card p-6">
            <h3 className="text-base font-semibold text-zinc-900">Gap View (Cluster x Objectives)</h3>
            <p className="mt-1 text-xs text-zinc-600">
              Gap Score = Durchschnitt Challenge Score im Cluster x Objective Importance x Relation Strength.
            </p>
            <form action={saveClusterObjectiveRelation} className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <select
                name="cluster_id"
                defaultValue=""
                className="min-w-[240px] rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs"
              >
                <option value="">Cluster waehlen</option>
                {(workspace.clusters ?? []).map((cluster) => (
                  <option key={cluster.id} value={cluster.id}>
                    {cluster.label}
                  </option>
                ))}
              </select>
              <select
                name="objective_id"
                defaultValue=""
                className="min-w-[260px] rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs"
              >
                <option value="">Objective waehlen</option>
                {(workspace.objectives ?? []).map((objective) => (
                  <option key={objective.id} value={objective.id}>
                    {objective.title}
                  </option>
                ))}
              </select>
              <label className="text-xs text-zinc-600">
                Relation
                <input
                  type="number"
                  min={0}
                  max={3}
                  name="relation_strength"
                  defaultValue={1}
                  className="ml-2 w-16 rounded border border-zinc-300 bg-white px-2 py-1 text-xs"
                />
              </label>
              <button type="submit" disabled={!canWrite} className="brand-btn px-3 py-1.5 text-xs">
                Gap speichern
              </button>
            </form>
            {(workspace.clusters ?? []).length === 0 || (workspace.objectives ?? []).length === 0 ? (
              <p className="mt-4 brand-surface p-3 text-sm text-zinc-600">
                Fuer die Gap Matrix werden mindestens ein Cluster und ein Objective benoetigt.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-[860px] border-collapse">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-semibold text-zinc-700">
                        Cluster
                      </th>
                      {(workspace.objectives ?? []).map((objective) => (
                        <th key={objective.id} className="border border-zinc-200 bg-zinc-50 px-2 py-2 text-left text-xs font-semibold text-zinc-700">
                          {objective.title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(workspace.clusters ?? []).map((cluster) => (
                      <tr key={cluster.id}>
                        <td className="sticky left-0 z-10 border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800">
                          {cluster.label}
                        </td>
                        {(workspace.objectives ?? []).map((objective) => {
                          const relation = relationByClusterObjective.get(`${cluster.id}:${objective.id}`);
                          const gapScore = Number(relation?.gapScore ?? 0);
                          const scoreClass =
                            gapScore >= 30
                              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                              : gapScore >= 15
                                ? "border-amber-300 bg-amber-50 text-amber-900"
                                : "border-zinc-300 bg-white text-zinc-700";
                          return (
                            <td key={`${cluster.id}-${objective.id}`} className="border border-zinc-200 p-1 align-top">
                              <div className={`rounded border px-2 py-1 text-xs ${scoreClass}`}>
                                <div className="flex items-center justify-between gap-2">
                                  <span>Gap {gapScore.toFixed(2)}</span>
                                  <span>R {relation?.relationStrength ?? 0}</span>
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      ) : null}

      {activeL1 === "pips" ? (
        <section className="space-y-4">
          <article className="brand-card p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Programs</h2>
            <form action={createStrategyProgramInCycle} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
              <input
                name="title"
                required
                placeholder="Neues Programm"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm md:col-span-2"
              />
              <select
                name="strategic_direction_id"
                defaultValue=""
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">Stossrichtung waehlen</option>
                {(workspace.strategicDirections ?? []).map((direction) => (
                  <option key={direction.id} value={direction.id}>
                    {direction.title}
                  </option>
                ))}
              </select>
              <input
                name="timeline"
                placeholder="Timeline (z.B. 2026-2028)"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                name="budget"
                defaultValue={0}
                min={0}
                step={1000}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <textarea
                name="description"
                rows={2}
                placeholder="Programm-Beschreibung"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm md:col-span-4"
              />
              <button type="submit" disabled={!canWrite} className="brand-btn px-4 py-2 text-sm">
                Programm speichern
              </button>
            </form>
            <div className="mt-3 flex flex-wrap gap-2">
              {(workspace.programs ?? []).map((program) => (
                <span key={program.id} className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                  {program.title} {program.strategic_direction_id ? `(${directionById.get(program.strategic_direction_id)?.title ?? "n/a"})` : ""}
                </span>
              ))}
            </div>
          </article>

          <article className="brand-card p-6">
            <h3 className="text-base font-semibold text-zinc-900">Initiativen (Execution View)</h3>
            <form action={createPipInitiativeInCycle} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <input
                name="title"
                required
                placeholder="Neue Initiative"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm md:col-span-2"
              />
              <select
                name="program_id"
                defaultValue=""
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">Programm waehlen</option>
                {(workspace.programs ?? []).map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.title}
                  </option>
                ))}
              </select>
              <input
                type="number"
                name="priority"
                defaultValue={3}
                min={1}
                max={5}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <input
                name="linked_okrs"
                placeholder="Linked OKRs (CSV)"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm md:col-span-2"
              />
              <input
                name="deliverables"
                placeholder="Deliverables (CSV)"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm md:col-span-2"
              />
              <button type="submit" disabled={!canWrite} className="brand-btn px-4 py-2 text-sm">
                Initiative speichern
              </button>
            </form>
            <div className="mt-4 space-y-3">
              {(workspace.initiatives ?? []).length === 0 ? (
                <p className="brand-surface p-3 text-sm text-zinc-600">Noch keine PIPs vorhanden.</p>
              ) : (
                (workspace.initiatives ?? []).map((initiative) => {
                  const linkedTargetIds = new Set(targetIdsByInitiative.get(initiative.id) ?? []);
                  const coverage = workspace.initiativeCoverageById.get(initiative.id) ?? {
                    linked: 0,
                    total: workspace.annualTargets.length,
                    percent: 0,
                  };
                  return (
                    <div key={initiative.id} className="brand-surface space-y-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-zinc-900">{initiative.title}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                            Coverage {coverage.percent}% ({coverage.linked}/{coverage.total || 0})
                          </span>
                          <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                            Programm: {workspace.programs.find((program) => program.id === initiative.program_id)?.title ?? "n/a"}
                          </span>
                        </div>
                      </div>
                      {Array.isArray(initiative.linked_okrs) && initiative.linked_okrs.length > 0 ? (
                        <p className="text-xs text-zinc-600">OKRs: {initiative.linked_okrs.join(", ")}</p>
                      ) : null}
                      {Array.isArray(initiative.deliverables) && initiative.deliverables.length > 0 ? (
                        <p className="text-xs text-zinc-600">Deliverables: {initiative.deliverables.join(", ")}</p>
                      ) : null}
                      <form action={linkInitiativeToTargetPredecessor} className="flex flex-wrap gap-2">
                        <input type="hidden" name="initiative_id" value={initiative.id} />
                        <select
                          name="annual_target_id"
                          defaultValue=""
                          className="min-w-[260px] rounded-md border border-zinc-300 px-2 py-1.5 text-xs"
                        >
                          <option value="">Vorgaenger-Ziel verknuepfen</option>
                          {(workspace.annualTargets ?? []).map((target) => (
                            <option key={target.id} value={target.id}>
                              {target.title}
                            </option>
                          ))}
                        </select>
                        <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-3 py-1.5 text-xs">
                          Verknuepfen
                        </button>
                      </form>
                      <div className="flex flex-wrap gap-2">
                        {(workspace.annualTargets ?? [])
                          .filter((target) => linkedTargetIds.has(target.id))
                          .map((target) => (
                            <form
                              key={`${initiative.id}-${target.id}`}
                              action={unlinkInitiativeTargetPredecessor}
                              className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700"
                            >
                              <input type="hidden" name="initiative_id" value={initiative.id} />
                              <input type="hidden" name="annual_target_id" value={target.id} />
                              <span>{target.title}</span>
                              <button type="submit" disabled={!canWrite} className="text-red-700">
                                x
                              </button>
                            </form>
                          ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </article>
        </section>
      ) : null}

      {activeL1 === "corporate-strategy" && activeTab === "summary" ? (
        <section className="brand-card p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-zinc-700">Node-Einordnung:</span>
            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-700">
              LLM: {graphLayoutLlmCount}
            </span>
            <span className="rounded-full border border-zinc-300 bg-white px-2 py-1 text-zinc-700">
              Rule-Fallback: {graphLayoutRuleCount}
            </span>
            {activeOrFailedJobs.length > 0 ? (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-amber-700">
                Hintergrundjobs: {activeOrFailedJobs.length}
              </span>
            ) : null}
          </div>
          {activeOrFailedJobs.length > 0 ? (
            <div className="mt-2 space-y-1 text-xs text-zinc-600">
              {activeOrFailedJobs.slice(0, 4).map((job) => (
                <p key={job.id}>
                  {job.job_type} - {job.status}
                  {job.progress_total > 0 ? ` (${job.progress_done}/${job.progress_total})` : ""}
                  {job.last_error ? ` - ${job.last_error}` : ""}
                </p>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {activeL1 === "corporate-strategy" && activeTab === "summary" ? (
        <AnalysisVisualizationWorkspace
          entries={enrichedAllEntries}
          approvedLinks={workspace.approvedLinks}
          linkDrafts={workspace.linkDrafts}
          clusters={workspace.clusters}
          clusterMembers={workspace.clusterMembers}
          entryDimensions={entryDimensionsRecord}
          availableDimensions={workspace.availableDimensions}
          promotedEntryIds={promotedEntryIds}
          entryDirectionIdsByEntryId={entryDirectionIdsRecord}
          strategicDirections={workspace.strategicDirections}
          llmLayoutByEntryId={llmLayoutByEntryId}
          canWrite={canWrite}
        />
      ) : null}

      {activeL1 === "corporate-strategy" && activeTab === "summary" ? (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <article className="brand-card p-4">
            <h3 className="text-sm font-semibold text-zinc-900">Top 5 Challenges</h3>
            <div className="mt-2 space-y-2">
              {topChallenges.length === 0 ? (
                <p className="text-xs text-zinc-600">Noch keine Challenges vorhanden.</p>
              ) : (
                topChallenges.map((challenge) => (
                  <div key={challenge.id} className="rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs">
                    <p className="font-medium text-zinc-900">{challenge.title}</p>
                    <p className="text-zinc-600">Score {Number(challenge.challenge_score ?? 0).toFixed(2)}</p>
                  </div>
                ))
              )}
            </div>
          </article>
          <article className="brand-card p-4">
            <h3 className="text-sm font-semibold text-zinc-900">Top 5 Directions</h3>
            <div className="mt-2 space-y-2">
              {topDirections.length === 0 ? (
                <p className="text-xs text-zinc-600">Noch keine Stossrichtungen vorhanden.</p>
              ) : (
                topDirections.map((direction) => (
                  <div key={direction.id} className="rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs">
                    <p className="font-medium text-zinc-900">{direction.title}</p>
                    <p className="text-zinc-600">Score {Number(direction.direction_score ?? 0).toFixed(2)}</p>
                  </div>
                ))
              )}
            </div>
          </article>
          <article className="brand-card p-4">
            <h3 className="text-sm font-semibold text-zinc-900">Coverage: Unadressierte Challenges</h3>
            <div className="mt-2 space-y-2">
              {uncoveredChallenges.length === 0 ? (
                <p className="text-xs text-emerald-700">Alle Challenges sind mindestens einer Direction zugeordnet.</p>
              ) : (
                uncoveredChallenges.slice(0, 8).map((challenge) => (
                  <div key={challenge.id} className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                    {challenge.title}
                  </div>
                ))
              )}
            </div>
          </article>
        </section>
      ) : null}

      {activeL1 === "corporate-strategy" && activeTab === "summary" ? (
        <section className="brand-card p-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">Empfehlungen fuer Herausforderungen</h2>
            <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
              {workspace.challengeCandidates.filter((candidate) => candidate.status === "draft").length} offen
            </span>
          </div>
          <p className="text-sm text-zinc-600">
            Vorschlaege aus Clustern und Luecken. Uebernehmen erstellt direkt eine strategische Herausforderung.
          </p>
          <div className="space-y-2">
            {workspace.challengeCandidates.filter((candidate) => candidate.status === "draft").length === 0 ? (
              <p className="brand-surface p-3 text-sm text-zinc-600">
                Keine offenen Empfehlungen. Fuehre &quot;Luecken neu berechnen&quot; aus, um neue Vorschlaege zu erzeugen.
              </p>
            ) : (
              workspace.challengeCandidates
                .filter((candidate) => candidate.status === "draft")
                .map((candidate) => (
                  <div key={candidate.id} className="brand-surface space-y-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-zinc-900">{candidate.title}</p>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                          Prioritaet {candidate.priority}
                        </span>
                        <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                          Quelle {candidate.source_type}
                        </span>
                      </div>
                    </div>
                    {candidate.description ? (
                      <p className="text-sm text-zinc-600">{candidate.description}</p>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <form action={promoteChallengeCandidate}>
                        <input type="hidden" name="candidate_id" value={candidate.id} />
                        <button type="submit" disabled={!canWrite} className="brand-btn px-3 py-1.5 text-xs">
                          Als Challenge uebernehmen
                        </button>
                      </form>
                      <form action={dismissChallengeCandidate}>
                        <input type="hidden" name="candidate_id" value={candidate.id} />
                        <button
                          type="submit"
                          disabled={!canWrite}
                          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700"
                        >
                          Ausblenden
                        </button>
                      </form>
                    </div>
                  </div>
                ))
            )}
          </div>
        </section>
      ) : null}

      {activeL1 === "corporate-strategy" && activeTab === "summary" ? (
      <section className="brand-card p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-zinc-900">Analyse-Netzwerk</h2>
          <form action={generateLinkDrafts}>
            <input type="hidden" name="analysis_type" value={actionTab} />
            <input type="hidden" name="return_to" value="/strategy-cycle?l1=corporate-strategy&l2=summary" />
            <button type="submit" disabled={!canWrite} className="brand-btn px-3 py-1.5 text-xs">
              Link-Entwuerfe generieren
            </button>
            <AiWaitOverlay
              title="AI Agent analysiert Verknuepfungen"
              description="Wir erzeugen Link-Entwuerfe und gewichten sie fuer das Netzwerk."
            />
          </form>
          <form action={recomputeClusters}>
            <input type="hidden" name="analysis_type" value={actionTab} />
            <input type="hidden" name="return_to" value="/strategy-cycle?l1=corporate-strategy&l2=summary" />
            <button type="submit" disabled={!canWrite} className="brand-btn px-3 py-1.5 text-xs">
              Cluster neu berechnen
            </button>
            <AiWaitOverlay
              title="AI Agent bewertet Cluster"
              description="Cluster-Labels und Zusammenfassungen werden jetzt neu bewertet."
            />
          </form>
          <form action={recomputeGaps}>
            <input type="hidden" name="analysis_type" value={actionTab} />
            <input type="hidden" name="return_to" value="/strategy-cycle?l1=corporate-strategy&l2=summary" />
            <button type="submit" disabled={!canWrite} className="brand-btn px-3 py-1.5 text-xs">
              Luecken neu berechnen
            </button>
            <AiWaitOverlay
              title="AI Agent bewertet Luecken"
              description="Wir priorisieren Gaps und erzeugen Challenge-Kandidaten."
            />
          </form>
          <form action={recomputeGraphLayout}>
            <input type="hidden" name="analysis_type" value={actionTab} />
            <input type="hidden" name="return_to" value="/strategy-cycle?l1=corporate-strategy&l2=summary" />
            <button
              type="submit"
              disabled={!canWrite || hasRunningGraphLayout}
              className="brand-btn px-3 py-1.5 text-xs"
            >
              Graph-Layout jetzt neu berechnen
            </button>
            <AiWaitOverlay
              title="AI Agent ordnet den Graphen neu"
              description="Node-Positionen werden neu berechnet und persistent gespeichert."
            />
          </form>
          <form action={backfillEntryQuality}>
            <input type="hidden" name="analysis_type" value={actionTab} />
            <input type="hidden" name="return_to" value="/strategy-cycle?l1=corporate-strategy&l2=summary" />
            <button
              type="submit"
              disabled={!canWrite || hasRunningQualityBackfill}
              className="brand-btn px-3 py-1.5 text-xs"
            >
              Bestehende Punkte neu bewerten
            </button>
            <AiWaitOverlay
              title="AI Agent bewertet alle bestehenden Punkte"
              description="Wir rechnen Quality fuer alle vorhandenen Eintraege neu und aktualisieren den Graph."
            />
          </form>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <article className="brand-surface p-3">
            <h3 className="text-sm font-semibold text-zinc-900">Verbindungs-Entwuerfe</h3>
            <div className="mt-2 space-y-2">
              {(workspace.linkDrafts ?? []).length === 0 ? (
                <p className="text-xs text-zinc-600">Keine offenen Entwuerfe.</p>
              ) : (
                (workspace.linkDrafts ?? []).slice(0, 12).map((draft) => {
                  const tri = readTriScores(draft.metadata);
                  return (
                    <div key={draft.id} className="rounded-md border border-zinc-200 bg-white p-2">
                    <p className="text-xs text-zinc-700">
                      <span className="font-medium">
                        {workspace.entryTitleById.get(draft.source_analysis_item_id) ?? draft.source_analysis_item_id}
                      </span>
                      {" -> "}
                      <span className="font-medium">
                        {workspace.entryTitleById.get(draft.target_analysis_item_id) ?? draft.target_analysis_item_id}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {draft.link_type} | conf {Math.round(Number(draft.confidence ?? 0) * 100)}% | s
                      {draft.strength}
                    </p>
                    {tri ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        Naehe {Math.round(tri.proximityScore * 100)}% | Unterstuetzung{" "}
                        {Math.round(tri.supportScore * 100)}% | Abstossung {Math.round(tri.repulsionScore * 100)}%
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-zinc-500">{draft.comment}</p>
                    <div className="mt-2 flex gap-2">
                      <form action={approveLinkDraft}>
                        <input type="hidden" name="analysis_type" value={actionTab} />
                        <input type="hidden" name="draft_id" value={draft.id} />
                        <button type="submit" disabled={!canWrite} className="brand-btn px-3 py-1.5 text-xs">
                          Accept
                        </button>
                      </form>
                      <form action={rejectLinkDraft}>
                        <input type="hidden" name="analysis_type" value={actionTab} />
                        <input type="hidden" name="draft_id" value={draft.id} />
                        <button
                          type="submit"
                          disabled={!canWrite}
                          className="brand-btn px-3 py-1.5 text-xs"
                        >
                          Reject
                        </button>
                      </form>
                    </div>
                    </div>
                  );
                })
              )}
            </div>
          </article>

          <article className="brand-surface p-3">
            <h3 className="text-sm font-semibold text-zinc-900">Cluster & Potenziale</h3>
            <div className="mt-2 space-y-2">
              {(workspace.clusters ?? []).length === 0 ? (
                <p className="text-xs text-zinc-600">Noch keine Cluster berechnet.</p>
              ) : (
                (workspace.clusters ?? []).slice(0, 8).map((cluster) => {
                  const members = workspace.clusterMembersByClusterId.get(cluster.id) ?? [];
                  const topMemberTitles = members
                    .slice(0, 4)
                    .map((member) => workspace.entryTitleById.get(member.entry_id) ?? member.entry_id);
                  return (
                    <div key={cluster.id} className="rounded-md border border-zinc-200 bg-white p-2">
                      <p className="text-xs font-semibold text-zinc-900">{cluster.label}</p>
                      <p className="mt-1 text-xs text-zinc-600">{cluster.summary}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Score: {Math.round(Number(cluster.cluster_score ?? 0) * 100)} | Mitglieder: {members.length}
                      </p>
                      {topMemberTitles.length > 0 ? (
                        <p className="mt-1 text-xs text-zinc-500">
                          {topMemberTitles.join(" | ")}
                        </p>
                      ) : null}
                      <form action={promoteClusterToStrategicChallenge} className="mt-2">
                        <input type="hidden" name="analysis_type" value={actionTab} />
                        <input type="hidden" name="cluster_id" value={cluster.id} />
                        <button type="submit" disabled={!canWrite} className="brand-btn px-3 py-1.5 text-xs">
                          Als Challenge uebernehmen
                        </button>
                      </form>
                    </div>
                  );
                })
              )}
            </div>
          </article>

          <article className="brand-surface p-3">
            <h3 className="text-sm font-semibold text-zinc-900">Luecken in der Betrachtung</h3>
            <div className="mt-2 space-y-2">
              {(workspace.gapFindings ?? []).length === 0 ? (
                <p className="text-xs text-zinc-600">Keine offenen Luecken gefunden.</p>
              ) : (
                (workspace.gapFindings ?? []).slice(0, 12).map((gap) => (
                  <div key={gap.id} className="rounded-md border border-zinc-200 bg-white p-2">
                    <p className="text-xs font-medium text-zinc-900">
                      {gap.gap_type} | {gap.dimension}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">Prioritaet: {gap.severity} | Status: {gap.status}</p>
                    <p className="mt-1 text-xs text-zinc-500">{gap.recommendation}</p>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>
      </section>
      ) : null}

      {activeL1 === "corporate-strategy" && activeTab !== "summary" && activeTab !== "strategy-matrix" ? (
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Analyse-Eintrag erfassen</h2>
          <form action={createAnalysisEntry} className="mt-4 space-y-3">
            <input type="hidden" name="analysis_type" value={activeTab} />
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Titel / Kernaussage</label>
              <input
                name="title"
                required
                placeholder="Titel / Kernaussage"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <p className="mb-1 block text-xs font-medium text-zinc-700">Sub-Typ</p>
              {activeTab === "environment" ? (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-600">
                    Optional als PESTEL verfeinern (ohne separaten Moduswechsel):
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {PESTEL_AREA_META.map((area) => (
                      <label
                        key={area.key}
                        className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
                        style={{
                          background: `color-mix(in srgb, var(--brand-primary) ${area.tintPercent}%, white)`,
                          borderColor: `color-mix(in srgb, var(--brand-primary) ${Math.min(area.tintPercent + 18, 72)}%, white)`,
                        }}
                      >
                        <input type="radio" name="sub_type" value={area.key} />
                        <span>{area.label}</span>
                      </label>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs">
                    <input type="radio" name="sub_type" value="" defaultChecked />
                    <span>Keine PESTEL-Kategorie</span>
                  </label>
                </div>
              ) : activeTab === "swot" ? (
                <select
                  name="sub_type"
                  required
                  defaultValue="strength"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                >
                  {SWOT_SUB_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name="sub_type"
                  placeholder="Sub-Typ (optional)"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              )}
            </div>
            <textarea
              name="description"
              rows={4}
              placeholder="Beschreibung / Evidenz / Implikation"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">
                Strategische Wirkung (1-5)
              </label>
              <LiveRangeInput name="impact_level" defaultValue={3} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">
                Unsicherheits-Score (1-5)
              </label>
              <LiveRangeInput name="uncertainty_level" defaultValue={3} />
            </div>
            <p className="text-xs text-zinc-500">
              Qualitaetsregel: Bei Wirkung 4-5 muss die Begruendung mindestens 40 Zeichen haben.
            </p>
            <button type="submit" disabled={!canWrite} className="brand-btn px-4 py-2 text-sm">
              Eintrag speichern
            </button>
            <AiWaitOverlay
              title="AI Agent berechnet Qualitaet"
              description="Der Qualitaetswert wird berechnet und direkt in der Datenbank gespeichert."
            />
          </form>
        </article>

        <article className="brand-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">
              {getTabTitle(activeTab)} - Eintraege ({filteredEntries.length}/{entries.length})
            </h2>
            <a
              href="/strategy-cycle?l1=corporate-strategy&l2=strategy-matrix"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700"
            >
              Zur Strategie-Matrix
            </a>
          </div>

          <form className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <input type="hidden" name="tab" value={activeTab} />
            <select
              name="sort"
              defaultValue={sort}
              className="min-w-[260px] flex-1 rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs"
            >
              <option value="score_desc">Sortierung: Qualitaetswert (absteigend)</option>
              <option value="updated_desc">Sortierung: Letzte Aktualisierung</option>
            </select>
            <select
              name="quality_band"
              defaultValue={qualityBandFilter}
              className="min-w-[180px] rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs"
            >
              <option value="all">Band: Alle</option>
              <option value="high">Band: Hohe Qualitaet</option>
              <option value="medium">Band: Mittlere Qualitaet</option>
              <option value="low">Band: Niedrige Qualitaet</option>
            </select>
            <div className="flex min-w-[150px] items-center gap-2">
              <label className="text-xs text-zinc-600">Mindestwert</label>
              <input
                type="number"
                name="min_score"
                min={0}
                max={100}
                defaultValue={minScore}
                className="w-24 rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs"
              />
            </div>
            <button
              type="submit"
              className="shrink-0 rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700"
            >
              Filter anwenden
            </button>
          </form>

          <div className="mt-4 space-y-3">
            {filteredEntries.length === 0 ? (
              <p className="brand-surface p-3 text-sm text-zinc-600">
                Keine Eintraege fuer die aktuellen Filter.
              </p>
            ) : (
              filteredEntries.map((entry) => {
                const promotedChallengeId = workspace.promotedBySourceId.get(entry.id) ?? null;
                const pestelArea = activeTab === "environment" ? getPestelAreaStyle(entry.sub_type) : null;
                const updatedAtLabel = String(entry.updated_at ?? "")
                  .replace("T", " ")
                  .replace("Z", "")
                  .slice(0, 16);
                return (
                  <div
                    key={entry.id}
                    id={`entry-${entry.id}`}
                    className="brand-surface p-3"
                    style={pestelArea ? { borderColor: (pestelArea.style as { borderColor: string }).borderColor } : undefined}
                  >
                    <form action={updateAnalysisEntry} className="space-y-2">
                      <input type="hidden" name="analysis_entry_id" value={entry.id} />
                      <input type="hidden" name="analysis_type" value={activeTab} />
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                        <div className="min-w-0 space-y-2">
                          <label className="block min-w-0">
                            <span className="mb-1 block text-xs font-medium text-zinc-600">Titel / Kernaussage</span>
                            <input
                              name="title"
                              defaultValue={entry.title}
                              className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                            />
                          </label>
                          <label className="block min-w-0 overflow-hidden">
                            <span className="mb-1 block text-xs font-medium text-zinc-600">
                              Strategischer Impact
                            </span>
                            <LiveRangeInput name="impact_level" defaultValue={entry.impact_level ?? 3} />
                          </label>
                          <label className="block min-w-0 overflow-hidden">
                            <span className="mb-1 block text-xs font-medium text-zinc-600">
                              Unsicherheits-Score
                            </span>
                            <LiveRangeInput name="uncertainty_level" defaultValue={entry.uncertainty_level ?? 3} />
                          </label>
                        </div>
                        <div className="block min-w-0">
                          <span className="mb-1 block text-xs font-medium text-zinc-600">Sub-Typ</span>
                          {activeTab === "environment" ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-1 gap-2">
                                {PESTEL_AREA_META.map((area) => (
                                  <label
                                    key={area.key}
                                    className="flex min-w-0 items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
                                    style={{
                                      background: `color-mix(in srgb, var(--brand-primary) ${area.tintPercent}%, white)`,
                                      borderColor: `color-mix(in srgb, var(--brand-primary) ${Math.min(area.tintPercent + 18, 72)}%, white)`,
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name="sub_type"
                                      value={area.key}
                                      defaultChecked={entry.sub_type === area.key}
                                    />
                                    <span className="truncate">{area.label}</span>
                                  </label>
                                ))}
                              </div>
                              <label className="flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs">
                                <input
                                  type="radio"
                                  name="sub_type"
                                  value=""
                                  defaultChecked={!isPestelSubType(entry.sub_type)}
                                />
                                <span>Keine PESTEL-Kategorie</span>
                              </label>
                            </div>
                          ) : activeTab === "swot" ? (
                            <select
                              name="sub_type"
                              defaultValue={entry.sub_type ?? "strength"}
                              className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                            >
                              {SWOT_SUB_TYPES.map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              name="sub_type"
                              defaultValue={entry.sub_type ?? ""}
                              placeholder="Sub-Typ"
                              className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                            />
                          )}
                        </div>
                      </div>
                      <textarea
                        name="description"
                        rows={3}
                        defaultValue={entry.description ?? ""}
                        className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="submit"
                          disabled={!canWrite}
                          className="brand-btn px-3 py-1.5 text-xs"
                        >
                          Speichern
                        </button>
                        <AiWaitOverlay
                          title="AI Agent berechnet Qualitaet"
                          description="Wir rechnen den Qualitaetswert neu und speichern ihn persistent."
                        />
                        <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                          Qualitaetswert: {entry.qualityScore}
                        </span>
                        <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                          Quelle: {entry.qualitySource === "llm" ? "LLM" : "Rule-Fallback"}
                        </span>
                        <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                          Band: {getQualityBandLabel(entry.qualityBand)}
                        </span>
                        {pestelArea ? (
                          <span
                            className="rounded-md border px-2 py-1 text-xs"
                            style={pestelArea.style}
                          >
                            PESTEL: {pestelArea.label}
                          </span>
                        ) : null}
                        <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                          Zone: {getPriorityZone(entry.impact_level, entry.uncertainty_level)}
                        </span>
                        {entry.qualityScore === 0 ? (
                          <span className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-700">
                            Kein strategischer Nutzen erkannt - erscheint nicht im Graph
                          </span>
                        ) : null}
                      </div>
                    </form>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <form action={promoteToStrategicChallenge}>
                        <input type="hidden" name="analysis_entry_id" value={entry.id} />
                        <input type="hidden" name="analysis_type" value={activeTab} />
                        <button
                          type="submit"
                          disabled={!canWrite || promotedChallengeId !== null}
                          className="brand-btn-secondary px-3 py-1.5 text-xs"
                        >
                          {promotedChallengeId ? "Bereits als Herausforderung uebernommen" : "Als Herausforderung uebernehmen"}
                        </button>
                      </form>
                      <form action={deleteAnalysisEntry}>
                        <input type="hidden" name="analysis_entry_id" value={entry.id} />
                        <input type="hidden" name="analysis_type" value={activeTab} />
                        <button
                          type="submit"
                          disabled={!canWrite}
                          className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-700"
                        >
                          Loeschen
                        </button>
                      </form>
                      <span className="text-xs text-zinc-500">
                        Aktualisiert: {updatedAtLabel || "-"}
                      </span>
                    </div>
                    <div className="mt-2">
                      <p className="mb-1 text-xs font-medium text-zinc-600">Bestehender Herausforderung zuordnen</p>
                      <div className="flex flex-wrap gap-2">
                        {challengeOptions.length === 0 ? (
                          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-500">
                            Keine Herausforderungen verfuegbar
                          </span>
                        ) : (
                          challengeOptions.map((challenge) => {
                            const isCurrent = challenge.sourceAnalysisEntryId === entry.id;
                            return (
                              <form key={`${entry.id}-${challenge.id}`} action={attachFindingToChallenge}>
                                <input type="hidden" name="analysis_entry_id" value={entry.id} />
                                <input type="hidden" name="analysis_type" value={activeTab} />
                                <input type="hidden" name="challenge_id" value={challenge.id} />
                                <button
                                  type="submit"
                                  disabled={!canWrite}
                                  className={`rounded-full border px-3 py-1 text-xs ${
                                    isCurrent
                                      ? "border-zinc-900 bg-zinc-900 text-white"
                                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                                  }`}
                                >
                                  {challenge.title}
                                </button>
                              </form>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>
      </section>
      ) : null}

      {activeL1 === "corporate-strategy" && activeTab === "strategy-matrix" ? (
        <StrategyMatrixPage
          searchParams={Promise.resolve({
            drawer_direction_id: resolvedSearchParams.drawer_direction_id,
          })}
        />
      ) : null}
    </div>
  );
}
