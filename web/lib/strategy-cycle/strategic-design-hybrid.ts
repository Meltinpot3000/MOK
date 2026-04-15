import type { CorrelationStatus } from "@/lib/strategy-cycle/correlation";

export type StrategicDesignDeterministicSignal = {
  id: "challenge_gap" | "direction_priority" | "objective_importance" | "challenge_importance";
  labelDe: string;
  weightPercent: number;
  thresholdHintDe: string;
};

export type StrategicDesignSignalProfile = {
  version: string;
  signals: StrategicDesignDeterministicSignal[];
  hardRulesDe: string[];
};

export type StrategicDesignAssistSource = "deterministic" | "llm_assist";
export type StrategicDesignAssistConfidence = "low" | "medium" | "high";
export type StrategicDesignAssistDecisionState =
  | "auto_suggested"
  | "accepted"
  | "rejected"
  | "manual_override";

/**
 * Hybrid-Vertrag für die kombinierte Sicht (Deterministik + optionaler LLM-Hinweis).
 * In Phase 1 bleibt finalScore identisch zum deterministischen Score.
 */
export type StrategicDesignHybridEvaluation = {
  deterministicScore: number;
  llmAdjustment: number;
  finalScore: number;
  explanationDe: string;
  confidence: StrategicDesignAssistConfidence;
  source: StrategicDesignAssistSource;
  recommendationStatus: CorrelationStatus;
};

export function getStrategicDesignSignalProfile(): StrategicDesignSignalProfile {
  return {
    version: "v1",
    signals: [
      {
        id: "challenge_gap",
        labelDe: "Gap-Signal Herausforderung↔Ziel",
        weightPercent: 45,
        thresholdHintDe: "Normierung aus Cluster-Ziel-Gap (0..75 -> 0..1).",
      },
      {
        id: "direction_priority",
        labelDe: "Priorit\u00E4t der Sto\u00DFrichtung",
        weightPercent: 30,
        thresholdHintDe: "1..5 normiert; beeinflusst Auto-Score je verkn\u00FCpfte Sto\u00DFrichtung.",
      },
      {
        id: "objective_importance",
        labelDe: "Gewicht des Ziels (Importance)",
        weightPercent: 15,
        thresholdHintDe: "importance_score 1..5 normiert.",
      },
      {
        id: "challenge_importance",
        labelDe: "Gewicht der Herausforderung",
        weightPercent: 10,
        thresholdHintDe: "challenge_score 1..5 normiert.",
      },
    ],
    hardRulesDe: [
      "Statusschwellen: >=70 grün, >=45 gelb, sonst rot.",
      "Ohne Direction-Link wird ein Fallback-Score berechnet und rot/unknown markiert.",
      "Override hat Vorrang vor Auto-Status, wird aber als Konflikt gezählt wenn er starke Auto-Signale überschreibt.",
    ],
  };
}

function confidenceFromAbsAdjustment(absAdj: number): StrategicDesignAssistConfidence {
  if (absAdj >= 12) return "high";
  if (absAdj >= 6) return "medium";
  return "low";
}

/**
 * Merge-Layer mit Guardrails:
 * - llmAdjustment wird hart auf +/-15 Punkte begrenzt
 * - finalScore bleibt in [0,100]
 */
export function buildStrategicDesignHybridEvaluation(input: {
  deterministicScore: number;
  recommendationStatus: CorrelationStatus;
  llmAdjustment?: number | null;
  llmExplanationDe?: string | null;
}): StrategicDesignHybridEvaluation {
  const deterministicScore = Math.max(0, Math.min(100, Math.round(Number(input.deterministicScore) || 0)));
  const boundedAdjustment = Math.max(-15, Math.min(15, Math.round(Number(input.llmAdjustment ?? 0))));
  const finalScore = Math.max(0, Math.min(100, deterministicScore + boundedAdjustment));
  const hasLlmSignal = boundedAdjustment !== 0 || Boolean(input.llmExplanationDe?.trim());
  const source: StrategicDesignAssistSource = hasLlmSignal ? "llm_assist" : "deterministic";
  const confidence = hasLlmSignal ? confidenceFromAbsAdjustment(Math.abs(boundedAdjustment)) : "low";
  const explanationDe = hasLlmSignal
    ? String(input.llmExplanationDe ?? "").trim() || "LLM-Hinweis ohne zusätzliche Begründung."
    : "Deterministische Baseline ohne LLM-Adjustment.";

  return {
    deterministicScore,
    llmAdjustment: hasLlmSignal ? boundedAdjustment : 0,
    finalScore,
    explanationDe,
    confidence,
    source,
    recommendationStatus: input.recommendationStatus,
  };
}
