import { z } from "zod";
import { invokeLlmForJson } from "@/lib/analysis-network/providers";

const tierSchema = z.enum(["insufficient", "low", "medium", "high"]);

export const annualTargetSmartResponseSchema = z.object({
  title: z.string(),
  smart_formulation: z.object({
    specific: z.string(),
    measurable: z.string(),
    achievable: z.string(),
    relevant: z.string(),
    time_bound: z.string(),
  }),
  smart_check: z.object({
    specific: z.boolean(),
    measurable: z.boolean(),
    achievable: z.boolean(),
    relevant: z.boolean(),
    time_bound: z.boolean(),
  }),
  improvement_notes: z.array(z.string()),
  anchor_fit: z.object({
    overall_level: tierSchema,
    alignment_level: tierSchema,
    formulation_level: tierSchema,
    reason: z.string(),
    improvement_hint: z.string().nullable().optional(),
  }),
});

export type AnnualTargetSmartResponse = z.infer<typeof annualTargetSmartResponseSchema>;

export type AnnualTargetSmartContext = {
  title: string;
  smartFormulation: {
    specific: string;
    measurable: string;
    achievable: string;
    relevant: string;
    time_bound: string;
  };
  targetYear: number;
  executionMode: "run" | "change";
  directionTitle: string;
  programTitle: string | null;
  anchorType: "strategic_direction" | "strategy_program";
  anchorTitle: string;
};

export async function improveAnnualTargetWithSmartLlm(
  context: AnnualTargetSmartContext
): Promise<{ ok: true; data: AnnualTargetSmartResponse } | { ok: false; error: string }> {
  const anchorLabel =
    context.anchorType === "strategy_program" ? "Programm (Change-Anker)" : "Stoßrichtung (Run-Anker)";

  const prompt = `Du bist Sentinel, ein Assistent für Jahresziel-Formulierung und Anker-Fit.
1) Verbessere Titel und SMART-Formulierung (Specific, Measurable, Achievable, Relevant, Time-bound).
2) Bewerte den Fit des Jahresziels zum Anker (${anchorLabel}: ${context.anchorTitle || "—"}).

Antworte NUR mit validem JSON in diesem Schema:
{
  "title": string,
  "smart_formulation": {
    "specific": string,
    "measurable": string,
    "achievable": string,
    "relevant": string,
    "time_bound": string
  },
  "smart_check": { "specific": boolean, "measurable": boolean, "achievable": boolean, "relevant": boolean, "time_bound": boolean },
  "improvement_notes": string[],
  "anchor_fit": {
    "overall_level": "insufficient"|"low"|"medium"|"high",
    "alignment_level": "insufficient"|"low"|"medium"|"high",
    "formulation_level": "insufficient"|"low"|"medium"|"high",
    "reason": string,
    "improvement_hint": string|null
  }
}

Kontext:
- Ausführungsmodus: ${context.executionMode === "run" ? "Run (Anker = Stoßrichtung)" : "Change (Anker = Programm)"}
- Zieljahr: ${context.targetYear}
- Stoßrichtung: ${context.directionTitle || "—"}
- Programm: ${context.programTitle ?? "—"}
- Fit-Anker: ${anchorLabel} — ${context.anchorTitle || "—"}

Aktuelle Formulierung (wird als Entwurf gespeichert; deine Texte sind Vorschläge zur optionalen Übernahme):
- Titel: ${context.title || "—"}
- S (Spezifisch): ${context.smartFormulation.specific || "—"}
- M (Messbar): ${context.smartFormulation.measurable || "—"}
- A (Erreichbar): ${context.smartFormulation.achievable || "—"}
- R (Relevant): ${context.smartFormulation.relevant || "—"}
- T (Terminiert): ${context.smartFormulation.time_bound || "—"}

Regeln:
- Keine Bonusbeträge erfinden.
- Keine automatische Freigabe — nur Vorschläge.
- Verbessere unklare oder unvollständige SMART-Texte; belasse gute Formulierungen weitgehend.
- improvement_notes: konkrete, kurze Hinweise auf Deutsch.
- smart_check: true nur wenn die Dimension nach dem Vorschlag klar erfüllt ist.
- anchor_fit.alignment_level: inhaltliche Passung zum Anker.
- anchor_fit.formulation_level: Klarheit/Messbarkeit der Formulierung.
- anchor_fit.overall_level: konservativ aus Alignment und Formulierung (schwächeres Level begrenzt).
- anchor_fit.reason: 2–4 Sätze Begründung auf Deutsch (wie bei OKR-Fit).
- anchor_fit.improvement_hint: optionaler konkreter Verbesserungsvorschlag zum Fit.
- Deutsch, präzise, messbar.`;

  const result = await invokeLlmForJson(prompt, 1600);
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
