# Sentinel Semantic Map Discovery

## 1. Zweck

Dieses Modul erzeugt eine **LLM-lesbare fachliche Landkarte** (Places, Roads, Gaps) aus technischem Rohmaterial (Schema, Tools, UI-Hinweise, kleine Datenprofile). Die Karte wird **nicht manuell** gepflegt: Das LLM entwirft einen Draft, das Backend **validiert deterministisch**, was existiert und ausführbar ist. Veröffentlichte Snapshots bilden die Grundlage für Planner, Route Planning und spätere Evidence-Gates — **ohne** die Sentinel-Runtime im MVP hart zu ersetzen.

## 2. Eigenständigkeit

- Eigener Codepfad unter `web/lib/ai/semantic-map/`.
- Eigener Daten-Workspace `sentinel_map` in Postgres (kein Mischen mit bestehenden `app`-AI-Tabellen).
- Keine direkte Verdrahtung in OKR-, Strategy-, Task- oder Review-Pipelines; Anbindung nur über die exportierten Funktionen.

## 3. Architektur

```
Schema / Tools / UI / Sample Profiles
        → Inventory Collector
        → LLM Draft (JSON, Zod)
        → Normalisierung
        → Deterministische Validierung
        → Snapshot (Publish)
        → Runtime: ExecutableSemanticMap
        → Compact Map (Planner) / Question Resolution / Evidence Requirements
```

## 4. Datenfluss

1. **Build:** Inventory sammeln, Run + `source_inventory` speichern, LLM-Draft erzeugen, `map_drafts` schreiben.
2. **Validate:** Draft gegen Inventory prüfen, `validation_results` + `map_gaps` (Draft) schreiben, `map_drafts.validated_at` setzen.
3. **Publish:** Nur wenn Draft validiert; `map_snapshots` + `map_places` + `map_roads` + `map_gaps` (Snapshot); vorherige aktive Snapshots deaktivieren.
4. **Runtime:** Aktiven Snapshot laden → `ExecutableSemanticMap` mit **getrennten** Road-Listen (`roadsAll` vs. `roadsExecutableVerified`).

## 5. Datenmodell (Kurz)

- **Run:** Modell, Schema-Hash, Status, Organisation optional.
- **Inventory:** JSON-Rohmaterial (Tabellen, FKs, Views, Functions, Tools, UI, Sample-Profile).
- **Draft:** LLM-JSON (`places`, `roads`, …) — jeder Place und jede Road **muss** `evidence` haben (Zod `min(1)`).
- **Snapshot:** `validation_summary` mit Zählungen und `gapsCount` (persistierte Snapshot-Gaps).
- **Executable Map:** Places vollständig; Roads: `roadsExecutableVerified` = nur `verified`; `roadsAll` inkl. inferred/missing_tool/unsupported für Diagnose.

## 6. Supabase

- Schema `sentinel_map`, Tabellen: `map_runs`, `source_inventory`, `map_drafts`, `map_snapshots`, `map_places`, `map_roads`, `map_metadata`, `validation_results`, `map_gaps`.
- **Nur `service_role`-Grants** (kein `authenticated`/`anon` auf diesem Schema) — Zugriff serverseitig/CLI.

## 7. Öffentliche Schnittstellen

Siehe `index.ts`:

- `buildSemanticMapDraft`
- `validateSemanticMapDraft`
- `publishSemanticMapSnapshot`
- `getActiveSemanticMap`
- `buildCompactMapForPlanner`
- `planRouteFromMap` (Option `allowInferredRoads`)
- `resolveQuestionAgainstSemanticMap`
- `deriveEvidenceRequirementsFromResolution`
- `buildSemanticUsedSourcesFromToolCalls` / `buildSemanticMapRunDiagnostics` (Backend-Run-Diagnose; `diagnosticsOnly` steuert Verifier-Anbindung)
- `inspectSemanticMap` / `buildSemanticMapRuntimeDiagnostics`

### Answer-Verifier (Semantic Evidence Guard, Phase 15)

- Wenn `AI_SEMANTIC_EVIDENCE_GUARD_ENABLED=true` **oder** `SemanticMapRunDiagnostics.diagnosticsOnly === false`: der Orchestrator lädt Diagnostik und `verifyAnswer` kann bei **High-Risk**-Lücken (fehlende Challenge-/Initiative-Evidence, Top-Challenge ohne Evidence, Zyklus-Mismatch) die **freie LLM-Antwort** durch eine **deterministische** Erklärung ersetzen (keine UI, keine Toolplan-Änderung).
- Default: Flag **aus** — produktiv erst nach bewusster Aktivierung.

**Stand (Kurz):** Semantic Map Discovery implementiert · Backend-Diagnostics implementiert · Evidence-Smoke implementiert · **Verifier Enforcement (opt-in)** implementiert · Toolplanung über Semantic Map später · Frontend später.

## 8. Build / Validate / Publish

- **Publish** nur mit `validated_at` auf dem Draft und erfolgreicher `validation_results`-Zeile.
- Snapshot enthält `validation_summary.places.*`, `roads.*`, `gapsCount`.

## 9. Runtime-Nutzung

- Standard-**Execution** nutzt **nur verified Roads** (`roadsExecutableVerified`, `planRouteFromMap` ohne `allowInferredRoads`).
- **Inferred Roads** erscheinen in **Compact Map** (Planner-Hinweis) und **Diagnostics**, nicht automatisch für ausführbare Routen.
- Optional: `planRouteFromMap({ ..., options: { allowInferredRoads: true } })`.

## 10. Sicherheitsmodell

- Kein vollständiger Datenexport: Inventory mit **harten Caps** (`inventory/caps.ts`).
- Keine freie SQL-Generierung durch das LLM.
- Schema-Introspection nur mit DB-URL auf dem Server/CLI, nicht in der User-Browser-Runtime.

## 11. LLM-Grenzen

- Das LLM **darf** keine nicht existierenden Tabellen/Tools erfinden; Evidence muss zum Inventory passieren, sonst `unsupported` / `inferred`.
- Question Resolution: **kein** Pflichtfeld `matchedTerms`; Ausgabe konzeptbasiert (Zod-Schema).

## 12. MVP-Grenzen

- Keine Orchestrator-Integration, keine Admin-UI, keine Embeddings, keine Graph-DB.
- UI-Routen-Inventar ist heuristisch (Next `app/**/page.tsx`).

## 13. Beispiel: strategische Herausforderung + Initiativen

Freie Frage (z. B. Englisch): *What is our biggest strategic challenge and which initiatives address it?*

Ablauf:

1. `resolveQuestionAgainstSemanticMap` ordnet die Frage `placeKeys` zu (z. B. `strategy.challenge`, `strategy.initiative`, `okr.cycle`).
2. `planRouteFromMap` sucht eine Route mit **nur verified Roads** (oder mit Option inferred).
3. `deriveEvidenceRequirementsFromResolution` liefert Evidence-Constraints (Zyklus, Challenge, Initiative).
4. Fehlt eine verified Road → Gap / fehlende Route im Inspect.

## CLI

Aus dem Verzeichnis `web/`:

- `npm run ai:semantic-map:build`
- `npm run ai:semantic-map:validate -- --draft <uuid>`
- `npm run ai:semantic-map:publish -- --run <uuid> --draft <uuid>`
- `npm run ai:semantic-map:inspect`
- `npm run ai:semantic-map:test-reference` — Referenzkette (Resolution → Evidence → Coverage-Dry-Run), **ohne** Business-Antwort; optional `--question "..."`, `--org <uuid>`. LLM nur mit `AI_SEMANTIC_MAP_LIVE_TEST=true` und `--use-llm 1`.
- `npm run ai:semantic-map:backend-smoke` — Backend-Smoke: Referenzfrage + simulierte Tool-Calls (Standard: nur `get_current_okr_cycle`) gegen Fixture-Map; JSON mit `semanticMapDiagnostics` (kein LLM, kein Frontend).

Details: [semantic-map-discovery.md](../../scripts/doc/semantic-map-discovery.md).

## Vitest-Matrix (`web/`: `npm test`)

| Datei | Inhalt |
| --- | --- |
| `semantic-map.lifecycle.test.ts` | Normalisierung Draft-Keys |
| `semantic-map.validation.test.ts` | deterministische Validierung, Landschafts-Inventar |
| `semantic-map.runtime.test.ts` | Routen (verified vs inferred), Compact Map, Diagnostics |
| `semantic-map.evidence.test.ts` | `evaluateSemanticEvidenceCoverage`, `evaluateCycleClaimConsistency` |
| `semantic-map.question-resolution.test.ts` | Mock-Resolution, `deriveEvidenceRequirementsFromResolution`, Gate |
| `answer-verifier-semantic-guard.test.ts` | Verifier + `SemanticMapRunDiagnostics` (Flag / `diagnosticsOnly`) |
| `semantic-map.backend-diagnostics.test.ts` | `buildSemanticMapRunDiagnostics`, Tool→`SemanticUsedSource`, Zyklus-Mismatch |
| `semantic-map.live.test.ts` | nur bei `AI_SEMANTIC_MAP_LIVE_TEST=true`: echtes `resolveQuestionAgainstSemanticMap` |
