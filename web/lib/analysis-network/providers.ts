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
};

export type LlmQualityScore = {
  qualityScore: number;
  impactScore: number;
  certaintyScore: number;
  evidenceScore: number;
  structureScore: number;
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

const LINK_PROMPT_VERSION = "analysis-link-v3";
const QUALITY_PROMPT_VERSION = "analysis-quality-v1";
const CLUSTER_PROMPT_VERSION = "analysis-cluster-v1";
const GAP_PROMPT_VERSION = "analysis-gap-v1";

export const GEMINI_MODEL_QUALITY = process.env.ANALYSIS_LLM_MODEL_GEMINI ?? "gemini-2.5-pro";
export const GEMINI_MODEL_LINKS = process.env.ANALYSIS_LLM_MODEL_GEMINI_LINKS ?? "gemini-2.5-flash";
export const GEMINI_MODEL_ASSIST = process.env.ANALYSIS_LLM_MODEL_GEMINI_ASSIST ?? GEMINI_MODEL_QUALITY;
export const GROQ_MODEL = process.env.ANALYSIS_LLM_MODEL_GROQ ?? "llama-3.3-70b-versatile";
const REQUEST_TIMEOUT_MS = Number(process.env.ANALYSIS_LLM_TIMEOUT_MS ?? 20000);

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
    "Bewerte die Qualitaet eines strategischen Analyse-Findings (0-100).",
    "Antwort nur als valides JSON (ohne Markdown).",
    'Schema: {"qualityScore":0-100,"impactScore":0-100,"certaintyScore":0-100,"evidenceScore":0-100,"structureScore":0-100,"explanation":"max 240 Zeichen"}',
    "Regeln:",
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
}): string {
  return withStrategyReference(
    [
    "Verbessere Label und Summary fuer einen strategischen Cluster.",
    "Antwort nur als valides JSON.",
    'Schema: {"label":"kurz","summary":"max 220 Zeichen","scoreAdjustment":-0.2..0.2,"explanation":"max 160 Zeichen"}',
    "",
    `Aktuelles Label: ${input.currentLabel}`,
    `Aktuelle Summary: ${input.currentSummary}`,
    `Aktueller Score: ${input.score}`,
    "Cluster-Findings:",
    ...input.members.map((member) => `- ${member}`),
    ],
    input.strategyReferenceText
  );
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
}): string {
  return withStrategyReference(
    [
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

async function fetchWithRetry(input: string, init: RequestInit, retries = 1): Promise<Response | null> {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetchWithTimeout(input, init).catch(() => null);
    if (response?.ok) return response;
    if (attempt === retries) return response;
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
    }
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

  const response = await fetchWithRetry("https://api.groq.com/openai/v1/chat/completions", {
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
  });

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
  const geminiRaw = await scoreWithGemini(prompt, GEMINI_MODEL_LINKS, options?.maxOutputTokens);
  if (geminiRaw) {
    const parsed = parseJsonPayload(geminiRaw.text);
    if (parsed) {
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
  }
  const groqRaw = await scoreWithGroq(prompt, GROQ_MODEL, options?.maxOutputTokens);
  if (!groqRaw) return { result: null, usage: null };
  const parsed = parseJsonPayload(groqRaw.text);
  if (!parsed) return { result: null, usage: groqRaw.usage };
  return {
    result: {
      ...parsed,
      provider: "groq",
      model: GROQ_MODEL,
      promptVersion: LINK_PROMPT_VERSION,
    },
    usage: groqRaw.usage,
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

export async function scoreEntryQualityWithLlm(
  entry: QualityEntryInput,
  options?: { strategyReferenceText?: string | null; maxOutputTokens?: number }
): Promise<LlmScoreResponse<LlmQualityScore>> {
  const prompt = buildQualityPrompt(entry, options?.strategyReferenceText);
  const geminiRaw = await scoreWithGemini(prompt, GEMINI_MODEL_QUALITY, options?.maxOutputTokens);
  if (geminiRaw) {
    const json = parseGenericJson(geminiRaw.text);
    if (json) {
      const qualityScore = clamp(Number(json.qualityScore ?? 50), 0, 100);
      const impactScore = clamp(Number(json.impactScore ?? qualityScore), 0, 100);
      const certaintyScore = clamp(Number(json.certaintyScore ?? qualityScore), 0, 100);
      const evidenceScore = clamp(Number(json.evidenceScore ?? qualityScore), 0, 100);
      const structureScore = clamp(Number(json.structureScore ?? qualityScore), 0, 100);
      return {
        result: {
          qualityScore: Math.round(qualityScore),
          impactScore: Math.round(impactScore),
          certaintyScore: Math.round(certaintyScore),
          evidenceScore: Math.round(evidenceScore),
          structureScore: Math.round(structureScore),
          explanation: String(json.explanation ?? "").trim().slice(0, 240),
          provider: "gemini",
          model: GEMINI_MODEL_QUALITY,
          promptVersion: QUALITY_PROMPT_VERSION,
        },
        usage: geminiRaw.usage,
      };
    }
  }
  const groqRaw = await scoreWithGroq(prompt, GROQ_MODEL, options?.maxOutputTokens);
  if (!groqRaw) return { result: null, usage: null };
  const json = parseGenericJson(groqRaw.text);
  if (!json) return { result: null, usage: groqRaw.usage };
  const qualityScore = clamp(Number(json.qualityScore ?? 50), 0, 100);
  return {
    result: {
      qualityScore: Math.round(qualityScore),
      impactScore: Math.round(clamp(Number(json.impactScore ?? qualityScore), 0, 100)),
      certaintyScore: Math.round(clamp(Number(json.certaintyScore ?? qualityScore), 0, 100)),
      evidenceScore: Math.round(clamp(Number(json.evidenceScore ?? qualityScore), 0, 100)),
      structureScore: Math.round(clamp(Number(json.structureScore ?? qualityScore), 0, 100)),
      explanation: String(json.explanation ?? "").trim().slice(0, 240),
      provider: "groq",
      model: GROQ_MODEL,
      promptVersion: QUALITY_PROMPT_VERSION,
    },
    usage: groqRaw.usage,
  };
}

export async function assessClusterWithLlm(input: {
  currentLabel: string;
  currentSummary: string;
  score: number;
  members: string[];
  strategyReferenceText?: string | null;
  maxOutputTokens?: number;
}): Promise<LlmScoreResponse<LlmClusterAssessment>> {
  const prompt = buildClusterPrompt(input);
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

export async function proposeChallengeCandidatesWithLlm(input: {
  clusters: Array<{ id: string; label: string; summary: string; score: number }>;
  gaps: Array<{ id: string; dimension: string; gapType: string; severity: number; recommendation: string }>;
  strategyReferenceText?: string | null;
  maxOutputTokens?: number;
}): Promise<LlmScoreResponse<LlmChallengeCandidate[]>> {
  if (input.clusters.length === 0 && input.gaps.length === 0) {
    return { result: [], usage: null };
  }
  const prompt = buildChallengeCandidatesPrompt(input);
  const geminiRaw = await scoreWithGemini(prompt, GEMINI_MODEL_ASSIST, input.maxOutputTokens);
  if (!geminiRaw) return { result: null, usage: null };
  const json = parseGenericJson(geminiRaw.text);
  if (!json) return { result: null, usage: geminiRaw.usage };
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
  return { result: candidates.slice(0, 8), usage: geminiRaw.usage };
}
