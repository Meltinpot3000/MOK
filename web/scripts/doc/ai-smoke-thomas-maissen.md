# AI Smoke: Thomas Maissen (strategische Herausforderungen & Stossrichtungen)

## 1. Testkontext

| Feld | Wert |
|------|------|
| **user_id** (`auth.users.id`) | `5301eae6-44c8-4231-a1bd-d49faf547016` |
| **membership_id** (`app.organization_memberships.id`) | `1fa2d469-db42-4d70-a255-d3ba4abcccb0` |
| **organization_id** | `15fd7d63-dad1-44c4-9ee5-b3bc34f54e43` |
| **E-Mail (Login / Magic Link)** | `info@messina-engineering.ch` |
| **display_name** (Membership) | Thomas Maissen |
| **Preset** | `AI_SMOKE_PRESET=thomas_maissen` |
| **Fragen-Set** | `AI_SMOKE_QUESTION_SET=strategy_directions` (Katalog: `web/scripts/lib/strategy-directions-catalog.mjs`) |

Abfrage der IDs: `web/scripts/resolve-member-via-supabase-api.mjs messina` (Join `auth.users` ↔ `app.organization_memberships`).

Hinweis: Die Textsuche `maissen` trifft den Auth-Nutzer nicht zuverlässig; die Zuordnung **Thomas Maissen** steht auf der Membership (`display_name`) zu `info@messina-engineering.ch`.

---

## 2. Preflight (Planner / lokales LLM)

Vor jedem vollständigen Lauf führt `ai-assistant-smoke-complex.mjs` einen **Planner-Preflight** aus (`web/scripts/lib/strategy-smoke-verification.mjs` → `runPlannerPreflight`):

- `SENTINEL_LOCAL_LLM_PROVIDER` (Standard `ollama`; auch `openai_compat` / `vllm`)
- `SENTINEL_LOCAL_LLM_BASE_URL` (Ollama: z. B. `http://localhost:11434`)
- `SENTINEL_LOCAL_LLM_MODEL`

**Ollama:** `GET /api/tags`, Modellname in der Liste; optional `POST /api/generate` (Mini-Prompt), sofern nicht mit `AI_SMOKE_PREFLIGHT_SKIP_GENERATE=true` übersprungen.

**OpenAI-kompatibel:** `GET /v1/models`, optional `POST /v1/chat/completions`.

Ergebnis landet in der JSON-Ausgabe unter `smokeMeta.plannerPreflight`:

```json
{
  "provider": "ollama",
  "baseUrl": "http://localhost:11434",
  "model": "…",
  "reachable": true,
  "modelAvailable": true,
  "generateOk": true
}
```

**Nur Preflight ausführen** (keine Fragen):

```bash
cd web
npm run ai:smoke:strategy-thomas:preflight
```

---

## 3. Run-Qualität (`runQuality`)

Aus Preflight abgeleitet (`deriveRunQuality`):

| `runQuality` | Bedeutung |
|--------------|-----------|
| `verification_ready` | Service erreichbar, Modell gelistet, Generate-Test ok (bzw. Skip ohne Fehler) → **fachliche Verifikation möglich** |
| `planner_unavailable` | Host down oder Modell fehlt → **kein** fachlicher Strategy-Nachweis |
| `technical_only` | Erreichbar, aber Generate-Test fehlgeschlagen → nur technischer Referenzlauf |

Im JSON: `smokeMeta.runQuality`, `smokeMeta.runQualityLabel`, sowie `documentationHint` und `domainVerificationPass` (nur `true`, wenn Planner bereit, alle Strategy-Bewertungen **PASS**, keine technische Nur-Lauf-Qualität).

---

## 4. Bewertung pro Frage

Für `strategy_directions` enthält jedes Listenelement in `results[]` ein Feld **`evaluation`** (siehe Spezifikation im Auftrag): erwarteter vs. tatsächlicher Pfad, `queryClass`, `retrievalStatus`, Composite-Diagnostics, Tool-Anzahl, Antwort-Qualitätsflags, **`pass`** / **`failReasons`**.

- **`runQuality === planner_unavailable`:** jede Frage erhält u. a. `run_planner_unavailable_not_domain_verified` → **FAIL** (fachlich nicht bestanden).
- **Legacy / unknown** bei unterstützten Katalog-Fragen → **FAIL**, sofern kein sauberer Degradation-Contract (`coveredOps` / `missingOps`, `retrievalStatus` partial/failed) die Erwartung aus dem Katalog erfüllt.
- **Fast-Mode-Stub** (`Smoke fast mode: no synthesis.`) → **FAIL** bei `verification_ready` (Platzhalter).

Exit-Code des Skripts bleibt standardmäßig **0** (technischer Lauf darf durchlaufen). Für CI: `AI_SMOKE_STRICT_EXIT=true` — Exit **1**, wenn `domainVerificationPass` falsch oder `runQuality !== verification_ready`.

---

## 5. Run-Level-Summary

Die Ausgabe enthält `summary`:

- `totalQuestions`, `passed`, `failed`
- `technicalOnly`, `plannerAvailable`, `runQuality`
- `pipelineCount`, `legacyCount`, `unknownCount`, `compositeCount`
- `failedQuestions[]` mit `id`, `question`, `failReasons`

Zusätzlich **eine Zeile auf stderr** (lesbar im Terminal), z. B.:

`Planner: OK | unavailable | Pipeline: 3/5 | Composite: 2/5 | Legacy: 1/5 | Unknown: 0/5 | PASS: 4/5 | FAIL: 1/5`

---

## 6. NPM-Scripts (`web/package.json`)

| Script | Verhalten |
|--------|-----------|
| `npm run ai:smoke:strategy-thomas` | Standard: Thomas-Preset + `strategy_directions`, Preflight + Fragen (lädt `run-strategy-thomas-smoke.mjs`) |
| `npm run ai:smoke:strategy-thomas:full` | wie oben, **`AI_SMOKE_FAST_MODE=false`** (Synthesis / kein Fast-Stub über `/api/internal/ai-smoke`) |
| `npm run ai:smoke:strategy-thomas:preflight` | nur Planner-Preflight |
| `npm run ai:smoke:complex` | generisches Complex-Smoke (ohne Thomas-Defaults) |

---

## 7. Konfiguration (Auszug `.env.local` unter `web/`)

```env
# Thomas + Strategy-Fragen (run-strategy-thomas-smoke setzt Defaults, falls unset)
AI_SMOKE_PRESET=thomas_maissen
AI_SMOKE_QUESTION_SET=strategy_directions

# Sentinel / Ollama (müssen zur App passen)
SENTINEL_LOCAL_LLM_PROVIDER=ollama
SENTINEL_LOCAL_LLM_BASE_URL=http://localhost:11434
SENTINEL_LOCAL_LLM_MODEL=qwen2.5:3b-instruct

# Optional
AI_SMOKE_FAST_MODE=true
AI_SMOKE_PREFLIGHT_SKIP_GENERATE=false
AI_SMOKE_STRICT_EXIT=false
AI_SMOKE_MODE=
```

Smoke-HTTP: `AI_SMOKE_SECRET` oder `CRON_SECRET`, `AI_SMOKE_BASE_URL`, Supabase Service Role + Anon für Magic-Link.

---

## 8. Ergebnis des letzten dokumentierten Laufs

**Datum/Zeit:** 2026-05-11 (Referenz, vor Einführung von Preflight/Evaluation).

| Kennzahl | Wert (historisch) |
|----------|---------------------|
| Modus | `fastMode: true`, kein Preflight |
| Fragen | 5 (`strategy_directions`) |
| Pfad | überwiegend **legacy**, **unknown** (Ollama Plan-Fallback) |
| Antwort | `Smoke fast mode: no synthesis.` |

**Interpretation (historisch):** Nur technischer Kontextnachweis — **keine** fachliche Verifikation.

**Nach Implementierung:** Neuen Lauf ausführen und hier die Felder aus `summary` und `smokeMeta.plannerPreflight` eintragen:

| Feld | Wert (nach nächstem Lauf ausfüllen) |
|------|-------------------------------------|
| `runQuality` | |
| `totalQuestions` | |
| `passed` / `failed` | |
| `pipelineCount` / `legacyCount` / `unknownCount` / `compositeCount` | |
| `plannerPreflight.reachable` / `modelAvailable` / `generateOk` | |

---

## 9. Interpretation (allgemein)

- **Planner unavailable (`runQuality: planner_unavailable`):**  
  *Dieser Lauf bestätigt nur Skript, Auth und Backend-Kontext — nicht die fachliche Strategy-Auswertung.*

- **Pipeline/Composite mit PASS bei `verification_ready`:**  
  *Dieser Lauf bestätigt den Pipeline-/Contract-Pfad für die im Katalog unterstützten Fragen gemäß Bewertungsregeln.*

---

## 10. Offene Punkte (Betrieb & Produkt)

- Lokaler **Ollama** (oder `openai_compat`) zuverlässig erreichbar; Modell lokal installiert.
- Fragen, die Sentinel noch nicht voll abbildet: Katalog erlaubt **Degradation** (`allowDegradation`, `coveredOps` / `missingOps`); reines Legacy ohne Contract bleibt **FAIL**.
- Fehlende Capabilities / `missingOps` in Contracts bei Bedarf in separates Ticket übernehmen.

---

## 11. Ergebnisse archivieren

```bash
cd web
npm run ai:smoke:strategy-thomas 2>&1 | Tee-Object -FilePath ../../docs/ai-smoke-thomas-maissen-last-run.json
```

Projektspezifische JSON-Dateien nicht zwingend ins Repo committen.
