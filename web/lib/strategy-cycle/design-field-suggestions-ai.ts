import { z } from "zod";
import { invokeLlmForJson } from "@/lib/analysis-network/providers";
import type { ClusterCandidate, DirectionSummary } from "@/lib/strategy-cycle/design-field-suggestions-prep";

export const designFieldSuggestionLlmItemSchema = z.object({
  label: z.string(),
  description: z.string(),
  strategic_intent: z.string(),
  direction_ids: z.array(z.string()),
  confidence: z.number().min(0).max(100),
  rationale_de: z.string(),
});

export const designFieldSuggestionLlmResponseSchema = z.object({
  suggestions: z.array(designFieldSuggestionLlmItemSchema),
  unassigned_direction_ids: z.array(z.string()).optional(),
});

export type DesignFieldSuggestionLlmResponse = z.infer<typeof designFieldSuggestionLlmResponseSchema>;

export type DesignFieldSuggestionsAiContext = {
  companyKennzahlenJson: string;
  strategyReferenceText: string | null;
  directionSummaries: DirectionSummary[];
  clusterCandidates: ClusterCandidate[];
  managementPartitions: ClusterCandidate[];
};

export async function generateDesignFieldSuggestionsWithLlm(
  context: DesignFieldSuggestionsAiContext,
  maxOutputTokens: number
): Promise<{ ok: true; data: DesignFieldSuggestionLlmResponse } | { ok: false; error: string }> {
  const prompt = `Du bist ein Strategieberater für Portfolio-Design.
Schlage 3–5 strategische Designfelder vor, die bestehende Stoßrichtungen sinnvoll gruppieren.
Antworte NUR mit validem JSON in diesem Schema:
{
  "suggestions": [
    {
      "label": string,
      "description": string,
      "strategic_intent": string,
      "direction_ids": string[],
      "confidence": number,
      "rationale_de": string
    }
  ],
  "unassigned_direction_ids": string[]
}

Regeln:
- Primärziel: 3–5 managementfähige Designfelder mit möglichst vollständiger Abdeckung aller Stoßrichtungen.
- Verwende ausschließlich direction_ids aus dem Input.
- Erfinde keine neuen Stoßrichtungen, Herausforderungen oder Ziele.
- Labels managementfähig, deutsch, prägnant (max. 6 Wörter).
- confidence als Zahl 0–100 (80+ sehr sicher, 60+ mittel, darunter unsicher).
- Thematisch benachbarte oder strategisch zusammenhängende Stoßrichtungen dürfen im selben Feld landen — Perfektion ist nicht nötig.
- Nutze managementPartitions als Leitplanke für die Verdichtung (3–5 Felder).
- unassigned_direction_ids nur für Stoßrichtungen ohne erkennbare strategische Nähe zu anderen.
- Jede direction_id höchstens in einem Vorschlag.

Unternehmenskontext:
${context.companyKennzahlenJson}

Strategiereferenz:
${context.strategyReferenceText ?? "—"}

Stoßrichtungs-Summaries (JSON):
${JSON.stringify(context.directionSummaries)}

Cluster-Kandidaten (JSON):
${JSON.stringify(context.clusterCandidates)}

Management-Partitionen (3–5 Felder, JSON):
${JSON.stringify(context.managementPartitions)}`;

  const result = await invokeLlmForJson(prompt, maxOutputTokens);
  if (!result?.text) {
    return { ok: false, error: "Sentinel✨ konnte keine Antwort liefern. Bitte später erneut versuchen." };
  }

  try {
    const parsed = JSON.parse(result.text) as unknown;
    const data = designFieldSuggestionLlmResponseSchema.safeParse(parsed);
    if (!data.success) {
      return { ok: false, error: "Sentinel✨-Antwort war ungültig. Bitte erneut versuchen." };
    }
    return { ok: true, data: data.data };
  } catch {
    return { ok: false, error: "Sentinel✨-Antwort konnte nicht gelesen werden." };
  }
}
