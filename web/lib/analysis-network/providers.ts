import type { AnalysisEntryRecord, AnalysisLinkType } from "@/lib/analysis-network/types";

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

const PROMPT_VERSION = "analysis-link-v2";
const GEMINI_MODEL = process.env.ANALYSIS_LLM_MODEL_GEMINI ?? "gemini-2.5-flash";
const GROQ_MODEL = process.env.ANALYSIS_LLM_MODEL_GROQ ?? "llama-3.3-70b-versatile";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildPrompt(a: AnalysisEntryRecord, b: AnalysisEntryRecord): string {
  return [
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
  ].join("\n");
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

async function scoreWithGemini(a: AnalysisEntryRecord, b: AnalysisEntryRecord): Promise<LlmScoredLink | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(a, b) }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) return null;
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
  const parsed = parseJsonPayload(text);
  if (!parsed) return null;

  return {
    ...parsed,
    provider: "gemini",
    model: GEMINI_MODEL,
    promptVersion: PROMPT_VERSION,
  };
}

async function scoreWithGroq(a: AnalysisEntryRecord, b: AnalysisEntryRecord): Promise<LlmScoredLink | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Du gibst nur valides JSON zurueck." },
        { role: "user", content: buildPrompt(a, b) },
      ],
    }),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  const parsed = parseJsonPayload(text);
  if (!parsed) return null;

  return {
    ...parsed,
    provider: "groq",
    model: GROQ_MODEL,
    promptVersion: PROMPT_VERSION,
  };
}

export async function scorePairWithLlm(
  a: AnalysisEntryRecord,
  b: AnalysisEntryRecord
): Promise<LlmScoredLink | null> {
  const geminiResult = await scoreWithGemini(a, b);
  if (geminiResult) return geminiResult;
  return scoreWithGroq(a, b);
}
