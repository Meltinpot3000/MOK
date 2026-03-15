"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPhase0Context, getPlanningCycles } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type WorkspaceContext = {
  organizationId: string;
  membershipId: string;
  cycleId: string;
};

async function getWorkspaceContextOrRedirect(
  itemId:
    | "organization"
    | "strategic-directions"
    | "annual-targets"
    | "initiatives"
): Promise<WorkspaceContext> {
  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  const access = await getSidebarAccessContext(itemId);
  if (access.state !== "ok" || !access.canWrite) redirect("/no-access");
  const cycles = await getPlanningCycles(context.organizationId);
  const cycle = cycles[0];
  if (!cycle) redirect("/planning-cycles");
  return {
    organizationId: context.organizationId,
    membershipId: context.membershipId,
    cycleId: cycle.id,
  };
}

function done(path: string): never {
  revalidatePath("/industries");
  revalidatePath("/business-models");
  revalidatePath("/operating-models");
  revalidatePath("/organization");
  revalidatePath("/responsibles");
  redirect(path);
}

function parseListField(raw: FormDataEntryValue | null): unknown[] {
  const value = String(raw ?? "").trim();
  if (!value) return [];
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => ({ text: item }));
}

export async function createIndustry(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect("organization");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) done("/industries?error=missing-name");
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("industries").insert({
    organization_id: context.organizationId,
    planning_cycle_id: context.cycleId,
    name,
    description: String(formData.get("description") ?? "").trim() || null,
    market_characteristics: String(formData.get("market_characteristics") ?? "").trim() || null,
    growth_rate: Number(formData.get("growth_rate") ?? 0) || null,
    strategic_importance: String(formData.get("strategic_importance") ?? "medium"),
    status: String(formData.get("status") ?? "active"),
    created_by_membership_id: context.membershipId,
  });
  done("/industries?success=saved");
}

export async function createBusinessModel(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect("organization");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) done("/business-models?error=missing-name");
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("business_models").insert({
    organization_id: context.organizationId,
    planning_cycle_id: context.cycleId,
    name,
    description: String(formData.get("description") ?? "").trim() || null,
    status: String(formData.get("status") ?? "active"),
    version_no: Number(formData.get("version_no") ?? 1) || 1,
    customer_segments: parseListField(formData.get("customer_segments")),
    value_proposition: parseListField(formData.get("value_proposition")),
    channels: parseListField(formData.get("channels")),
    customer_relationships: parseListField(formData.get("customer_relationships")),
    revenue_streams: parseListField(formData.get("revenue_streams")),
    key_resources: parseListField(formData.get("key_resources")),
    key_activities: parseListField(formData.get("key_activities")),
    key_partners: parseListField(formData.get("key_partners")),
    cost_structure: parseListField(formData.get("cost_structure")),
    created_by_membership_id: context.membershipId,
  });
  done("/business-models?success=saved");
}

export async function createOperatingModel(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect("organization");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) done("/operating-models?error=missing-name");
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("operating_models").insert({
    organization_id: context.organizationId,
    planning_cycle_id: context.cycleId,
    name,
    description: String(formData.get("description") ?? "").trim() || null,
    status: String(formData.get("status") ?? "active"),
    version_no: Number(formData.get("version_no") ?? 1) || 1,
    processes: parseListField(formData.get("processes")),
    organization_design: parseListField(formData.get("organization_design")),
    capabilities: parseListField(formData.get("capabilities")),
    technology: parseListField(formData.get("technology")),
    data_assets: parseListField(formData.get("data_assets")),
    governance: parseListField(formData.get("governance")),
    locations: parseListField(formData.get("locations")),
    partners: parseListField(formData.get("partners")),
    created_by_membership_id: context.membershipId,
  });
  done("/operating-models?success=saved");
}

export async function linkBusinessModelToIndustry(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect("organization");
  const businessModelId = String(formData.get("business_model_id") ?? "");
  const industryId = String(formData.get("industry_id") ?? "");
  if (!businessModelId || !industryId) done("/business-models?error=missing-link");
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("business_model_industries").upsert(
    {
      organization_id: context.organizationId,
      planning_cycle_id: context.cycleId,
      business_model_id: businessModelId,
      industry_id: industryId,
    },
    { onConflict: "planning_cycle_id,business_model_id,industry_id" }
  );
  done("/business-models?success=linked");
}

export async function linkIndustryToOrganizationUnit(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect("organization");
  const industryId = String(formData.get("industry_id") ?? "");
  const organizationUnitId = String(formData.get("organization_unit_id") ?? "");
  if (!industryId || !organizationUnitId) done("/industries?error=missing-link");
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("organization_unit_industries").upsert(
    {
      organization_id: context.organizationId,
      planning_cycle_id: context.cycleId,
      industry_id: industryId,
      organization_unit_id: organizationUnitId,
    },
    { onConflict: "planning_cycle_id,organization_unit_id,industry_id" }
  );
  done("/industries?success=linked");
}

export async function unlinkIndustryFromOrganizationUnit(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect("organization");
  const industryId = String(formData.get("industry_id") ?? "");
  const organizationUnitId = String(formData.get("organization_unit_id") ?? "");
  if (!industryId || !organizationUnitId) done("/industries?error=missing-link");
  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("organization_unit_industries")
    .delete()
    .eq("organization_id", context.organizationId)
    .eq("planning_cycle_id", context.cycleId)
    .eq("industry_id", industryId)
    .eq("organization_unit_id", organizationUnitId);
  done("/industries?success=unlinked");
}

export async function linkBusinessModelToOrganizationUnit(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect("organization");
  const businessModelId = String(formData.get("business_model_id") ?? "");
  const organizationUnitId = String(formData.get("organization_unit_id") ?? "");
  if (!businessModelId || !organizationUnitId) done("/business-models?error=missing-link");
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("organization_unit_business_models").upsert(
    {
      organization_id: context.organizationId,
      planning_cycle_id: context.cycleId,
      business_model_id: businessModelId,
      organization_unit_id: organizationUnitId,
    },
    { onConflict: "planning_cycle_id,organization_unit_id,business_model_id" }
  );
  done("/business-models?success=linked");
}

export async function unlinkBusinessModelFromOrganizationUnit(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect("organization");
  const businessModelId = String(formData.get("business_model_id") ?? "");
  const organizationUnitId = String(formData.get("organization_unit_id") ?? "");
  if (!businessModelId || !organizationUnitId) done("/business-models?error=missing-link");
  const supabase = await createSupabaseServerClient();
  await supabase
    .schema("app")
    .from("organization_unit_business_models")
    .delete()
    .eq("organization_id", context.organizationId)
    .eq("planning_cycle_id", context.cycleId)
    .eq("business_model_id", businessModelId)
    .eq("organization_unit_id", organizationUnitId);
  done("/business-models?success=unlinked");
}

export async function linkOperatingModelToBusinessModel(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect("organization");
  const operatingModelId = String(formData.get("operating_model_id") ?? "");
  const businessModelId = String(formData.get("business_model_id") ?? "");
  if (!operatingModelId || !businessModelId) done("/operating-models?error=missing-link");
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("operating_model_business_models").upsert(
    {
      organization_id: context.organizationId,
      planning_cycle_id: context.cycleId,
      operating_model_id: operatingModelId,
      business_model_id: businessModelId,
    },
    { onConflict: "planning_cycle_id,operating_model_id,business_model_id" }
  );
  done("/operating-models?success=linked");
}

export async function linkOperatingModelToIndustry(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect("organization");
  const operatingModelId = String(formData.get("operating_model_id") ?? "");
  const industryId = String(formData.get("industry_id") ?? "");
  if (!operatingModelId || !industryId) done("/operating-models?error=missing-link");
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("operating_model_industries").upsert(
    {
      organization_id: context.organizationId,
      planning_cycle_id: context.cycleId,
      operating_model_id: operatingModelId,
      industry_id: industryId,
    },
    { onConflict: "planning_cycle_id,operating_model_id,industry_id" }
  );
  done("/operating-models?success=linked");
}

export async function linkStrategicDirectionToIndustry(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect("strategic-directions");
  const strategicDirectionId = String(formData.get("strategic_direction_id") ?? "");
  const industryId = String(formData.get("industry_id") ?? "");
  if (!strategicDirectionId || !industryId) done("/strategic-directions?error=missing-link");
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("strategic_direction_industries").upsert(
    {
      organization_id: context.organizationId,
      planning_cycle_id: context.cycleId,
      strategic_direction_id: strategicDirectionId,
      industry_id: industryId,
    },
    { onConflict: "planning_cycle_id,strategic_direction_id,industry_id" }
  );
  done("/strategic-directions?success=linked");
}

export async function linkStrategicDirectionToBusinessModel(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect("strategic-directions");
  const strategicDirectionId = String(formData.get("strategic_direction_id") ?? "");
  const businessModelId = String(formData.get("business_model_id") ?? "");
  if (!strategicDirectionId || !businessModelId) done("/strategic-directions?error=missing-link");
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("strategic_direction_business_models").upsert(
    {
      organization_id: context.organizationId,
      planning_cycle_id: context.cycleId,
      strategic_direction_id: strategicDirectionId,
      business_model_id: businessModelId,
    },
    { onConflict: "planning_cycle_id,strategic_direction_id,business_model_id" }
  );
  done("/strategic-directions?success=linked");
}

export async function linkStrategicDirectionToOperatingModel(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect("strategic-directions");
  const strategicDirectionId = String(formData.get("strategic_direction_id") ?? "");
  const operatingModelId = String(formData.get("operating_model_id") ?? "");
  if (!strategicDirectionId || !operatingModelId) done("/strategic-directions?error=missing-link");
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("strategic_direction_operating_models").upsert(
    {
      organization_id: context.organizationId,
      planning_cycle_id: context.cycleId,
      strategic_direction_id: strategicDirectionId,
      operating_model_id: operatingModelId,
    },
    { onConflict: "planning_cycle_id,strategic_direction_id,operating_model_id" }
  );
  done("/strategic-directions?success=linked");
}

export async function linkAnnualTargetToIndustry(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect("annual-targets");
  const annualTargetId = String(formData.get("annual_target_id") ?? "");
  const industryId = String(formData.get("industry_id") ?? "");
  if (!annualTargetId || !industryId) done("/annual-targets?error=missing-link");
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("annual_target_industries").upsert(
    {
      organization_id: context.organizationId,
      planning_cycle_id: context.cycleId,
      annual_target_id: annualTargetId,
      industry_id: industryId,
    },
    { onConflict: "planning_cycle_id,annual_target_id,industry_id" }
  );
  done("/annual-targets?success=linked");
}

export async function linkAnnualTargetToBusinessModel(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect("annual-targets");
  const annualTargetId = String(formData.get("annual_target_id") ?? "");
  const businessModelId = String(formData.get("business_model_id") ?? "");
  if (!annualTargetId || !businessModelId) done("/annual-targets?error=missing-link");
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("annual_target_business_models").upsert(
    {
      organization_id: context.organizationId,
      planning_cycle_id: context.cycleId,
      annual_target_id: annualTargetId,
      business_model_id: businessModelId,
    },
    { onConflict: "planning_cycle_id,annual_target_id,business_model_id" }
  );
  done("/annual-targets?success=linked");
}

export async function linkAnnualTargetToOperatingModel(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect("annual-targets");
  const annualTargetId = String(formData.get("annual_target_id") ?? "");
  const operatingModelId = String(formData.get("operating_model_id") ?? "");
  if (!annualTargetId || !operatingModelId) done("/annual-targets?error=missing-link");
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("annual_target_operating_models").upsert(
    {
      organization_id: context.organizationId,
      planning_cycle_id: context.cycleId,
      annual_target_id: annualTargetId,
      operating_model_id: operatingModelId,
    },
    { onConflict: "planning_cycle_id,annual_target_id,operating_model_id" }
  );
  done("/annual-targets?success=linked");
}

export async function linkInitiativeToIndustry(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect("initiatives");
  const initiativeId = String(formData.get("initiative_id") ?? "");
  const industryId = String(formData.get("industry_id") ?? "");
  if (!initiativeId || !industryId) done("/initiatives?error=missing-link");
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("initiative_industries").upsert(
    {
      organization_id: context.organizationId,
      planning_cycle_id: context.cycleId,
      initiative_id: initiativeId,
      industry_id: industryId,
    },
    { onConflict: "planning_cycle_id,initiative_id,industry_id" }
  );
  done("/initiatives?success=linked");
}

export async function linkInitiativeToBusinessModel(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect("initiatives");
  const initiativeId = String(formData.get("initiative_id") ?? "");
  const businessModelId = String(formData.get("business_model_id") ?? "");
  if (!initiativeId || !businessModelId) done("/initiatives?error=missing-link");
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("initiative_business_models").upsert(
    {
      organization_id: context.organizationId,
      planning_cycle_id: context.cycleId,
      initiative_id: initiativeId,
      business_model_id: businessModelId,
    },
    { onConflict: "planning_cycle_id,initiative_id,business_model_id" }
  );
  done("/initiatives?success=linked");
}

export async function linkInitiativeToOperatingModel(formData: FormData) {
  const context = await getWorkspaceContextOrRedirect("initiatives");
  const initiativeId = String(formData.get("initiative_id") ?? "");
  const operatingModelId = String(formData.get("operating_model_id") ?? "");
  if (!initiativeId || !operatingModelId) done("/initiatives?error=missing-link");
  const supabase = await createSupabaseServerClient();
  await supabase.schema("app").from("initiative_operating_models").upsert(
    {
      organization_id: context.organizationId,
      planning_cycle_id: context.cycleId,
      initiative_id: initiativeId,
      operating_model_id: operatingModelId,
    },
    { onConflict: "planning_cycle_id,initiative_id,operating_model_id" }
  );
  done("/initiatives?success=linked");
}
