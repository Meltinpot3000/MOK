import { GEMINI_MODEL_ASSIST } from "@/lib/analysis-network/providers";
import type { CorrelationStatus } from "@/lib/strategy-cycle/correlation";
import type { StrategicDesignAssistConfidence } from "@/lib/strategy-cycle/strategic-design-hybrid";

const REQUEST_TIMEOUT_MS = Number(process.env.ANALYSIS_LLM_TIMEOUT_MS ?? 25000);

export type StrategicDesignAssistSuggestion = {
  suggested_status: CorrelationStatus;
  llm_adjustment: number;
  confidence: StrategicDesignAssistConfidence;
  explanation_de: string;
};

function normalizeStatus(raw: string): CorrelationStatus {
  if (raw === "green" || raw === "yellow" || raw === "red" || raw === "unknown") return raw;
  return "unknown";
}

function normalizeConfidence(raw: string): StrategicDesignAssistConfidence {
  if (raw === "high" || raw === "medium" || raw === "low") return raw;
  return "low";
}

function parseSuggestion(text: string): StrategicDesignAssistSuggestion | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    const raw = JSON.parse(cleaned) as Record<string, unknown>;
    const suggested_status = normalizeStatus(String(raw.suggested_status ?? "unknown").trim());
    const llm_adjustment = Math.max(-15, Math.min(15, Math.round(Number(raw.llm_adjustment ?? 0))));
    const confidence = normalizeConfidence(String(raw.confidence ?? "low").trim());
    const explanation_de = String(raw.explanation_de ?? "").trim();
    if (!explanation_de) return null;
    return { suggested_status, llm_adjustment, confidence, explanation_de };
  } catch {
    return null;
  }
}

async function fetchWithTimeout(input: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function proposeStrategicDesignAssistWithGemini(input: {
  challengeTitle: string;
  objectiveTitle: string;
  directionTitle: string;
  deterministicScore: number;
  deterministicStatus: CorrelationStatus;
  objectiveLifecycleLabel: string;
  overrideNote: string | null;
  companyContextJson: string;
  maxOutputTokens: number;
}): Promise<StrategicDesignAssistSuggestion | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = [
    "Du bist ein strategischer Co-Pilot f\u00FCr Korrelationen zwischen Herausforderung, strategischem Ziel und Sto\u00DFrichtung.",
    "Gib eine knappe Empfehlung für den Status der Korrelation in Deutsch.",
    "Antworte ausschliesslich als valides JSON.",
    "",
    "Schema:",
    '{ "suggested_status":"green|yellow|red|unknown", "llm_adjustment": -15..15, "confidence":"low|medium|high", "explanation_de":"string" }',
    "",
    "Regeln:",
    "- llm_adjustment ist nur ein Hinweis und darf nicht ausserhalb [-15,15] liegen.",
    "- explanation_de in 1-3 Sätzen, klar und auditierbar.",
    "",
    `Herausforderung: ${input.challengeTitle}`,
    `Ziel: ${input.objectiveTitle}`,
    `Stossrichtung: ${input.directionTitle}`,
    `Deterministischer Score: ${input.deterministicScore}`,
    `Deterministischer Status: ${input.deterministicStatus}`,
    `Ziel-Lifecycle: ${input.objectiveLifecycleLabel}`,
    input.overrideNote ? `Vorhandene Override-Notiz: ${input.overrideNote}` : "",
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
          temperature: 0.2,
          responseMimeType: "application/json",
          maxOutputTokens: Math.max(128, Math.min(4096, Math.round(input.maxOutputTokens))),
        },
      }),
    }
  );
  if (!response.ok) return null;

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawText = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("\n") ?? "";
  return parseSuggestion(rawText);
}
