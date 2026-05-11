/**
 * Erwartungen pro Strategy/Smoke-Frage (Thomas strategy_directions).
 * Keine neuen Produkt-Features — nur Test-Spezifikation.
 */

export const STRATEGY_DIRECTIONS_CATALOG = [
  {
    id: "strategy_challenges_critical_scope",
    question:
      "Welche strategischen Herausforderungen in meinem Scope sind aktuell am kritischsten, und wie hängen sie mit den Stossrichtungen zusammen?",
    expected: {
      path: "pipeline",
      queryClass: ["composite", "lookup", "ranking", "distribution"],
      requiredContract: true,
      allowPartial: true,
      requiredDiagnostics: false,
      allowDegradation: true,
      requiredMissingOps: false,
    },
  },
  {
    id: "strategy_directions_density_gap",
    question:
      "Vergleiche für den aktuellen Zyklus: Welche Stossrichtungen haben die höchste Dichte an strategischen Herausforderungen, und bei welchen fehlen zugeordnete Herausforderungen?",
    expected: {
      path: "pipeline",
      queryClass: ["composite", "ranking", "distribution", "lookup"],
      requiredContract: true,
      allowPartial: true,
      requiredDiagnostics: false,
      allowDegradation: true,
      requiredMissingOps: false,
    },
  },
  {
    id: "strategy_challenges_by_direction_responsible",
    question:
      "Liste strategische Herausforderungen, bei denen ich in der Verantwortungskette bin, gruppiert nach Stossrichtung — mit Status und Priorität.",
    expected: {
      path: "pipeline",
      queryClass: ["composite", "lookup", "distribution"],
      requiredContract: true,
      allowPartial: true,
      requiredDiagnostics: false,
      allowDegradation: true,
      requiredMissingOps: false,
    },
  },
  {
    id: "strategy_direction_vs_measures_contradiction",
    question:
      "Wo widersprechen sich formulierte Stossrichtungen und die konkreten Massnahmen zu den zugehörigen Herausforderungen in meinem Bereich?",
    expected: {
      path: "pipeline",
      queryClass: ["composite", "lookup"],
      requiredContract: true,
      allowPartial: true,
      requiredDiagnostics: false,
      allowDegradation: true,
      requiredMissingOps: true,
    },
  },
  {
    id: "strategy_review_bullets_per_direction",
    question:
      "Fasse für den Strategy Review auf: pro Stossrichtung maximal drei Bulletpoints — nur Herausforderungen mit mir als Owner oder Co-Owner; Risiken und nächste Entscheidungen getrennt.",
    expected: {
      path: "pipeline",
      queryClass: ["composite", "lookup", "ranking"],
      requiredContract: true,
      allowPartial: true,
      requiredDiagnostics: false,
      allowDegradation: true,
      requiredMissingOps: false,
    },
  },
];

/** @param {string} q */
export function findCatalogEntry(questionText) {
  return STRATEGY_DIRECTIONS_CATALOG.find((c) => c.question === questionText) ?? null;
}

export function strategyDirectionQuestions() {
  return STRATEGY_DIRECTIONS_CATALOG.map((c) => c.question);
}
