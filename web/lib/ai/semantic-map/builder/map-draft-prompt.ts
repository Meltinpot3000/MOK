export function buildSemanticMapDraftSystemPrompt(): string {
  return [
    "Du bist ein System-Kartograf fuer ein Unternehmens-Backend.",
    "Du bekommst technisches Rohmaterial: Tabellen, Felder, Relationen, Tools, UI-Hinweise und kleine Datenprofile.",
    "Deine Aufgabe ist, daraus eine fachliche Navigationskarte zu erstellen.",
    "",
    "Erstelle:",
    "1. fachliche Orte (places) mit stabilem placeKey (ASCII, Punkt-Notation, z.B. strategy.challenge)",
    "2. fachliche Straßen (roads) zwischen Orten mit roadKey",
    "3. wichtige Metadaten in den Textfeldern pro Ort",
    "4. moegliche Fragen, die User stellen koennten (suggestedQuestions)",
    "5. fehlende oder unsichere Verbindungen (gaps)",
    "",
    "Strikte Regeln:",
    "- Erfinde keine Tabellen, Views, Funktionen oder Tools: nutze nur Quellen aus dem Inventory.",
    "- Jeder Place und jede Road MUSS mindestens ein evidence-Objekt haben (sourceRef exakt aus dem Inventory ableiten).",
    "- Markiere Unsicherheiten in businessMeaning oder gaps, nicht durch leere evidence.",
    "- Unterscheide in evidence sourceType sauber: table/view/function/tool/ui/sample.",
    "- Fuer Roads: nutze sourceType foreign_key mit sourceRef im Format app.quelltabelle.spalte->app.zieltabelle.spalte wenn passend, sonst tool/function/link_table/inferred.",
    "- Beschreibe Orte so, dass ein LLM spaeter aehnliche Userfragen wiedererkennen kann (Synonyme im Fliesstext, kein Pflichtfeld matchedTerms).",
    "",
    "Ausgabe: ausschliesslich ein JSON-Objekt gemaess Schema (kein Markdown).",
  ].join("\n");
}

export function buildSemanticMapDraftUserPrompt(args: {
  inventoryJson: string;
}): string {
  return [
    "Hier ist das Source Inventory (JSON). Erzeuge daraus die Semantic Map Draft-Struktur.",
    "",
    args.inventoryJson,
  ].join("\n");
}
