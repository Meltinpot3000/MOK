import type { ModelRouteDecision, ModelTier } from "@/lib/ai/types";
import type { SentinelPlan } from "@/lib/ai/sentinel-core/schemas";
import type { EffectivePolicy } from "@/lib/ai/security/policy-engine";

export type ModelRouterInput = {
  plan: SentinelPlan;
  policy: EffectivePolicy;
};

/**
 * Wahl des Antwortmodells fuer den Synthesis-Schritt.
 *
 * Regeln (deterministisch, sichtbare Downgrades):
 * 1. canAnswerLocally && local_llm_enabled -> local
 * 2. needsFrontierModel && externalModelsEnabled && Anthropic verfuegbar -> frontier
 *    -> wenn nicht erfuellt: Downgrade nach fast_external mit User-Message
 * 3. (needsInternalRetrieval || needsWebSearch) && externalModelsEnabled -> fast_external
 * 4. Fallback: local (mit Downgrade-Hinweis falls extern verlangt war).
 *
 * Wenn `needsWebSearch` ist und websearch nicht verfuegbar, wird zusaetzlich
 * eine `downgrade.userMessage` zum Web-Search-Disabled-Hinweis erzeugt.
 */
export function routeModel(input: ModelRouterInput): ModelRouteDecision {
  const { plan, policy } = input;
  const downgradeNotices: string[] = [];

  if (plan.taskType === "external_research" && !policy.webSearchEnabled) {
    downgradeNotices.push(
      "Hinweis: Web-Recherche ist in dieser Organisation deaktiviert. Antwort basiert ausschliesslich auf internen Daten."
    );
  }
  if (plan.answerStrategy.needsWebSearch && !policy.webSearchEnabled) {
    downgradeNotices.push(
      "Hinweis: Web-Suche wurde benoetigt, ist aber deaktiviert. Antwort beschraenkt sich auf interne Quellen."
    );
  }
  if (plan.answerStrategy.needsFrontierModel && !policy.externalModelsEnabled) {
    downgradeNotices.push(
      "Hinweis: Ein Frontier-Modell waere fuer diese Frage hilfreich, externe Modelle sind aber deaktiviert. Antwort kommt vom lokalen Modell."
    );
  }

  if (plan.answerStrategy.canAnswerLocally && policy.localLlmEnabled) {
    return finalize({
      modelTier: "local",
      provider: "ollama",
      reason: "Plan erlaubt lokale Antwort, lokales LLM ist aktiv.",
      downgradeNotices,
    });
  }

  if (plan.answerStrategy.needsFrontierModel && policy.externalModelsEnabled) {
    if (policy.providerAvailability.anthropic) {
      return finalize({
        modelTier: "frontier",
        provider: "anthropic",
        reason: "Plan signalisiert Frontier-Modell, externe Modelle aktiv, Anthropic verfuegbar.",
        downgradeNotices,
      });
    }
    if (policy.providerAvailability.gemini) {
      return finalize({
        modelTier: "fast_external",
        provider: "gemini",
        reason: "Frontier nicht verfuegbar, fallback fast_external (Gemini).",
        downgradeFrom: "frontier",
        downgradeNotices: [
          ...downgradeNotices,
          "Hinweis: Frontier-Modell nicht verfuegbar, es wird ein schnelleres externes Modell genutzt.",
        ],
      });
    }
  }

  if (
    (plan.answerStrategy.needsInternalRetrieval || plan.answerStrategy.needsWebSearch) &&
    policy.externalModelsEnabled
  ) {
    if (policy.providerAvailability.gemini) {
      return finalize({
        modelTier: "fast_external",
        provider: "gemini",
        reason: "Plan benoetigt externe Synthese, Gemini gewaehlt.",
        downgradeNotices,
      });
    }
    if (policy.providerAvailability.groq) {
      return finalize({
        modelTier: "fast_external",
        provider: "groq",
        reason: "Plan benoetigt externe Synthese, Gemini fehlt - Fallback Groq.",
        downgradeNotices,
      });
    }
  }

  if (policy.localLlmEnabled) {
    const reasonLines = [
      "Lokales LLM gewaehlt (Fallback).",
      ...(plan.answerStrategy.needsFrontierModel
        ? ["Frontier war erforderlich, ist aber blockiert -> sichtbarer Downgrade."]
        : []),
    ];
    return finalize({
      modelTier: "local",
      provider: "ollama",
      reason: reasonLines.join(" "),
      downgradeFrom: plan.answerStrategy.needsFrontierModel ? "frontier" : undefined,
      downgradeNotices,
    });
  }

  return finalize({
    modelTier: "local",
    provider: "ollama",
    reason:
      "Kein Modell verfuegbar; lokales LLM wird versucht, kann aber blockiert sein. Letzter Fallback.",
    downgradeNotices,
    forceDowngradeMessage:
      "Hinweis: Aktuell ist kein konfiguriertes Modell verfuegbar. Antwort moeglicherweise unvollstaendig.",
  });
}

function finalize(args: {
  modelTier: ModelTier;
  provider: ModelRouteDecision["provider"];
  reason: string;
  downgradeFrom?: ModelTier;
  downgradeNotices: string[];
  forceDowngradeMessage?: string;
}): ModelRouteDecision {
  const userMessages = [
    ...args.downgradeNotices,
    ...(args.forceDowngradeMessage ? [args.forceDowngradeMessage] : []),
  ].filter(Boolean);
  if (args.downgradeFrom || userMessages.length > 0) {
    return {
      modelTier: args.modelTier,
      provider: args.provider,
      reason: args.reason,
      downgrade: {
        from: args.downgradeFrom ?? args.modelTier,
        to: args.modelTier,
        userMessage: userMessages.join(" "),
      },
    };
  }
  return {
    modelTier: args.modelTier,
    provider: args.provider,
    reason: args.reason,
  };
}
