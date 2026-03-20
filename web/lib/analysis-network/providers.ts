import type { AnalysisEntryRecord, AnalysisLinkType } from "@/lib/analysis-network/types";

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
    'Schema: {"proximityScore":0-1,"supportScore":0-1,"repulsionScore":0-1,"directionHint":"none|causes|depends_on","suggestedLinkType":"related_to|causes|supports|contradicts|amplifies|depends_on|duplicates","explanation":"kurze Begruendung <= 220 Zeichen"}',
    "Regeln:",
    "- proximityScore = semantische Naehe/Verwandtschaft",
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
    "- certaintyScore: Verlaesslichkeit (niedrige Unsicherheit => hoher Score)",
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
    "Verbessere Label und Summary fuer einen strategischen Cluster.",
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

function buildGraphLayoutPrompt(input: {
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
      "Berechne eine strategisch sinnvolle 3D-Layout-Position fuer alle Knoten.",
      "Antwort nur als valides JSON.",
      'Schema: {"layoutVersion":"analysis-graph-layout-v1","nodes":[{"id":"...","x":-1..1,"y":-1..1,"z":-1..1,"confidence":0..1}],"globalReasoning":"max 240 Zeichen"}',
      "Regeln:",
      "- Jeder input-node muss GENAU EINMAL in nodes enthalten sein.",
      "- x-Achse: extern (environment/competitor) eher negativ, intern (company/swot) eher positiv.",
      "- y-Achse: hoher Impact und geringere Unsicherheit eher hoch.",
      "- z-Achse: stark vernetzte Querschnittsthemen eher hoch.",
      "- Semantisch nahe oder unterstuetzende Knoten naeher, widerspruechliche eher weiter entfernt.",
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

function parseGraphLayoutJson(raw: string, expectedNodeIds: string[]): {
  layoutVersion: string;
  nodes: LlmGraphLayoutNode[];
  globalReasoning: string;
} | null {
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
  const minimumAccepted = Math.max(1, Math.ceil(expectedNodeIds.length * 0.5));
  if (parsedNodes.length < minimumAccepted) return null;
  return {
    layoutVersion: String(json.layoutVersion ?? GRAPH_LAYOUT_PROMPT_VERSION).trim().slice(0, 80),
    nodes: parsedNodes,
    globalReasoning: String(json.globalReasoning ?? "").trim().slice(0, 300),
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

async function scoreWithGemini(
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

async function scoreWithGroq(
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
    explanation: String(json.explanation ?? "").trim().slice(0, 240) || "LLM-Qualitaetsbewertung",
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

export async function proposeGraphLayoutWithLlm(input: {
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
}): Promise<LlmScoreResponse<LlmGraphLayout>> {
  if (input.nodes.length === 0) return { result: null, usage: null };
  const expectedNodeIds = input.nodes.map((node) => node.id);
  const prompt = buildGraphLayoutPrompt(input);
  const groqRaw = await scoreWithGroq(prompt, GROQ_MODEL, input.maxOutputTokens);
  if (groqRaw) {
    const parsedGroq = parseGraphLayoutJson(groqRaw.text, expectedNodeIds);
    if (parsedGroq) {
      return {
        result: {
          ...parsedGroq,
          provider: "groq",
          model: GROQ_MODEL,
          promptVersion: GRAPH_LAYOUT_PROMPT_VERSION,
        },
        usage: groqRaw.usage,
      };
    }
  }
  const geminiRaw = await scoreWithGemini(prompt, GEMINI_MODEL_ASSIST, input.maxOutputTokens);
  if (!geminiRaw) return { result: null, usage: null };
  const parsed = parseGraphLayoutJson(geminiRaw.text, expectedNodeIds);
  if (!parsed) return { result: null, usage: geminiRaw.usage };
  return {
    result: {
      ...parsed,
      provider: "gemini",
      model: GEMINI_MODEL_ASSIST,
      promptVersion: GRAPH_LAYOUT_PROMPT_VERSION,
    },
    usage: geminiRaw.usage,
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
