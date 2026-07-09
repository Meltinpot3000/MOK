import type { CorrelationStatus, CorrelationSummaryResult } from "@/lib/strategy-cycle/correlation";
import {
  deriveFulfillmentGaps,
  type FulfillmentGap,
} from "@/lib/strategy-cycle/challenge-fulfillment-gaps";
import { COVERAGE_LEVEL_META, normalizeContributionLevel } from "@/lib/strategy-cycle/coverage-level";
import { CHALLENGE_EXECUTION_BAND_THRESHOLDS } from "@/lib/strategy-cycle/challenge-resolution-profile-thresholds";
import {
  type CoverageBand,
  coverageBandFromWMax,
  normalizedCoverageWeight,
} from "@/lib/strategy-cycle/strategic-design-insights";

export type ExecutionBand =
  | "not_measurable"
  | "early"
  | "in_progress"
  | "advanced"
  | "largely_delivered";

export type CoherenceAssessment = CorrelationStatus | "not_assessed";

export type ChallengeResolutionEvidence = {
  topDirections: Array<{ id: string; title: string; contributionLevel: string }>;
  weakestCorrelation?: {
    objectiveTitle: string;
    directionTitle: string;
    status: CorrelationStatus;
  };
  executionSources: Array<{ label: string; progress: number; weight: number }>;
};

export type ChallengeResolutionProfile = {
  challengeId: string;
  addressing: CoverageBand;
  addressingLabelDe: string;
  coherence: CoherenceAssessment;
  coherenceLabelDe: string;
  execution: {
    band: ExecutionBand;
    labelDe: string;
    percent: number | null;
    anchorCount: number;
  };
  /** Gewichteter Umsetzungsfortschritt (0–100), nur wenn strategisch verankert und Anker existieren. */
  fulfillmentPercent: number | null;
  managementAssessedProgress: number | null;
  calculatedProgressFromKeyResults: number | null;
  calculatedProgressFromInitiatives: number | null;
  progressSource: "manual" | "key_result_based" | "initiative_based" | "hybrid" | "none";
  fulfillmentGaps: FulfillmentGap[];
  systemHintDe: string;
  evidence: ChallengeResolutionEvidence;
};

export const ADDRESSING_BAND_LABELS_DE: Record<CoverageBand, string> = {
  none: "nicht verankert",
  weak: "schwach adressiert",
  medium: "teilweise adressiert",
  strong: "klar adressiert",
};

export const COHERENCE_LABELS_DE: Record<CoherenceAssessment, string> = {
  green: "inhaltlich stimmig",
  yellow: "Passung prüfen",
  red: "kritische Lücke",
  unknown: "unklar",
  not_assessed: "nicht bewertbar",
};

export const EXECUTION_BAND_LABELS_DE: Record<ExecutionBand, string> = {
  not_measurable: "keine messbaren Anker",
  early: "Umsetzung früh",
  in_progress: "Umsetzung läuft",
  advanced: "Umsetzung fortgeschritten",
  largely_delivered: "weitgehend umgesetzt",
};

const COHERENCE_SEVERITY: Record<CorrelationStatus, number> = {
  red: 0,
  yellow: 1,
  unknown: 2,
  green: 3,
};

export type ChallengeDirectionLinkInput = {
  strategic_challenge_id: string;
  strategic_direction_id: string;
  contribution_level?: string | null;
};

export type ChallengeResolutionWorkspaceInput = {
  challengeId: string;
  challengeTitle: string;
  challengeDirectionLinks: ChallengeDirectionLinkInput[];
  directions: Array<{ id: string; title: string }>;
  correlationSummary: CorrelationSummaryResult;
  annualTargets: Array<{
    id: string;
    title: string;
    strategic_direction_id: string;
    progress_percent?: number | string | null;
    progress_calculation_mode?: string | null;
  }>;
  initiatives: Array<{
    id: string;
    title: string;
    program_id?: string | null;
    progress_percent?: number | string | null;
  }>;
  initiativeTargetLinks: Array<{
    initiative_id: string;
    annual_target_id: string;
    contribution_level?: string | null;
  }>;
  programs: Array<{ id: string; strategic_direction_id?: string | null }>;
  keyResultTargetLinks?: Array<{
    key_result_id: string;
    annual_target_id: string;
    contribution_level?: string | null;
  }>;
  keyResults?: Array<{ id: string; title: string; progressPercent: number }>;
};

function num(v: number | string | null | undefined, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function challengeMaxW(challengeId: string, links: ChallengeDirectionLinkInput[]): number {
  let m = 0;
  for (const l of links) {
    if (l.strategic_challenge_id !== challengeId) continue;
    m = Math.max(m, normalizedCoverageWeight(l.contribution_level));
  }
  return m;
}

function weakestCoherenceStatus(statuses: CorrelationStatus[]): CorrelationStatus {
  return statuses.reduce((worst, s) =>
    COHERENCE_SEVERITY[s] < COHERENCE_SEVERITY[worst] ? s : worst
  );
}

export function coherenceForChallenge(
  challengeId: string,
  correlationSummary: CorrelationSummaryResult
): CoherenceAssessment {
  const statuses: CorrelationStatus[] = [];
  for (const cell of correlationSummary.cells) {
    if (cell.challengeId !== challengeId) continue;
    const directionDetails = cell.directions ?? [];
    if (directionDetails.length > 0) {
      for (const d of directionDetails) {
        if (d.effectiveStatus !== "unknown") statuses.push(d.effectiveStatus);
      }
    } else if (cell.status !== "unknown") {
      statuses.push(cell.status);
    }
  }
  if (statuses.length === 0) return "not_assessed";
  return weakestCoherenceStatus(statuses);
}

export function executionBandFromPercent(percent: number | null): ExecutionBand {
  if (percent == null || !Number.isFinite(percent)) return "not_measurable";
  const p = Math.max(0, Math.min(100, percent));
  const t = CHALLENGE_EXECUTION_BAND_THRESHOLDS;
  if (p <= t.earlyMax) return "early";
  if (p <= t.inProgressMax) return "in_progress";
  if (p <= t.advancedMax) return "advanced";
  return "largely_delivered";
}

type ExecutionAnchor = { label: string; progress: number; weight: number };

export function collectExecutionAnchors(input: {
  challengeId: string;
  challengeDirectionLinks: ChallengeDirectionLinkInput[];
  annualTargets: ChallengeResolutionWorkspaceInput["annualTargets"];
  initiatives: ChallengeResolutionWorkspaceInput["initiatives"];
  initiativeTargetLinks: ChallengeResolutionWorkspaceInput["initiativeTargetLinks"];
  programs: ChallengeResolutionWorkspaceInput["programs"];
  keyResultTargetLinks?: ChallengeResolutionWorkspaceInput["keyResultTargetLinks"];
  keyResults?: ChallengeResolutionWorkspaceInput["keyResults"];
}): ExecutionAnchor[] {
  const wByDirection = new Map<string, number>();
  for (const link of input.challengeDirectionLinks) {
    if (link.strategic_challenge_id !== input.challengeId) continue;
    const w = normalizedCoverageWeight(link.contribution_level);
    const prev = wByDirection.get(link.strategic_direction_id) ?? 0;
    wByDirection.set(link.strategic_direction_id, Math.max(prev, w));
  }
  if (wByDirection.size === 0) return [];

  const directionIds = new Set(wByDirection.keys());
  const anchors: ExecutionAnchor[] = [];
  const initiativeIdsUsed = new Set<string>();

  const targetById = new Map(input.annualTargets.map((t) => [t.id, t] as const));
  const programDirectionById = new Map(
    input.programs
      .filter((p) => p.strategic_direction_id)
      .map((p) => [p.id, p.strategic_direction_id!] as const)
  );

  for (const target of input.annualTargets) {
    if (!directionIds.has(target.strategic_direction_id)) continue;
    const w = wByDirection.get(target.strategic_direction_id) ?? 0;
    if (w <= 0) continue;
    anchors.push({
      label: `Jahresziel: ${target.title}`,
      progress: num(target.progress_percent),
      weight: w,
    });
  }

  for (const link of input.initiativeTargetLinks) {
    const target = targetById.get(link.annual_target_id);
    if (!target || !directionIds.has(target.strategic_direction_id)) continue;
    const initiative = input.initiatives.find((i) => i.id === link.initiative_id);
    if (!initiative || initiativeIdsUsed.has(initiative.id)) continue;
    const wDir = wByDirection.get(target.strategic_direction_id) ?? 0;
    const w = wDir * normalizedCoverageWeight(link.contribution_level);
    if (w <= 0) continue;
    initiativeIdsUsed.add(initiative.id);
    anchors.push({
      label: `Initiative: ${initiative.title}`,
      progress: num(initiative.progress_percent),
      weight: w,
    });
  }

  for (const initiative of input.initiatives) {
    if (!initiative.program_id || initiativeIdsUsed.has(initiative.id)) continue;
    const directionId = programDirectionById.get(initiative.program_id);
    if (!directionId || !directionIds.has(directionId)) continue;
    const w = wByDirection.get(directionId) ?? 0;
    if (w <= 0) continue;
    initiativeIdsUsed.add(initiative.id);
    anchors.push({
      label: `Initiative: ${initiative.title}`,
      progress: num(initiative.progress_percent),
      weight: w,
    });
  }

  const krById = new Map((input.keyResults ?? []).map((kr) => [kr.id, kr] as const));
  const krIdsUsed = new Set<string>();
  for (const link of input.keyResultTargetLinks ?? []) {
    const target = targetById.get(link.annual_target_id);
    if (!target || !directionIds.has(target.strategic_direction_id)) continue;
    const kr = krById.get(link.key_result_id);
    if (!kr || krIdsUsed.has(kr.id)) continue;
    const wDir = wByDirection.get(target.strategic_direction_id) ?? 0;
    const w = wDir * normalizedCoverageWeight(link.contribution_level);
    if (w <= 0) continue;
    krIdsUsed.add(kr.id);
    anchors.push({
      label: `Key Result: ${kr.title}`,
      progress: num(kr.progressPercent),
      weight: w,
    });
  }

  return anchors;
}

export function fulfillmentContextForChallenge(input: {
  challengeId: string;
  challengeDirectionLinks: ChallengeDirectionLinkInput[];
  annualTargets: ChallengeResolutionWorkspaceInput["annualTargets"];
  initiatives: ChallengeResolutionWorkspaceInput["initiatives"];
  initiativeTargetLinks: ChallengeResolutionWorkspaceInput["initiativeTargetLinks"];
  programs: ChallengeResolutionWorkspaceInput["programs"];
  keyResultTargetLinks?: ChallengeResolutionWorkspaceInput["keyResultTargetLinks"];
}): {
  linkedDirectionCount: number;
  annualTargetCountOnDirections: number;
  initiativeCountOnDirections: number;
  keyResultLinkCountOnDirections: number;
} {
  const directionIds = new Set<string>();
  for (const link of input.challengeDirectionLinks) {
    if (link.strategic_challenge_id !== input.challengeId) continue;
    directionIds.add(link.strategic_direction_id);
  }

  const targetById = new Map(input.annualTargets.map((t) => [t.id, t] as const));
  const programDirectionById = new Map(
    input.programs
      .filter((p) => p.strategic_direction_id)
      .map((p) => [p.id, p.strategic_direction_id!] as const)
  );

  let annualTargetCountOnDirections = 0;
  for (const t of input.annualTargets) {
    if (directionIds.has(t.strategic_direction_id)) annualTargetCountOnDirections += 1;
  }

  const initiativeIds = new Set<string>();
  for (const link of input.initiativeTargetLinks) {
    const target = targetById.get(link.annual_target_id);
    if (target && directionIds.has(target.strategic_direction_id)) {
      initiativeIds.add(link.initiative_id);
    }
  }
  for (const initiative of input.initiatives) {
    if (!initiative.program_id) continue;
    const dir = programDirectionById.get(initiative.program_id);
    if (dir && directionIds.has(dir)) initiativeIds.add(initiative.id);
  }

  let keyResultLinkCountOnDirections = 0;
  for (const link of input.keyResultTargetLinks ?? []) {
    const target = targetById.get(link.annual_target_id);
    if (target && directionIds.has(target.strategic_direction_id)) keyResultLinkCountOnDirections += 1;
  }

  return {
    linkedDirectionCount: directionIds.size,
    annualTargetCountOnDirections,
    initiativeCountOnDirections: initiativeIds.size,
    keyResultLinkCountOnDirections,
  };
}

export function deriveFulfillmentPercent(
  addressing: CoverageBand,
  executionPercent: number | null
): number | null {
  if (addressing === "none") return null;
  return executionPercent;
}

export function weightedExecutionPercent(anchors: ExecutionAnchor[]): number | null {
  let sumW = 0;
  let sum = 0;
  for (const a of anchors) {
    if (a.weight <= 0) continue;
    sumW += a.weight;
    sum += a.weight * Math.max(0, Math.min(100, a.progress));
  }
  if (sumW <= 0) return null;
  return Math.round(sum / sumW);
}

function weightedAverage(values: Array<{ value: number; weight: number }>): number | null {
  let sw = 0;
  let s = 0;
  for (const v of values) {
    if (!Number.isFinite(v.value) || !Number.isFinite(v.weight) || v.weight <= 0) continue;
    sw += v.weight;
    s += v.value * v.weight;
  }
  if (sw <= 0) return null;
  return Math.round(s / sw);
}

export function buildChallengeResolutionHint(input: {
  addressing: CoverageBand;
  coherence: CoherenceAssessment;
  execution: ExecutionBand;
}): string {
  const { addressing, coherence, execution } = input;

  if (addressing === "none") {
    return "Priorisierte Herausforderung ohne tragende Stoßrichtung — zuerst im Strategiezyklus verknüpfen.";
  }
  if (addressing !== "none" && coherence === "red") {
    return "Strategisch adressiert, aber die inhaltliche Passung zu verknüpften Zielen ist kritisch — Korrelationsanalyse prüfen.";
  }
  if (addressing === "strong" && execution === "not_measurable") {
    return "Klar adressiert; über verknüpfte Stoßrichtungen sind noch keine messbaren Umsetzungsanker (Jahresziele/Initiativen) erkennbar.";
  }
  if (addressing !== "none" && execution === "in_progress") {
    return "Teilweise bis klar adressiert; messbarer Umsetzungsfortschritt entlang verknüpfter Jahresziele und Initiativen.";
  }
  if (execution === "advanced" || execution === "largely_delivered") {
    if (addressing === "weak" || addressing === "none") {
      return "Spürbarer Umsetzungsfortschritt bei schwacher strategischer Verankerung der Herausforderung — Verknüpfungen nachziehen.";
    }
    return "Adressierung und Umsetzung wirken konsistent — Kohärenz und Fortschritt weiter im Review beobachten.";
  }
  if (coherence === "yellow") {
    return "Adressiert; inhaltliche Lücken zwischen Herausforderung, Stoßrichtung und strategischen Zielen klären.";
  }
  if (addressing === "weak") {
    return "Schwach adressiert — Beitragsstufe an Stoßrichtungen erhöhen oder weitere Richtungen verknüpfen.";
  }
  return "Strategisches Profil aus Verknüpfungen, Korrelation und Umsetzungsankern — Details in den drei Dimensionen.";
}

function findWeakestCorrelationEvidence(
  challengeId: string,
  correlationSummary: CorrelationSummaryResult
): ChallengeResolutionEvidence["weakestCorrelation"] | undefined {
  let worst: { severity: number; objectiveTitle: string; directionTitle: string; status: CorrelationStatus } | null =
    null;

  for (const cell of correlationSummary.cells) {
    if (cell.challengeId !== challengeId) continue;
    for (const d of cell.directions ?? []) {
      const sev = COHERENCE_SEVERITY[d.effectiveStatus];
      if (worst != null && sev >= worst.severity) continue;
      worst = {
        severity: sev,
        objectiveTitle: cell.objectiveTitle,
        directionTitle: d.directionTitle,
        status: d.effectiveStatus,
      };
    }
  }
  if (!worst) return undefined;
  return {
    objectiveTitle: worst.objectiveTitle,
    directionTitle: worst.directionTitle,
    status: worst.status,
  };
}

export function deriveChallengeResolutionProfile(
  input: ChallengeResolutionWorkspaceInput
): ChallengeResolutionProfile {
  const wMax = challengeMaxW(input.challengeId, input.challengeDirectionLinks);
  const addressing = coverageBandFromWMax(wMax);
  const coherence = coherenceForChallenge(input.challengeId, input.correlationSummary);
  const executionAnchors = collectExecutionAnchors({
    challengeId: input.challengeId,
    challengeDirectionLinks: input.challengeDirectionLinks,
    annualTargets: input.annualTargets,
    initiatives: input.initiatives,
    initiativeTargetLinks: input.initiativeTargetLinks,
    programs: input.programs,
    keyResultTargetLinks: input.keyResultTargetLinks,
    keyResults: input.keyResults,
  });
  const executionPercent = weightedExecutionPercent(executionAnchors);
  const executionBand = executionBandFromPercent(executionPercent);
  const targetById = new Map(input.annualTargets.map((t) => [t.id, t] as const));
  const managementProgress = weightedAverage(
    executionAnchors
      .filter((a) => a.label.startsWith("Jahresziel:"))
      .map((a) => ({ value: a.progress, weight: a.weight }))
  );
  const calcFromKr = weightedAverage(
    executionAnchors
      .filter((a) => a.label.startsWith("Key Result:"))
      .map((a) => ({ value: a.progress, weight: a.weight }))
  );
  const calcFromInitiatives = weightedAverage(
    executionAnchors
      .filter((a) => a.label.startsWith("Initiative:"))
      .map((a) => ({ value: a.progress, weight: a.weight }))
  );
  const annualTargetModes = new Set(
    (input.keyResultTargetLinks ?? [])
      .map((l) => targetById.get(l.annual_target_id)?.progress_calculation_mode ?? null)
      .filter((v): v is string => Boolean(v))
  );
  for (const t of input.annualTargets) {
    if (t.progress_calculation_mode) annualTargetModes.add(t.progress_calculation_mode);
  }
  const progressSource =
    annualTargetModes.size === 0
      ? "none"
      : annualTargetModes.size > 1
        ? "hybrid"
        : (annualTargetModes.values().next().value as
            | "manual"
            | "key_result_based"
            | "initiative_based"
            | "hybrid");
  const fulfillmentPercent = deriveFulfillmentPercent(addressing, managementProgress ?? executionPercent);
  const fulfillmentCtx = fulfillmentContextForChallenge({
    challengeId: input.challengeId,
    challengeDirectionLinks: input.challengeDirectionLinks,
    annualTargets: input.annualTargets,
    initiatives: input.initiatives,
    initiativeTargetLinks: input.initiativeTargetLinks,
    programs: input.programs,
    keyResultTargetLinks: input.keyResultTargetLinks,
  });
  const fulfillmentGaps = deriveFulfillmentGaps({
    addressing,
    ...fulfillmentCtx,
    executionAnchorCount: executionAnchors.length,
    executionPercent,
  });

  const directionById = new Map(input.directions.map((d) => [d.id, d] as const));
  const topDirections = input.challengeDirectionLinks
    .filter((l) => l.strategic_challenge_id === input.challengeId)
    .map((l) => ({
      id: l.strategic_direction_id,
      title: directionById.get(l.strategic_direction_id)?.title ?? "Stoßrichtung",
      weight: normalizedCoverageWeight(l.contribution_level),
      level: normalizeContributionLevel(l.contribution_level),
    }))
    .sort((a, b) => b.weight - a.weight || a.title.localeCompare(b.title, "de"))
    .slice(0, 3)
    .map((d) => ({
      id: d.id,
      title: d.title,
      contributionLevel: COVERAGE_LEVEL_META[d.level].labelDe,
    }));

  const systemHintDe = buildChallengeResolutionHint({ addressing, coherence, execution: executionBand });

  return {
    challengeId: input.challengeId,
    addressing,
    addressingLabelDe: ADDRESSING_BAND_LABELS_DE[addressing],
    coherence,
    coherenceLabelDe: COHERENCE_LABELS_DE[coherence],
    execution: {
      band: executionBand,
      labelDe: EXECUTION_BAND_LABELS_DE[executionBand],
      percent: executionPercent,
      anchorCount: executionAnchors.length,
    },
    fulfillmentPercent,
    managementAssessedProgress: managementProgress,
    calculatedProgressFromKeyResults: calcFromKr,
    calculatedProgressFromInitiatives: calcFromInitiatives,
    progressSource,
    fulfillmentGaps,
    systemHintDe,
    evidence: {
      topDirections,
      weakestCorrelation: findWeakestCorrelationEvidence(input.challengeId, input.correlationSummary),
      executionSources: executionAnchors.slice(0, 5),
    },
  };
}

export function buildChallengeResolutionProfileMap(input: {
  challenges: Array<{ id: string; title: string }>;
  challengeDirectionLinks: ChallengeDirectionLinkInput[];
  directions: Array<{ id: string; title: string }>;
  correlationSummary: CorrelationSummaryResult;
  annualTargets: ChallengeResolutionWorkspaceInput["annualTargets"];
  initiatives: ChallengeResolutionWorkspaceInput["initiatives"];
  initiativeTargetLinks: ChallengeResolutionWorkspaceInput["initiativeTargetLinks"];
  programs: ChallengeResolutionWorkspaceInput["programs"];
  keyResultTargetLinks?: ChallengeResolutionWorkspaceInput["keyResultTargetLinks"];
  keyResults?: ChallengeResolutionWorkspaceInput["keyResults"];
}): Map<string, ChallengeResolutionProfile> {
  const map = new Map<string, ChallengeResolutionProfile>();
  for (const ch of input.challenges) {
    map.set(
      ch.id,
      deriveChallengeResolutionProfile({
        challengeId: ch.id,
        challengeTitle: ch.title,
        challengeDirectionLinks: input.challengeDirectionLinks,
        directions: input.directions,
        correlationSummary: input.correlationSummary,
        annualTargets: input.annualTargets,
        initiatives: input.initiatives,
        initiativeTargetLinks: input.initiativeTargetLinks,
        programs: input.programs,
        keyResultTargetLinks: input.keyResultTargetLinks,
        keyResults: input.keyResults,
      })
    );
  }
  return map;
}

/** Serialisierbares Profil für Client-Komponenten (Dashboard-Popup). */
export type ChallengeResolutionProfileDto = {
  addressing: CoverageBand;
  addressingLabelDe: string;
  coherence: CoherenceAssessment;
  coherenceLabelDe: string;
  executionBand: ExecutionBand;
  executionLabelDe: string;
  executionPercent: number | null;
  executionAnchorCount: number;
  fulfillmentPercent: number | null;
  managementAssessedProgress: number | null;
  calculatedProgressFromKeyResults: number | null;
  calculatedProgressFromInitiatives: number | null;
  progressSource: "manual" | "key_result_based" | "initiative_based" | "hybrid" | "none";
  fulfillmentGaps: FulfillmentGap[];
  systemHintDe: string;
  topDirections: ChallengeResolutionEvidence["topDirections"];
  weakestCorrelation?: ChallengeResolutionEvidence["weakestCorrelation"];
  executionSources: ChallengeResolutionEvidence["executionSources"];
};

export function toChallengeResolutionProfileDto(
  profile: ChallengeResolutionProfile
): ChallengeResolutionProfileDto {
  return {
    addressing: profile.addressing,
    addressingLabelDe: profile.addressingLabelDe,
    coherence: profile.coherence,
    coherenceLabelDe: profile.coherenceLabelDe,
    executionBand: profile.execution.band,
    executionLabelDe: profile.execution.labelDe,
    executionPercent: profile.execution.percent,
    executionAnchorCount: profile.execution.anchorCount,
    fulfillmentPercent: profile.fulfillmentPercent,
    managementAssessedProgress: profile.managementAssessedProgress,
    calculatedProgressFromKeyResults: profile.calculatedProgressFromKeyResults,
    calculatedProgressFromInitiatives: profile.calculatedProgressFromInitiatives,
    progressSource: profile.progressSource,
    fulfillmentGaps: profile.fulfillmentGaps,
    systemHintDe: profile.systemHintDe,
    topDirections: profile.evidence.topDirections,
    weakestCorrelation: profile.evidence.weakestCorrelation,
    executionSources: profile.evidence.executionSources,
  };
}
