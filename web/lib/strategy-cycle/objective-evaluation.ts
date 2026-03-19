import type { CompanyKennzahlen } from "@/lib/strategy-cycle/company-info";
import type { StrategyReferenceFields } from "@/lib/strategy-cycle/strategy-reference";
import type { CompanyProfileInput, StrategicContextOutput } from "@/lib/analysis-network/objective-evaluation-providers";
import { buildStrategicContextWithLlm } from "@/lib/analysis-network/objective-evaluation-providers";

const REQUIRED_FIELDS = [
  "organization_type",
  "company_size",
  "industry",
  "core_value_creation",
  "regions",
  "revenue_current",
  "revenue_target",
  "transformation_status",
] as const;

export function validateCompanyProfileForEvaluation(
  kennzahlen: CompanyKennzahlen
): string[] {
  const missing: string[] = [];
  const orgType = (kennzahlen.organizationsform || kennzahlen.organizationsform_other || "").trim();
  if (!orgType) missing.push("organization_type");
  if (!(kennzahlen.unternehmensgroesse ?? "").trim()) missing.push("company_size");
  const industry = (kennzahlen.industriekontext || kennzahlen.industriekontext_other || "").trim();
  if (!industry) missing.push("industry");
  if (!(kennzahlen.kern_wertschoepfung ?? "").trim()) missing.push("core_value_creation");
  if (!Array.isArray(kennzahlen.marktregionen) || kennzahlen.marktregionen.length === 0) {
    missing.push("regions");
  }
  if (!(kennzahlen.umsatz_heute ?? "").trim()) missing.push("revenue_current");
  if (!(kennzahlen.umsatz_ziel ?? "").trim()) missing.push("revenue_target");
  if (!(kennzahlen.transformation_status ?? "").trim()) missing.push("transformation_status");
  return missing;
}

export function buildCompanyProfileInput(
  kennzahlen: CompanyKennzahlen,
  strategyRef: StrategyReferenceFields
): CompanyProfileInput {
  const orgType = (kennzahlen.organizationsform || "").trim();
  const orgTypeOther = (kennzahlen.organizationsform_other ?? "").trim();
  const industry = (kennzahlen.industriekontext || "").trim();
  const industryOther = (kennzahlen.industriekontext_other ?? "").trim();
  return {
    organization_type: orgTypeOther ? `${orgType} (${orgTypeOther})` : orgType,
    company_size: (kennzahlen.unternehmensgroesse ?? "").trim(),
    industry: industryOther ? `${industry} (${industryOther})` : industry,
    core_value_creation: (kennzahlen.kern_wertschoepfung ?? "").trim(),
    regions: Array.isArray(kennzahlen.marktregionen) ? kennzahlen.marktregionen : [],
    revenue_current: (kennzahlen.umsatz_heute ?? "").trim(),
    revenue_target: (kennzahlen.umsatz_ziel ?? "").trim(),
    transformation_status: (kennzahlen.transformation_status ?? "").trim(),
    mission: strategyRef.mission ?? "",
    vision: strategyRef.vision ?? "",
    values: strategyRef.values ?? "",
    culture: strategyRef.culture ?? "",
    leadership: strategyRef.leadership ?? "",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClientLike = any;

export async function invalidateStrategicContextCache(
  supabase: SupabaseClientLike,
  organizationId: string
): Promise<void> {
  await supabase
    .schema("app")
    .from("strategic_context_cache")
    .update({ is_current: false })
    .eq("organization_id", organizationId);
}

export async function getOrBuildStrategicContext(input: {
  supabase: SupabaseClientLike;
  organizationId: string;
  companyProfile: CompanyProfileInput;
  maxOutputTokens?: number;
}): Promise<{
  context: StrategicContextOutput;
  contextJson: string;
  fromCache: boolean;
  provider?: string;
  model?: string;
  promptVersion?: string;
}> {
  const { data: cached } = await input.supabase
    .schema("app")
    .from("strategic_context_cache")
    .select("context_json, provider, model, prompt_version")
    .eq("organization_id", input.organizationId)
    .eq("is_current", true)
    .maybeSingle() as { data: { context_json: unknown; provider?: string; model?: string; prompt_version?: string } | null };

  if (cached?.context_json && typeof cached.context_json === "object") {
    const ctx = cached.context_json as StrategicContextOutput;
    return {
      context: ctx,
      contextJson: JSON.stringify(ctx),
      fromCache: true,
      provider: cached.provider,
      model: cached.model,
      promptVersion: cached.prompt_version,
    };
  }

  const response = await buildStrategicContextWithLlm(input.companyProfile, input.maxOutputTokens);
  if (!response.result) {
    throw new Error("Failed to build strategic context");
  }

  const context = response.result;
  const contextJson = JSON.stringify(context);
  const provider = (response as { provider?: string }).provider ?? null;
  const model = (response as { model?: string }).model ?? null;

  const { data: existing } = await input.supabase
    .schema("app")
    .from("strategic_context_cache")
    .select("id")
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (existing) {
    await input.supabase
      .schema("app")
      .from("strategic_context_cache")
      .update({
        context_json: context,
        is_current: true,
        provider,
        model,
        prompt_version: "objective-context-v1",
      })
      .eq("organization_id", input.organizationId);
  } else {
    await input.supabase.schema("app").from("strategic_context_cache").insert({
      organization_id: input.organizationId,
      context_json: context,
      is_current: true,
      provider,
      model,
      prompt_version: "objective-context-v1",
    });
  }

  return {
    context,
    contextJson,
    fromCache: false,
  };
}
