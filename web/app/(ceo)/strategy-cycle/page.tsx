import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  approveLinkDraft,
  attachFindingToChallenge,
  createObjectiveInCycle,
  createStrategicChallengeInCycle,
  createPipInitiativeInCycle,
  updatePipInitiativeInCycle,
  createStrategyProgramInCycle,
  updateStrategyProgramInCycle,
  createAnalysisEntry,
  createStrategicDirectionInCycle,
  backfillEntryQuality,
  clearCorrelationStatusOverride,
  deleteObjectiveInCycle,
  deleteStrategicChallengeInCycle,
  deleteStrategicDirectionInCycle,
  dismissChallengeCandidate,
  deleteAnalysisEntry,
  generateLinkDrafts,
  linkDirectionToChallengePredecessor,
  linkDirectionToObjectiveInCycle,
  linkObjectiveToBusinessModelInCycle,
  linkObjectiveToIndustryInCycle,
  promoteChallengeCandidate,
  promoteClusterToStrategicChallenge,
  promoteToStrategicChallenge,
  recomputeClusters,
  recomputeGraphLayout,
  recomputeGaps,
  rejectLinkDraft,
  saveCorrelationStatusOverride,
  linkStrategicChallengeToBusinessModelInCycle,
  linkStrategicChallengeToIndustryInCycle,
  linkStrategicDirectionToBusinessModelInCycle,
  linkStrategicDirectionToIndustryInCycle,
  unlinkObjectiveFromBusinessModelInCycle,
  unlinkObjectiveFromIndustryInCycle,
  unlinkStrategicChallengeFromBusinessModelInCycle,
  linkStrategicChallengeToAnalysisEntryInCycle,
  unlinkStrategicChallengeFromAnalysisEntryInCycle,
  unlinkStrategicChallengeFromIndustryInCycle,
  unlinkStrategicDirectionFromBusinessModelInCycle,
  unlinkStrategicDirectionFromIndustryInCycle,
  unlinkDirectionChallengePredecessor,
  unlinkDirectionFromObjectiveInCycle,
  updateObjectiveInCycle,
  updateStrategicChallengeAssessment,
  updateStrategicDirectionAssessment,
  updateAnalysisEntry,
  queueObjectiveEvaluationBackfill,
} from "@/app/(ceo)/strategy-cycle/actions";
import {
  promoteStrategyObjectRevision,
  proposeStrategyObjectDraft,
  rejectStrategyObjectRevision,
  updateStrategyObjectDraft,
  linkStrategyObjectDraftAssignment,
  unlinkStrategyObjectDraftAssignment,
} from "@/app/(ceo)/strategy-cycle/strategy-object-revision-actions";
import { setStrategyObjectLifecycle } from "@/app/(ceo)/strategy-cycle/strategy-object-lifecycle-actions";
import { TableHorizontalScroll } from "@/components/table/TableHorizontalScroll";
import { AnalysisVisualizationWorkspace } from "@/components/analysis-visualization/AnalysisVisualizationWorkspace";
import { AiWaitOverlay } from "@/components/ceo/AiWaitOverlay";
import { LiveRangeInput } from "@/components/ceo/LiveRangeInput";
import { ChallengeCreateForm } from "@/components/ceo/ChallengeCreateForm";
import { ObjectiveCreateForm } from "@/components/ceo/ObjectiveCreateForm";
import { StrategicDesignDashboard } from "@/components/ceo/StrategicDesignDashboard";
import { StrategicDesignSummary } from "@/components/ceo/StrategicDesignSummary";
import { StrategicDirectionsTable } from "@/components/ceo/StrategicDirectionsTable";
import { ObjectivesTable } from "@/components/ceo/ObjectivesTable";
import { ChallengesTable } from "@/components/ceo/ChallengesTable";
import { AnalysisEntriesTable } from "@/components/ceo/AnalysisEntriesTable";
import { ProgramPipWorkspace } from "@/components/ceo/ProgramPipWorkspace";
import { InitiativePipWorkspace } from "@/components/ceo/InitiativePipWorkspace";
import { StrategyDraftFocus } from "@/components/ceo/strategy-objects/StrategyDraftFocus";
import { RefreshOnSuccess } from "@/components/ceo/RefreshOnSuccess";
import { ObjectiveEvaluationPrompt } from "@/components/ceo/strategy-objects/ObjectiveEvaluationPrompt";
import { ObjectiveAiPanel } from "@/components/ceo/ObjectiveAiPanel";
import { ObjectiveBalanceScatterPlot } from "@/components/ceo/ObjectiveBalanceScatterPlot";
import { PortfolioSummaryView } from "@/components/ceo/PortfolioSummaryView";
import { getTenantBranding } from "@/lib/ceo/queries";
import { getPhase0Context } from "@/lib/phase0/queries";
import { resolveStrategyPlanningCycle } from "@/lib/strategy-cycle/pick-strategy-planning-cycle";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { isStrategicDirectionEligibleForPrograms } from "@/lib/strategy-objects/direction-program-eligibility";
import { computeStrategicDesignCorrelationSummary } from "@/lib/strategy-cycle/correlation";
import { computeStrategicDesignInsights } from "@/lib/strategy-cycle/strategic-design-insights";
import {
  getStrategyCycleWorkspaceData,
  type InitiativeKrLinkContext,
  type ProgramOverviewViewRow,
} from "@/lib/strategy-cycle/queries";
import {
  readAnalysisNetworkLlmPolicy,
  isLlmFeatureEnabled,
  type AnalysisNetworkLlmPolicy,
} from "@/lib/analysis-network/policy";
import { buildProgramMatrix } from "@/lib/strategy-cycle/program-matrix";
import { normalizeContributionLevel, type ContributionLevel } from "@/lib/strategy-cycle/coverage-level";
import { ProgramMappingMatrix } from "@/components/ceo/ProgramMappingMatrix";
import { AnalysisNetworkRecommendationPanels } from "@/components/ceo/strategy-cycle/AnalysisNetworkRecommendationPanels";
import { StrategyCycleOverviewLoader } from "@/components/ceo/strategy-cycle/StrategyCycleOverviewLoader";
import { buildAnalysisEntryOverviewStats } from "@/lib/strategy-cycle/analysis-entry-overview";
import { buildOverviewDrillTables } from "@/lib/strategy-cycle/overview-drill-tables";
import { computeAnalysisNetworkStaleFlags } from "@/lib/strategy-cycle/analysis-network-stale";
import { getStrategyRevisionStatusMessage } from "@/lib/strategy-objects/revision-status-messages";
import { fetchOpenDraftsForCycle } from "@/lib/strategy-objects/revision-queries";

const STRATEGY_OBJECT_RETURN_PATHS = {
  objectives: "/strategy-cycle?l1=objectives",
  challenges: "/strategy-cycle?l1=strategic-directions&l2=challenges",
  directions: "/strategy-cycle?l1=strategic-directions&l2=design",
} as const;

type StrategyCycleViewPageProps = {
  searchParams: Promise<{
    l1?: string;
    l2?: string;
    tab?: string;
    error?: string;
    success?: string;
    strategy_draft?: string;
    sort?: string;
    min_score?: string;
    quality_band?: string;
  }>;
};

const STRATEGY_CYCLE_TABS = [
  "summary",
  "environment",
  "company",
  "competitor",
  "swot",
  "workshop",
  "other",
] as const;

const L1_TABS = [
  "overview",
  "objectives",
  "corporate-strategy",
  "strategic-directions",
  "pips",
] as const;
const STRATEGIC_DESIGN_TABS = ["dashboard", "summary", "challenges", "design", "strategy-matrix"] as const;
const PIP_TABS = ["programme", "initiativen"] as const;

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

/** Pending ohne Fortschritt: nach dieser Zeit Button wieder frei. */
const BACKGROUND_JOB_PENDING_STALE_MS = 20 * 60 * 1000;
/** Running: lange Laeufe (viele Ziele/Entries) erlauben; danach als haengend behandeln. */
const BACKGROUND_JOB_RUNNING_STALE_MS = 90 * 60 * 1000;

type BackgroundJobRow = {
  job_type: string;
  status: string;
  created_at: string;
  started_at: string | null;
};

function isBackgroundJobStaleForUiLock(
  job: Pick<BackgroundJobRow, "status" | "created_at" | "started_at">
): boolean {
  const now = Date.now();
  if (job.status === "pending") {
    return now - new Date(job.created_at).getTime() > BACKGROUND_JOB_PENDING_STALE_MS;
  }
  if (job.status === "running") {
    const ref = job.started_at
      ? new Date(job.started_at).getTime()
      : new Date(job.created_at).getTime();
    return now - ref > BACKGROUND_JOB_RUNNING_STALE_MS;
  }
  return false;
}

function jobActivelyLocksUi(job: BackgroundJobRow, jobType: string): boolean {
  if (job.job_type !== jobType) return false;
  if (job.status !== "pending" && job.status !== "running") return false;
  return !isBackgroundJobStaleForUiLock(job);
}

function ObjectiveEvaluationDisabledNotice({ policy }: { policy: AnalysisNetworkLlmPolicy }) {
  if (isLlmFeatureEnabled(policy, "objective_evaluation")) return null;
  const who = "Eine berechtigte Rolle kann in der Systemkonfiguration (LLM-Nutzung)";
  if (!policy.llmEnabled) {
    return (
      <p className="mt-2 text-xs text-zinc-600">
        Sentinel✨ Ziel-Bewertung: LLM ist global aus. {who} «LLM global aktivieren» einschalten.
      </p>
    );
  }
  return (
    <p className="mt-2 text-xs text-zinc-600">
      Sentinel✨ Ziel-Bewertung: Feature ist aus. {who} «Ziele-Bewertung» aktivieren (ggf.
      zuerst «LLM global aktivieren»).
    </p>
  );
}

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
    case "overview":
      return "Übersicht";
    case "objectives":
      return "Ziele";
    case "corporate-strategy":
      return "Strategische Erkenntnisse";
    case "strategic-directions":
      return "Strategisches Design";
    case "pips":
      return "PIPs";
    default:
      return "Strategische Erkenntnisse";
  }
}

function getStGallenHint(tab: string) {
  if (tab === "summary")
    return "Strategische Gesamtsicht mit Netzwerk und Tabellen-Scan aller Analysepunkte.";
  if (tab === "strategy-matrix")
    return "Mapping-Matrix: strategische Herausforderungen und Sto\u00DFrichtungen im \u00DCberblick (Score, Verkn\u00FCpfung, \u00DCberschneidungen).";
  if (tab === "environment") return "St. Gallen: Umwelt-Sph\u00E4ren und Anspruchsgruppen systematisch erfassen.";
  if (tab === "company") return "St. Gallen: interne F\u00E4higkeiten, Ressourcen und Prozesse bewerten.";
  if (tab === "competitor") return "St. Gallen: Wettbewerbsposition und Differenzierungskr\u00E4fte analysieren.";
  if (tab === "swot") return "St. Gallen: interne/ externe Faktoren als S-W-O-T verdichten.";
  return "Strategische Befunde strukturiert dokumentieren und priorisieren.";
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
      text: "Bei hoher Wirkung (4-5) braucht es eine belastbare Begr\u00FCndung (mind. 40 Zeichen).",
    };
  if (error === "invalid-subtype")
    return { type: "error", text: "Der Sub-Typ passt nicht zum ausgew\u00E4hlten Analysebereich." };
  if (error === "not-found")
    return { type: "error", text: "Analyse-Eintrag wurde nicht gefunden oder ist nicht mehr verf\u00FCgbar." };
  if (error === "missing-link")
    return { type: "error", text: "Bitte g\u00FCltige Verkn\u00FCpfung ausw\u00E4hlen." };
  if (error === "objective-not-linkable")
    return {
      type: "error",
      text: "Nur Ziele mit Status \u00ABaktiv\u00BB oder \u00ABauff\u00E4llig\u00BB (at_risk) k\u00F6nnen mit einer Sto\u00DFrichtung verkn\u00FCpft werden.",
    };
  if (error === "direction-active-requires-links")
    return {
      type: "error",
      text: "Status \u00ABAktiv\u00BB ist nur m\u00F6glich, wenn diese Sto\u00DFrichtung mindestens eine strategische Herausforderung als Vorg\u00E4nger verkn\u00FCpft hat (Datenbankregel).",
    };
  if (error === "direction-update-failed")
    return {
      type: "error",
      text: "Sto\u00DFrichtung konnte nicht gespeichert werden (z. B. Berechtigung oder Validierung). Details siehe Server-Log.",
    };
  if (error === "direction-not-found")
    return {
      type: "error",
      text: "Sto\u00DFrichtung wurde nicht gefunden oder geh\u00F6rt nicht zum aktiven Planungszyklus \u2014 Speichern hatte keine Wirkung.",
    };
  if (error === "program-insert-failed")
    return { type: "error", text: "Programm konnte nicht gespeichert werden. Bitte Berechtigungen pr\u00FCfen." };
  if (error === "program-duplicate-title")
    return { type: "error", text: "Ein Programm mit diesem Titel existiert bereits in diesem Zyklus." };
  if (error === "program-needs-active-initiative")
    return {
      type: "error",
      text: "Ein Programm kann erst auf Aktiv gesetzt werden, wenn mindestens eine zugeh\u00F6rige Initiative aktiv ist.",
    };
  if (error === "program-invalid-dates")
    return {
      type: "error",
      text: "Das Enddatum darf nicht vor dem Startdatum liegen.",
    };
  if (error === "program-invalid-owner")
    return { type: "error", text: "Der gew\u00E4hlte Sponsor geh\u00F6rt nicht zu dieser Organisation." };
  if (error === "program-invalid-sponsor-role")
    return {
      type: "error",
      text: "Als Sponsor sind nur Personen mit Rolle Executive zul\u00E4ssig.",
    };
  if (error === "program-invalid-direction")
    return {
      type: "error",
      text: "Die strategische Sto\u00DFrichtung wurde nicht gefunden oder geh\u00F6rt nicht zu diesem Zyklus.",
    };
  if (error === "program-direction-not-active")
    return {
      type: "error",
      text: "Nur Sto\u00DFrichtungen mit Status \u00ABAktiv\u00BB k\u00F6nnen f\u00FCr Programme verwendet werden.",
    };
  if (error === "program-update-failed")
    return {
      type: "error",
      text: "Programm konnte nicht gespeichert werden. Bitte Berechtigungen und Eingaben pr\u00FCfen.",
    };
  if (error === "program-update-invalid-status")
    return { type: "error", text: "Ung\u00FCltiger Programm-Status." };
  if (error === "initiative-invalid-status")
    return { type: "error", text: "Ung\u00FCltiger Initiative-Status." };
  if (error === "initiative-program-closed")
    return {
      type: "error",
      text: "Geschlossene Programme k\u00F6nnen f\u00FCr neue oder geaenderte Initiativen nicht gewaehlt werden.",
    };
  if (error === "initiative-invalid-program")
    return { type: "error", text: "Programm wurde nicht gefunden oder geh\u00F6rt nicht zu diesem Zyklus." };
  if (error === "initiative-invalid-owner")
    return { type: "error", text: "Der gew\u00E4hlte Owner geh\u00F6rt nicht zu dieser Organisation." };
  if (error === "initiative-invalid-dates")
    return {
      type: "error",
      text: "Bei der Initiative darf das Enddatum nicht vor dem Startdatum liegen.",
    };
  if (error === "initiative-insert-failed")
    return { type: "error", text: "Initiative konnte nicht erstellt werden." };
  if (error === "initiative-update-failed")
    return { type: "error", text: "Initiative konnte nicht gespeichert werden." };
  if (error === "initiative-update-missing-id")
    return { type: "error", text: "Initiative-ID fehlt \u2014 bitte erneut ausw\u00E4hlen." };
  if (error === "initiative-not-found")
    return { type: "error", text: "Initiative wurde nicht gefunden." };
  if (error === "objective-insert-failed")
    return { type: "error", text: "Ziel konnte nicht gespeichert werden. Bitte Berechtigungen pr\u00FCfen." };
  if (error === "ai-evaluation-disabled")
    return {
      type: "error",
      text: "Sentinel\u2728 Ziel-Bewertung ist nicht aktiviert. Bitte eine berechtigte Rolle, in der Systemkonfiguration (LLM-Nutzung) \u00ABLLM global aktivieren\u00BB und \u00ABZiele-Bewertung\u00BB zu pr\u00FCfen.",
    };
  if (error === "company-profile-incomplete")
    return {
      type: "error",
      text: "Unternehmensprofil f\u00FCr die KI-Bewertung unvollst\u00E4ndig. Bitte Kennwerte/Unternehmensinfo erg\u00E4nzen.",
    };
  if (error === "llm-budget-exceeded")
    return { type: "error", text: "LLM-Budget erreicht. Ziel-Bewertung wurde nicht gestartet." };
  if (success === "saved")
    return { type: "success", text: "Analyse-Eintrag wurde gespeichert." };
  if (success === "updated")
    return { type: "success", text: "Analyse-Eintrag wurde aktualisiert." };
  if (success === "deleted")
    return { type: "success", text: "Analyse-Eintrag wurde gel\u00F6scht." };
  if (success === "promoted")
    return { type: "success", text: "Eintrag wurde als strategische Herausforderung in die Matrix \u00FCbernommen." };
  if (success === "links-generated")
    return { type: "success", text: "Link-Entw\u00FCrfe wurden neu generiert." };
  if (success === "links-queued")
    return { type: "success", text: "Link-Entw\u00FCrfe werden im Hintergrund generiert." };
  if (success === "link-approved")
    return { type: "success", text: "Link-Entwurf wurde freigegeben." };
  if (success === "link-rejected")
    return { type: "success", text: "Link-Entwurf wurde verworfen." };
  if (success === "clusters-recomputed")
    return { type: "success", text: "Cluster wurden neu berechnet." };
  if (success === "clusters-queued")
    return { type: "success", text: "Cluster werden im Hintergrund neu berechnet." };
  if (success === "gaps-recomputed")
    return { type: "success", text: "L\u00FCckenanalyse wurde neu berechnet." };
  if (success === "gaps-queued")
    return { type: "success", text: "L\u00FCckenanalyse wird im Hintergrund neu berechnet." };
  if (success === "graph-layout-recomputed")
    return { type: "success", text: "Graph-Layout wurde neu berechnet." };
  if (success === "quality-backfilled")
    return { type: "success", text: "Bestehende Analysepunkte wurden neu bewertet und im Graph aktualisiert." };
  if (success === "graph-layout-queued")
    return { type: "success", text: "Graph-Layout Job wurde gestartet und l\u00E4uft im Hintergrund." };
  if (success === "quality-backfill-queued")
    return { type: "success", text: "Quality-Backfill Job wurde gestartet und l\u00E4uft im Hintergrund." };
  if (success === "cluster-promoted")
    return { type: "success", text: "Cluster wurde als strategische Herausforderung \u00FCbernommen." };
  if (success === "finding-linked")
    return { type: "success", text: "Befund wurde einer bestehenden Herausforderung zugeordnet." };
  if (success === "direction-created")
    return { type: "success", text: "Strategisches Design wurde erstellt." };
  if (success === "objective-created")
    return { type: "success", text: "Ziel wurde erstellt." };
  if (success === "objective-updated")
    return { type: "success", text: "Ziel wurde aktualisiert." };
  if (success === "objective-deleted")
    return { type: "success", text: "Ziel wurde gel\u00F6scht." };
  if (success === "objective-evaluation-complete")
    return { type: "success", text: "Ziele wurden von Sentinel✨ bewertet." };
  if (success === "objective-evaluated")
    return { type: "success", text: "Sentinel✨-Bewertung für das Ziel wurde neu berechnet." };
  if (success === "objective-evaluation-backfill-queued")
    return { type: "success", text: "Ziele werden im Hintergrund neu bewertet." };
  if (success === "challenge-created")
    return { type: "success", text: "Strategische Herausforderung wurde erstellt." };
  if (success === "challenge-deleted")
    return { type: "success", text: "Strategische Herausforderung wurde gel\u00F6scht." };
  if (success === "direction-deleted")
    return { type: "success", text: "Strategische Sto\u00DFrichtung wurde gel\u00F6scht." };
  if (success === "initiative-created")
    return { type: "success", text: "Initiative wurde erstellt." };
  if (success === "initiative-updated")
    return { type: "success", text: "Initiative wurde aktualisiert." };
  if (success === "program-created")
    return { type: "success", text: "Programm wurde erstellt." };
  if (success === "program-updated")
    return { type: "success", text: "Programm wurde aktualisiert." };
  if (success === "assessment-updated")
    return {
      type: "success",
      text: "Sto\u00DFrichtung wurde gespeichert (Bewertungen, Status, Text).",
    };
  if (success === "linked")
    return { type: "success", text: "Predecessor-Verkn\u00FCpfung wurde gespeichert." };
  if (success === "unlinked")
    return { type: "success", text: "Predecessor-Verkn\u00FCpfung wurde entfernt." };
  if (success === "strategy-reference-saved")
    return { type: "success", text: "Unternehmensinfo wurde gespeichert." };
  if (success === "company-kennzahlen-saved")
    return { type: "success", text: "Kennwerte wurden gespeichert." };
  if (success === "correlation-override-saved")
    return { type: "success", text: "Status-Override f\u00FCr die Korrelation wurde gespeichert." };
  if (success === "correlation-override-cleared")
    return { type: "success", text: "Status-Override wurde entfernt. Auto-Status ist wieder aktiv." };
  const revisionStatus = getStrategyRevisionStatusMessage(error, success);
  if (revisionStatus) return revisionStatus;
  if (error) {
    return {
      type: "error",
      text: "Vorgang fehlgeschlagen. Bitte Eingaben prüfen oder erneut versuchen.",
    };
  }
  return null;
}

function deriveQualityBand(score: number): "high" | "medium" | "low" {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

export default async function StrategyCycleViewPage({ searchParams }: StrategyCycleViewPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedL1Early = String(resolvedSearchParams.l1 ?? "").trim();
  if (requestedL1Early === "unternehmensinfo" || requestedL1Early === "mission-vision-culture-values") {
    const sp = new URLSearchParams();
    const l2 = resolvedSearchParams.l2 ?? resolvedSearchParams.tab;
    if (l2) sp.set("l2", String(l2));
    if (resolvedSearchParams.success) sp.set("success", String(resolvedSearchParams.success));
    if (resolvedSearchParams.error) sp.set("error", String(resolvedSearchParams.error));
    const q = sp.toString();
    redirect(`/unternehmensinfo${q ? `?${q}` : ""}`);
  }
  const legacyTab = resolvedSearchParams.tab;
  const requestedL1 = String(resolvedSearchParams.l1 ?? "").trim();
  const rawL2Param = resolvedSearchParams.l2 ?? legacyTab;
  const activeL1 = L1_TABS.includes(requestedL1 as (typeof L1_TABS)[number])
    ? requestedL1
    : legacyTab
      ? "corporate-strategy"
      : "overview";
  const requestedL2 =
    rawL2Param != null && String(rawL2Param).trim() !== ""
      ? String(rawL2Param).trim()
      : activeL1 === "strategic-directions"
        ? "dashboard"
        : "summary";
  const activeTab =
    activeL1 === "corporate-strategy" &&
    STRATEGY_CYCLE_TABS.includes(requestedL2 as (typeof STRATEGY_CYCLE_TABS)[number])
      ? requestedL2
      : "summary";
  const activeStrategicTab =
    activeL1 === "strategic-directions"
      ? STRATEGIC_DESIGN_TABS.includes(requestedL2 as (typeof STRATEGIC_DESIGN_TABS)[number])
        ? (requestedL2 as (typeof STRATEGIC_DESIGN_TABS)[number])
        : "dashboard"
      : "summary";
  const activePipTab =
    activeL1 === "pips" && PIP_TABS.includes(requestedL2 as (typeof PIP_TABS)[number])
      ? requestedL2
      : "programme";
  const actionTab = ANALYSIS_TYPES.includes(activeTab as (typeof ANALYSIS_TYPES)[number]) ? activeTab : "environment";

  const pageAccess = await getSidebarAccessContext("strategy-cycle");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");
  const canWrite = pageAccess.canWrite;

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  const selectedCycle = await resolveStrategyPlanningCycle(context.organizationId);

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

  const workspace = await getStrategyCycleWorkspaceData(
    context.organizationId,
    selectedCycle.id,
    selectedCycle.legacy_planning_cycle_id ?? undefined
  );
  const branding = await getTenantBranding(context.organizationId);
  const openStrategyDraftByIdentityId = await fetchOpenDraftsForCycle(
    context.organizationId,
    selectedCycle.id
  );
  const revisionActions = {
    proposeStrategyObjectDraft,
    updateStrategyObjectDraft,
    promoteStrategyObjectRevision,
    rejectStrategyObjectRevision,
    linkStrategyObjectDraftAssignment,
    unlinkStrategyObjectDraftAssignment,
    setStrategyObjectLifecycle,
  };
  const analysisLlmPolicy = readAnalysisNetworkLlmPolicy(branding?.branding_config ?? null);
  const canQueueObjectiveEvaluation = isLlmFeatureEnabled(analysisLlmPolicy, "objective_evaluation");
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
  const objectiveIdsByDirection = new Map<string, string[]>();
  for (const link of workspace.directionObjectiveLinks ?? []) {
    const current = objectiveIdsByDirection.get(link.strategic_direction_id) ?? [];
    current.push(link.objective_id);
    objectiveIdsByDirection.set(link.strategic_direction_id, current);
  }
  const challengeCoverageByDirection: Record<string, Record<string, ContributionLevel>> = {};
  for (const link of workspace.challengeDirectionLinks ?? []) {
    const dirId = link.strategic_direction_id;
    const chId = link.strategic_challenge_id;
    if (!challengeCoverageByDirection[dirId]) challengeCoverageByDirection[dirId] = {};
    challengeCoverageByDirection[dirId][chId] = normalizeContributionLevel(
      (link as { contribution_level?: string | null }).contribution_level
    );
  }
  const objectiveCoverageByDirection: Record<string, Record<string, ContributionLevel>> = {};
  for (const link of workspace.directionObjectiveLinks ?? []) {
    const dirId = link.strategic_direction_id;
    const obId = link.objective_id;
    if (!objectiveCoverageByDirection[dirId]) objectiveCoverageByDirection[dirId] = {};
    objectiveCoverageByDirection[dirId][obId] = normalizeContributionLevel(
      (link as { contribution_level?: string | null }).contribution_level
    );
  }
  const directionCountByChallengeId = new Map<string, number>();
  const directionIdsByChallengeId = new Map<string, Set<string>>();
  for (const link of workspace.challengeDirectionLinks ?? []) {
    directionCountByChallengeId.set(
      link.strategic_challenge_id,
      (directionCountByChallengeId.get(link.strategic_challenge_id) ?? 0) + 1
    );
    const current = directionIdsByChallengeId.get(link.strategic_challenge_id) ?? new Set<string>();
    current.add(link.strategic_direction_id);
    directionIdsByChallengeId.set(link.strategic_challenge_id, current);
  }
  const programById = new Map((workspace.programs ?? []).map((p) => [p.id, p] as const));
  const programOverviewById = new Map<string, ProgramOverviewViewRow>(
    ((workspace.programOverviews ?? []) as ProgramOverviewViewRow[]).map((row) => [row.id, row])
  );
  const initiativesByProgramId: Record<
    string,
    Array<{
      id: string;
      title: string;
      status: string | null;
      priority: number | null;
      progress_percent: number | null;
    }>
  > = {};
  for (const initiative of workspace.initiatives ?? []) {
    const pid = initiative.program_id;
    if (!pid) continue;
    const cur = initiativesByProgramId[pid] ?? [];
    cur.push({
      id: initiative.id,
      title: initiative.title,
      status: initiative.status ?? null,
      priority: initiative.priority ?? null,
      progress_percent:
        (initiative as { progress_percent?: number | null }).progress_percent ?? null,
    });
    initiativesByProgramId[pid] = cur;
  }
  for (const key of Object.keys(initiativesByProgramId)) {
    initiativesByProgramId[key].sort(
      (a, b) => (a.priority ?? 999) - (b.priority ?? 999)
    );
  }
  const directionIdsWithInitiatives = new Set<string>();
  for (const initiative of workspace.initiatives ?? []) {
    const program = initiative.program_id ? programById.get(initiative.program_id) : null;
    if (program?.strategic_direction_id) directionIdsWithInitiatives.add(program.strategic_direction_id);
  }
  const totalChallenges = (workspace.challenges ?? []).length;
  const challengesCoveredByDirections = totalChallenges === 0 ? 0 : (workspace.challenges ?? []).filter((c) => (directionCountByChallengeId.get(c.id) ?? 0) > 0).length;
  const challengesCoveredByInitiatives =
    totalChallenges === 0
      ? 0
      : (workspace.challenges ?? []).filter((c) => {
          const dirIds = directionIdsByChallengeId.get(c.id);
          if (!dirIds) return false;
          return [...dirIds].some((d) => directionIdsWithInitiatives.has(d));
        }).length;
  const coverageByDirectionsPercent = totalChallenges === 0 ? 0 : Math.round((challengesCoveredByDirections / totalChallenges) * 100);
  const coverageByInitiativesPercent = totalChallenges === 0 ? 0 : Math.round((challengesCoveredByInitiatives / totalChallenges) * 100);
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
  const annualTargetTitleById = Object.fromEntries(
    (workspace.annualTargets ?? []).map((t) => [t.id, t.title] as const)
  );
  const initiativePipRows = (workspace.initiatives ?? []).map((raw) => {
    const i = raw as typeof raw & {
      description?: string | null;
      owner_membership_id?: string | null;
      progress_percent?: number | null;
      kr_link_contexts?: InitiativeKrLinkContext[];
      linked_okrs?: unknown;
      deliverables?: unknown;
    };
    const atIds = [...new Set(targetIdsByInitiative.get(i.id) ?? [])];
    const krContexts = i.kr_link_contexts ?? [];
    const krIds = krContexts.map((c) => c.key_result_id);
    const okrLegacy = Array.isArray(i.linked_okrs) ? (i.linked_okrs as string[]) : null;
    const delLegacy = Array.isArray(i.deliverables) ? (i.deliverables as string[]) : null;
    const startRaw = (i as { start_date?: string | null }).start_date;
    const endRaw = (i as { end_date?: string | null }).end_date;
    return {
      id: i.id,
      title: i.title,
      status: i.status,
      priority: i.priority,
      program_id: i.program_id,
      progress_percent: i.progress_percent ?? 0,
      owner_membership_id: i.owner_membership_id ?? null,
      description: i.description ?? null,
      start_date: startRaw ? String(startRaw).slice(0, 10) : null,
      end_date: endRaw ? String(endRaw).slice(0, 10) : null,
      kr_link_contexts: krContexts,
      annual_target_ids: atIds,
      key_result_ids: krIds,
      annual_target_titles: atIds.map((tid) => annualTargetTitleById[tid] ?? tid),
      legacy_linked_okrs: okrLegacy,
      legacy_deliverables: delLegacy,
    };
  });
  const programsOpenForInitiatives = (workspace.programs ?? [])
    .filter((p) => String((p as { status?: string }).status ?? "") !== "closed")
    .map((p) => ({ id: p.id, title: p.title }));
  const ownerLabelByPipMembershipId: Record<string, string> = Object.fromEntries(
    (workspace.programOwnerOptions ?? []).map((o) => [o.id, o.label] as const)
  );
  for (const [mid, name] of Object.entries(workspace.responsibleNameByMembershipId ?? {})) {
    if (!ownerLabelByPipMembershipId[mid]) ownerLabelByPipMembershipId[mid] = name;
  }
  const pipOwnerOptionById = new Map(
    (workspace.programOwnerOptions ?? []).map((o) => [o.id, o] as const)
  );
  for (const row of initiativePipRows) {
    const oid = row.owner_membership_id;
    if (!oid || pipOwnerOptionById.has(oid)) continue;
    const label =
      ownerLabelByPipMembershipId[oid] ?? (workspace.responsibleNameByMembershipId ?? {})[oid] ?? "Mitglied";
    pipOwnerOptionById.set(oid, { id: oid, label });
  }
  const pipInitiativeOwnerOptions = [...pipOwnerOptionById.values()].sort((a, b) =>
    a.label.localeCompare(b.label, "de")
  );
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
  const draftChallengeCandidates = (workspace.challengeCandidates ?? []).filter((c) => c.status === "draft");
  const summaryClusters = workspace.clusters ?? [];
  const recommendedChallengeTotal = draftChallengeCandidates.length + summaryClusters.length;
  const linkDrafts = workspace.linkDrafts ?? [];
  const gapFindings = workspace.gapFindings ?? [];
  const linkDraftsCount = linkDrafts.length;
  const gapFindingsCount = gapFindings.length;
  const analyseNetzwerkOpenTotal = recommendedChallengeTotal + linkDraftsCount + gapFindingsCount;
  const recommendationClusterPanels = summaryClusters.map((cluster) => {
    const members = workspace.clusterMembersByClusterId.get(cluster.id) ?? [];
    const topMemberTitles = members
      .slice(0, 4)
      .map((member) => workspace.entryTitleById.get(member.entry_id) ?? member.entry_id);
    return {
      id: cluster.id,
      label: cluster.label,
      summary: cluster.summary ?? null,
      cluster_score: cluster.cluster_score,
      topMemberTitles,
      memberCount: members.length,
    };
  });
  const entryTitleByIdRecord = Object.fromEntries(workspace.entryTitleById.entries());
  const analysisNetworkStale = computeAnalysisNetworkStaleFlags({
    entries: workspace.entries,
    approvedLinks: workspace.approvedLinks ?? [],
    linkDrafts: workspace.linkDrafts ?? [],
    gapFindings: workspace.gapFindings ?? [],
  });
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
  const activeOrFailedJobs = (workspace.backgroundJobs ?? []).filter(
    (job) => job.status === "pending" || job.status === "running" || job.status === "failed"
  );
  const runningJobs = activeOrFailedJobs.filter((job) => job.status === "pending" || job.status === "running");
  const hasRunningQualityBackfill = runningJobs.some((job) => jobActivelyLocksUi(job, "quality_backfill"));
  const hasRunningGraphLayout = runningJobs.some((job) => jobActivelyLocksUi(job, "graph_layout_recompute"));
  const hasRunningObjectiveBackfill = runningJobs.some((job) =>
    jobActivelyLocksUi(job, "objective_evaluation_backfill")
  );
  const hasRunningLinkDrafts = runningJobs.some((job) => jobActivelyLocksUi(job, "link_draft_generation"));
  const hasRunningClusters = runningJobs.some((job) => jobActivelyLocksUi(job, "cluster_recompute"));
  const hasRunningGaps = runningJobs.some((job) => jobActivelyLocksUi(job, "gaps_recompute"));
  const staleObjectiveEvalJobs = runningJobs.filter(
    (job) =>
      job.job_type === "objective_evaluation_backfill" && isBackgroundJobStaleForUiLock(job)
  );
  const portfolioEvaluatedAtMs = workspace.portfolioEvaluation?.portfolio_evaluated_at
    ? new Date(workspace.portfolioEvaluation.portfolio_evaluated_at).getTime()
    : null;
  const latestObjectiveEvalMs = (workspace.objectives ?? []).reduce<number>((acc, o) => {
    const at = (o as { ai_evaluated_at?: string | null }).ai_evaluated_at;
    if (!at) return acc;
    const ms = new Date(at).getTime();
    return Number.isFinite(ms) && ms > acc ? ms : acc;
  }, 0);
  const hasOutdatedObjectiveEval = (workspace.objectives ?? []).some(
    (o) => (o as { ai_evaluation_status?: string | null }).ai_evaluation_status === "outdated"
  );
  const isPortfolioEvaluationStale =
    workspace.portfolioEvaluation != null &&
    (portfolioEvaluatedAtMs == null ||
      (latestObjectiveEvalMs > 0 && latestObjectiveEvalMs > portfolioEvaluatedAtMs) ||
      hasOutdatedObjectiveEval);
  const programMatrix = buildProgramMatrix({
    challenges: workspace.challenges ?? [],
    directions: (workspace.strategicDirections ?? []).map((d) => ({
      id: d.id,
      title: d.title,
      priority: d.priority ?? null,
      versioning: d.versioning,
    })),
    challengeDirectionLinks: (workspace.challengeDirectionLinks ?? []).map((link) => ({
      strategic_challenge_id: link.strategic_challenge_id,
      strategic_direction_id: link.strategic_direction_id,
      contribution_level: (link as { contribution_level?: string | null }).contribution_level ?? "medium",
    })),
    directionObjectiveLinks: workspace.directionObjectiveLinks ?? [],
    objectives: (workspace.objectives ?? []).map((o) => ({
      id: o.id,
      title: o.title,
      importance_score: (o as { importance_score?: number | null }).importance_score ?? null,
      ai_objective_score: (o as { ai_objective_score?: number | string | null }).ai_objective_score ?? null,
      versioning: o.versioning,
    })),
  });
  const analysisEntryIdsByChallengeId = new Map<string, string[]>();
  for (const row of workspace.challengeAnalysisEntries ?? []) {
    const cur = analysisEntryIdsByChallengeId.get(row.strategic_challenge_id) ?? [];
    if (!cur.includes(row.analysis_entry_id)) cur.push(row.analysis_entry_id);
    analysisEntryIdsByChallengeId.set(row.strategic_challenge_id, cur);
  }
  const strategicDesignSummary = computeStrategicDesignCorrelationSummary({
    challenges: workspace.challenges ?? [],
    objectives: workspace.objectives ?? [],
    directions: workspace.strategicDirections ?? [],
    clusterMembers: workspace.clusterMembers ?? [],
    clusterObjectiveRelations: workspace.clusterObjectiveRelations ?? [],
    challengeDirectionLinks: workspace.challengeDirectionLinks ?? [],
    directionObjectiveLinks: workspace.directionObjectiveLinks ?? [],
    overrides: workspace.correlationStatusOverrides ?? [],
    analysisEntryIdsByChallengeId,
  });
  const strategicDesignInsights = computeStrategicDesignInsights({
    challenges: workspace.challenges ?? [],
    objectives: workspace.objectives ?? [],
    strategicDirections: workspace.strategicDirections ?? [],
    challengeDirectionLinks: workspace.challengeDirectionLinks ?? [],
    directionObjectiveLinks: workspace.directionObjectiveLinks ?? [],
    correlationSummary: strategicDesignSummary,
  });

  const corporateStrategySummaryHref = `/strategy-cycle?l1=corporate-strategy&l2=summary&sort=${sort}&min_score=${minScore}&quality_band=${qualityBandFilter}`;

  const objectiveScoreValues = (workspace.objectives ?? [])
    .map((o) => Number((o as { ai_objective_score?: number | string | null }).ai_objective_score))
    .filter((value) => Number.isFinite(value));
  const objectiveAvgScore =
    objectiveScoreValues.length > 0
      ? objectiveScoreValues.reduce((acc, value) => acc + value, 0) / objectiveScoreValues.length
      : null;
  const portfolioBalanceScore =
    workspace.portfolioEvaluation?.balance_score != null &&
    Number.isFinite(Number(workspace.portfolioEvaluation.balance_score))
      ? Number(workspace.portfolioEvaluation.balance_score)
      : null;

  const extraLinkedAnalysisEntryIds = new Set(
    (workspace.challengeAnalysisEntries ?? []).map((r) => r.analysis_entry_id).filter(Boolean)
  );
  const analysisEntrySummary = buildAnalysisEntryOverviewStats(
    workspace.entries ?? [],
    workspace.challenges ?? [],
    workspace.promotedClusterIds,
    workspace.clusterMembersByClusterId,
    extraLinkedAnalysisEntryIds
  );
  const promotedEntryIdSet = new Set([
    ...workspace.promotedBySourceId.keys(),
    ...extraLinkedAnalysisEntryIds,
  ]);
  const directionCountByEntryIdRecord = Object.fromEntries(
    [...(workspace.entryDirectionIdsByEntryId?.entries() ?? [])].map(([id, ids]) => [id, ids.length])
  );
  const overviewDrillTables = buildOverviewDrillTables({
    objectives: workspace.objectives ?? [],
    entries: (workspace.entries ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      analysis_type: e.analysis_type,
      sub_type: e.sub_type,
      impact_level: e.impact_level,
      uncertainty_level: e.uncertainty_level,
      quality_score:
        typeof e.quality_score === "number" && Number.isFinite(e.quality_score)
          ? e.quality_score
          : null,
    })),
    challenges: workspace.challenges ?? [],
    directions: workspace.strategicDirections ?? [],
    programs: (workspace.programs ?? []).map((p) => {
      const pr = p as {
        id: string;
        title: string;
        status?: string | null;
        owner_membership_id?: string | null;
        budget_total?: number | null;
        start_date?: string | null;
        end_date?: string | null;
      };
      return pr;
    }),
    initiatives: (workspace.initiatives ?? []).map((i) => {
      const row = i as {
        id: string;
        title: string;
        status?: string | null;
        priority?: number | null;
        program_id?: string | null;
        owner_membership_id?: string | null;
        progress_percent?: number | null;
        start_date?: string | null;
        end_date?: string | null;
      };
      return row;
    }),
    directionCountByChallengeId: Object.fromEntries(directionCountByChallengeId),
    challengeIdsByDirection: Object.fromEntries(challengeIdsByDirection),
    objectiveIdsByDirection: Object.fromEntries(objectiveIdsByDirection),
    promotedEntryIds: promotedEntryIdSet,
    directionCountByEntryId: directionCountByEntryIdRecord,
    programOverviewById,
    programTitleById: Object.fromEntries(
      (workspace.programs ?? []).map((p) => [p.id, p.title] as const)
    ),
    ownerLabelByMembershipId: ownerLabelByPipMembershipId,
  });

  const analysisEntryIdsByChallengeRecord: Record<string, string[]> = {};
  for (const c of workspace.challenges ?? []) {
    analysisEntryIdsByChallengeRecord[c.id] = [];
  }
  for (const row of workspace.challengeAnalysisEntries ?? []) {
    const cur = analysisEntryIdsByChallengeRecord[row.strategic_challenge_id] ?? [];
    if (!cur.includes(row.analysis_entry_id)) cur.push(row.analysis_entry_id);
    analysisEntryIdsByChallengeRecord[row.strategic_challenge_id] = cur;
  }
  const challengeIdByAnalysisEntryId: Record<string, string> = {};
  for (const row of workspace.challengeAnalysisEntries ?? []) {
    challengeIdByAnalysisEntryId[row.analysis_entry_id] = row.strategic_challenge_id;
  }
  for (const ch of workspace.challenges ?? []) {
    const sid = (ch as { source_analysis_entry_id?: string | null }).source_analysis_entry_id;
    if (sid && challengeIdByAnalysisEntryId[sid] === undefined) {
      challengeIdByAnalysisEntryId[sid] = ch.id;
    }
  }
  const analysisEntriesForChallengePills = [...(workspace.entries ?? [])]
    .map((e) => ({ id: e.id, title: e.title, analysis_type: e.analysis_type }))
    .sort((a, b) => a.title.localeCompare(b.title, "de"));

  return (
    <div className="min-w-0 space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Strategiezyklus</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Arbeitsbereich Strategiezyklus</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Hier bearbeitet ihr die Strategie für den aktuellen Planungszyklus: Unternehmensprofil und Analysen,
          strategische Herausforderungen und Stoßrichtungen, Ziele sowie Programme und Initiativen — in einem
          durchgängigen Ablauf.
        </p>
      </header>

      <Suspense fallback={null}>
        <RefreshOnSuccess />
        <StrategyDraftFocus />
        <ObjectiveEvaluationPrompt
          enabled={canQueueObjectiveEvaluation}
          returnPath={STRATEGY_OBJECT_RETURN_PATHS.objectives}
        />
      </Suspense>
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
              href={
                tab === "overview"
                  ? "/strategy-cycle?l1=overview"
                  : tab === "pips"
                    ? "/strategy-cycle?l1=pips&l2=programme"
                    : `/strategy-cycle?l1=${tab}`
              }
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
        ) : activeL1 === "strategic-directions" ? (
          <div className="flex flex-wrap gap-2">
            {STRATEGIC_DESIGN_TABS.map((tab) => {
              const label =
                tab === "dashboard"
                  ? "Übersicht"
                  : tab === "summary"
                    ? "Korrelationsanalyse"
                    : tab === "challenges"
                      ? "Strategische Herausforderungen"
                      : tab === "strategy-matrix"
                        ? "Strategie-Matrix"
                        : "Strategische Sto\u00DFrichtungen";
              return (
                <a
                  key={tab}
                  href={`/strategy-cycle?l1=strategic-directions&l2=${tab}`}
                  className={`rounded-md border px-3 py-1.5 text-xs ${
                    activeStrategicTab === tab
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {label}
                </a>
              );
            })}
          </div>
        ) : activeL1 === "pips" ? (
          <div className="flex flex-wrap gap-2">
            {PIP_TABS.map((tab) => (
              <a
                key={tab}
                href={`/strategy-cycle?l1=pips&l2=${tab}`}
                className={`rounded-md border px-3 py-1.5 text-xs ${
                  activePipTab === tab
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {tab === "programme" ? "Programme" : "Initiativen"}
              </a>
            ))}
          </div>
        ) : null}
      </section>

      {activeL1 === "overview" ? (
        <StrategyCycleOverviewLoader
          analysisEntrySummary={analysisEntrySummary}
          counts={{
            analysisEntries: analysisEntrySummary.total,
            challenges: (workspace.challenges ?? []).length,
            directions: (workspace.strategicDirections ?? []).length,
            objectives: (workspace.objectives ?? []).length,
            programs: (workspace.programs ?? []).length,
            initiatives: (workspace.initiatives ?? []).length,
          }}
          kpis={strategicDesignInsights.kpis}
          drillTables={overviewDrillTables}
          corporateStrategySummaryHref={corporateStrategySummaryHref}
          objectiveAvgScore={objectiveAvgScore}
          portfolioBalanceScore={portfolioBalanceScore}
        />
      ) : null}

      {activeL1 === "objectives" ? (
        <section className="min-w-0 space-y-4">
          <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <article className="brand-card p-6">
              <h2 className="text-lg font-semibold text-zinc-900">Ziel erfassen</h2>
              <p className="mt-1 text-[11px] text-zinc-500">
                
                Neue Ziele hier anlegen (stabile Zielbilder, typ. 3–5 Jahre). Bestehende Einträge rechts in
                der Tabelle aufklappen und dort bearbeiten.
              </p>
              <ObjectiveCreateForm action={createObjectiveInCycle} canWrite={canWrite} />
            </article>
            <article className="brand-card min-w-0 p-6">
              <h3 className="text-base font-semibold text-zinc-900">Ziele</h3>
              <div className="mt-4 min-w-0">
                <ObjectivesTable
                  objectives={workspace.objectives ?? []}
                  industries={workspace.availableDimensions?.industries ?? []}
                  businessModels={workspace.availableDimensions?.businessModels ?? []}
                  industryIdsByObjective={Object.fromEntries(workspace.industryIdsByObjectiveId ?? [])}
                  businessModelIdsByObjective={Object.fromEntries(workspace.businessModelIdsByObjectiveId ?? [])}
                  creatorDisplayNameByMembershipId={workspace.creatorDisplayNameByMembershipId}
                  canWrite={canWrite}
                  openDraftByIdentityId={openStrategyDraftByIdentityId}
                  returnPath={STRATEGY_OBJECT_RETURN_PATHS.objectives}
                  revisionActions={revisionActions}
                  actions={{
                    updateObjectiveInCycle,
                    deleteObjectiveInCycle,
                    linkObjectiveToIndustryInCycle,
                    unlinkObjectiveFromIndustryInCycle,
                    linkObjectiveToBusinessModelInCycle,
                    unlinkObjectiveFromBusinessModelInCycle,
                  }}
                />
              </div>
            </article>
          </div>

          <article className="brand-card min-w-0 p-6">
            <h3 className="text-base font-semibold text-zinc-900">Portfolio-Bewertung</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Balance und Verteilung der Ziele nach Sentinel✨-Bewertung.
            </p>
            <div className="mt-4 space-y-4">
              <PortfolioSummaryView
                portfolio={workspace.portfolioEvaluation ?? null}
                isStale={isPortfolioEvaluationStale}
              />
              <form action={queueObjectiveEvaluationBackfill}>
                <button
                  type="submit"
                  disabled={
                    !canWrite ||
                    (workspace.objectives ?? []).length === 0 ||
                    hasRunningObjectiveBackfill ||
                    !canQueueObjectiveEvaluation
                  }
                  className="brand-btn rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Ziele neu bewerten
                </button>
              </form>
              <ObjectiveEvaluationDisabledNotice policy={analysisLlmPolicy} />
              {canQueueObjectiveEvaluation && staleObjectiveEvalJobs.length > 0 ? (
                <p className="mt-2 text-xs text-amber-800">
                  
                  Ein Ziel-Bewertungsjob ist älter als ca.:{" "}
                  {Math.round(BACKGROUND_JOB_PENDING_STALE_MS / 60000)} Min (pending) bzw.{" "}
                  {Math.round(BACKGROUND_JOB_RUNNING_STALE_MS / 60000)}  Min (running) — der Button ist wieder
                  aktiv. Hängende Einträge bleiben in der Jobliste; ein neuer Lauf stellt einen zusätzlichen
                  Job ein.
                </p>
              ) : null}
            </div>
          </article>

          <article className="brand-card min-w-0 p-6">
            <h3 className="text-base font-semibold text-zinc-900">Ziel-Balance (Streudiagramm)</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Grob lesbar: Intern/Extern vs Exploit/Explore (KI-Klassifikation, nur wenige Rasterpunkte). Feine
              Verschiebung unter den Punkten kommt aus Teilscores, damit Ueberlagerungen sichtbar werden.
            </p>
            <TableHorizontalScroll className="mt-4 min-w-0" bordered={false}>
              <ObjectiveBalanceScatterPlot objectives={workspace.objectives ?? []} />
            </TableHorizontalScroll>
          </article>
        </section>
      ) : null}

      {activeL1 === "strategic-directions" ? (
        <section key={activeStrategicTab} className="min-w-0 space-y-4">
          {activeStrategicTab === "dashboard" ? (
            <StrategicDesignDashboard insights={strategicDesignInsights} />
          ) : activeStrategicTab === "summary" ? (
            <StrategicDesignSummary
              canWrite={canWrite}
              summary={strategicDesignSummary}
              onSaveOverride={saveCorrelationStatusOverride}
              onClearOverride={clearCorrelationStatusOverride}
            />
          ) : activeStrategicTab === "challenges" ? (
            <div className="min-w-0 space-y-4">
              <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
                <article className="brand-card p-6">
                  <h2 className="text-lg font-semibold text-zinc-900">Herausforderung erfassen</h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    
                    Manuell oder unabhaengig von Analyse-Einträgen anlegen und bewerten.
                  </p>
                  <ChallengeCreateForm
                    action={createStrategicChallengeInCycle}
                    canWrite={canWrite}
                    analysisEntries={analysisEntriesForChallengePills}
                  />
                </article>
                <article className="brand-card min-w-0 p-6">
                  <h3 className="text-base font-semibold text-zinc-900">Strategische Herausforderungen</h3>
                  <div className="mt-4 min-w-0">
                    <ChallengesTable
                      challenges={workspace.challenges ?? []}
                      industries={workspace.availableDimensions?.industries ?? []}
                      businessModels={workspace.availableDimensions?.businessModels ?? []}
                      industryIdsByChallenge={Object.fromEntries(challengeIndustryIdsById)}
                      businessModelIdsByChallenge={Object.fromEntries(challengeBusinessModelIdsById)}
                      analysisEntries={analysisEntriesForChallengePills}
                      analysisEntryIdsByChallenge={analysisEntryIdsByChallengeRecord}
                      challengeIdByAnalysisEntryId={challengeIdByAnalysisEntryId}
                      directionCountByChallengeId={Object.fromEntries(directionCountByChallengeId)}
                      canWrite={canWrite}
                      openDraftByIdentityId={openStrategyDraftByIdentityId}
                      returnPath={STRATEGY_OBJECT_RETURN_PATHS.challenges}
                      revisionActions={revisionActions}
                      actions={{
                        updateStrategicChallengeAssessment,
                        deleteStrategicChallengeInCycle,
                        linkStrategicChallengeToIndustryInCycle,
                        unlinkStrategicChallengeFromIndustryInCycle,
                        linkStrategicChallengeToBusinessModelInCycle,
                        unlinkStrategicChallengeFromBusinessModelInCycle,
                        linkStrategicChallengeToAnalysisEntryInCycle,
                        unlinkStrategicChallengeFromAnalysisEntryInCycle,
                      }}
                    />
                  </div>
                </article>
              </div>
              <article className="brand-card min-w-0 p-6">
            <h3 className="text-base font-semibold text-zinc-900">Heatmap (Auswirkung × Dringlichkeit)</h3>
            <p className="mt-1 text-xs text-zinc-600">
              Hohe Werte oben rechts markieren prioritär zu adressierende Herausforderungen.
            </p>
            <div className="mt-4 flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start">
              <TableHorizontalScroll className="min-w-0 shrink-0">
                <table className="w-max min-w-[520px] border-collapse">
                  <thead>
                    <tr>
                      <th className="border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700">Auswirkung \\ Dringlichkeit</th>
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
              </TableHorizontalScroll>
              <div className="flex flex-col gap-4 lg:min-w-[280px]">
                <div>
                  <h4 className="text-sm font-medium text-zinc-800">Top 5 Herausforderungen</h4>
                  <p className="mt-1 text-xs text-zinc-500">Nach Herausforderungs-Score sortiert</p>
                  <ul className="mt-2 space-y-1.5">
                    {topChallenges.map((challenge, idx) => (
                      <li key={challenge.id} className="flex items-start gap-2 text-xs">
                        <span className="shrink-0 font-medium text-zinc-500">{idx + 1}.</span>
                        <span className="text-zinc-800" title={challenge.title}>
                          {challenge.title.length > 50 ? `${challenge.title.slice(0, 50)}…` : challenge.title}
                        </span>
                        <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                          {Number(challenge.challenge_score ?? 0).toFixed(1)}
                        </span>
                      </li>
                    ))}
                    {topChallenges.length === 0 && (
                      <li className="text-xs text-zinc-400">Keine Herausforderungen vorhanden.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-zinc-800">Abdeckungsgrad</h4>
                  <p className="mt-1 text-xs text-zinc-500">Herausforderungen mit Verknüpfung</p>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                      <span className="text-xs text-zinc-700">Durch Stoßrichtungen</span>
                      <span className="text-sm font-semibold text-zinc-900">
                        {challengesCoveredByDirections}/{totalChallenges} ({coverageByDirectionsPercent}%)
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                      <span className="text-xs text-zinc-700">Durch Initiativen</span>
                      <span className="text-sm font-semibold text-zinc-900">
                        {challengesCoveredByInitiatives}/{totalChallenges} ({coverageByInitiativesPercent}%)
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-zinc-400">
                    
                    Initiativen hängen über Programme an Stoßrichtungen; eine Herausforderung gilt als abgedeckt, wenn sie mit einer Stoßrichtung verknüpft ist, die Initiativen hat.
                  </p>
                </div>
              </div>
            </div>
          </article>
            </div>
          ) : activeStrategicTab === "design" ? (
          <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <article className="brand-card p-6">
              <h2 className="text-lg font-semibold text-zinc-900">Stoßrichtung erfassen</h2>
              <p className="mt-1 text-sm text-zinc-600">
                
                Unabhaengig anlegen; Verknüpfungen zu Herausforderungen und Zielen erfolgen in der Tabelle per
                Pills.
              </p>
              <form action={createStrategicDirectionInCycle} className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Titel</label>
                  <input
                    name="title"
                    required
                    placeholder="Neue strategische Sto\u00DFrichtung"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Beschreibung</label>
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="Kurzbeschreibung, L\u00F6sungslogik (losgeloest von konkreten Ma\u00DFnahmen)"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <p className="text-xs text-zinc-500">
                  
                  Priorität (1–5) wird automatisch aus den vier Bewertungen berechnet — gleiche Gewichtung wie der
                  Stoßrichtungs-Score, ganzzahlig gerundet.
                </p>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Strategischer Wert</label>
                  <input
                    type="number"
                    name="strategic_value_score"
                    defaultValue={3}
                    min={1}
                    max={5}
                    className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Passung / Kompetenzen</label>
                  <input
                    type="number"
                    name="capability_fit_score"
                    defaultValue={3}
                    min={1}
                    max={5}
                    className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Machbarkeit</label>
                  <input
                    type="number"
                    name="feasibility_score"
                    defaultValue={3}
                    min={1}
                    max={5}
                    className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Risiko</label>
                  <input
                    type="number"
                    name="risk_score"
                    defaultValue={3}
                    min={1}
                    max={5}
                    className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <button type="submit" disabled={!canWrite} className="brand-btn w-full px-4 py-2 text-sm">
                  
                  Stoßrichtung speichern
                </button>
              </form>
            </article>
            <article className="brand-card min-w-0 p-6">
              <h3 className="text-base font-semibold text-zinc-900">Strategische Stoßrichtungen</h3>
              <div className="mt-4 min-w-0">
                <StrategicDirectionsTable
                directions={workspace.strategicDirections ?? []}
                challenges={(workspace.challenges ?? []).map((c) => ({
                  id: c.id,
                  title: c.title,
                }))}
                objectives={(workspace.objectives ?? []).map((o) => ({
                  id: o.id,
                  title: o.title,
                  versioning: o.versioning,
                }))}
                industries={workspace.availableDimensions.industries ?? []}
                businessModels={workspace.availableDimensions.businessModels ?? []}
                programsByDirectionId={Object.fromEntries(programsByDirectionId)}
                challengeIdsByDirection={Object.fromEntries(challengeIdsByDirection)}
                challengeCoverageByDirection={challengeCoverageByDirection}
                objectiveIdsByDirection={Object.fromEntries(objectiveIdsByDirection)}
                objectiveCoverageByDirection={objectiveCoverageByDirection}
                industryIdsByDirection={Object.fromEntries(directionIndustryIdsById)}
                businessModelIdsByDirection={Object.fromEntries(directionBusinessModelIdsById)}
                directionCoverageById={Object.fromEntries(workspace.directionCoverageById)}
                canWrite={canWrite}
                openDraftByIdentityId={openStrategyDraftByIdentityId}
                returnPath={STRATEGY_OBJECT_RETURN_PATHS.directions}
                revisionActions={revisionActions}
                actions={{
                  updateStrategicDirectionAssessment,
                  deleteStrategicDirectionInCycle,
                  linkDirectionToChallengePredecessor,
                  unlinkDirectionChallengePredecessor,
                  linkDirectionToObjectiveInCycle,
                  unlinkDirectionFromObjectiveInCycle,
                  linkStrategicDirectionToIndustryInCycle,
                  unlinkStrategicDirectionFromIndustryInCycle,
                  linkStrategicDirectionToBusinessModelInCycle,
                  unlinkStrategicDirectionFromBusinessModelInCycle,
                }}
              />
              </div>
            </article>
          </div>
          ) : activeStrategicTab === "strategy-matrix" ? (
          <ProgramMappingMatrix model={programMatrix} canWrite={canWrite} />
          ) : null}
        </section>
      ) : null}

      {activeL1 === "pips" ? (
        <section className="space-y-4">
          {activePipTab === "programme" ? (
            <ProgramPipWorkspace
              canWrite={canWrite}
              createProgramAction={createStrategyProgramInCycle}
              updateProgramAction={updateStrategyProgramInCycle}
              strategicDirectionsForPrograms={(workspace.strategicDirections ?? []).filter((d) =>
                isStrategicDirectionEligibleForPrograms(d.versioning)
              )}
              strategicDirectionsAll={(workspace.strategicDirections ?? []).map((d) => ({
                id: d.id,
                title: d.title,
              }))}
              ownerOptions={workspace.programOwnerOptions ?? []}
              ownerLabelByMembershipId={ownerLabelByPipMembershipId}
              programRows={(workspace.programs ?? []).map((p) => {
                const o = programOverviewById.get(p.id);
                const pr = p as {
                  id: string;
                  title: string;
                  description?: string | null;
                  strategic_direction_id?: string | null;
                  owner_membership_id?: string | null;
                  budget_total?: number | null;
                  status?: string | null;
                  start_date?: string | null;
                  end_date?: string | null;
                };
                return {
                  id: pr.id,
                  title: pr.title,
                  description: pr.description ?? null,
                  strategic_direction_id: pr.strategic_direction_id ?? null,
                  owner_membership_id: pr.owner_membership_id ?? null,
                  budget_total: pr.budget_total ?? null,
                  status: pr.status ?? "draft",
                  start_date: pr.start_date ?? null,
                  end_date: pr.end_date ?? null,
                  initiative_count: Number(o?.initiative_count ?? 0),
                  initiative_active_count: Number(o?.initiative_active_count ?? 0),
                  initiative_done_count: Number(o?.initiative_done_count ?? 0),
                  progress_percent_from_initiatives: Number(o?.progress_percent ?? 0),
                };
              })}
              directionTitleById={Object.fromEntries(
                (workspace.strategicDirections ?? []).map((d) => [d.id, d.title])
              )}
              initiativesByProgramId={initiativesByProgramId}
            />
          ) : null}

          {activePipTab === "initiativen" ? (
            <InitiativePipWorkspace
              canWrite={canWrite}
              createInitiativeAction={createPipInitiativeInCycle}
              updateInitiativeAction={updatePipInitiativeInCycle}
              programsOpenForInitiatives={programsOpenForInitiatives}
              programsAll={(workspace.programs ?? []).map((p) => ({
                id: p.id,
                title: p.title,
                status: String((p as { status?: string }).status ?? "draft"),
              }))}
              ownerOptions={pipInitiativeOwnerOptions}
              annualTargets={(workspace.annualTargets ?? []).map((t) => ({
                id: t.id,
                title: t.title,
              }))}
              keyResultOptions={workspace.pipKeyResultOptions ?? []}
              initiativeRows={initiativePipRows}
              programTitleById={Object.fromEntries(
                (workspace.programs ?? []).map((p) => [p.id, p.title])
              )}
              ownerLabelByMembershipId={ownerLabelByPipMembershipId}
            />
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
          manualClusterPositionsByEntryId={workspace.manualClusterPositionsByEntryId}
          canWrite={canWrite}
          graphMaintenanceActions={{
            recomputeGraphLayout,
            backfillEntryQuality,
            analysisType: actionTab,
            returnTo: "/strategy-cycle?l1=corporate-strategy&l2=summary",
            hasRunningGraphLayout,
            hasRunningQualityBackfill,
            staleGraphLayout: analysisNetworkStale.staleGraphLayout,
            staleQualityBackfill: analysisNetworkStale.staleQualityBackfill,
          }}
        />
      ) : null}

      {activeL1 === "corporate-strategy" && activeTab === "summary" ? (
      <section className="brand-card p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-zinc-900">Analyse-Netzwerk</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Berechnungen für Verknüpfungen, Cluster und Lücken starten Sie unter «Aktionen» (Schaltflächen nur aktiv,
              wenn eine Neuberechnung nötig ist). Graph-Layout und Qualität steuern Sie unter der Visualisierung. Alle offenen
              Netzwerk-Punkte bündeln wir unter «Empfohlene Herausforderungen».
            </p>
          </div>
          <span className="shrink-0 rounded-md border border-zinc-300 bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-700">
            {analyseNetzwerkOpenTotal === 1
              ? "1 offener Punkt"
              : `${analyseNetzwerkOpenTotal} offene Punkte`}
          </span>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4">
          <p className="text-xs font-medium text-zinc-700">Aktionen</p>
          <div className="mt-3 flex flex-wrap gap-2">
          <form action={generateLinkDrafts}>
            <input type="hidden" name="analysis_type" value={actionTab} />
            <input type="hidden" name="return_to" value="/strategy-cycle?l1=corporate-strategy&l2=summary" />
            <button
              type="submit"
              disabled={
                !canWrite || hasRunningLinkDrafts || !analysisNetworkStale.staleLinkDraftGeneration
              }
              className="brand-btn px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Link-Entwürfe generieren
            </button>
            <AiWaitOverlay
              title="Job wird eingestellt"
              description="Link-Entw\u00FCrfe werden im Hintergrund generiert."
            />
          </form>
          <form action={recomputeClusters}>
            <input type="hidden" name="analysis_type" value={actionTab} />
            <input type="hidden" name="return_to" value="/strategy-cycle?l1=corporate-strategy&l2=summary" />
            <button
              type="submit"
              disabled={!canWrite || hasRunningClusters || !analysisNetworkStale.staleClusterRecompute}
              className="brand-btn px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Cluster neu berechnen
            </button>
            <AiWaitOverlay
              title="Job wird eingestellt"
              description="Cluster werden im Hintergrund neu berechnet."
            />
          </form>
          <form action={recomputeGaps}>
            <input type="hidden" name="analysis_type" value={actionTab} />
            <input type="hidden" name="return_to" value="/strategy-cycle?l1=corporate-strategy&l2=summary" />
            <button
              type="submit"
              disabled={!canWrite || hasRunningGaps || !analysisNetworkStale.staleGapsRecompute}
              className="brand-btn px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Luecken neu berechnen
            </button>
            <AiWaitOverlay
              title="Job wird eingestellt"
              description="L\u00FCckenanalyse wird im Hintergrund neu berechnet."
            />
          </form>
          </div>
        </div>

        <AnalysisNetworkRecommendationPanels
          recommendedChallengeTotal={recommendedChallengeTotal}
          draftChallengeCandidates={draftChallengeCandidates}
          clusterPanels={recommendationClusterPanels}
          linkDraftsCount={linkDraftsCount}
          linkDrafts={linkDrafts}
          gapFindingsCount={gapFindingsCount}
          gapFindings={gapFindings}
          entryTitleById={entryTitleByIdRecord}
          canWrite={canWrite}
          actionTab={actionTab}
          promoteChallengeCandidate={promoteChallengeCandidate}
          dismissChallengeCandidate={dismissChallengeCandidate}
          promoteClusterToStrategicChallenge={promoteClusterToStrategicChallenge}
          approveLinkDraft={approveLinkDraft}
          rejectLinkDraft={rejectLinkDraft}
        />
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
              
              Qualitätsregel: Bei Wirkung 4-5 muss die Begründung mindestens 40 Zeichen haben.
            </p>
            <button type="submit" disabled={!canWrite} className="brand-btn px-4 py-2 text-sm">
              Eintrag speichern
            </button>
            <AiWaitOverlay
              title="AI Agent berechnet Qualitaet"
              description="Der Qualit\u00E4tswert wird berechnet und direkt in der Datenbank gespeichert."
            />
          </form>
        </article>

        <article className="brand-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">
              {getTabTitle(activeTab)}  - Einträge ({filteredEntries.length}/{entries.length})
            </h2>
            <a
              href="/strategy-cycle?l1=strategic-directions&l2=strategy-matrix"
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
              <option value="score_desc">Sortierung: Qualitätswert (absteigend)</option>
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

          <div className="mt-4">
            <AnalysisEntriesTable
              entries={filteredEntries.map((e) => {
                const rawBand =
                  e.quality_band ?? (e as { qualityBand?: string | null }).qualityBand ?? null;
                const quality_band =
                  rawBand === "low" || rawBand === "medium" || rawBand === "high" ? rawBand : null;
                const rawSource =
                  e.quality_source ?? (e as { qualitySource?: string | null }).qualitySource ?? null;
                const quality_source =
                  rawSource === "llm" || rawSource === "rule" ? rawSource : null;
                return {
                  id: e.id,
                  title: e.title,
                  sub_type: e.sub_type,
                  description: e.description,
                  impact_level: e.impact_level,
                  uncertainty_level: e.uncertainty_level,
                  quality_score:
                    e.quality_score ?? (e as { qualityScore?: number }).qualityScore ?? null,
                  quality_band,
                  quality_source,
                  updated_at: e.updated_at,
                  analysis_type: e.analysis_type ?? activeTab,
                };
              })}
              analysisType={activeTab}
              canWrite={canWrite}
              promotedBySourceId={workspace.promotedBySourceId}
              directionCountByEntryId={Object.fromEntries(
                [...(workspace.entryDirectionIdsByEntryId?.entries() ?? [])].map(([id, ids]) => [
                  id,
                  ids.length,
                ])
              )}
              challengeOptions={challengeOptions}
              updateAnalysisEntry={updateAnalysisEntry}
              deleteAnalysisEntry={deleteAnalysisEntry}
              promoteToStrategicChallenge={promoteToStrategicChallenge}
              attachFindingToChallenge={attachFindingToChallenge}
            />
          </div>
        </article>
      </section>
      ) : null}

    </div>
  );
}
