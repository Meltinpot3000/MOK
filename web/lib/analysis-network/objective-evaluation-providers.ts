import type { LlmScoreResponse, LlmUsage } from "./providers";
import { invokeLlmForJson } from "./providers";

const STRATEGIC_CONTEXT_PROMPT_VERSION = "objective-context-v1";
const OBJECTIVE_EVAL_PROMPT_VERSION = "objective-eval-v1";
const PORTFOLIO_EVAL_PROMPT_VERSION = "objective-portfolio-v1";

export type CompanyProfileInput = {
  organization_type: string;
  company_size: string;
  industry: string;
  core_value_creation: string;
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

function parseStrategicContextJson(raw: string): StrategicContextOutput | null {
  try {
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first < 0 || last <= first) return null;
    const json = JSON.parse(raw.slice(first, last + 1)) as Record<string, unknown>;
    const implications = Array.isArray(json.strategic_implications)
      ? (json.strategic_implications as unknown[]).map(String).filter(Boolean)
      : [];
    return {
      company_type: String(json.company_type ?? "").trim().slice(0, 200),
      scale: String(json.scale ?? "").trim().slice(0, 100),
      industry_context: String(json.industry_context ?? "").trim().slice(0, 400),
      value_creation_logic: String(json.value_creation_logic ?? "").trim().slice(0, 400),
      market_scope: String(json.market_scope ?? "").trim().slice(0, 200),
      growth_ambition: String(json.growth_ambition ?? "").trim().slice(0, 200),
      transformation_pressure: String(json.transformation_pressure ?? "").trim().slice(0, 200),
      strategic_implications: implications.slice(0, 10),
    };
  } catch {
    return null;
  }
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
  const userPrompt = `Company Information:

Organization Type: ${profile.organization_type}
Company Size: ${profile.company_size}
Industry: ${profile.industry}
Core Value Creation: ${profile.core_value_creation}
Regions: ${profile.regions.join(", ") || "—"}
Revenue Current: ${profile.revenue_current}
Revenue Target: ${profile.revenue_target}
Transformation Status: ${profile.transformation_status}

Mission: ${profile.mission || "—"}
Vision: ${profile.vision || "—"}
Values: ${profile.values || "—"}
Culture: ${profile.culture || "—"}
Leadership: ${profile.leadership || "—"}

---

Create a strategic context profile in JSON format.
Schema: {"company_type":"...","scale":"...","industry_context":"...","value_creation_logic":"...","market_scope":"...","growth_ambition":"...","transformation_pressure":"...","strategic_implications":["..."]}`;
  return userPrompt;
}

function buildObjectiveEvalPrompt(contextJson: string, objectiveTitle: string, objectiveDescription: string): string {
  return `Strategic Context:
${contextJson}

Objective:
Title: ${objectiveTitle}
Description: ${objectiveDescription}

---

Evaluate this objective. Return JSON only.
Schema: {"clarity_score":1-5,"strategic_relevance_score":1-5,"feasibility_score":1-5,"fit_to_company_score":1-5,"dimension_classification":{"external_internal":"internal|external|balanced","short_long_term":"short|mid|long","exploit_explore":"exploit|explore|balanced"},"issues":["..."],"improvement_suggestion":"...","confidence":1-5}`;
}

function buildPortfolioEvalPrompt(objectivesWithClassifications: string): string {
  return `Objectives:
${objectivesWithClassifications}

---

Evaluate the portfolio. Return JSON only.
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
    "You are a senior strategy consultant. Translate structured company information into a concise strategic context profile. Focus on growth ambition, transformation pressure, strategic implications, business model logic. Do NOT repeat inputs. Infer meaning. Be precise and structured. Return only valid JSON.";
  const userPrompt = buildStrategicContextPrompt(profile);
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
  const result = await invokeLlmForJson(fullPrompt, maxOutputTokens);
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
  const systemPrompt = `You are a strategy expert evaluating strategic objectives. Evaluate the objective strictly in the context of the company. Do NOT be generic. Be critical but constructive. Classify the objective across strategic dimensions and assess clarity, strategic relevance, feasibility, fit to company. Return structured JSON only.`;
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
  const systemPrompt = `You are a strategy advisor evaluating a portfolio of objectives. Assess balance across internal vs external, exploit vs explore, short vs long term. Identify gaps, risks, and imbalance. Return structured JSON only.`;
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
