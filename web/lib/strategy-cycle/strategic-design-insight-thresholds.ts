/**
 * Zentrale Schwellen fuer Strategic-Design-Insights (Dashboard).
 * Feintuning hier, nicht verstreut in der Berechnung.
 */
export const STRATEGIC_DESIGN_INSIGHT_THRESHOLDS = {
  /** Challenge gilt als „hoch“ fuer Unaddressed-Filter */
  challengeHighScore: 60,
  /** Unaddressed: max(w) < dies = kein starker Challenge→Richtung-Link (strong = 1.0) */
  unaddressedCoverageMaxW: 1,
  /** Alternative: weder medium noch strong */
  insufficientCoverageMaxW: 0.5,
  /** Bandgrenzen fuer w_max (normalisierte Gewichte) */
  coverageBandWeakUpper: 0.5,
  coverageBandStrongMin: 1,
  /** KPI: Challenge hat „medium-or-strong“ Anker */
  coverageKpiMinW: 0.5,
  /** Unsupported-Objective: hohe Wichtigkeit */
  objectiveHighImportanceMin: 4,
  /** Unsupported: max Objective→Richtung-Gewicht unter diesem Wert = schwach gekoppelt */
  unsupportedObjectiveMaxMaxW: 0.5,
  /** Unsupported: verknuepfte Richtungen mit Prioritaets-Score unter diesem Wert (1–5) */
  unsupportedObjectiveDirectionScoreMax: 2.5,
  misalignment: {
    /** Mindest-Challenge-Impact, damit Misalignment in Frage kommt */
    minChallengeImpact: 15,
    /** Hoechstes Objective-Alignment, darunter gilt es als „niedrig“ neben hohem Impact */
    maxObjectiveAlignmentForConflict: 25,
    /** Zusaetzlich: Impact muss mindestens dieses Vielfache von Alignment sein */
    challengeImpactVsAlignmentRatio: 1.75,
  },
  /** Ziele mit viel Richtungs-Gewicht aber wenig Challenge-Backing (Heuristik) */
  limitedChallengeBacking: {
    /** Summe normalized weights ueber Objective→Richtung mindestens */
    minDirectionLinkageWeightSum: 1.5,
    /** Summe der Challenge-Backing-Metrik darunter = Kandidat */
    maxChallengeBackingSum: 120,
  },
  /** Anteil Top-Directions mit starkem Objective-Link (KPI) */
  topDirectionsStrongObjectiveLinkMinW: 1,
  /** Konfliktliste: erste Anzeige */
  conflictsInitialDisplayCount: 10,
} as const;

export type StrategicDesignInsightThresholds = typeof STRATEGIC_DESIGN_INSIGHT_THRESHOLDS;
