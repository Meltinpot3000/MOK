import type { SemanticMapDraft } from "../types";

/** Standard-Draft: Challenge, Initiative, OKR-Zyklus + eine verifizierbare FK-Road. */
export const strategyMapThreePlaceDraftFixture: SemanticMapDraft = {
  places: [
    {
      placeKey: "strategy.challenge",
      canonicalName: "Herausforderung",
      domain: "strategy",
      businessMeaning: "Strategische Challenge",
      descriptionForPlanner: "Synonyme: Engpass, Brennpunkt",
      evidence: [{ sourceType: "table", sourceRef: "app.strategic_challenges" }],
    },
    {
      placeKey: "strategy.initiative",
      canonicalName: "Initiative",
      domain: "strategy",
      businessMeaning: "Massnahme",
      descriptionForPlanner: "Synonyme: Programm, Vorhaben",
      evidence: [{ sourceType: "table", sourceRef: "app.strategic_initiatives" }],
    },
    {
      placeKey: "okr.cycle",
      canonicalName: "Zyklus",
      domain: "okr",
      businessMeaning: "Planungszyklus",
      descriptionForPlanner: "aktueller Zyklus",
      evidence: [{ sourceType: "table", sourceRef: "app.cycle_instances" }],
    },
  ],
  roads: [
    {
      roadKey: "challenge.to.initiative",
      fromPlaceKey: "strategy.challenge",
      toPlaceKey: "strategy.initiative",
      businessMeaning: "Initiativen adressieren Challenge",
      relationType: "fk",
      evidence: [
        {
          sourceType: "foreign_key",
          sourceRef: "app.strategic_initiatives.challenge_id->app.strategic_challenges.id",
        },
      ],
    },
  ],
  suggestedQuestions: [],
  gaps: [],
};
