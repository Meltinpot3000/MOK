# Semantic Map Discovery — CLI & Smoke

Alle Befehle **aus dem Ordner `web/`** ausführen (damit `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` aus `web/.env.local` bzw. übergeordneten `.env`-Dateien geladen werden können).

## Voraussetzungen

- `SUPABASE_SERVICE_ROLE_KEY` und `NEXT_PUBLIC_SUPABASE_URL` für Schreibzugriff auf `sentinel_map`.
- `DATABASE_URL` oder `SUPABASE_POOLER_DB_URL` für Schema- und Sample-Profile-Inventory.
- Für **Build** und **Question Resolution**: erreichbares LLM (Standard wie Sentinel: `SENTINEL_LOCAL_LLM_PROVIDER` / Ollama), optional `SEMANTIC_MAP_LLM_PROVIDER`, `SEMANTIC_MAP_LLM_TIMEOUT_MS`.

## Befehle

### Build (Inventory + LLM-Draft)

```bash
npm run ai:semantic-map:build
```

Optional Organisation:

```bash
npm run ai:semantic-map:build -- --org <organization-uuid>
```

Ausgabe: Kurzübersicht + JSON mit `runId`, `draftId`, `draft`, `inventorySummary`.

### Validate

```bash
npm run ai:semantic-map:validate -- --draft <draft-uuid>
```

Schreibt `validation_results`, aktualisiert `map_drafts.validated_at`, `map_gaps` (Draft).

### Publish

Nur nach erfolgreicher Validierung (`validated_at` gesetzt):

```bash
npm run ai:semantic-map:publish -- --run <run-uuid> --draft <draft-uuid>
```

### Inspect

```bash
npm run ai:semantic-map:inspect
```

Zeigt u. a.:

- `runtime executable (strict: verified roads only)` — **ja** nur wenn mindestens ein verified Place **und** mindestens eine **verified** Road existieren (Standard-Execution).
- `inferred roads` — nur Hinweis; nicht Teil der Standard-Execution.

### Test-Reference (Referenzkette ohne Business-Antwort)

#### 1. Zweck

`test-reference` prüft **keine** fachliche Business-Antwort des Assistenten. Stattdessen dient der Befehl dazu, die **Referenzkette** der Semantic Map zu verifizieren bzw. sichtbar zu machen:

- **Question Resolution** — strukturierte Zuordnung der Frage (Intent, `relevantPlaces`, `requiredEvidence`, …); im Standard über **Mock**, optional über **LLM** (siehe unten).
- **Erkannte Places** — über `relevantPlaces` und `requiredEvidence.placeKey` in der Resolution.
- **Required Operations** — Feld `requiredOperations` in der Resolution.
- **Route Planning** — Feld `requiredRoads` in der Resolution (welche Kanten fachlich nötig sind); die ausführbare Route auf der Map nutzt dieselben Place-/Road-Daten (`planRouteFromMap`, nur **verified** Roads im Standard — siehe Modul-README und `inspect`).
- **Evidence Requirements** — abgeleitet mit `deriveEvidenceRequirementsFromResolution` aus Resolution + aktiver bzw. Fixture-**Executable Map**.
- **Evidence Coverage** — Dry-Run mit `evaluateSemanticEvidenceCoverage` (ohne echte Tool-Aufrufe; in der CLI z. B. mit leeren `usedSources` oder zum Abgleich mit Tests).
- **Execution Readiness** — schließt aus derselben Map an (verified Places/Roads); ausführliche Flags wie bei `inspect` (`runtimeExecutableStrict`, …).

Die JSON-Ausgabe enthält primär `resolution`, `evidenceRequirements` und `coverageIfNoTools` (Coverage mit **keinen** genutzten Quellen = maximal strenger Dry-Run).

#### 2. Befehl

```bash
npm run ai:semantic-map:test-reference
```

(Ausführung wie die übrigen Befehle **im Ordner `web/`**.)

#### 3. Optional mit Frage

Die Frage erscheint in der Ausgabe und wird bei **LLM-Modus** an `resolveQuestionAgainstSemanticMap` übergeben. Im **Mock-Standard** bleibt die Resolution deterministisch (Fixture), die Frage dient dann der Dokumentation/Repro.

```bash
npm run ai:semantic-map:test-reference -- --question "Welches ist die grösste strategische Herausforderung im aktuellen Zyklus und welche Initiativen laufen?"
```

#### 4. Optional mit LLM

Nur wenn **beides** erfüllt ist:

- Umgebungsvariable `AI_SEMANTIC_MAP_LIVE_TEST=true`
- CLI-Argument `--use-llm 1`

wird die Resolution per `resolveQuestionAgainstSemanticMap` mit echtem LLM erzeugt (sonst **Mock**).

#### 5. Erwartetes Verhalten

- **Standard:** fixture- bzw. snapshot-basierte **Executable Map**; Resolution per **Mock** — **kein** echtes LLM nötig.
- Es gibt **keine** finale Business-Antwort (kein Sentinel-/Chat-Pfad).
- **Evidence incomplete:** Wenn in einem Coverage-Lauf die `usedSources` **nur** z. B. `get_current_okr_cycle` enthielten, wären Challenge- und Initiative-Slots **nicht** abgedeckt — `answerAllowed: false`, `missingEvidence` u. a. mit `strategy_challenge` und `initiative` (siehe Unit-Tests `semantic-map.evidence.test.ts`). Die CLI zeigt zusätzlich einen Dry-Run mit **leeren** `usedSources` (`coverageIfNoTools`), der alle harten Evidence-Lücken aufdeckt.
- **Blocked Claims:** Ohne passende Evidence werden u. a. `challenge_claim_without_evidence`, bei Top-Challenge-Kontext `top_challenge_without_challenge_evidence`, und `initiative_claim_without_evidence` gesetzt (`SEMANTIC_MAP_BLOCKED_CLAIMS`).

#### 6. Hinweis

Der **Live-LLM**-Pfad ist **optional**; ohne `AI_SEMANTIC_MAP_LIVE_TEST` und `--use-llm 1` läuft alles deterministisch. Vitest-Live-Tests (`semantic-map.live.test.ts`) sind ebenfalls nur mit gesetzter Variable aktiv — **CI bleibt stabil**, sofern diese Variable dort nicht gesetzt wird.

### Backend Smoke / Runtime Diagnostics

#### 1. Zweck

Prüft **backendseitig** (ohne Frontend, ohne Browser), ob die aus der Frage und der Semantic Map abgeleiteten **Required-Evidence-Slots** durch die **tatsächlich ausgeführten Tool-Calls** (als `SemanticUsedSource`) abgedeckt sind. Dient der Absicherung gegen den Fall: Frage verlangt strategische Herausforderung + Initiativen, der Lauf lädt aber nur den aktuellen OKR-Zyklus.

#### 2. Befehl

```bash
npm run ai:semantic-map:backend-smoke
```

(Ausführung **im Ordner `web/`** — gleiche `.env`-Laderei wie die übrigen Semantic-Map-Befehle; für diesen Smoke ist **kein** Supabase-Zwang nötig, es wird die **Fixture-Map** verwendet.)

#### 3. Was getestet wird

- Referenzfrage (deutsch, Strategie + Initiativen im Zyklus; per `--question` überschreibbar).
- Simulierte Tool-Calls: standardmässig nur **`get_current_okr_cycle`** (MVP-Adapter in `buildSemanticUsedSourcesFromToolCalls`).
- Ablauf intern: Fixture-Map, Mock-Resolution, `deriveEvidenceRequirementsFromResolution`, Normalisierung der Tool-Calls → `usedSources`, `evaluateSemanticEvidenceCoverage`, optional Zyklus-Konsistenz — Ergebnis als **`semanticMapDiagnostics`** (Typ `SemanticMapRunDiagnostics`).

#### 4. Erwartung (Standardlauf)

- `evidenceCoverage.answerAllowed === false`
- `evidenceCoverage.missingEvidence` enthält `strategy_challenge` und `initiative`
- `evidenceCoverage.blockedClaims` enthält `challenge_claim_without_evidence` und `initiative_claim_without_evidence` (bei erkanntem „Top-Challenge“-Kontext in der Frage zusätzlich `top_challenge_without_challenge_evidence`)
- `executionReadiness === "missing_evidence"`
- `diagnosticsOnly === true` (MVP: **keine** harte Blockade der produktiven Chat-Antwort über diesen Pfad)

Die stdout-JSON enthält zusätzlich `requiredEvidenceSlots` (abgeleitete Slot-Liste aus den Evidence-PlaceKeys) und `toolCalls` als Namensliste.

#### 5. Abgrenzung

- **Keine** finale Business-Antwort und kein Chat-Endpunkt.
- **Kein** Frontend-Test und **kein** Browser.
- **Kein** echtes LLM erforderlich (Mock-Resolution).

#### 6. Strategy-/Thomas-Smoke (optional)

Die Thomas-Strategy-Smoke (`run-strategy-thomas-smoke.mjs` → `ai-assistant-smoke-complex.mjs`) ist ein breiter Assistant-Pfad. Eine Einbindung von `semanticMapDiagnostics` pro Frage würde dort eine durchgängige Tool-Call-Sammlung und Orchestrierung voraussetzen — **nicht** Teil dieses Auftrags. **TODO:** bei späterer Sentinel-Telemetrie (aggregierte Tool-Calls pro Turn) `buildSemanticMapRunDiagnostics` anbinden.

## Smoke-Ablauf

1. `npm run db:migrate` (Repo-Root) — sicherstellt, dass `sentinel_map` existiert.
2. `npm run ai:semantic-map:build`
3. `npm run ai:semantic-map:validate -- --draft <id aus Schritt 2>`
4. `npm run ai:semantic-map:publish -- --run <runId> --draft <draftId>`
5. `npm run ai:semantic-map:inspect`

## Hinweise

- Keine Geschäftsdaten-Dumps: Sample-Profile sind aggregiert und gedeckelt (`web/lib/ai/semantic-map/inventory/caps.ts`).
- Produktive Map entsteht nur aus Inventory + LLM + Validierung; Test-Fixtures dienen ausschließlich Unit-Tests.
