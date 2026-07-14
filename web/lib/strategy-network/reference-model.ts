import type {
  ReferenceFaqItem,
  ReferenceNetworkEdge,
  ReferenceNetworkGraph,
  ReferenceNetworkNode,
} from "@/lib/strategy-network/types";

export const REFERENCE_FAQ: ReferenceFaqItem[] = [
  {
    id: "challenge-resolution-profile",
    question: "Wie bewertet das System, ob eine Herausforderung adressiert oder umgesetzt ist?",
    answer:
      "Pro Herausforderung leitet CITADEL ein dreiteiliges Profil ab (ohne manuelle «Erfüllungs-%»): " +
      "(1) Adressierung aus challenge_direction_links und Beitragsstufe (schwach/mittel/stark), " +
      "(2) Kohärenz aus der Korrelationsanalyse Herausforderung × strategisches Ziel × gemeinsame Stoßrichtung, " +
      "(3) Umsetzung als gewichteter Fortschritt über Jahresziele (Fortschritt %), Initiativen (Fortschritt %) und " +
      "OKR-Key-Results (Metrik/Check-in), sofern sie per Traceability an Jahresziele der Stoßrichtung hängen. " +
      "Der **Erfüllungsgrad** ist dieser Umsetzungsprozentsatz (0–100). Fehlen Anker, zeigt das Dashboard unter " +
      "«Fortschritt pflegen» konkrete Sprungziele (Jahresziele, PIP, OKR-Tracking).",
  },
  {
    id: "okr-gate",
    question: "Was bedeutet «Keine aktiven OKRs ohne gültige Jahresziele»?",
    answer:
      "Wenn die Mandantenregel aktiv ist, bleiben OKRs als Entwurf erlaubt, aber Aktivierung/Publish wird geblockt, " +
      "solange für den Objective-Owner im Zieljahr keine aktiven Jahresziele existieren (Gate 1). " +
      "Zusätzlich muss das Objective mindestens einem Jahresziel zugeordnet sein oder eine genehmigte Ausnahme haben (Gate 2).",
  },
  {
    id: "challenge-cycle",
    question: "Wo leben Herausforderungen – im Strategie- oder Reviewzyklus?",
    answer:
      "Herausforderungen werden im Strategiezyklus angelegt, bewertet und mit Stoßrichtungen verknüpft. " +
      "Der Reviewzyklus prüft Fortschritt und Entscheidungen (z. B. bei Initiativen oder Strategy Review) – " +
      "er ersetzt nicht die inhaltliche Herausforderungsarbeit.",
  },
  {
    id: "analysis-to-challenge",
    question: "Wie hängen strategische Erkenntnisse mit Herausforderungen zusammen?",
    answer:
      "Analyse-Einträge (Erkenntnisse aus Umfeld-, Unternehmens- oder Wettbewerbsanalyse) können einzeln " +
      "als Herausforderung übernommen werden. Mehrere Einträge können zu einem Analyse-Cluster zusammengefasst " +
      "und gemeinsam als eine Herausforderung übernommen werden.",
  },
  {
    id: "strategy-vs-okr-objectives",
    question: "Was ist der Unterschied zwischen «Zielen» und OKR-Objectives?",
    answer:
      "Strategische Ziele im Strategiezyklus beschreiben das langfristige Zielbild der Strategiearbeit. " +
      "OKR-Objectives gehören zum OKR-Zyklus (Quartals-/Umsetzungsebene) mit messbaren Key Results. " +
      "Beide Ebenen können über Jahresziele und Verknüpfungen in der Traceability zusammengeführt werden.",
  },
  {
    id: "annual-target-bridge",
    question: "Wie wirken strategische Ziele auf die operative Software?",
    answer:
      "Jahresziele operationalisieren Stoßrichtungen für ein Planungsjahr. Programme und Initiativen " +
      "setzen die Umsetzung um; OKR-Objectives und Key Results messen Fortschritt in kurzen Zyklen. " +
      "Verknüpfungstabellen (z. B. objective_target_links, annual_target_okr_objective_links) halten die Brücken nachvollziehbar.",
  },
];

const NODES: ReferenceNetworkNode[] = [
  {
    id: "unternehmensinfo",
    kind: "unternehmensinfo",
    zone: "strategy",
    label: "Unternehmensinfo",
    description:
      "Langfristiger Orientierungsrahmen: Purpose, Vision, Mission und strategische Leitplanken. " +
      "Sie beeinflussen Bewertungen und Priorisierungen, sind aber keine verknüpften Datensätze im Zyklusgraph.",
    examples: ["Mission-Teaser im Strategiezyklus", "Kennwerte aus Markenauftritt"],
    moduleHref: "/unternehmensinfo",
    manualAnchor: "begriffe",
    dbTables: ["tenant_branding (branding_config)"],
  },
  {
    id: "analysis_entry",
    kind: "analysis_entry",
    zone: "strategy",
    label: "Analyse-Eintrag",
    description:
      "Strukturierte strategische Erkenntnis (Umfeld, Unternehmen, Wettbewerb) mit Qualitätsbewertung. " +
      "Kann direkt zur Herausforderung übernommen oder einem Cluster zugeordnet werden.",
    examples: ["SWOT-Punkt", "Markttrend", "interne Schwäche"],
    moduleHref: "/strategy-cycle?l1=analysis&l2=entries",
    dbTables: ["analysis_entries", "strategic_challenge_analysis_entries"],
  },
  {
    id: "analysis_cluster",
    kind: "analysis_cluster",
    zone: "strategy",
    label: "Analyse-Cluster",
    description:
      "KI- oder manuell gebündelte Gruppe verwandter Analyse-Einträge. Beim Übernehmen entsteht daraus " +
      "typischerweise eine Herausforderung; Cluster-Mitglieder können zusätzlich einbezogen sein.",
    examples: ["Themencluster «Digitaler Wettbewerbsdruck»"],
    moduleHref: "/strategy-cycle?l1=analysis&l2=entries",
    dbTables: ["analysis_clusters", "analysis_cluster_members"],
  },
  {
    id: "challenge",
    kind: "challenge",
    zone: "strategy",
    label: "Herausforderung",
    description:
      "Priorisiertes strategisches Themenfeld im Strategiezyklus. Entsteht aus Analyse-Einträgen oder Clustern; " +
      "wird mit Stoßrichtungen, Dimensionen (Industrie, Business Model) und Programmen verknüpft. " +
      "Das Herausforderungs-Profil (Adressierung · Kohärenz · Umsetzung) wird daraus und aus Korrelation/Umsetzungsankern abgeleitet.",
    examples: ["«Nachhaltige Beschaffung»", "«Fachkräftemangel»"],
    moduleHref: "/strategy-cycle?l1=strategic-directions&l2=challenges",
    dbTables: ["strategic_challenges", "challenge_direction_links"],
  },
  {
    id: "direction",
    kind: "direction",
    zone: "strategy",
    label: "Stoßrichtung",
    description:
      "Gewünschtes strategisches Handlungsfeld, abgeleitet aus Analyse und Herausforderungen. " +
      "Verbindet Strategieentwicklung mit Jahreszielen, Programmen und strategischen Zielen.",
    examples: ["«Kundenerlebnis digital ausbauen»"],
    moduleHref: "/strategic-directions",
    dbTables: ["strategic_directions", "strategic_direction_objective_links"],
  },
  {
    id: "strategy_objective",
    kind: "strategy_objective",
    zone: "strategy",
    label: "Strategisches Ziel",
    description:
      "Langfristiges Zielbild im Strategiezyklus (UI: «Ziele»). Nicht mit OKR-Objectives verwechseln. " +
      "Kann Stoßrichtungen und Jahresziele tragen.",
    examples: ["«Marktführerschaft Segment DACH bis 2028»"],
    moduleHref: "/strategy-cycle?l1=objectives",
    manualAnchor: "begriffe",
    dbTables: ["strategy_objectives", "objective_direction_links", "objective_target_links"],
  },
  {
    id: "annual_target",
    kind: "annual_target",
    zone: "execution",
    label: "Jahresziel",
    description:
      "Steuerbares Jahres-Commitment (Commitment Layer) zwischen Strategie und Umsetzung. " +
      "Hängt an einer Stoßrichtung, trägt eigene Management-Messung (progress_percent) und kann " +
      "über Modus/Fortschrittsquelle transparent gegen KR-/Initiativen-Berechnungen gespiegelt werden.",
    examples: ["«Umsatzanteil Neugeschäft 35 %»"],
    moduleHref: "/annual-targets",
    dbTables: [
      "annual_targets",
      "initiative_target_links",
      "objective_target_links",
      "key_result_target_links",
      "annual_target_okr_objective_links",
      "annual_target_okr_objective_exceptions",
    ],
  },
  {
    id: "program",
    kind: "program",
    zone: "execution",
    label: "Programm",
    description:
      "Gebündelte Maßnahmenlandschaft (PIP) mit Budget, Laufzeit und Verantwortung. " +
      "Bezieht sich typischerweise auf Stoßrichtung, optional Herausforderung und unterstützte strategische Ziele.",
    examples: ["«Transformationsprogramm IT»"],
    moduleHref: "/strategy-cycle?l1=pips&l2=programme",
    dbTables: ["strategy_programs"],
  },
  {
    id: "initiative",
    kind: "initiative",
    zone: "execution",
    label: "Initiative",
    description:
      "Operative Umsetzungseinheit mit Fortschritt und Review-Bezug. Gehört zu einem Programm; " +
      "kann Jahresziele und Key Results unterstützen.",
    examples: ["«Rollout CRM Phase 2»"],
    moduleHref: "/strategy-cycle?l1=pips&l2=initiativen",
    dbTables: ["initiatives", "initiative_target_links", "initiative_key_result_links"],
  },
  {
    id: "review_session",
    kind: "review_session",
    zone: "review",
    label: "Review / Freigabe",
    description:
      "Formalisierte Prüfung im Reviewzyklus: Initiative-Fortschritt, Strategy Review, Freigaben. " +
      "Ergänzt die laufende OKR-Pflege, ohne Herausforderungen hier zu erfassen.",
    examples: ["Quartals-Review", "Strategy-Review-Freigabe"],
    moduleHref: "/reviews",
    dbTables: ["strategy_review_procedures", "initiative review fields"],
  },
  {
    id: "okr_objective",
    kind: "okr_objective",
    zone: "okr",
    label: "OKR-Objective",
    description:
      "Zielebene im OKR-Modell (Quartals-/Kurzzyklus). Getrennt von strategischen Zielen im Strategiezyklus; " +
      "hängt direkt an einer führenden Stoßrichtung und operationalisiert Jahresziele über annual_target_okr_objective_links.",
    examples: ["«Q2: Kundenzufriedenheit steigern»"],
    moduleHref: "/okr/planning",
    dbTables: ["okr_objectives", "annual_target_okr_objective_links"],
  },
  {
    id: "key_result",
    kind: "key_result",
    zone: "okr",
    label: "Key Result",
    description:
      "Messbare Wirkung zu einem OKR-Objective. Updates im Tracking; kann Initiativen und Jahresziele verknüpfen.",
    examples: ["«NPS von 42 auf 55»"],
    moduleHref: "/okr/tracking",
    dbTables: ["key_results", "key_result_target_links", "initiative_key_result_links", "okr_updates"],
  },
];

const EDGES: ReferenceNetworkEdge[] = [
  {
    id: "entry_to_challenge",
    sourceId: "analysis_entry",
    targetId: "challenge",
    label: "übernehmen",
    cardinality: "n:1",
    optional: false,
    ruleKey: null,
    dbTables: ["strategic_challenges.source_analysis_entry_id", "strategic_challenge_analysis_entries"],
    uiSurfaces: ["Strategiezyklus → Analyse → «Als Herausforderung übernehmen»"],
    description: "Einzelner Analyse-Eintrag wird Quelle einer Herausforderung.",
  },
  {
    id: "cluster_to_challenge",
    sourceId: "analysis_cluster",
    targetId: "challenge",
    label: "bündeln & übernehmen",
    cardinality: "1:1",
    optional: false,
    ruleKey: null,
    dbTables: ["analysis_clusters", "promoteClusterToStrategicChallenge"],
    uiSurfaces: ["Strategiezyklus → Cluster übernehmen"],
    description: "Mehrere Einträge eines Clusters fließen in eine Herausforderung ein.",
  },
  {
    id: "challenge_to_direction",
    sourceId: "challenge",
    targetId: "direction",
    label: "adressiert",
    cardinality: "n:m",
    optional: true,
    ruleKey: "challenge_direction.enabled",
    dbTables: ["challenge_direction_links"],
    uiSurfaces: ["Strategiezyklus → Stoßrichtungen ↔ Herausforderungen"],
    description:
      "Welche Stoßrichtungen eine Herausforderung adressieren (Beitragsstufe low/medium/high). " +
      "Grundlage der Dimension «Adressierung» im Herausforderungs-Profil.",
  },
  {
    id: "direction_to_objective",
    sourceId: "direction",
    targetId: "strategy_objective",
    label: "stützt Ziel",
    cardinality: "n:m",
    optional: true,
    ruleKey: "direction_objective.enabled",
    dbTables: ["strategic_direction_objective_links"],
    uiSurfaces: ["Strategiezyklus → Korrelation / Ziele"],
    description: "Stoßrichtung trägt zu einem strategischen Ziel bei.",
  },
  {
    id: "objective_to_direction",
    sourceId: "strategy_objective",
    targetId: "direction",
    label: "bezogen auf",
    cardinality: "n:m",
    optional: true,
    ruleKey: "objective_direction.enabled",
    dbTables: ["objective_direction_links"],
    uiSurfaces: ["Traceability / Zielpflege"],
    description: "Strategisches Ziel kann explizit Stoßrichtungen zugeordnet werden.",
  },
  {
    id: "direction_to_annual_target",
    sourceId: "direction",
    targetId: "annual_target",
    label: "operationalisiert",
    cardinality: "1:n",
    optional: false,
    ruleKey: null,
    dbTables: ["annual_targets.strategic_direction_id"],
    uiSurfaces: ["Jahresziele"],
    description: "Jahresziel hängt an einer Stoßrichtung.",
  },
  {
    id: "direction_to_program",
    sourceId: "direction",
    targetId: "program",
    label: "getragen von",
    cardinality: "1:n",
    optional: false,
    ruleKey: null,
    dbTables: ["strategy_programs.strategic_direction_id"],
    uiSurfaces: ["PIP → Programme"],
    description: "Programm setzt primär eine Stoßrichtung um.",
  },
  {
    id: "challenge_to_program",
    sourceId: "challenge",
    targetId: "program",
    label: "kontext",
    cardinality: "n:m",
    optional: true,
    ruleKey: "program_challenge.enabled",
    dbTables: ["strategy_programs.strategic_challenge_id"],
    uiSurfaces: ["Programm anlegen / Matrix"],
    description: "Optionale Zuordnung eines Programms zu einer Herausforderung.",
  },
  {
    id: "objective_to_program",
    sourceId: "strategy_objective",
    targetId: "program",
    label: "unterstützt",
    cardinality: "n:m",
    optional: true,
    ruleKey: "program_objective.enabled",
    dbTables: ["strategy_programs.supported_objective_ids"],
    uiSurfaces: ["Programm → unterstützte Ziele"],
    description: "Programm unterstützt ausgewählte strategische Ziele.",
  },
  {
    id: "program_to_initiative",
    sourceId: "program",
    targetId: "initiative",
    label: "enthält",
    cardinality: "1:n",
    optional: false,
    ruleKey: null,
    dbTables: ["initiatives.program_id"],
    uiSurfaces: ["PIP → Initiativen"],
    description: "Initiative gehört zu einem Programm.",
  },
  {
    id: "program_to_annual_target",
    sourceId: "program",
    targetId: "annual_target",
    label: "verankert",
    cardinality: "1:n",
    optional: true,
    ruleKey: "change_annual_target.program_required",
    dbTables: ["annual_targets.strategy_program_id"],
    uiSurfaces: ["Jahresziele (Change)"],
    description: "Change-Jahresziel hängt an einem Programm; Run-Jahresziele haben kein Programm.",
  },
  {
    id: "initiative_to_annual_target",
    sourceId: "initiative",
    targetId: "annual_target",
    label: "trägt bei (Legacy)",
    cardinality: "n:m",
    optional: true,
    ruleKey: "initiative_target.deprecated",
    dbTables: ["initiative_target_links"],
    uiSurfaces: ["Legacy-Traceability"],
    description: "Deprecated: Initiativen hängen am Programm, nicht mehr am Jahresziel.",
  },
  {
    id: "objective_to_annual_target",
    sourceId: "strategy_objective",
    targetId: "annual_target",
    label: "übersetzt",
    cardinality: "n:m",
    optional: true,
    ruleKey: "objective_target.enabled",
    dbTables: ["objective_target_links"],
    uiSurfaces: ["Traceability"],
    description: "Strategisches Ziel wird in Jahresziele übersetzt.",
  },
  {
    id: "initiative_to_review",
    sourceId: "initiative",
    targetId: "review_session",
    label: "wird geprüft",
    cardinality: "n:m",
    optional: false,
    ruleKey: null,
    dbTables: ["initiatives (review fields)", "review rollup"],
    uiSurfaces: ["Reviewzyklus"],
    description: "Initiativen-Fortschritt und Gesundheit im Review.",
  },
  {
    id: "okr_objective_to_key_result",
    sourceId: "okr_objective",
    targetId: "key_result",
    label: "misst",
    cardinality: "1:n",
    optional: false,
    ruleKey: null,
    dbTables: ["key_results.okr_objective_id"],
    uiSurfaces: ["OKR-Planung"],
    description: "Key Results gehören zu einem OKR-Objective.",
  },
  {
    id: "direction_to_okr_objective",
    sourceId: "direction",
    targetId: "okr_objective",
    label: "führt (abgeleitet)",
    cardinality: "1:n",
    optional: false,
    ruleKey: "okr.direction.derived",
    dbTables: [
      "annual_target_okr_objective_links",
      "initiative_key_result_links",
      "okr_objectives.leading_strategic_direction_id",
    ],
    uiSurfaces: ["OKR-Planung → abgeleitete Stoßrichtung"],
    description:
      "Stoßrichtung wird über Change-Jahresziel oder Initiative/Programm abgeleitet; kein direktes Setzen mehr.",
  },
  {
    id: "okr_objective_to_annual_target",
    sourceId: "okr_objective",
    targetId: "annual_target",
    label: "operationalisiert",
    cardinality: "n:m",
    optional: true,
    ruleKey: "okr.require_annual_targets_before_activation",
    dbTables: ["annual_target_okr_objective_links", "annual_target_okr_objective_exceptions"],
    uiSurfaces: ["OKR-Planung", "Governance-Gate beim Aktivieren"],
    description:
      "Explizite Zuordnung: welches Objective ein Jahresziel im aktuellen Zyklus operationalisiert (inkl. Ausnahmepfad).",
  },
  {
    id: "key_result_to_annual_target",
    sourceId: "key_result",
    targetId: "annual_target",
    label: "aligniert",
    cardinality: "n:m",
    optional: true,
    ruleKey: "key_result_target.enabled",
    dbTables: ["key_result_target_links"],
    uiSurfaces: ["OKR-Planung / Traceability"],
    description: "Messpfad: KR-Fortschritt kann den Vergleichswert für Jahresziele liefern.",
  },
  {
    id: "initiative_to_key_result",
    sourceId: "initiative",
    targetId: "key_result",
    label: "liefert",
    cardinality: "n:m",
    optional: true,
    ruleKey: "initiative_key_result.enabled",
    dbTables: ["initiative_key_result_links"],
    uiSurfaces: ["OKR-Planung → Initiative verknüpfen"],
    description: "Initiative unterstützt messbar ein Key Result.",
  },
];

export function getReferenceNetworkGraph(): ReferenceNetworkGraph {
  return { nodes: NODES, edges: EDGES };
}

export function getReferenceNodeById(id: string): ReferenceNetworkNode | undefined {
  return NODES.find((n) => n.id === id);
}

export function getReferenceEdgeById(id: string): ReferenceNetworkEdge | undefined {
  return EDGES.find((e) => e.id === id);
}
