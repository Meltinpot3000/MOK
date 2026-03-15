import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OrganizationUnitDimensionLinks = {
  organizationUnitIndustries: Array<{ organization_unit_id: string; industry_id: string; industry_name: string }>;
  organizationUnitBusinessModels: Array<{
    organization_unit_id: string;
    business_model_id: string;
    business_model_name: string;
  }>;
};

export async function getIndustries(organizationId: string, planningCycleId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("industries")
    .select(
      "id, name, description, market_characteristics, growth_rate, strategic_importance, status, updated_at"
    )
    .eq("organization_id", organizationId)
    .eq("planning_cycle_id", planningCycleId)
    .order("name", { ascending: true });
  return data ?? [];
}

export async function getBusinessModels(organizationId: string, planningCycleId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("business_models")
    .select(
      "id, name, description, status, version_no, customer_segments, value_proposition, channels, customer_relationships, revenue_streams, key_resources, key_activities, key_partners, cost_structure, updated_at"
    )
    .eq("organization_id", organizationId)
    .eq("planning_cycle_id", planningCycleId)
    .order("name", { ascending: true });
  return data ?? [];
}

export async function getOperatingModels(organizationId: string, planningCycleId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("operating_models")
    .select(
      "id, name, description, status, version_no, processes, organization_design, capabilities, technology, data_assets, governance, locations, partners, updated_at"
    )
    .eq("organization_id", organizationId)
    .eq("planning_cycle_id", planningCycleId)
    .order("name", { ascending: true });
  return data ?? [];
}

export async function getDimensionLinks(organizationId: string, planningCycleId: string) {
  const supabase = await createSupabaseServerClient();
  const [
    businessModelIndustries,
    operatingModelIndustries,
    operatingModelBusinessModels,
    strategicDirectionIndustries,
    strategicDirectionBusinessModels,
    strategicDirectionOperatingModels,
    annualTargetIndustries,
    annualTargetBusinessModels,
    annualTargetOperatingModels,
    initiativeIndustries,
    initiativeBusinessModels,
    initiativeOperatingModels,
    strategicDirections,
    annualTargets,
    initiatives,
  ] = await Promise.all([
    supabase
      .schema("app")
      .from("business_model_industries")
      .select("business_model_id, industry_id")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("operating_model_industries")
      .select("operating_model_id, industry_id")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("operating_model_business_models")
      .select("operating_model_id, business_model_id")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("strategic_direction_industries")
      .select("strategic_direction_id, industry_id")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("strategic_direction_business_models")
      .select("strategic_direction_id, business_model_id")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("strategic_direction_operating_models")
      .select("strategic_direction_id, operating_model_id")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("annual_target_industries")
      .select("annual_target_id, industry_id")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("annual_target_business_models")
      .select("annual_target_id, business_model_id")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("annual_target_operating_models")
      .select("annual_target_id, operating_model_id")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("initiative_industries")
      .select("initiative_id, industry_id")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("initiative_business_models")
      .select("initiative_id, business_model_id")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("initiative_operating_models")
      .select("initiative_id, operating_model_id")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("strategic_directions")
      .select("id, title")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId)
      .order("title", { ascending: true }),
    supabase
      .schema("app")
      .from("annual_targets")
      .select("id, title")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId)
      .order("title", { ascending: true }),
    supabase
      .schema("app")
      .from("initiatives")
      .select("id, title")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId)
      .order("title", { ascending: true }),
  ]);

  return {
    businessModelIndustries: businessModelIndustries.data ?? [],
    operatingModelIndustries: operatingModelIndustries.data ?? [],
    operatingModelBusinessModels: operatingModelBusinessModels.data ?? [],
    strategicDirectionIndustries: strategicDirectionIndustries.data ?? [],
    strategicDirectionBusinessModels: strategicDirectionBusinessModels.data ?? [],
    strategicDirectionOperatingModels: strategicDirectionOperatingModels.data ?? [],
    annualTargetIndustries: annualTargetIndustries.data ?? [],
    annualTargetBusinessModels: annualTargetBusinessModels.data ?? [],
    annualTargetOperatingModels: annualTargetOperatingModels.data ?? [],
    initiativeIndustries: initiativeIndustries.data ?? [],
    initiativeBusinessModels: initiativeBusinessModels.data ?? [],
    initiativeOperatingModels: initiativeOperatingModels.data ?? [],
    strategicDirections: strategicDirections.data ?? [],
    annualTargets: annualTargets.data ?? [],
    initiatives: initiatives.data ?? [],
  };
}

export async function getOrganizationUnitDimensionLinks(
  organizationId: string,
  planningCycleId: string
): Promise<OrganizationUnitDimensionLinks> {
  const supabase = await createSupabaseServerClient();
  const [industryLinksRes, businessModelLinksRes] = await Promise.all([
    supabase
      .schema("app")
      .from("organization_unit_industries")
      .select("organization_unit_id, industry_id, industry:industry_id(name)")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
    supabase
      .schema("app")
      .from("organization_unit_business_models")
      .select("organization_unit_id, business_model_id, business_model:business_model_id(name)")
      .eq("organization_id", organizationId)
      .eq("planning_cycle_id", planningCycleId),
  ]);

  const organizationUnitIndustries = (industryLinksRes.data ?? []).map((row) => {
    const industry = Array.isArray(row.industry) ? row.industry[0] : row.industry;
    return {
      organization_unit_id: row.organization_unit_id,
      industry_id: row.industry_id,
      industry_name: industry?.name ?? "Industry",
    };
  });

  const organizationUnitBusinessModels = (businessModelLinksRes.data ?? []).map((row) => {
    const businessModel = Array.isArray(row.business_model) ? row.business_model[0] : row.business_model;
    return {
      organization_unit_id: row.organization_unit_id,
      business_model_id: row.business_model_id,
      business_model_name: businessModel?.name ?? "Business Model",
    };
  });

  return {
    organizationUnitIndustries,
    organizationUnitBusinessModels,
  };
}
