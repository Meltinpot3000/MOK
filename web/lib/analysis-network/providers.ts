import type { AnalysisEntryRecord, AnalysisLinkType } from "@/lib/analysis-network/types";
import type { OkrContributionTier } from "@/lib/strategy-cycle/coverage-level";
import { computeStrategicDirectionOverallLevel, minContributionTier } from "@/lib/okr/contribution-tier";
import { z } from "zod";

type QualityEntryInput = Pick<
  AnalysisEntryRecord,
  "title" | "analysis_type" | "sub_type" | "impact_level" | "uncertainty_level" | "description"
>;

export type LlmScoredLink = {
  proximityScore: number;
  supportScore: number;
  repulsionScore: number;
  directionHint: "none" | "causes" | "depends_on";
  suggestedLinkType: AnalysisLinkType;
  explanation: string;
  provider: "gemini" | "groq";
  model: string;
  promptVersion: string;
};

export type LlmUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  billableCost: number | null;
  usageMissing: boolean;
};

export type LlmScoreResponse<T> = {
  result: T | null;
  usage: LlmUsage | null;
  /** gesetzt, wenn result Nutzdaten liefert, aber diese keinen Provider tragen (z. B. Kandidatenliste) */
  resolvedProvider?: "gemini" | "groq" | null;
  resolvedModel?: string | null;
};

export type LlmQualityScore = {
  qualityScore: number;
  impactScore: number;
  certaintyScore: number;
  evidenceScore: number;
  structureScore: number;
  hasStrategicValue: boolean;
  strategicValueReason: string;
  explanation: string;
  provider: "gemini" | "groq";
  model: string;
  promptVersion: string;
};

export type LlmClusterAssessment = {
  label: string;
  summary: string;
  scoreAdjustment: number;
  explanation: string;
  provider: "gemini" | "groq";
  model: string;
  promptVersion: string;
};

export type LlmGapAssessment = {
  severity: number;
  recommendation: string;
  rationale: string;
  provider: "gemini" | "groq";
  model: string;
  promptVersion: string;
};

export type LlmChallengeCandidate = {
  title: string;
  description: string;
  priority: number;
  source: "cluster" | "gap";
  sourceRef: string;
};

export type LlmGraphLayoutNode = {
  id: string;
  x: number;
  y: number;
  z: number;
  confidence: number;
  reason?: string;
};

export type LlmGraphLayout = {
  layoutVersion: string;
  nodes: LlmGraphLayoutNode[];
  globalReasoning: string;
  provider: "gemini" | "groq";
  model: string;
  promptVersion: string;
};

const LINK_PROMPT_VERSION = "analysis-link-v3";
const QUALITY_PROMPT_VERSION = "analysis-quality-v1";
const CLUSTER_PROMPT_VERSION = "analysis-cluster-v1";
const GAP_PROMPT_VERSION = "analysis-gap-v1";
const GRAPH_LAYOUT_PROMPT_VERSION = "analysis-graph-layout-v1";
/** Nachziehen unvollständiger Groq-Antworten: kleinere Batches, bis alle IDs KI-Positionen haben (oder Abbruch). */
const GRAPH_LAYOUT_SUPPLEMENT_CHUNK_SIZE = Number(
  process.env.ANALYSIS_GRAPH_LAYOUT_SUPPLEMENT_CHUNK ?? 8
);
const GRAPH_LAYOUT_SUPPLEMENT_MAX_ROUNDS = Number(
  process.env.ANALYSIS_GRAPH_LAYOUT_SUPPLEMENT_MAX_ROUNDS ?? 48
);
const OKR_CONTRIBUTION_PROMPT_VERSION = "okr-contribution-v5";
const KR_INITIATIVE_MATCHING_PROMPT_VERSION = "kr-initiative-matching-v1";

export const GEMINI_MODEL_QUALITY = process.env.ANALYSIS_LLM_MODEL_GEMINI ?? "gemini-2.5-pro";
export const GEMINI_MODEL_LINKS = process.env.ANALYSIS_LLM_MODEL_GEMINI_LINKS ?? "gemini-2.5-flash";
export const GEMINI_MODEL_ASSIST = process.env.ANALYSIS_LLM_MODEL_GEMINI_ASSIST ?? GEMINI_MODEL_QUALITY;
export const GROQ_MODEL = process.env.ANALYSIS_LLM_MODEL_GROQ ?? "llama-3.3-70b-versatile";
const REQUEST_TIMEOUT_MS = Number(process.env.ANALYSIS_LLM_TIMEOUT_MS ?? 20000);
const GEMINI_MIN_INTERVAL_MS = Number(process.env.ANALYSIS_LLM_MIN_INTERVAL_MS_GEMINI ?? 900);
/** Groq: niedriger = hoere Kadenz; bei 429 greifen Retries. 30 RPM fuer z. B. llama-3.3-70b ≈ 2000 ms Mittel — siehe Groq-Dokumentation / eigene Limits. */
const GROQ_MIN_INTERVAL_MS = Number(process.env.ANALYSIS_LLM_MIN_INTERVAL_MS_GROQ ?? 250);
const RETRY_BASE_DELAY_MS_GEMINI = Number(
  process.env.ANALYSIS_LLM_RETRY_BASE_DELAY_MS_GEMINI ?? process.env.ANALYSIS_LLM_RETRY_BASE_DELAY_MS ?? 1200
);
const RETRY_BASE_DELAY_MS_GROQ = Number(process.env.ANALYSIS_LLM_RETRY_BASE_DELAY_MS_GROQ ?? 800);
const RETRY_MAX_ATTEMPTS = Number(process.env.ANALYSIS_LLM_RETRY_MAX_ATTEMPTS ?? 3);
const lastRequestAtByProvider: Record<"gemini" | "groq", number> = {
  gemini: 0,
  groq: 0,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.round(ms))));
}

async function enforceProviderRateLimit(provider: "gemini" | "groq"): Promise<void> {
  const minIntervalMs = provider === "gemini" ? GEMINI_MIN_INTERVAL_MS : GROQ_MIN_INTERVAL_MS;
  if (minIntervalMs <= 0) return;
  const now = Date.now();
  const elapsed = now - lastRequestAtByProvider[provider];
  if (elapsed < minIntervalMs) {
    await sleep(minIntervalMs - elapsed);
  }
  lastRequestAtByProvider[provider] = Date.now();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeStrategyReferenceText(strategyReferenceText: string | null | undefined): string | null {
  const trimmed = String(strategyReferenceText ?? "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 4000);
}

function withStrategyReference(lines: string[], strategyReferenceText: string | null | undefined): string {
  const referenceText = normalizeStrategyReferenceText(strategyReferenceText);
  if (!referenceText) return lines.join("\n");
  return [
    ...lines,
    "",
    "Strategischer Referenzrahmen (Mission, Vision, Culture, Values):",
    referenceText,
    "Nutze diesen Kontext als Priorisierungsrahmen bei unklarer Gewichtung.",
  ].join("\n");
}

function buildPrompt(
  a: AnalysisEntryRecord,
  b: AnalysisEntryRecord,
  strategyReferenceText?: string | null
): string {
  return withStrategyReference(
    [
    "Beurteile die Beziehung zwischen zwei strategischen Analyse-Findings mit drei getrennten Scores.",
    "Antwortformat exakt als JSON-Objekt ohne Markdown.",
    'Schema: {"proximityScore":0-1,"supportScore":0-1,"repulsionScore":0-1,"directionHint":"none|causes|depends_on","suggestedLinkType":"related_to|causes|supports|contradicts|amplifies|depends_on|duplicates","explanation":"kurze Begr\u00FCndung <= 220 Zeichen"}',
    "Regeln:",
    "- proximityScore = semantische N\u00E4he/Verwandtschaft",
    "- supportScore = wie stark A und B sich foerdern/verstaerken",
    "- repulsionScore = wie stark A und B sich widersprechen/ausbremsen",
    "- directionHint nur setzen, wenn Kausalitaet/Abhaengigkeit klar erkennbar ist",
    "- suggestedLinkType muss zu den Scores passen",
    "",
    "Finding A:",
    `- title: ${a.title}`,
    `- analysis_type: ${a.analysis_type}`,
    `- sub_type: ${a.sub_type ?? ""}`,
    `- impact: ${a.impact_level ?? 3}`,
    `- uncertainty: ${a.uncertainty_level ?? 3}`,
    `- description: ${a.description ?? ""}`,
    "",
    "Finding B:",
    `- title: ${b.title}`,
    `- analysis_type: ${b.analysis_type}`,
    `- sub_type: ${b.sub_type ?? ""}`,
    `- impact: ${b.impact_level ?? 3}`,
    `- uncertainty: ${b.uncertainty_level ?? 3}`,
    `- description: ${b.description ?? ""}`,
    ],
    strategyReferenceText
  );
}

function buildQualityPrompt(entry: QualityEntryInput, strategyReferenceText?: string | null): string {
  return withStrategyReference(
    [
    "Pruefe zuerst, ob dieses Finding einen echten strategischen Nutzen hat.",
    "Antwort nur als valides JSON (ohne Markdown).",
    'Schema: {"strategicValue":true|false,"strategicValueReason":"max 180 Zeichen","qualityScore":0-100,"impactScore":0-100,"certaintyScore":0-100,"evidenceScore":0-100,"structureScore":0-100,"explanation":"max 240 Zeichen"}',
    "Regeln:",
    "- strategicValue=false, wenn Aussage inhaltlich leer, zu generisch, ohne strategische Implikation oder als Test/Platzhalter erkennbar ist",
    "- Wenn strategicValue=false, dann qualityScore=0 und alle Teil-Scores=0",
    "- impactScore: strategische Relevanz aus impact/inhalt",
    "- certaintyScore: Verl\u00E4sslichkeit (niedrige Unsicherheit => hoher Score)",
    "- evidenceScore: Belastbarkeit der Beschreibung/Evidenz",
    "- structureScore: Klarheit/Struktur/Subtyp-Passung",
    "",
    "Finding:",
    `- title: ${entry.title}`,
    `- analysis_type: ${entry.analysis_type}`,
    `- sub_type: ${entry.sub_type ?? ""}`,
    `- impact: ${entry.impact_level ?? 3}`,
    `- uncertainty: ${entry.uncertainty_level ?? 3}`,
    `- description: ${entry.description ?? ""}`,
    ],
    strategyReferenceText
  );
}

function buildClusterPrompt(input: {
  currentLabel: string;
  currentSummary: string;
  score: number;
  members: string[];
  strategyReferenceText?: string | null;
  existingChallengeTitles?: string[];
}): string {
  const lines = [
    "Verbessere Label und Summary f\u00FCr einen strategischen Cluster.",
    "Antwort nur als valides JSON.",
    'Schema: {"label":"kurz","summary":"max 220 Zeichen","scoreAdjustment":-0.2..0.2,"explanation":"max 160 Zeichen"}',
    "",
    `Aktuelles Label: ${input.currentLabel}`,
    `Aktuelle Summary: ${input.currentSummary}`,
    `Aktueller Score: ${input.score}`,
    "Cluster-Findings:",
    ...input.members.map((member) => `- ${member}`),
  ];
  if (input.existingChallengeTitles && input.existingChallengeTitles.length > 0) {
    lines.push(
      "",
      "Diese Challenge-Titel existieren bereits als strategische Herausforderungen. Wenn dein vorgeschlagenes Label inhaltlich einem davon entspricht oder sehr aehnlich ist, gib das aktuelle Label unveraendert zurueck.",
      ...input.existingChallengeTitles.map((t) => `- ${t}`)
    );
  }
  return withStrategyReference(lines, input.strategyReferenceText);
}

function buildGapPrompt(input: {
  dimension: string;
  gapType: string;
  severity: number;
  recommendation: string;
  contextLines: string[];
  strategyReferenceText?: string | null;
}): string {
  return withStrategyReference(
    [
    "Verbessere Priorisierung und Empfehlung eines strategischen Gap-Findings.",
    "Antwort nur als valides JSON.",
    'Schema: {"severity":1-5,"recommendation":"max 220 Zeichen","rationale":"max 160 Zeichen"}',
    "",
    `Dimension: ${input.dimension}`,
    `Gap-Typ: ${input.gapType}`,
    `Aktuelle Severity: ${input.severity}`,
    `Aktuelle Recommendation: ${input.recommendation}`,
    "Kontext:",
    ...input.contextLines.map((line) => `- ${line}`),
    ],
    input.strategyReferenceText
  );
}

function buildChallengeCandidatesPrompt(input: {
  clusters: Array<{ id: string; label: string; summary: string; score: number }>;
  gaps: Array<{ id: string; dimension: string; gapType: string; severity: number; recommendation: string }>;
  strategyReferenceText?: string | null;
  existingChallengeTitles?: string[];
}): string {
  const lines = [
    "Erzeuge bis zu 8 Strategic-Challenge-Kandidaten aus Clustern und Gaps.",
    "Antwort nur als valides JSON.",
    'Schema: {"candidates":[{"title":"...","description":"...","priority":1-5,"source":"cluster|gap","sourceRef":"id"}]}',
    "Regeln:",
    "- Keine Dubletten",
    "- Titel handlungsorientiert",
    "- Priority nach strategischer Hebelwirkung",
    "",
    "Cluster:",
    ...input.clusters.map((cluster) => `- [${cluster.id}] ${cluster.label} | score=${cluster.score} | ${cluster.summary}`),
    "Gaps:",
    ...input.gaps.map((gap) => `- [${gap.id}] ${gap.gapType}/${gap.dimension} | severity=${gap.severity} | ${gap.recommendation}`),
  ];
  if (input.existingChallengeTitles && input.existingChallengeTitles.length > 0) {
    lines.push(
      "",
      "Diese Challenge-Titel existieren bereits. Schlage keine Kandidaten vor die diesen inhaltlich entsprechen.",
      ...input.existingChallengeTitles.map((t) => `- ${t}`)
    );
  }
  return withStrategyReference(lines, input.strategyReferenceText);
}

export function buildGraphLayoutPrompt(input: {
  nodes: Array<{
    id: string;
    title: string;
    analysisType: string;
    subType: string | null;
    impact: number;
    uncertainty: number;
    description: string | null;
    qualityScore: number;
  }>;
  edges: Array<{
    source: string;
    target: string;
    linkType: string;
    confidence: number;
    strength: number;
    triScores?: { proximityScore: number; supportScore: number; repulsionScore: number } | null;
  }>;
  strategyReferenceText?: string | null;
}): string {
  const compactNodes = input.nodes.map((node) => ({
    id: node.id,
    type: node.analysisType,
    subType: node.subType ?? "",
    impact: node.impact,
    uncertainty: node.uncertainty,
    quality: node.qualityScore,
    title: node.title.slice(0, 120),
    description: String(node.description ?? "").slice(0, 220),
  }));
  const compactEdges = input.edges.slice(0, 120).map((edge) => ({
    source: edge.source,
    target: edge.target,
    type: edge.linkType,
    confidence: Number(edge.confidence.toFixed(3)),
    strength: edge.strength,
    triScores: edge.triScores
      ? {
          proximityScore: Number(edge.triScores.proximityScore.toFixed(3)),
          supportScore: Number(edge.triScores.supportScore.toFixed(3)),
          repulsionScore: Number(edge.triScores.repulsionScore.toFixed(3)),
        }
      : null,
  }));
  return withStrategyReference(
    [
      "Berechne eine strategisch sinnvolle 3D-Layout-Position f\u00FCr alle Knoten.",
      "Antwort nur als valides JSON.",
      'Schema: {"layoutVersion":"analysis-graph-layout-v1","nodes":[{"id":"...","x":-1..1,"y":-1..1,"z":-1..1,"confidence":0..1}],"globalReasoning":"max 240 Zeichen"}',
      "Regeln:",
      "- Jeder input-node muss GENAU EINMAL in nodes enthalten sein.",
      "- x-Achse: extern (environment/competitor) eher negativ, intern (company/swot) eher positiv.",
      "- y-Achse KONVENTION (verpflichtend): strategic = NEGATIV (oben), operational = POSITIV (unten).",
      "- y-Achse: hoher Impact und geringere Unsicherheit => eher strategisch (also y < 0).",
      "- y-Achse: niedriger Impact und/oder hohe Unsicherheit => eher operational (also y > 0).",
      "- z-Achse: stark vernetzte Querschnittsthemen eher hoch.",
      "- Semantisch nahe oder unterst\u00FCtzende Knoten naeher, widerspr\u00FCchliche eher weiter entfernt.",
      "- Keine Koordinaten ausserhalb [-1,1].",
      "",
      `NodesJSON: ${JSON.stringify(compactNodes)}`,
      `EdgesJSON: ${JSON.stringify(compactEdges)}`,
    ],
    input.strategyReferenceText
  );
}

function parseJsonPayload(raw: string): {
  proximityScore: number;
  supportScore: number;
  repulsionScore: number;
  directionHint: "none" | "causes" | "depends_on";
  suggestedLinkType: AnalysisLinkType;
  explanation: string;
} | null {
  try {
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace < 0 || lastBrace <= firstBrace) return null;
    const payload = JSON.parse(raw.slice(firstBrace, lastBrace + 1)) as {
      proximityScore?: number;
      supportScore?: number;
      repulsionScore?: number;
      directionHint?: string;
      suggestedLinkType?: string;
      explanation?: string;
    };
    const allowedLinkTypes: AnalysisLinkType[] = [
      "related_to",
      "contradicts",
      "causes",
      "supports",
      "amplifies",
      "depends_on",
      "duplicates",
    ];
    const suggestedLinkType = allowedLinkTypes.includes(payload.suggestedLinkType as AnalysisLinkType)
      ? (payload.suggestedLinkType as AnalysisLinkType)
      : "related_to";
    const directionHint =
      payload.directionHint === "causes" || payload.directionHint === "depends_on"
        ? payload.directionHint
        : "none";

    return {
      proximityScore: Number(clamp(Number(payload.proximityScore ?? 0.5), 0, 1).toFixed(4)),
      supportScore: Number(clamp(Number(payload.supportScore ?? 0.45), 0, 1).toFixed(4)),
      repulsionScore: Number(clamp(Number(payload.repulsionScore ?? 0.3), 0, 1).toFixed(4)),
      directionHint,
      suggestedLinkType,
      explanation: String(payload.explanation ?? "").trim().slice(0, 220),
    };
  } catch {
    return null;
  }
}

function parseGenericJson(raw: string): Record<string, unknown> | null {
  try {
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace < 0 || lastBrace <= firstBrace) return null;
    const payload = JSON.parse(raw.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

export type GraphLayoutParseDiagnostics = {
  accepted: boolean;
  reasonCode: "ok" | "empty_response" | "invalid_json" | "below_threshold";
  expectedCount: number;
  parsedCount: number;
  minimumRequired: number;
  coverageRatioApplied: number;
  missingIds: string[];
  unexpectedIdsInResponse: string[];
  rawNodesArrayLength: number;
  /** Eine Zeile Deutsch: warum der Parser abgelehnt hat oder OK */
  summaryDe: string;
};

function summarizeMissingIds(ids: string[], max = 6): string {
  if (ids.length === 0) return "";
  const shown = ids.slice(0, max);
  const suffix = ids.length > max ? ` (+${ids.length - max} weitere)` : "";
  return `${shown.join(", ")}${suffix}`;
}

/**
 * Gleiche Regeln wie {@link parseGraphLayoutJson}, liefert aber eine nachvollziehbare Begründung
 * (z. B. für Tests, Logs, graph_layout_reason bei Rule-Fallback).
 */
export function diagnoseGraphLayoutParse(
  raw: string | null | undefined,
  expectedNodeIds: string[],
  options?: { minimumCoverageRatio?: number }
): GraphLayoutParseDiagnostics {
  const expectedCount = expectedNodeIds.length;
  const ratio = options?.minimumCoverageRatio ?? 0.5;
  const minimumRequired = Math.max(1, Math.ceil(expectedCount * ratio));
  const coverageRatioApplied = ratio;

  if (!raw?.trim()) {
    return {
      accepted: false,
      reasonCode: "empty_response",
      expectedCount,
      parsedCount: 0,
      minimumRequired,
      coverageRatioApplied,
      missingIds: [...expectedNodeIds],
      unexpectedIdsInResponse: [],
      rawNodesArrayLength: 0,
      summaryDe: "Groq lieferte keinen Text (leere Antwort oder Timeout).",
    };
  }

  const json = parseGenericJson(raw);
  if (!json) {
    return {
      accepted: false,
      reasonCode: "invalid_json",
      expectedCount,
      parsedCount: 0,
      minimumRequired,
      coverageRatioApplied,
      missingIds: [...expectedNodeIds],
      unexpectedIdsInResponse: [],
      rawNodesArrayLength: 0,
      summaryDe:
        "Antwort ist kein verwertbares JSON (kein gültiges Objekt in geschweiften Klammern oder Parse-Fehler).",
    };
  }

  const rawNodes = Array.isArray(json.nodes) ? json.nodes : [];
  const expected = new Set(expectedNodeIds);
  const parsedIds = new Set<string>();
  const unexpectedIdsInResponse: string[] = [];

  for (const rawNode of rawNodes) {
    if (!rawNode || typeof rawNode !== "object") continue;
    const node = rawNode as Record<string, unknown>;
    const id = String(node.id ?? "").trim();
    if (!id) continue;
    if (!expected.has(id)) {
      if (!unexpectedIdsInResponse.includes(id)) unexpectedIdsInResponse.push(id);
      continue;
    }
    if (parsedIds.has(id)) continue;
    parsedIds.add(id);
  }

  const parsedCount = parsedIds.size;
  const missingIds = expectedNodeIds.filter((id) => !parsedIds.has(id));

  if (parsedCount < minimumRequired) {
    return {
      accepted: false,
      reasonCode: "below_threshold",
      expectedCount,
      parsedCount,
      minimumRequired,
      coverageRatioApplied,
      missingIds,
      unexpectedIdsInResponse,
      rawNodesArrayLength: rawNodes.length,
      summaryDe: `JSON enthielt nur ${parsedCount} gültige Knoten-ID(s), mindestens ${minimumRequired} nötig (${Math.round(
        coverageRatioApplied * 100
      )}% von ${expectedCount}). Fehlend: ${summarizeMissingIds(missingIds)}.`,
    };
  }

  return {
    accepted: true,
    reasonCode: "ok",
    expectedCount,
    parsedCount,
    minimumRequired,
    coverageRatioApplied,
    missingIds,
    unexpectedIdsInResponse,
    rawNodesArrayLength: rawNodes.length,
    summaryDe: `OK: ${parsedCount} Knoten im JSON akzeptiert.`,
  };
}

function parseGraphLayoutJson(
  raw: string,
  expectedNodeIds: string[],
  options?: { minimumCoverageRatio?: number }
): {
  layoutVersion: string;
  nodes: LlmGraphLayoutNode[];
  globalReasoning: string;
} | null {
  const d = diagnoseGraphLayoutParse(raw, expectedNodeIds, options);
  if (!d.accepted) return null;
  const json = parseGenericJson(raw);
  if (!json) return null;
  const rawNodes = Array.isArray(json.nodes) ? json.nodes : [];
  const parsedNodes: LlmGraphLayoutNode[] = [];
  const expected = new Set(expectedNodeIds);
  const seen = new Set<string>();
  for (const rawNode of rawNodes) {
    if (!rawNode || typeof rawNode !== "object") continue;
    const node = rawNode as Record<string, unknown>;
    const id = String(node.id ?? "").trim();
    if (!id || !expected.has(id) || seen.has(id)) continue;
    const x = clamp(Number(node.x ?? 0), -1, 1);
    const y = clamp(Number(node.y ?? 0), -1, 1);
    const z = clamp(Number(node.z ?? 0), -1, 1);
    const confidence = clamp(Number(node.confidence ?? 0.5), 0, 1);
    parsedNodes.push({
      id,
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
      z: Number.isFinite(z) ? z : 0,
      confidence: Number.isFinite(confidence) ? confidence : 0.5,
      reason: String(node.reason ?? "").trim().slice(0, 140) || undefined,
    });
    seen.add(id);
  }
  const ratio = options?.minimumCoverageRatio ?? 0.5;
  const minimumAccepted = Math.max(1, Math.ceil(expectedNodeIds.length * ratio));
  if (parsedNodes.length < minimumAccepted) return null;
  return {
    layoutVersion: String(json.layoutVersion ?? GRAPH_LAYOUT_PROMPT_VERSION).trim().slice(0, 80),
    nodes: parsedNodes,
    globalReasoning: String(json.globalReasoning ?? "").trim().slice(0, 300),
  };
}

function aggregateGraphLayoutUsages(usages: LlmUsage[]): LlmUsage | null {
  if (usages.length === 0) return null;
  const sum = (pick: (u: LlmUsage) => number | null): number | null => {
    let total = 0;
    let any = false;
    for (const u of usages) {
      const v = pick(u);
      if (v != null && Number.isFinite(v)) {
        total += v;
        any = true;
      }
    }
    return any ? total : null;
  };
  return {
    promptTokens: sum((u) => u.promptTokens),
    completionTokens: sum((u) => u.completionTokens),
    totalTokens: sum((u) => u.totalTokens),
    billableCost: null,
    usageMissing: usages.some((u) => u.usageMissing),
  };
}

function parseUsageFromGeminiResponse(responseBody: Record<string, unknown>): LlmUsage {
  const usage = (responseBody.usageMetadata as Record<string, unknown> | undefined) ?? {};
  const promptTokens = Number(usage.promptTokenCount ?? NaN);
  const completionTokens = Number(usage.candidatesTokenCount ?? NaN);
  const totalTokens = Number(usage.totalTokenCount ?? NaN);
  return {
    promptTokens: Number.isFinite(promptTokens) ? promptTokens : null,
    completionTokens: Number.isFinite(completionTokens) ? completionTokens : null,
    totalTokens: Number.isFinite(totalTokens) ? totalTokens : null,
    billableCost: null,
    usageMissing: !(
      Number.isFinite(promptTokens) ||
      Number.isFinite(completionTokens) ||
      Number.isFinite(totalTokens)
    ),
  };
}

function parseUsageFromGroqResponse(responseBody: Record<string, unknown>): LlmUsage {
  const usage = (responseBody.usage as Record<string, unknown> | undefined) ?? {};
  const promptTokens = Number(usage.prompt_tokens ?? NaN);
  const completionTokens = Number(usage.completion_tokens ?? NaN);
  const totalTokens = Number(usage.total_tokens ?? NaN);
  return {
    promptTokens: Number.isFinite(promptTokens) ? promptTokens : null,
    completionTokens: Number.isFinite(completionTokens) ? completionTokens : null,
    totalTokens: Number.isFinite(totalTokens) ? totalTokens : null,
    billableCost: null,
    usageMissing: !(
      Number.isFinite(promptTokens) ||
      Number.isFinite(completionTokens) ||
      Number.isFinite(totalTokens)
    ),
  };
}

async function fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithRetry(
  input: string,
  init: RequestInit,
  provider: "gemini" | "groq",
  retries = RETRY_MAX_ATTEMPTS
): Promise<Response | null> {
  for (let attempt = 0; attempt <= Math.max(0, retries); attempt += 1) {
    await enforceProviderRateLimit(provider);
    const response = await fetchWithTimeout(input, init).catch(() => null);
    if (response?.ok) return response;
    if (attempt === retries) return response;
    const shouldRetry =
      !response || response.status === 429 || response.status >= 500 || response.status === 408;
    if (!shouldRetry) return response;
    const baseDelay = provider === "groq" ? RETRY_BASE_DELAY_MS_GROQ : RETRY_BASE_DELAY_MS_GEMINI;
    const retryDelayMs = baseDelay * Math.pow(2, attempt) + Math.round(Math.random() * 250);
    await sleep(retryDelayMs);
  }
  return null;
}

export async function scoreWithGemini(
  prompt: string,
  model: string,
  maxOutputTokens?: number
): Promise<{ text: string; usage: LlmUsage } | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const response = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          ...(Number.isFinite(maxOutputTokens) && Number(maxOutputTokens) > 0
            ? { maxOutputTokens: Math.round(Number(maxOutputTokens)) }
            : {}),
        },
      }),
    },
    "gemini"
  );

  if (!response?.ok) return null;
  const data = (await response.json()) as {
    usageMetadata?: Record<string, unknown>;
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
  return {
    text,
    usage: parseUsageFromGeminiResponse(data as Record<string, unknown>),
  };
}

export async function scoreWithGroq(
  prompt: string,
  model: string,
  maxOutputTokens?: number
): Promise<{ text: string; usage: LlmUsage } | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const response = await fetchWithRetry(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        ...(Number.isFinite(maxOutputTokens) && Number(maxOutputTokens) > 0
          ? { max_tokens: Math.round(Number(maxOutputTokens)) }
          : {}),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Du gibst nur valides JSON zurueck." },
          { role: "user", content: prompt },
        ],
      }),
    },
    "groq"
  );

  if (!response?.ok) return null;
  const data = (await response.json()) as {
    usage?: Record<string, unknown>;
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  return {
    text,
    usage: parseUsageFromGroqResponse(data as Record<string, unknown>),
  };
}

export async function scorePairWithLlmDetailed(
  a: AnalysisEntryRecord,
  b: AnalysisEntryRecord,
  options?: { strategyReferenceText?: string | null; maxOutputTokens?: number }
): Promise<LlmScoreResponse<LlmScoredLink>> {
  const prompt = buildPrompt(a, b, options?.strategyReferenceText);
  const groqRaw = await scoreWithGroq(prompt, GROQ_MODEL, options?.maxOutputTokens);
  if (groqRaw) {
    const parsedGroq = parseJsonPayload(groqRaw.text);
    if (parsedGroq) {
      return {
        result: {
          ...parsedGroq,
          provider: "groq",
          model: GROQ_MODEL,
          promptVersion: LINK_PROMPT_VERSION,
        },
        usage: groqRaw.usage,
      };
    }
  }
  const geminiRaw = await scoreWithGemini(prompt, GEMINI_MODEL_LINKS, options?.maxOutputTokens);
  if (!geminiRaw) return { result: null, usage: null };
  const parsed = parseJsonPayload(geminiRaw.text);
  if (!parsed) return { result: null, usage: geminiRaw.usage };
  return {
    result: {
      ...parsed,
      provider: "gemini",
      model: GEMINI_MODEL_LINKS,
      promptVersion: LINK_PROMPT_VERSION,
    },
    usage: geminiRaw.usage,
  };
}

export async function scorePairWithLlm(
  a: AnalysisEntryRecord,
  b: AnalysisEntryRecord,
  options?: { strategyReferenceText?: string | null; maxOutputTokens?: number }
): Promise<LlmScoredLink | null> {
  const response = await scorePairWithLlmDetailed(a, b, options);
  return response.result;
}

function buildQualityScoreFromJson(
  json: Record<string, unknown>,
  provider: "gemini" | "groq",
  model: string
): LlmQualityScore {
  const hasStrategicValue = Boolean(json.strategicValue ?? true);
  const qualityScore = clamp(Number(json.qualityScore ?? 50), 0, 100);
  const impactScore = clamp(Number(json.impactScore ?? qualityScore), 0, 100);
  const certaintyScore = clamp(Number(json.certaintyScore ?? qualityScore), 0, 100);
  const evidenceScore = clamp(Number(json.evidenceScore ?? qualityScore), 0, 100);
  const structureScore = clamp(Number(json.structureScore ?? qualityScore), 0, 100);
  const enforcedZeroScore = hasStrategicValue ? Math.round(qualityScore) : 0;
  return {
    qualityScore: enforcedZeroScore,
    impactScore: hasStrategicValue ? Math.round(impactScore) : 0,
    certaintyScore: hasStrategicValue ? Math.round(certaintyScore) : 0,
    evidenceScore: hasStrategicValue ? Math.round(evidenceScore) : 0,
    structureScore: hasStrategicValue ? Math.round(structureScore) : 0,
    hasStrategicValue,
    strategicValueReason: String(json.strategicValueReason ?? "").trim().slice(0, 180),
    explanation: String(json.explanation ?? "").trim().slice(0, 240) || "LLM-Qualit\u00E4tsbewertung",
    provider,
    model,
    promptVersion: QUALITY_PROMPT_VERSION,
  };
}

export async function scoreEntryQualityWithLlm(
  entry: QualityEntryInput,
  options?: { strategyReferenceText?: string | null; maxOutputTokens?: number }
): Promise<LlmScoreResponse<LlmQualityScore>> {
  const prompt = buildQualityPrompt(entry, options?.strategyReferenceText);
  const groqRaw = await scoreWithGroq(prompt, GROQ_MODEL, options?.maxOutputTokens);
  if (groqRaw) {
    const json = parseGenericJson(groqRaw.text);
    if (json) {
      return {
        result: buildQualityScoreFromJson(json, "groq", GROQ_MODEL),
        usage: groqRaw.usage,
      };
    }
  }
  const geminiRaw = await scoreWithGemini(prompt, GEMINI_MODEL_QUALITY, options?.maxOutputTokens);
  if (!geminiRaw) return { result: null, usage: null };
  const json = parseGenericJson(geminiRaw.text);
  if (!json) return { result: null, usage: geminiRaw.usage };
  return {
    result: buildQualityScoreFromJson(json, "gemini", GEMINI_MODEL_QUALITY),
    usage: geminiRaw.usage,
  };
}

export async function assessClusterWithLlm(input: {
  currentLabel: string;
  currentSummary: string;
  score: number;
  members: string[];
  strategyReferenceText?: string | null;
  existingChallengeTitles?: string[];
  maxOutputTokens?: number;
}): Promise<LlmScoreResponse<LlmClusterAssessment>> {
  const prompt = buildClusterPrompt(input);
  const groqRaw = await scoreWithGroq(prompt, GROQ_MODEL, input.maxOutputTokens);
  if (groqRaw) {
    const json = parseGenericJson(groqRaw.text);
    if (json) {
      return {
        result: {
          label: String(json.label ?? input.currentLabel).trim().slice(0, 120) || input.currentLabel,
          summary:
            String(json.summary ?? input.currentSummary).trim().slice(0, 220) || input.currentSummary,
          scoreAdjustment: clamp(Number(json.scoreAdjustment ?? 0), -0.2, 0.2),
          explanation: String(json.explanation ?? "").trim().slice(0, 160),
          provider: "groq",
          model: GROQ_MODEL,
          promptVersion: CLUSTER_PROMPT_VERSION,
        },
        usage: groqRaw.usage,
      };
    }
  }
  const geminiRaw = await scoreWithGemini(prompt, GEMINI_MODEL_ASSIST, input.maxOutputTokens);
  if (!geminiRaw) return { result: null, usage: null };
  const json = parseGenericJson(geminiRaw.text);
  if (!json) return { result: null, usage: geminiRaw.usage };
  return {
    result: {
      label: String(json.label ?? input.currentLabel).trim().slice(0, 120) || input.currentLabel,
      summary:
        String(json.summary ?? input.currentSummary).trim().slice(0, 220) || input.currentSummary,
      scoreAdjustment: clamp(Number(json.scoreAdjustment ?? 0), -0.2, 0.2),
      explanation: String(json.explanation ?? "").trim().slice(0, 160),
      provider: "gemini",
      model: GEMINI_MODEL_ASSIST,
      promptVersion: CLUSTER_PROMPT_VERSION,
    },
    usage: geminiRaw.usage,
  };
}

export async function assessGapWithLlm(input: {
  dimension: string;
  gapType: string;
  severity: number;
  recommendation: string;
  contextLines: string[];
  strategyReferenceText?: string | null;
  maxOutputTokens?: number;
}): Promise<LlmScoreResponse<LlmGapAssessment>> {
  const prompt = buildGapPrompt(input);
  const groqRaw = await scoreWithGroq(prompt, GROQ_MODEL, input.maxOutputTokens);
  if (groqRaw) {
    const json = parseGenericJson(groqRaw.text);
    if (json) {
      return {
        result: {
          severity: Math.round(clamp(Number(json.severity ?? input.severity), 1, 5)),
          recommendation:
            String(json.recommendation ?? input.recommendation).trim().slice(0, 220) ||
            input.recommendation,
          rationale: String(json.rationale ?? "").trim().slice(0, 160),
          provider: "groq",
          model: GROQ_MODEL,
          promptVersion: GAP_PROMPT_VERSION,
        },
        usage: groqRaw.usage,
      };
    }
  }
  const geminiRaw = await scoreWithGemini(prompt, GEMINI_MODEL_ASSIST, input.maxOutputTokens);
  if (!geminiRaw) return { result: null, usage: null };
  const json = parseGenericJson(geminiRaw.text);
  if (!json) return { result: null, usage: geminiRaw.usage };
  return {
    result: {
      severity: Math.round(clamp(Number(json.severity ?? input.severity), 1, 5)),
      recommendation:
        String(json.recommendation ?? input.recommendation).trim().slice(0, 220) ||
        input.recommendation,
      rationale: String(json.rationale ?? "").trim().slice(0, 160),
      provider: "gemini",
      model: GEMINI_MODEL_ASSIST,
      promptVersion: GAP_PROMPT_VERSION,
    },
    usage: geminiRaw.usage,
  };
}

function parseChallengeCandidatesFromJson(json: Record<string, unknown>): LlmChallengeCandidate[] {
  const candidatesRaw = Array.isArray(json.candidates) ? json.candidates : [];
  const candidates: LlmChallengeCandidate[] = [];
  for (const item of candidatesRaw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const source = row.source === "gap" ? "gap" : "cluster";
    const sourceRef = String(row.sourceRef ?? "").trim();
    const title = String(row.title ?? "").trim();
    if (!title || !sourceRef) continue;
    candidates.push({
      title: title.slice(0, 140),
      description: String(row.description ?? "").trim().slice(0, 400),
      priority: Math.round(clamp(Number(row.priority ?? 3), 1, 5)),
      source,
      sourceRef,
    });
  }
  return candidates.slice(0, 8);
}

export async function proposeChallengeCandidatesWithLlm(input: {
  clusters: Array<{ id: string; label: string; summary: string; score: number }>;
  gaps: Array<{ id: string; dimension: string; gapType: string; severity: number; recommendation: string }>;
  strategyReferenceText?: string | null;
  existingChallengeTitles?: string[];
  maxOutputTokens?: number;
}): Promise<LlmScoreResponse<LlmChallengeCandidate[]>> {
  if (input.clusters.length === 0 && input.gaps.length === 0) {
    return { result: [], usage: null };
  }
  const prompt = buildChallengeCandidatesPrompt(input);
  const groqRaw = await scoreWithGroq(prompt, GROQ_MODEL, input.maxOutputTokens);
  if (groqRaw) {
    const json = parseGenericJson(groqRaw.text);
    if (json) {
      const candidates = parseChallengeCandidatesFromJson(json);
      if (candidates.length > 0) {
        return {
          result: candidates,
          usage: groqRaw.usage,
          resolvedProvider: "groq",
          resolvedModel: GROQ_MODEL,
        };
      }
    }
  }
  const geminiRaw = await scoreWithGemini(prompt, GEMINI_MODEL_ASSIST, input.maxOutputTokens);
  if (!geminiRaw) return { result: null, usage: null };
  const json = parseGenericJson(geminiRaw.text);
  if (!json) return { result: null, usage: geminiRaw.usage };
  return {
    result: parseChallengeCandidatesFromJson(json),
    usage: geminiRaw.usage,
    resolvedProvider: "gemini",
    resolvedModel: GEMINI_MODEL_ASSIST,
  };
}

type GraphLayoutLlmInput = {
  nodes: Array<{
    id: string;
    title: string;
    analysisType: string;
    subType: string | null;
    impact: number;
    uncertainty: number;
    description: string | null;
    qualityScore: number;
  }>;
  edges: Array<{
    source: string;
    target: string;
    linkType: string;
    confidence: number;
    strength: number;
    triScores?: { proximityScore: number; supportScore: number; repulsionScore: number } | null;
  }>;
  strategyReferenceText?: string | null;
  maxOutputTokens?: number;
};

export type GraphLayoutLlmMergeDiagnostics = {
  missingNodeIds: string[];
  /** Für Rule-Knoten in die DB (graph_layout_reason); gekürzt */
  ruleFallbackExplanationDe: string;
  /** Letzter Groq-Versuch mit Parser-Ablehnung (auch wenn Gemini danach half) */
  lastGroqParseRejected: GraphLayoutParseDiagnostics | null;
};

async function proposeGraphLayoutWithLlmOnce(
  input: GraphLayoutLlmInput,
  parseOptions?: { minimumCoverageRatio?: number }
): Promise<{
  result: LlmGraphLayout | null;
  usage: LlmUsage | null;
  groqParseRejected: GraphLayoutParseDiagnostics | null;
}> {
  if (input.nodes.length === 0) {
    return { result: null, usage: null, groqParseRejected: null };
  }
  const expectedNodeIds = input.nodes.map((node) => node.id);
  const prompt = buildGraphLayoutPrompt(input);
  let groqParseRejected: GraphLayoutParseDiagnostics | null = null;
  const groqRaw = await scoreWithGroq(prompt, GROQ_MODEL, input.maxOutputTokens);
  if (groqRaw) {
    const parsedGroq = parseGraphLayoutJson(groqRaw.text, expectedNodeIds, parseOptions);
    if (parsedGroq) {
      return {
        result: {
          ...parsedGroq,
          provider: "groq",
          model: GROQ_MODEL,
          promptVersion: GRAPH_LAYOUT_PROMPT_VERSION,
        },
        usage: groqRaw.usage,
        groqParseRejected: null,
      };
    }
    groqParseRejected = diagnoseGraphLayoutParse(groqRaw.text, expectedNodeIds, parseOptions);
  } else {
    groqParseRejected = diagnoseGraphLayoutParse(undefined, expectedNodeIds, parseOptions);
  }
  const geminiRaw = await scoreWithGemini(prompt, GEMINI_MODEL_ASSIST, input.maxOutputTokens);
  if (!geminiRaw) return { result: null, usage: null, groqParseRejected };
  const parsed = parseGraphLayoutJson(geminiRaw.text, expectedNodeIds, parseOptions);
  if (!parsed) return { result: null, usage: geminiRaw.usage, groqParseRejected };
  return {
    result: {
      ...parsed,
      provider: "gemini",
      model: GEMINI_MODEL_ASSIST,
      promptVersion: GRAPH_LAYOUT_PROMPT_VERSION,
    },
    usage: geminiRaw.usage,
    groqParseRejected,
  };
}

function buildGraphLayoutRuleFallbackExplanationDe(
  missingCount: number,
  lastGroq: GraphLayoutParseDiagnostics | null
): string {
  const head = `${missingCount} Knoten: Regel-Layout, weil dafür keine gültige LLM-Position übernommen wurde.`;
  const tail = lastGroq?.summaryDe ? ` Letzter Groq-Parser: ${lastGroq.summaryDe}` : "";
  return (head + tail).slice(0, 480);
}

export type GraphLayoutGroqPipelineStep = {
  phase: "full" | "supplement";
  supplementRound: number;
  expectedNodeIds: string[];
  groqTextLength: number;
  /** Anfang der Rohantwort (nur Diagnose; nicht in Produktion loggen ohne Redaktion) */
  groqTextPreview: string;
  usage: LlmUsage | null;
  parse: GraphLayoutParseDiagnostics;
};

export type GraphLayoutGroqPipelineReport = {
  model: string;
  steps: GraphLayoutGroqPipelineStep[];
  mergedNodeIds: string[];
  missingNodeIds: string[];
  summaryDe: string;
};

/**
 * Nur Groq (kein Gemini): gleiche Batch-Logik wie {@link proposeGraphLayoutWithLlm}, aber
 * pro Schritt Rohantwort + Parser-Diagnose — für Tests und Root-Cause (warum fehlen IDs).
 */
export async function diagnoseGraphLayoutGroqPipeline(
  input: GraphLayoutLlmInput
): Promise<GraphLayoutGroqPipelineReport> {
  const expectedNodeIds = input.nodes.map((node) => node.id);
  if (expectedNodeIds.length === 0) {
    return {
      model: GROQ_MODEL,
      steps: [],
      mergedNodeIds: [],
      missingNodeIds: [],
      summaryDe: "Keine Knoten übergeben.",
    };
  }

  const nodeById = new Map(input.nodes.map((node) => [node.id, node]));
  const edgeList = input.edges;
  const merged = new Map<string, LlmGraphLayoutNode>();
  const steps: GraphLayoutGroqPipelineStep[] = [];

  const promptFull = buildGraphLayoutPrompt(input);
  const groqFull = await scoreWithGroq(promptFull, GROQ_MODEL, input.maxOutputTokens);
  const parseFull = diagnoseGraphLayoutParse(groqFull?.text, expectedNodeIds, { minimumCoverageRatio: 0.5 });
  steps.push({
    phase: "full",
    supplementRound: 0,
    expectedNodeIds: [...expectedNodeIds],
    groqTextLength: groqFull?.text?.length ?? 0,
    groqTextPreview: (groqFull?.text ?? "").slice(0, 1200),
    usage: groqFull?.usage ?? null,
    parse: parseFull,
  });
  const parsedFull = parseGraphLayoutJson(groqFull?.text ?? "", expectedNodeIds, { minimumCoverageRatio: 0.5 });
  if (parsedFull) {
    for (const node of parsedFull.nodes) merged.set(node.id, node);
  }

  const giveUp = new Set<string>();
  let chunkCap = Math.max(1, Math.min(GRAPH_LAYOUT_SUPPLEMENT_CHUNK_SIZE, expectedNodeIds.length));
  let supplementRounds = 0;

  while (supplementRounds < GRAPH_LAYOUT_SUPPLEMENT_MAX_ROUNDS) {
    const missing = expectedNodeIds.filter((id) => !merged.has(id) && !giveUp.has(id));
    if (missing.length === 0) break;

    const chunk = missing.slice(0, chunkCap);
    const chunkSet = new Set(chunk);
    const chunkNodes = chunk
      .map((id) => nodeById.get(id))
      .filter((n): n is GraphLayoutLlmInput["nodes"][number] => n != null);
    if (chunkNodes.length === 0) break;

    const chunkEdges = edgeList.filter((edge) => chunkSet.has(edge.source) && chunkSet.has(edge.target));
    const ratio = 1 / Math.max(chunk.length, 1);
    const promptSub = buildGraphLayoutPrompt({
      nodes: chunkNodes,
      edges: chunkEdges,
      strategyReferenceText: input.strategyReferenceText,
    });
    const groqSub = await scoreWithGroq(promptSub, GROQ_MODEL, input.maxOutputTokens);
    const parseSub = diagnoseGraphLayoutParse(groqSub?.text, chunk, { minimumCoverageRatio: ratio });
    steps.push({
      phase: "supplement",
      supplementRound: supplementRounds + 1,
      expectedNodeIds: [...chunk],
      groqTextLength: groqSub?.text?.length ?? 0,
      groqTextPreview: (groqSub?.text ?? "").slice(0, 1200),
      usage: groqSub?.usage ?? null,
      parse: parseSub,
    });

    const before = merged.size;
    const parsedSub = parseGraphLayoutJson(groqSub?.text ?? "", chunk, { minimumCoverageRatio: ratio });
    if (parsedSub) {
      for (const node of parsedSub.nodes) merged.set(node.id, node);
    }
    supplementRounds += 1;

    const gained = merged.size > before;
    if (gained) {
      chunkCap = Math.max(1, Math.min(GRAPH_LAYOUT_SUPPLEMENT_CHUNK_SIZE, expectedNodeIds.length));
    } else if (chunkCap > 1) {
      chunkCap = Math.max(1, Math.floor(chunkCap / 2));
    } else {
      giveUp.add(chunk[0]);
      chunkCap = Math.max(1, Math.min(GRAPH_LAYOUT_SUPPLEMENT_CHUNK_SIZE, expectedNodeIds.length));
    }
  }

  const mergedNodeIds = expectedNodeIds.filter((id) => merged.has(id));
  const missingNodeIds = expectedNodeIds.filter((id) => !merged.has(id));
  const lastFail = [...steps].reverse().find((s) => !s.parse.accepted);
  const summaryDe =
    missingNodeIds.length === 0
      ? `Groq-only: alle ${mergedNodeIds.length} Knoten nach ${steps.length} Schritt(en) parsebar.`
      : `Groq-only: ${missingNodeIds.length} Knoten ohne Position. ${lastFail ? lastFail.parse.summaryDe : ""}`.slice(
          0,
          600
        );

  return {
    model: GROQ_MODEL,
    steps,
    mergedNodeIds,
    missingNodeIds,
    summaryDe,
  };
}

/**
 * Erster Aufruf mit vollem Graph (50 %-Parser-Schwelle), danach Supplement-Batches
 * für fehlende IDs (1/Knoten Mindestabdeckung), damit unvollständige Groq-JSON-Antworten
 * nicht dauerhaft auf Rule-Fallback verweisen.
 */
export async function proposeGraphLayoutWithLlm(
  input: GraphLayoutLlmInput
): Promise<
  LlmScoreResponse<LlmGraphLayout> & {
    graphLayoutDiagnostics?: GraphLayoutLlmMergeDiagnostics;
  }
> {
  if (input.nodes.length === 0) return { result: null, usage: null };
  const expectedNodeIds = input.nodes.map((node) => node.id);
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]));
  const edgeList = input.edges;

  const merged = new Map<string, LlmGraphLayoutNode>();
  const usages: LlmUsage[] = [];
  const reasoningParts: string[] = [];

  let lastGroqParseRejected: GraphLayoutParseDiagnostics | null = null;

  const fullPass = await proposeGraphLayoutWithLlmOnce(input, { minimumCoverageRatio: 0.5 });
  if (fullPass.groqParseRejected) lastGroqParseRejected = fullPass.groqParseRejected;
  if (fullPass.usage) usages.push(fullPass.usage);
  if (fullPass.result) {
    for (const node of fullPass.result.nodes) merged.set(node.id, node);
    if (fullPass.result.globalReasoning) reasoningParts.push(fullPass.result.globalReasoning);
  }

  let layoutVersion = fullPass.result?.layoutVersion ?? GRAPH_LAYOUT_PROMPT_VERSION;
  let primaryProvider: LlmGraphLayout["provider"] | null = fullPass.result?.provider ?? null;
  let primaryModel: string | null = fullPass.result?.model ?? null;

  const giveUp = new Set<string>();
  let chunkCap = Math.max(1, Math.min(GRAPH_LAYOUT_SUPPLEMENT_CHUNK_SIZE, expectedNodeIds.length));
  let supplementRounds = 0;

  while (supplementRounds < GRAPH_LAYOUT_SUPPLEMENT_MAX_ROUNDS) {
    const missing = expectedNodeIds.filter((id) => !merged.has(id) && !giveUp.has(id));
    if (missing.length === 0) break;

    const chunk = missing.slice(0, chunkCap);
    const chunkSet = new Set(chunk);
    const chunkNodes = chunk
      .map((id) => nodeById.get(id))
      .filter((n): n is GraphLayoutLlmInput["nodes"][number] => n != null);
    if (chunkNodes.length === 0) break;

    const chunkEdges = edgeList.filter((edge) => chunkSet.has(edge.source) && chunkSet.has(edge.target));
    const ratio = 1 / Math.max(chunk.length, 1);

    const before = merged.size;
    const subRes = await proposeGraphLayoutWithLlmOnce(
      {
        nodes: chunkNodes,
        edges: chunkEdges,
        strategyReferenceText: input.strategyReferenceText,
        maxOutputTokens: input.maxOutputTokens,
      },
      { minimumCoverageRatio: ratio }
    );
    supplementRounds += 1;
    if (subRes.groqParseRejected) lastGroqParseRejected = subRes.groqParseRejected;
    if (subRes.usage) usages.push(subRes.usage);

    if (subRes.result) {
      for (const node of subRes.result.nodes) merged.set(node.id, node);
      if (subRes.result.globalReasoning) reasoningParts.push(subRes.result.globalReasoning);
      if (!primaryProvider) {
        primaryProvider = subRes.result.provider;
        primaryModel = subRes.result.model;
      }
      layoutVersion = subRes.result.layoutVersion || layoutVersion;
    }

    const gained = merged.size > before;
    if (gained) {
      chunkCap = Math.max(1, Math.min(GRAPH_LAYOUT_SUPPLEMENT_CHUNK_SIZE, expectedNodeIds.length));
    } else if (chunkCap > 1) {
      chunkCap = Math.max(1, Math.floor(chunkCap / 2));
    } else {
      giveUp.add(chunk[0]);
      chunkCap = Math.max(1, Math.min(GRAPH_LAYOUT_SUPPLEMENT_CHUNK_SIZE, expectedNodeIds.length));
    }
  }

  const missingNodeIds = expectedNodeIds.filter((id) => !merged.has(id));
  const graphLayoutDiagnostics: GraphLayoutLlmMergeDiagnostics | undefined =
    missingNodeIds.length > 0
      ? {
          missingNodeIds,
          ruleFallbackExplanationDe: buildGraphLayoutRuleFallbackExplanationDe(
            missingNodeIds.length,
            lastGroqParseRejected
          ),
          lastGroqParseRejected,
        }
      : undefined;

  if (merged.size === 0) {
    return {
      result: null,
      usage: aggregateGraphLayoutUsages(usages),
      graphLayoutDiagnostics:
        graphLayoutDiagnostics ??
        ({
          missingNodeIds: [...expectedNodeIds],
          ruleFallbackExplanationDe: buildGraphLayoutRuleFallbackExplanationDe(
            expectedNodeIds.length,
            lastGroqParseRejected
          ),
          lastGroqParseRejected,
        } satisfies GraphLayoutLlmMergeDiagnostics),
    };
  }

  const orderedNodes = expectedNodeIds
    .map((id) => merged.get(id))
    .filter((node): node is LlmGraphLayoutNode => Boolean(node));

  return {
    result: {
      layoutVersion,
      nodes: orderedNodes,
      globalReasoning: reasoningParts.filter(Boolean).join(" | ").slice(0, 300),
      provider: primaryProvider ?? "groq",
      model: primaryModel ?? GROQ_MODEL,
      promptVersion: GRAPH_LAYOUT_PROMPT_VERSION,
    },
    usage: aggregateGraphLayoutUsages(usages),
    graphLayoutDiagnostics,
  };
}

/** Generic LLM invocation for JSON responses. Used by objective-evaluation. */
export async function invokeLlmForJson(
  prompt: string,
  maxOutputTokens?: number
): Promise<{ text: string; usage: LlmUsage; provider: string; model: string } | null> {
  const groqRaw = await scoreWithGroq(prompt, GROQ_MODEL, maxOutputTokens);
  if (groqRaw?.text) {
    return {
      text: groqRaw.text,
      usage: groqRaw.usage,
      provider: "groq",
      model: GROQ_MODEL,
    };
  }
  const geminiRaw = await scoreWithGemini(prompt, GEMINI_MODEL_ASSIST, maxOutputTokens);
  if (!geminiRaw?.text) return null;
  return {
    text: geminiRaw.text,
    usage: geminiRaw.usage,
    provider: "gemini",
    model: GEMINI_MODEL_ASSIST,
  };
}

export type StrategyObjectiveRelevance = "direct" | "indirect" | "not_relevant";

export type LlmOkrDirectionContribution = {
  strategicDirectionId: string;
  alignmentLevel: OkrContributionTier;
  /** Klarheit, Messbarkeit, Überprüfbarkeit (hoch = gut). */
  formulationLevel: OkrContributionTier;
  /** Scope zum OKR-Zeitraum (high = überladen, medium = passend, low = zu eng). */
  scopeFitLevel: OkrContributionTier;
  overallLevel: OkrContributionTier;
  reason: string;
  improvementHint: string;
};

export type LlmOkrStrategyObjectiveContribution = {
  objectiveId: string;
  relevance: StrategyObjectiveRelevance;
  fitLevel: OkrContributionTier | null;
  reason: string;
  improvementHint: string;
};

export type LlmOkrInitiativeContribution = {
  initiativeId: string;
  executionLinkageLevel: OkrContributionTier;
  reason: string;
  improvementHint: string;
};

export type LlmOkrContributionAssessment = {
  okrId: string;
  strategicDirectionContribution: LlmOkrDirectionContribution;
  strategyObjectiveContributions: LlmOkrStrategyObjectiveContribution[];
  initiativeContributions: LlmOkrInitiativeContribution[];
  provider: "gemini" | "groq";
  model: string;
  promptVersion: string;
};

export type LlmKrInitiativeMatch = {
  initiativeId: string;
  level: "low" | "medium" | "high";
  reason: string;
  confidence: number;
};

export type LlmKrInitiativeMatchingResult = {
  status: "ok" | "insufficient_context";
  krId: string;
  initiativeMatches: LlmKrInitiativeMatch[];
  insufficientContextReason: string | null;
  provider: "gemini" | "groq";
  model: string;
  promptVersion: string;
};

function normalizeLlmContributionTier(raw: unknown): OkrContributionTier {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (
    v === "insufficient" ||
    v === "underdescribed" ||
    v === "unzureichend" ||
    v === "not_assessable" ||
    v === "nicht_auswertbar" ||
    v === "under_specified"
  ) {
    return "insufficient";
  }
  if (v === "weak" || v === "low") return "low";
  if (v === "strong" || v === "high") return "high";
  if (v === "medium") return "medium";
  /** Unbekannt/leer: nicht als Einzahlungsstufe interpretierbar */
  return "insufficient";
}

function parseImprovementHint(raw: unknown, level: OkrContributionTier): string {
  const hint = String(raw ?? "")
    .trim()
    .slice(0, 500);
  if (level === "high") return "";
  return hint;
}

function parseStrategyObjectiveRelevance(raw: unknown): StrategyObjectiveRelevance {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (v === "direct") return "direct";
  if (v === "indirect") return "indirect";
  return "not_relevant";
}

function parseOkrDirectionContribution(
  raw: unknown,
  expectedDirectionId: string
): LlmOkrDirectionContribution | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const strategicDirectionId = String(o.strategic_direction_id ?? "").trim();
  if (strategicDirectionId !== expectedDirectionId) return null;
  const alignmentLevel = normalizeLlmContributionTier(o.alignment_level);
  const formulationLevel = normalizeLlmContributionTier(
    o.formulation_level ?? o.ambition_level
  );
  const scopeFitLevel = normalizeLlmContributionTier(o.scope_fit_level ?? "medium");
  const modelOverall =
    o.overall_level == null || String(o.overall_level).trim() === ""
      ? null
      : normalizeLlmContributionTier(o.overall_level);
  const overallLevel = computeStrategicDirectionOverallLevel({
    alignmentLevel,
    formulationLevel,
    scopeFitLevel,
    modelOverallLevel: modelOverall,
  });
  const reason = String(o.reason ?? "")
    .trim()
    .slice(0, 400);
  const improvementHint = parseImprovementHint(o.improvement_hint, overallLevel);
  return {
    strategicDirectionId,
    alignmentLevel,
    formulationLevel,
    scopeFitLevel,
    overallLevel,
    reason,
    improvementHint,
  };
}

function parseOkrStrategyObjectiveContributions(
  rawList: unknown,
  allowed: Set<string>
): LlmOkrStrategyObjectiveContribution[] {
  if (!Array.isArray(rawList)) return [];
  const out: LlmOkrStrategyObjectiveContribution[] = [];
  const seen = new Set<string>();
  for (const row of rawList) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const objectiveId = String(o.objective_id ?? "").trim();
    if (!objectiveId || !allowed.has(objectiveId) || seen.has(objectiveId)) continue;
    seen.add(objectiveId);
    const relevance = parseStrategyObjectiveRelevance(o.relevance);
    const fitLevel =
      relevance === "not_relevant" ? null : normalizeLlmContributionTier(o.fit_level);
    const reason = String(o.reason ?? "")
      .trim()
      .slice(0, 400);
    const levelForHint = fitLevel ?? "high";
    const improvementHint =
      relevance === "not_relevant" ? "" : parseImprovementHint(o.improvement_hint, levelForHint);
    out.push({
      objectiveId,
      relevance,
      fitLevel,
      reason,
      improvementHint,
    });
  }
  return out;
}

function parseOkrInitiativeContributions(
  rawList: unknown,
  allowed: Set<string>
): LlmOkrInitiativeContribution[] {
  if (!Array.isArray(rawList)) return [];
  const out: LlmOkrInitiativeContribution[] = [];
  const seen = new Set<string>();
  for (const row of rawList) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const initiativeId = String(o.initiative_id ?? "").trim();
    if (!initiativeId || !allowed.has(initiativeId) || seen.has(initiativeId)) continue;
    seen.add(initiativeId);
    const executionLinkageLevel = normalizeLlmContributionTier(
      o.execution_linkage_level ?? o.level
    );
    const reason = String(o.reason ?? "")
      .trim()
      .slice(0, 400);
    const improvementHint = parseImprovementHint(o.improvement_hint, executionLinkageLevel);
    out.push({
      initiativeId,
      executionLinkageLevel,
      reason,
      improvementHint,
    });
  }
  return out;
}

function parseOkrContributionJson(
  text: string,
  expectedOkrId: string,
  strategicDirectionId: string,
  initiativeIds: string[],
  strategyObjectiveIds: string[]
): Omit<LlmOkrContributionAssessment, "provider" | "model" | "promptVersion"> | null {
  const json = parseGenericJson(text);
  if (!json) return null;
  const okrId = String(json.okr_id ?? "").trim();
  if (okrId !== expectedOkrId) return null;

  const strategicDirectionContribution = parseOkrDirectionContribution(
    json.strategic_direction_contribution,
    strategicDirectionId
  );
  if (!strategicDirectionContribution) return null;

  const initAllowed = new Set(initiativeIds);
  const soAllowed = new Set(strategyObjectiveIds);

  const initiativeContributions = parseOkrInitiativeContributions(
    json.initiative_contributions,
    initAllowed
  );
  const strategyObjectiveContributions = parseOkrStrategyObjectiveContributions(
    json.strategy_objective_contributions,
    soAllowed
  );

  for (const iid of initiativeIds) {
    if (!initiativeContributions.some((x) => x.initiativeId === iid)) {
      initiativeContributions.push({
        initiativeId: iid,
        executionLinkageLevel: "insufficient",
        reason:
          "Kein gültiger Modell-Eintrag für diese Initiative — technisch als «unzureichend beschrieben» erfasst.",
        improvementHint: "Initiative-Verknüpfung und KR-Text präzisieren.",
      });
    }
  }

  const soSeen = new Set(strategyObjectiveContributions.map((x) => x.objectiveId));
  for (const sid of strategyObjectiveIds) {
    if (!soSeen.has(sid)) {
      strategyObjectiveContributions.push({
        objectiveId: sid,
        relevance: "not_relevant",
        fitLevel: null,
        reason: "Kein Modell-Eintrag — als nicht relevant behandelt.",
        improvementHint: "",
      });
    }
  }

  return {
    okrId,
    strategicDirectionContribution,
    strategyObjectiveContributions,
    initiativeContributions,
  };
}

function buildOkrContributionPrompt(
  contextJson: string,
  strategicDirectionId: string,
  initiativeIds: string[],
  strategyObjectiveIds: string[]
): string {
  const initiativeRule =
    initiativeIds.length > 0
      ? `- initiative_contributions: genau ein Eintrag pro ID ${JSON.stringify(initiativeIds)} mit execution_linkage_level (operative Umsetzung über KR-Links).`
      : `- initiative_contributions: leeres Array [] (keine Initiative-Verknüpfungen).`;

  return `Du bist ein strategischer OKR-Analyst. Bewerte in dieser Reihenfolge:
1) Strategic Alignment, Formulierung und Quartals-Fit des OKR zur führenden Stoßrichtung (Pflicht)
2) Portfolio-Strategieziele unter derselben Stoßrichtung (Relevanz zuerst, dann Fit)
3) Initiativen nur als Execution Linkage (nachrangig, optional)

Antworte ausschließlich mit einem JSON-Objekt (kein Markdown), exakt dieser Struktur:
{
  "okr_id": "<uuid>",
  "strategic_direction_contribution": {
    "strategic_direction_id": "<uuid>",
    "alignment_level": "low"|"medium"|"high"|"insufficient",
    "formulation_level": "low"|"medium"|"high"|"insufficient",
    "scope_fit_level": "low"|"medium"|"high"|"insufficient",
    "overall_level": "low"|"medium"|"high"|"insufficient",
    "reason": "<max 3 Sätze: Alignment, Formulierung und Quartals-Fit getrennt benennen>",
    "improvement_hint": "<leer wenn overall_level=high, sonst konkreter Rat>"
  },
  "strategy_objective_contributions": [
    {
      "objective_id": "<uuid>",
      "relevance": "direct"|"indirect"|"not_relevant",
      "fit_level": "low"|"medium"|"high"|"insufficient",
      "reason": "<kurz>",
      "improvement_hint": "<nur wenn relevance≠not_relevant und fit_level≠high>"
    }
  ],
  "initiative_contributions": [
    {
      "initiative_id": "<uuid>",
      "execution_linkage_level": "low"|"medium"|"high"|"insufficient",
      "reason": "<kurz>",
      "improvement_hint": "<leer wenn high>"
    }
  ]
}

Regeln Stoßrichtung (strategic_direction_id exakt ${JSON.stringify(strategicDirectionId)}):
- alignment_level: strategischer Fit zur Stoßrichtung (hoch = guter Fit).
- formulation_level: Klarheit und Messbarkeit von Objective und KRs (hoch = SMART genug, eindeutig prüfbar). NICHT verwechseln mit Scope: vage Booleans oder fehlende Zielwerte → eher low/medium.
- scope_fit_level: passt die Menge der Outcomes zum OKR-Zeitraum im Kontext (okr_cycle)? low = zu eng/unterfordert; medium = passend; high = überladen/zu viel für den Zeitraum (z. B. Recruiting + volle Einsatzfähigkeit + Beschaffung in einem Quartal). Nutze okr_cycle.start_date und end_date.
- overall_level: zusammenfassend; konservativ (schwächt sich aus überladenem Scope, schwacher Formulierung oder schwachem Alignment).
- improvement_hint Pflicht wenn overall_level nicht high.

Strategieziele (Portfolio unter der Stoßrichtung):
- Für jedes Strategieziel in dieser ID-Liste genau ein Eintrag: ${JSON.stringify(strategyObjectiveIds)}
- Zuerst relevance: not_relevant = OKR muss nicht zu diesem SO beitragen → kein negatives Fit-Urteil erzwingen.
- fit_level nur bei direct oder indirect bewerten; bei not_relevant fit_level weglassen oder insufficient nur wenn wirklich unklar.

Initiativen:
${initiativeRule}
- execution_linkage_level bewertet operative Verknüpfung; ersetzt nicht Stoßrichtungs-Overall.

Stufen nur low, medium, high oder insufficient (Synonyme weak=low, strong=high; insufficient exakt so schreiben).

Kontext (JSON):
${contextJson}`;
}

/** @internal Tests */
export function parseOkrContributionAssessmentV4Response(
  text: string,
  expectedOkrId: string,
  strategicDirectionId: string,
  initiativeIds: string[],
  strategyObjectiveIds: string[]
): Omit<LlmOkrContributionAssessment, "provider" | "model" | "promptVersion"> | null {
  return parseOkrContributionJson(
    text,
    expectedOkrId,
    strategicDirectionId,
    initiativeIds,
    strategyObjectiveIds
  );
}

export async function assessOkrContributionsWithLlm(input: {
  contextJson: string;
  okrObjectiveId: string;
  strategicDirectionId: string;
  initiativeIds: string[];
  strategyObjectiveIds: string[];
  maxOutputTokens?: number;
}): Promise<LlmScoreResponse<LlmOkrContributionAssessment>> {
  const prompt = buildOkrContributionPrompt(
    input.contextJson,
    input.strategicDirectionId,
    input.initiativeIds,
    input.strategyObjectiveIds
  );
  const invoked = await invokeLlmForJson(prompt, input.maxOutputTokens);
  if (!invoked?.text) return { result: null, usage: invoked?.usage ?? null };
  const parsed = parseOkrContributionJson(
    invoked.text,
    input.okrObjectiveId,
    input.strategicDirectionId,
    input.initiativeIds,
    input.strategyObjectiveIds
  );
  if (!parsed) return { result: null, usage: invoked.usage };
  const provider = invoked.provider === "gemini" ? ("gemini" as const) : ("groq" as const);
  const model = invoked.model;
  return {
    result: {
      ...parsed,
      provider,
      model,
      promptVersion: OKR_CONTRIBUTION_PROMPT_VERSION,
    },
    usage: invoked.usage,
  };
}

function buildKrInitiativeMatchingPrompt(input: {
  contextJson: string;
  keyResultId: string;
  initiativeIds: string[];
}): string {
  return `Du bist ein Strategie-Analyst fuer die Verknuepfung von Key Results und Initiativen.

Antworte ausschliesslich mit einem JSON-Objekt (kein Markdown), exakt in einer der beiden Formen:

1) Bei ausreichendem Kontext:
{
  "status": "ok",
  "kr_id": "<uuid>",
  "initiative_matches": [
    {
      "initiative_id": "<uuid>",
      "level": "low"|"medium"|"high",
      "reason": "<max 2 Saetze, konkret>",
      "confidence": 0.0
    }
  ]
}

2) Bei zu schwachem Kontext:
{
  "status": "insufficient_context",
  "kr_id": "<uuid>",
  "insufficient_context_reason": "<kurz und konkret>"
}

Regeln:
- Nur IDs aus dieser Liste verwenden: ${JSON.stringify(input.initiativeIds)}
- Maximal 5 initiative_matches.
- confidence zwischen 0 und 1.
- level darf nur low, medium oder high sein.
- Wenn KR oder Initiativen inhaltlich zu unklar sind, gib status=insufficient_context statt zu raten.

Kontext (JSON):
${input.contextJson}`;
}

const krInitiativeMatchItemSchema = z.object({
  initiative_id: z.string().uuid(),
  level: z.enum(["low", "medium", "high"]),
  reason: z.string().trim().min(1).max(400),
  confidence: z.number().min(0).max(1),
});

const krInitiativeMatchingSchema = z.union([
  z.object({
    status: z.literal("ok"),
    kr_id: z.string().uuid(),
    initiative_matches: z.array(krInitiativeMatchItemSchema).max(5),
  }),
  z.object({
    status: z.literal("insufficient_context"),
    kr_id: z.string().uuid(),
    insufficient_context_reason: z.string().trim().min(1).max(400),
  }),
]);

export async function assessKrInitiativeMatchingWithLlm(input: {
  contextJson: string;
  keyResultId: string;
  initiativeIds: string[];
  maxOutputTokens?: number;
}): Promise<LlmScoreResponse<LlmKrInitiativeMatchingResult>> {
  const prompt = buildKrInitiativeMatchingPrompt(input);
  const invoked = await invokeLlmForJson(prompt, input.maxOutputTokens);
  if (!invoked?.text) return { result: null, usage: invoked?.usage ?? null };

  const parsedJson = parseGenericJson(invoked.text);
  if (!parsedJson) return { result: null, usage: invoked.usage };
  const parsed = krInitiativeMatchingSchema.safeParse(parsedJson);
  if (!parsed.success) return { result: null, usage: invoked.usage };

  if (parsed.data.kr_id !== input.keyResultId) {
    return { result: null, usage: invoked.usage };
  }

  const allowed = new Set(input.initiativeIds);
  const provider = invoked.provider === "gemini" ? ("gemini" as const) : ("groq" as const);
  const model = invoked.model;

  if (parsed.data.status === "insufficient_context") {
    return {
      result: {
        status: "insufficient_context",
        krId: parsed.data.kr_id,
        initiativeMatches: [],
        insufficientContextReason: parsed.data.insufficient_context_reason,
        provider,
        model,
        promptVersion: KR_INITIATIVE_MATCHING_PROMPT_VERSION,
      },
      usage: invoked.usage,
    };
  }

  const unique = new Set<string>();
  const matches: LlmKrInitiativeMatch[] = [];
  for (const row of parsed.data.initiative_matches) {
    if (!allowed.has(row.initiative_id) || unique.has(row.initiative_id)) continue;
    unique.add(row.initiative_id);
    matches.push({
      initiativeId: row.initiative_id,
      level: row.level,
      reason: row.reason.trim().slice(0, 400),
      confidence: Number(row.confidence.toFixed(3)),
    });
  }
  matches.sort((a, b) => b.confidence - a.confidence);

  return {
    result: {
      status: "ok",
      krId: parsed.data.kr_id,
      initiativeMatches: matches.slice(0, 5),
      insufficientContextReason: null,
      provider,
      model,
      promptVersion: KR_INITIATIVE_MATCHING_PROMPT_VERSION,
    },
    usage: invoked.usage,
  };
}
