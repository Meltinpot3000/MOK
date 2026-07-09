import { z } from "zod";
import { invokeLlmForJson } from "@/lib/analysis-network/providers";

export const annualTargetSmartResponseSchema = z.object({
  title: z.string(),
  description: z.string(),
  measurement_logic: z.string(),
  derivation_note: z.string(),
  smart_check: z.object({
    specific: z.boolean(),
    measurable: z.boolean(),
    achievable: z.boolean(),
    relevant: z.boolean(),
    time_bound: z.boolean(),
  }),
  improvement_notes: z.array(z.string()),
});

export type AnnualTargetSmartResponse = z.infer<typeof annualTargetSmartResponseSchema>;

export type AnnualTargetSmartContext = {
  title: string;
  description: string;
  measurementLogic: string;
  derivationNote: string;
  targetYear: number;
  directionTitle: string;
  strategicObjectiveTitle: string | null;
  programTitle: string | null;
  annualTargetType: string;
  measurementLogicHint: string;
  baseline: number | null;
  currentMeasure: number | null;
};

export async function improveAnnualTargetWithSmartLlm(
  context: AnnualTargetSmartContext
): Promise<{ ok: true; data: AnnualTargetSmartResponse } | { ok: false; error: string }> {
  const prompt = `Du bist Sentinel, ein Assistent für Jahresziel-Formulierung.
Optimiere die vorliegenden Angaben sprachlich und formell nach SMART (Specific, Measurable, Achievable, Relevant, Time-bound).
Verbessere Titel, Beschreibung, Messlogik und strategische Herleitung; erfinde keine Bonusbeträge.
Antworte NUR mit validem JSON in diesem Schema:
{
  "title": string,
  "description": string,
  "measurement_logic": string,
  "derivation_note": string,
  "smart_check": { "specific": boolean, "measurable": boolean, "achievable": boolean, "relevant": boolean, "time_bound": boolean },
  "improvement_notes": string[]
}

Kontext:
- Zieljahr: ${context.targetYear}
- Stoßrichtung: ${context.directionTitle}
- Strategisches Ziel: ${context.strategicObjectiveTitle ?? "nicht angegeben"}
- Programm: ${context.programTitle ?? "nicht angegeben"}
- Jahresziel-Typ: ${context.annualTargetType}
- Messlogik-Hinweis: ${context.measurementLogicHint || "—"}
- Ausgangswert: ${context.baseline ?? "—"}
- Aktueller Ist-Wert: ${context.currentMeasure ?? "—"}

Aktuelle Formulierung:
- Titel: ${context.title || "—"}
- Beschreibung: ${context.description || "—"}
- Messlogik / Zielwert: ${context.measurementLogic || "—"}
- Strategische Herleitung: ${context.derivationNote || "—"}

Regeln:
- Keine Bonusbeträge erfinden.
- Keine automatische Freigabe — nur Vorschlag.
- Deutsch, präzise, messbar.`;

  const result = await invokeLlmForJson(prompt, 1200);
  if (!result?.text) {
    return { ok: false, error: "Sentinel konnte keine Antwort liefern. Bitte später erneut versuchen." };
  }

  try {
    const parsed = JSON.parse(result.text) as unknown;
    const data = annualTargetSmartResponseSchema.safeParse(parsed);
    if (!data.success) {
      return { ok: false, error: "Sentinel-Antwort war ungültig. Bitte erneut versuchen." };
    }
    return { ok: true, data: data.data };
  } catch {
    return { ok: false, error: "Sentinel-Antwort konnte nicht gelesen werden." };
  }
}
