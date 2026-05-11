import { redactSensitive } from "@/lib/llm/redaction";

import type { AiContextPackage, AiDataClassification, ModelTier } from "@/lib/ai/types";

export type RedactionResult = {
  contextPackage: AiContextPackage;
  redactedFieldCount: number;
};

/**
 * Bereitet ein Kontextpaket fuer ein externes Modell vor:
 * - Maskiert E-Mail-Adressen.
 * - Redigiert HR-/Salary-/Performance-Felder.
 * - Stuft Objekte mit Klassifikation 'restricted' aus (durch Filter).
 * - Behaelt Struktur und IDs bei.
 */
export function redactContextForExternalModel(
  pkg: AiContextPackage,
  modelTier: ModelTier
): RedactionResult {
  if (modelTier === "local") {
    // Lokales Modell sieht den unredigierten Kontext.
    return { contextPackage: pkg, redactedFieldCount: 0 };
  }

  let redactedFieldCount = 0;
  const filteredObjects = pkg.internalContext.objects.filter(
    (obj) => obj.classification !== "restricted"
  );
  redactedFieldCount += pkg.internalContext.objects.length - filteredObjects.length;

  const redacted = filteredObjects.map((obj) => ({
    ...obj,
    fields: redactSensitive(obj.fields, {
      redactHrLikeKeys: true,
      maskEmails: true,
    }) as Record<string, unknown>,
    summary: maskEmailsInString(obj.summary),
  }));

  const filteredDocChunks =
    pkg.documentContext?.chunks.filter((chunk) => chunk.classification !== "restricted") ?? [];
  const redactedChunks = filteredDocChunks.map((chunk) => ({
    ...chunk,
    excerpt: maskEmailsInString(chunk.excerpt),
  }));

  return {
    contextPackage: {
      ...pkg,
      internalContext: { objects: redacted },
      documentContext: pkg.documentContext
        ? { chunks: redactedChunks }
        : pkg.documentContext,
    },
    redactedFieldCount,
  };
}

const EMAIL_PATTERN = /([a-zA-Z0-9_.+-]+)@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/g;
function maskEmailsInString(value: string): string {
  return value.replace(EMAIL_PATTERN, "[email]");
}

/**
 * Mappt Datenklassifikationen auf einen einfachen Cap (Strenger gewinnt).
 */
export function strictestClassification(
  classifications: AiDataClassification[]
): AiDataClassification {
  if (classifications.includes("restricted")) return "restricted";
  if (classifications.includes("confidential")) return "confidential";
  if (classifications.includes("internal")) return "internal";
  return "public";
}
