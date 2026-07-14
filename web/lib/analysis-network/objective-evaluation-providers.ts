import type { LlmScoreResponse, LlmUsage } from "./providers";
import { invokeLlmForJson } from "./providers";

export const STRATEGIC_CONTEXT_PROMPT_VERSION = "objective-context-v3-de-detailed";
export const OBJECTIVE_EVAL_PROMPT_VERSION = "objective-eval-v2-de";
export const PORTFOLIO_EVAL_PROMPT_VERSION = "objective-portfolio-v2-de";

export type CompanyProfileInput = {
  organization_type: string;
  company_size: string;
  industry: string;
  core_value_creation: string;
  key_product_or_service: string;
  regions: string[];
  revenue_current: string;
  revenue_target: string;
  transformation_status: string;
  mission: string;
  vision: string;
  values: string;
  culture: string;
  leadership: string;
};

export type StrategicContextOutput = {
  company_type: string;
  scale: string;
  industry_context: string;
  value_creation_logic: string;
  market_scope: string;
  growth_ambition: string;
  transformation_pressure: string;
  strategic_implications: string[];
};

export type ObjectiveEvaluationOutput = {
  clarity_score: number;
  strategic_relevance_score: number;
  feasibility_score: number;
  fit_to_company_score: number;
  dimension_classification: {
    external_internal: string;
    short_long_term: string;
    exploit_explore: string;
  };
  issues: string[];
  improvement_suggestion: string;
  confidence: number;
};

export type PortfolioEvaluationOutput = {
  balance_score: number;
  distribution: Record<string, unknown>;
  gaps: string[];
  risks: string[];
  recommendation: string;
};

function clampScore(value: number, min = 1, max = 5): number {
  if (!Number.isFinite(value)) return 3;
  return Math.round(Math.max(min, Math.min(max, value)));
}

function strategicContextFromRecord(json: Record<string, unknown>): StrategicContextOutput {
  const implications = Array.isArray(json.strategic_implications)
    ? (json.strategic_implications as unknown[]).map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
  return {
    company_type: String(json.company_type ?? "").trim().slice(0, 500),
    scale: String(json.scale ?? "").trim().slice(0, 300),
    industry_context: String(json.industry_context ?? "").trim().slice(0, 800),
    value_creation_logic: String(json.value_creation_logic ?? "").trim().slice(0, 800),
    market_scope: String(json.market_scope ?? "").trim().slice(0, 500),
    growth_ambition: String(json.growth_ambition ?? "").trim().slice(0, 500),
    transformation_pressure: String(json.transformation_pressure ?? "").trim().slice(0, 500),
    strategic_implications: implications.map((line) => line.slice(0, 600)).slice(0, 18),
  };
}

function parseStrategicContextJson(raw: string): StrategicContextOutput | null {
  try {
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first < 0 || last <= first) return null;
    const json = JSON.parse(raw.slice(first, last + 1)) as Record<string, unknown>;
    return strategicContextFromRecord(json);
  } catch {
    return null;
  }
}

/** DB `context_json` (jsonb) oder LLM-Rohtext zu strukturierter Ausgabe. */
export function coerceStrategicContextOutput(raw: unknown): StrategicContextOutput | null {
  if (typeof raw === "string") return parseStrategicContextJson(raw);
  if (!raw || typeof raw !== "object") return null;
  return strategicContextFromRecord(raw as Record<string, unknown>);
}

function parseObjectiveEvaluationJson(raw: string): ObjectiveEvaluationOutput | null {
  try {
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first < 0 || last <= first) return null;
    const json = JSON.parse(raw.slice(first, last + 1)) as Record<string, unknown>;
    const dim = (json.dimension_classification as Record<string, unknown>) ?? {};
    const issues = Array.isArray(json.issues) ? (json.issues as unknown[]).map(String).filter(Boolean) : [];
    const extInt = ["internal", "external", "balanced"].includes(String(dim.external_internal ?? ""))
      ? String(dim.external_internal)
      : "balanced";
    const shortLong = ["short", "mid", "long"].includes(String(dim.short_long_term ?? ""))
      ? String(dim.short_long_term)
      : "mid";
    const exploitExplore = ["exploit", "explore", "balanced"].includes(String(dim.exploit_explore ?? ""))
      ? String(dim.exploit_explore)
      : "balanced";
    return {
      clarity_score: clampScore(Number(json.clarity_score ?? 3)),
      strategic_relevance_score: clampScore(Number(json.strategic_relevance_score ?? 3)),
      feasibility_score: clampScore(Number(json.feasibility_score ?? 3)),
      fit_to_company_score: clampScore(Number(json.fit_to_company_score ?? 3)),
      dimension_classification: {
        external_internal: extInt,
        short_long_term: shortLong,
        exploit_explore: exploitExplore,
      },
      issues: issues.slice(0, 10),
      improvement_suggestion: String(json.improvement_suggestion ?? "").trim().slice(0, 500),
      confidence: clampScore(Number(json.confidence ?? 3)),
    };
  } catch {
    return null;
  }
}

function parsePortfolioEvaluationJson(raw: string): PortfolioEvaluationOutput | null {
  try {
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first < 0 || last <= first) return null;
    const json = JSON.parse(raw.slice(first, last + 1)) as Record<string, unknown>;
    const gaps = Array.isArray(json.gaps) ? (json.gaps as unknown[]).map(String).filter(Boolean) : [];
    const risks = Array.isArray(json.risks) ? (json.risks as unknown[]).map(String).filter(Boolean) : [];
    const dist = json.distribution && typeof json.distribution === "object" ? (json.distribution as Record<string, unknown>) : {};
    return {
      balance_score: clampScore(Number(json.balance_score ?? 3)),
      distribution: dist,
      gaps: gaps.slice(0, 10),
      risks: risks.slice(0, 10),
      recommendation: String(json.recommendation ?? "").trim().slice(0, 1000),
    };
  } catch {
    return null;
  }
}

function buildStrategicContextPrompt(profile: CompanyProfileInput): string {
  return `Unternehmensdaten (vollstaendiger Rohinput — alle Felder fuer die Synthese nutzen):

Organisationstyp: ${profile.organization_type}
Unternehmensgroesse (Mitarbeitende): ${profile.company_size}
Branche / Industriekontext: ${profile.industry}
Kern-Wertschoepfung: ${profile.core_value_creation}
Wichtigstes Produkt oder Dienstleistung: ${profile.key_product_or_service || "—"}
Marktregionen: ${profile.regions.join(", ") || "—"}
Umsatz heute: ${profile.revenue_current}
Umsatz-Ziel (Ende Strategiezyklus): ${profile.revenue_target}
Transformationsstatus: ${profile.transformation_status}

Strategiereferenz:
Mission: ${profile.mission || "—"}
Vision: ${profile.vision || "—"}
Werte: ${profile.values || "—"}
Kultur: ${profile.culture || "—"}
Leadership: ${profile.leadership || "—"}

---

Erstelle eine **ausfuehrliche** strategische Kontext-Zusammenfassung fuer Sentinel-Ziel-Bewertungen.
Antworte ausschliesslich mit validem JSON. Alle Textinhalte auf Deutsch.

Anforderungen an Tiefe und Umfang (mindestens einhalten):
- Jedes String-Feld: **2–4 vollstaendige Saetze** mit strategischer Interpretation (nicht nur Stichworte, nicht nur Eingaben umformulieren).
- Synthese aus **allen** Kennwerten **und** der Strategiereferenz (Mission, Vision, Werte, Kultur, Leadership) — auch wenn einzelne Texte kurz sind, Bedeutung ableiten.
- **strategic_implications**: **8–14** Eintraege; jeder Eintrag **1–2 Saetze** mit konkreter strategischer Konsequenz fuer Zielsetzung, Portfolio und Umsetzung.
- Keine leeren Felder. Keine generischen Floskeln ohne Bezug zum Unternehmen.

Schema (Schluessel exakt so):
{"company_type":"...","scale":"...","industry_context":"...","value_creation_logic":"...","market_scope":"...","growth_ambition":"...","transformation_pressure":"...","strategic_implications":["...","..."]}`;
}

/** Strategische Kontext-Zusammenfassung braucht deutlich mehr Output-Tokens als Einzelbewertungen. */
const STRATEGIC_CONTEXT_MIN_OUTPUT_TOKENS = 1600;

function buildObjectiveEvalPrompt(contextJson: string, objectiveTitle: string, objectiveDescription: string): string {
  return `Strategischer Kontext (JSON):
${contextJson}

Objective:
Titel: ${objectiveTitle}
Beschreibung: ${objectiveDescription}

---

Bewerte dieses Objective im Kontext des Unternehmens. Antworte nur mit validem JSON.

Skala 1–5: Nutze die **volle Bandbreite**. Die Zahl 3 ist nur fuer **durchschnittliche, klar mittlere** Erfuellung; vermeide es, alles pauschal mit 3 zu bewerten. Setze 1–2 oder 4–5, wenn die Begruendung das traeft. Begruende implizit durch konsistente Teilscores.

Freitext **issues** (kurze Saetze) und **improvement_suggestion** auf **Deutsch**.

Schema (Schluessel exakt so, Zahlen ganzzahlig 1–5): {"clarity_score":1-5,"strategic_relevance_score":1-5,"feasibility_score":1-5,"fit_to_company_score":1-5,"dimension_classification":{"external_internal":"internal|external|balanced","short_long_term":"short|mid|long","exploit_explore":"exploit|explore|balanced"},"issues":["..."],"improvement_suggestion":"...","confidence":1-5}`;
}

function buildPortfolioEvalPrompt(objectivesWithClassifications: string): string {
  return `Objectives mit Klassifikation:
${objectivesWithClassifications}

---

Bewerte das Portfolio (Balance, Lücken, Risiken). Antworte nur mit validem JSON. **gaps**, **risks** und **recommendation** auf **Deutsch**. balance_score 1–5 mit gleicher Kalibrierung wie bei Einzelbewertungen (3 = klar mittel, nicht Default).
Schema: {"balance_score":1-5,"distribution":{},"gaps":["..."],"risks":["..."],"recommendation":"..."}`;
}

export type StrategicContextLlmResult = StrategicContextOutput & {
  provider: string;
  model: string;
  promptVersion: string;
};

export async function buildStrategicContextWithLlm(
  profile: CompanyProfileInput,
  maxOutputTokens?: number
): Promise<LlmScoreResponse<StrategicContextOutput> & { provider?: string; model?: string }> {
  const systemPrompt =
    "You are a senior strategy consultant. Synthesize ALL provided company data and strategy reference texts into a detailed, comprehensive strategic context profile for downstream objective evaluation. Be substantive and specific to this company. Infer strategic meaning; do not merely compress inputs into short labels. Return only valid JSON.";
  const userPrompt = buildStrategicContextPrompt(profile);
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
  const outputTokenBudget = Math.max(maxOutputTokens ?? 600, STRATEGIC_CONTEXT_MIN_OUTPUT_TOKENS);
  const result = await invokeLlmForJson(fullPrompt, outputTokenBudget);
  if (!result) return { result: null, usage: null };
  const parsed = parseStrategicContextJson(result.text);
  if (!parsed) return { result: null, usage: result.usage };
  return {
    result: parsed,
    usage: result.usage,
    provider: result.provider,
    model: result.model,
  };
}

export async function evaluateObjectiveWithLlm(
  contextJson: string,
  objective: { title: string; description: string | null },
  maxOutputTokens?: number
): Promise<LlmScoreResponse<ObjectiveEvaluationOutput> & { provider?: string; model?: string }> {
  const systemPrompt = `Du bist ein Strategie-Expert:in und bewertest strategische Objectives. Bewerte streng im Kontext des Unternehmens — nicht generisch. Kritisch aber konstruktiv. Ordne die Dimensionen ein und bewerte Klaerheit, strategische Relevanz, Machbarkeit und Passung zum Unternehmen. Nur strukturiertes JSON; Freitextfelder auf Deutsch.`;
  const userPrompt = buildObjectiveEvalPrompt(
    contextJson,
    objective.title,
    objective.description ?? ""
  );
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
  const result = await invokeLlmForJson(fullPrompt, maxOutputTokens);
  if (!result) return { result: null, usage: null };
  const parsed = parseObjectiveEvaluationJson(result.text);
  if (!parsed) return { result: null, usage: result.usage };
  return {
    result: parsed,
    usage: result.usage,
    provider: result.provider,
    model: result.model,
  };
}

export async function evaluateObjectivePortfolioWithLlm(
  objectivesWithClassifications: string,
  maxOutputTokens?: number
): Promise<LlmScoreResponse<PortfolioEvaluationOutput> & { provider?: string; model?: string }> {
  const systemPrompt = `Du bist Strategieberater:in und bewertest ein Portfolio von Objectives. Beurteile Balance (intern/extern, exploit/explore, kurz/mittel/lang), Lücken und Risiken. Nur strukturiertes JSON; Texte auf Deutsch.`;
  const userPrompt = buildPortfolioEvalPrompt(objectivesWithClassifications);
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
  const result = await invokeLlmForJson(fullPrompt, maxOutputTokens);
  if (!result) return { result: null, usage: null };
  const parsed = parsePortfolioEvaluationJson(result.text);
  if (!parsed) return { result: null, usage: result.usage };
  return {
    result: parsed,
    usage: result.usage,
    provider: result.provider,
    model: result.model,
  };
}
