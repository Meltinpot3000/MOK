import type { SemanticMapQuestionResolution } from "../types";

/** Deterministische „LLM“-Resolution für Tests (grösste Challenge + Initiativen + Zyklus). */
export const strategyQuestionResolutionFixture: SemanticMapQuestionResolution = {
  interpretedIntent: "Groesste strategische Herausforderung und passende Initiativen",
  relevantPlaces: [
    {
      placeKey: "strategy.challenge",
      confidence: 0.9,
      reasoningSummary: "User spricht von strategischem Brennpunkt",
    },
    {
      placeKey: "strategy.initiative",
      confidence: 0.85,
      reasoningSummary: "Massnahmen zur Addressierung",
    },
  ],
  requiredRoads: [
    {
      roadKey: "challenge.to.initiative",
      required: true,
      reasoningSummary: "Benötigte Verknüpfung",
    },
  ],
  requiredOperations: ["lookup_initiatives"],
  requiredEvidence: [
    {
      placeKey: "okr.cycle",
      minObjects: 1,
      reason: "aktueller Zyklus",
    },
    {
      placeKey: "strategy.challenge",
      minObjects: 1,
      reason: "Herausforderung",
    },
    {
      placeKey: "strategy.initiative",
      minObjects: 1,
      reason: "Initiativen",
    },
  ],
  suggestedQueryClass: "composite",
};
