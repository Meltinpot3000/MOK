import { GEMINI_MODEL_ASSIST } from "@/lib/analysis-network/providers";

export type MatrixProgramProposalResult = {
  program_name: string;
  program_description: string;
  supported_objectives: string[];
  initiative_themes: string[];
  expected_impact: string;
  risks: string;
};

const REQUEST_TIMEOUT_MS = Number(process.env.ANALYSIS_LLM_TIMEOUT_MS ?? 25000);

async function fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

function parseUsageFromGemini(data: Record<string, unknown>): {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  billableCost: number | null;
  usageMissing: boolean;
} {
  const meta = data.usageMetadata as Record<string, unknown> | undefined;
  const prompt = Number(meta?.promptTokenCount ?? meta?.prompt_tokens ?? NaN);
  const candidates = Number(meta?.candidatesTokenCount ?? NaN);
  const total = Number(meta?.totalTokenCount ?? NaN);
  return {
    promptTokens: Number.isFinite(prompt) ? prompt : null,
    completionTokens: Number.isFinite(candidates) ? candidates : null,
    totalTokens: Number.isFinite(total) ? total : null,
    billableCost: null,
    usageMissing: !Number.isFinite(total),
  };
}

function parseProposalJson(text: string): MatrixProgramProposalResult | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const raw = JSON.parse(cleaned) as Record<string, unknown>;
    const program_name = String(raw.program_name ?? "").trim();
    const program_description = String(raw.program_description ?? "").trim();
    if (!program_name || !program_description) return null;
    const supported_objectives = Array.isArray(raw.supported_objectives)
      ? raw.supported_objectives.map((x) => String(x ?? "").trim()).filter(Boolean)
      : [];
    const initiative_themes = Array.isArray(raw.initiative_themes)
      ? raw.initiative_themes.map((x) => String(x ?? "").trim()).filter(Boolean)
      : [];
    return {
      program_name,
      program_description,
      supported_objectives,
      initiative_themes,
      expected_impact: String(raw.expected_impact ?? "").trim(),
      risks: String(raw.risks ?? "").trim(),
    };
  } catch {
    return null;
  }
}

export type MatrixProgramAiInput = {
  challengeTitle: string;
  challengeDescription: string | null;
  directionTitle: string;
  directionDescription: string | null;
  objectives: Array<{ id: string; title: string }>;
  cellScore: number;
  scoreExplanation: string;
  companyContextJson: string;
};

/**
 * LLM-Vorschlag fuer ein strategisches Programm (kein Jahresziel / Target).
 * Nutzt Gemini JSON-Modus.
 */
export async function proposeMatrixProgramWithGemini(
  input: MatrixProgramAiInput,
  maxOutputTokens: number
): Promise<{
  proposal: MatrixProgramProposalResult | null;
  usage: ReturnType<typeof parseUsageFromGemini>;
  rawText: string;
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      proposal: null,
      usage: {
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        billableCost: null,
        usageMissing: true,
      },
      rawText: "",
    };
  }

  const objectiveLines = input.objectives.map((o) => `- id: ${o.id} | ${o.title}`).join("\n");
  const prompt = [
    "Du bist ein strategischer Programm-Planer f\u00FCr ein Unternehmen.",
    "Erzeuge einen Vorschlag f\u00FCr EIN strategisches PROGRAMM (kein OKR, kein Jahresziel, kein Einzel-Projekt).",
    "Antwort ausschliesslich als valides JSON, ohne Markdown.",
    "",
    "Schema:",
    '{ "program_name": "string", "program_description": "string",',
    '  "supported_objectives": ["<uuid>", ...],',
    '  "initiative_themes": ["string", ...],',
    '  "expected_impact": "string",',
    '  "risks": "string" }',
    "",
    "Regeln:",
    "- supported_objectives: nur IDs aus der Liste unten; leer lassen wenn keine passen.",
    "- program_description: 2-4 Saetze, umsetzungsnah, solution-agnostic auf Strategieebene.",
    "- initiative_themes: 3-6 Kurzthemen f\u00FCr sp\u00E4tere Initiativen.",
    "",
    `Strategische Herausforderung: ${input.challengeTitle}`,
    input.challengeDescription ? `Beschreibung Herausforderung: ${input.challengeDescription}` : "",
    "",
    `Strategische Stossrichtung: ${input.directionTitle}`,
    input.directionDescription ? `Beschreibung Stossrichtung: ${input.directionDescription}` : "",
    "",
    `Matrix-Zellen-Score (0-100): ${input.cellScore}`,
    `Score-Hinweise: ${input.scoreExplanation}`,
    "",
    "Verf\u00FCgbare Ziele (nur diese IDs verwenden):",
    objectiveLines || "(keine)",
    "",
    "Unternehmenskontext (JSON):",
    input.companyContextJson.slice(0, 8000),
  ]
    .filter(Boolean)
    .join("\n");

  const model = GEMINI_MODEL_ASSIST;
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.25,
          responseMimeType: "application/json",
          maxOutputTokens: Math.max(256, Math.min(4096, Math.round(maxOutputTokens))),
        },
      }),
    }
  );

  if (!response.ok) {
    return {
      proposal: null,
      usage: {
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        billableCost: null,
        usageMissing: true,
      },
      rawText: "",
    };
  }

  const data = (await response.json()) as {
    usageMetadata?: Record<string, unknown>;
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const usage = parseUsageFromGemini(data as Record<string, unknown>);
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
  return {
    proposal: parseProposalJson(text),
    usage,
    rawText: text,
  };
}
