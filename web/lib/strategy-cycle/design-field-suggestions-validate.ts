import type { DesignFieldSuggestionLlmResponse } from "@/lib/strategy-cycle/design-field-suggestions-ai";

export type DesignFieldSuggestionConfidenceTier = "high" | "medium" | "low";
export type AssignmentConfidence = "high" | "medium" | "low";
export type AssignmentSource = "manual" | "approved" | "auto";

export type DirectionAssignmentMeta = {
  source: AssignmentSource;
  confidence: AssignmentConfidence;
  score: number;
  reasons: string[];
};

export type DesignFieldSuggestion = {
  label: string;
  description: string;
  strategicIntent: string;
  directionIds: string[];
  directionTitles: string[];
  confidence: number;
  confidenceTier: DesignFieldSuggestionConfidenceTier;
  confidenceLabelDe: string;
  assignmentConfidence: AssignmentConfidence;
  rationaleDe: string;
  directionAssignments: Record<string, DirectionAssignmentMeta>;
};

export type ValidateDesignFieldSuggestionsResult = {
  suggestions: DesignFieldSuggestion[];
  unassignedDirectionIds: string[];
  warningDe: string | null;
};

const LIMITS = {
  label: 80,
  description: 400,
  strategicIntent: 200,
  rationaleDe: 600,
} as const;

function clampText(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function mapConfidenceTier(confidence: number): {
  tier: DesignFieldSuggestionConfidenceTier;
  labelDe: string;
} {
  const c = clampConfidence(confidence);
  if (c >= 75) return { tier: "high", labelDe: "hoch" };
  if (c >= 55) return { tier: "medium", labelDe: "mittel" };
  return { tier: "low", labelDe: "niedrig" };
}

export function validateDesignFieldSuggestions(
  raw: DesignFieldSuggestionLlmResponse,
  allowedDirectionIds: string[],
  titleByDirectionId: Record<string, string>
): ValidateDesignFieldSuggestionsResult {
  const allowed = new Set(allowedDirectionIds);
  const usedDirectionIds = new Set<string>();
  const suggestions: DesignFieldSuggestion[] = [];

  for (const item of raw.suggestions) {
    const label = clampText(item.label, LIMITS.label);
    const description = clampText(item.description, LIMITS.description);
    const strategicIntent = clampText(item.strategic_intent, LIMITS.strategicIntent);
    const rationaleDe = clampText(item.rationale_de, LIMITS.rationaleDe);
    if (!label || item.direction_ids.length === 0) continue;

    const directionIds: string[] = [];
    for (const id of item.direction_ids) {
      if (!allowed.has(id) || usedDirectionIds.has(id)) continue;
      usedDirectionIds.add(id);
      directionIds.push(id);
    }
    if (directionIds.length === 0) continue;

    const confidence = clampConfidence(item.confidence);
    const confidenceMapped = mapConfidenceTier(confidence);

    suggestions.push({
      label,
      description,
      strategicIntent,
      directionIds,
      directionTitles: directionIds.map((id) => titleByDirectionId[id] ?? id),
      confidence,
      confidenceTier: confidenceMapped.tier,
      confidenceLabelDe: confidenceMapped.labelDe,
      assignmentConfidence: confidenceMapped.tier,
      rationaleDe,
      directionAssignments: Object.fromEntries(
        directionIds.map((id) => [
          id,
          {
            source: "auto" as const,
            confidence: confidenceMapped.tier,
            score: confidence / 100,
            reasons: rationaleDe ? [rationaleDe] : [],
          },
        ])
      ),
    });
  }

  const unassignedDirectionIds = (raw.unassigned_direction_ids ?? []).filter(
    (id) => allowed.has(id) && !usedDirectionIds.has(id)
  );
  for (const id of allowedDirectionIds) {
    if (!usedDirectionIds.has(id) && !unassignedDirectionIds.includes(id)) {
      unassignedDirectionIds.push(id);
    }
  }

  const unassignedRatio =
    allowedDirectionIds.length > 0
      ? unassignedDirectionIds.length / allowedDirectionIds.length
      : 0;

  const warningDe =
    suggestions.length < 2
      ? `Nur ${suggestions.length} gültige Vorschläge — bitte manuell prüfen oder erneut generieren.`
      : unassignedRatio > 0.2
        ? "Viele Stoßrichtungen konnten nicht sicher zugeordnet werden. Bitte Cluster-Schwelle prüfen oder manuell nachbearbeiten."
        : null;

  return { suggestions, unassignedDirectionIds, warningDe };
}
