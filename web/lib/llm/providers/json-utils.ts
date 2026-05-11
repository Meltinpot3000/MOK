import type { ZodTypeAny, z } from "zod";

import { LlmProviderError, type LlmProviderName } from "./types";

export function stripCodeFences(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  return trimmed;
}

export function tryParseJson(raw: string): unknown | null {
  const stripped = stripCodeFences(raw);
  if (!stripped) return null;
  try {
    return JSON.parse(stripped);
  } catch {
    const firstBrace = stripped.indexOf("{");
    const lastBrace = stripped.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = stripped.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function validateAgainstSchema<TSchema extends ZodTypeAny>(
  parsed: unknown,
  schema: TSchema,
  provider: LlmProviderName
): z.infer<TSchema> {
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new LlmProviderError({
      provider,
      code: "schema_validation_failed",
      message: result.error.message,
    });
  }
  return result.data;
}

export function buildRepairUserPrompt(args: {
  schemaName: string;
  schema: ZodTypeAny;
  previousText: string;
  validationError?: string;
}): string {
  const lines = [
    "Deine vorherige Antwort war kein gültiges JSON oder entsprach nicht dem geforderten Schema.",
    `Schema-Name: ${args.schemaName}`,
    "Gib jetzt ausschließlich valides JSON zurück, ohne Markdown, ohne Kommentare, ohne Erklärtext.",
    "Das JSON muss exakt diesem Schema entsprechen.",
  ];
  if (args.validationError) {
    lines.push("", "Validierungsfehler:", args.validationError);
  }
  lines.push("", "Vorherige Antwort:", args.previousText.slice(0, 4000));
  return lines.join("\n");
}
