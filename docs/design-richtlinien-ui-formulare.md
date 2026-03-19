# Design-Richtlinien: Formularfelder und Validierung

Diese Richtlinien gelten fuer neue und bestehende Screens im Strategie-Bereich.

## 1) Feld-Ueberschriften je Eingabefeld

- Jedes Eingabefeld hat eine sichtbare Ueberschrift oberhalb des Controls.
- Das Muster orientiert sich an den bestehenden Screens:
  - Label-Style: `text-xs text-zinc-600`
  - Control-Spacing: `mt-1 w-full ...`
- Platzhalter sind nur Zusatzhilfe und ersetzen keine Ueberschrift.

## 2) Save-Button erst bei vollstaendigen Pflichtfeldern

- Primaere Save-Buttons (z. B. `Objective speichern`) bleiben deaktiviert, bis alle Pflichtfelder gueltig befuellt sind.
- HTML-`required` bleibt aktiv, aber zusaetzlich wird clientseitig ein `canSubmit`-Gate verwendet.
- Deaktivierter Zustand wird visuell kenntlich gemacht (z. B. `disabled:opacity-60`, `disabled:cursor-not-allowed`).

## 3) Numerische Eingaben mit Min/Max + Begrenzung

- Fuer numerische Scores immer `min` und `max` am Input setzen.
- Zusaetzlich wird der eingegebene Wert beim Tippen gecappt (Clamp), damit keine Werte oberhalb des Maximalwerts gespeichert werden.
- Beispiel: `importance_score` ist strikt im Bereich `1..5`.

---

## 4) Einzeilige Expandable-Tabelle (Allgemein)

Fuer Uebersichten wie Strategische Stossrichtungen, Herausforderungen, Objectives:

- **Zeilen:** Jedes Line-Item ist eine einzeilige Tabellenzeile mit allen Backend-Feldern.
- **Ausklappen:** Zeile kann nach unten ausgeklappt werden, um alle Infos und Bearbeitungsmoeglichkeiten zu zeigen (alternativ: Fly-in wie bei SharePoint-Listen).
- **Spalten ein-/ausblenden:** User kann Spalten ueber einen Toggle (z. B. Spalten-Icon) ein- und ausblenden.
- **Edit-Modus:** Beim Ausklappen oder Fly-in kann der User Inhalte anpassen.

---

## 5) Pill-Buttons fuer Verknuepfungen

Statt Dropdowns fuer Verknuepfungen (Industries, Business Models, Challenges, Objectives, Cluster, Gaps):

- **Darstellung:** Pill-Buttons (Kapselform, `rounded-full`) zeigen verknuepfte Items auf einen Blick.
- **Interaktion:** Toggle-faehig (anklicken zum Verknuepfen/Entfernen).
- **Styling – nicht angewaehlt:** Pills heben sich vom Hintergrund ab:
  - Leichter Fill (z. B. `bg-zinc-100` oder `bg-slate-100`) statt reinem Weiss
  - Staerkerer Rand (z. B. `border-zinc-400`) oder dezenter Schatten (`shadow-sm`)
  - Text: `text-zinc-800`
- **Styling – angewaehlt/verknuepft:** Deutlicher hervorgehoben (z. B. `border-emerald-400 bg-emerald-50 text-emerald-900` oder Markenfarbe).
- **Entfernen:** Kleines "x" oder Klick auf Pill zum Entkoppeln.
