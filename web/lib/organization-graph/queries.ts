import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrganizationUnitDimensionLinks } from "@/lib/strategy-dimensions/queries";

export type UnitOverlay = {
  responsibles: string[];
  industries: string[];
  businessModels: string[];
};

export type OrganizationGraphOverlayMap = Record<string, UnitOverlay>;

function ensureUnitOverlay(
  map: OrganizationGraphOverlayMap,
  organizationUnitId: string
): UnitOverlay {
  if (!map[organizationUnitId]) {
    map[organizationUnitId] = {
      responsibles: [],
      industries: [],
      businessModels: [],
    };
  }
  return map[organizationUnitId];
}

export async function getOrganizationGraphOverlays(
  organizationId: string,
  planningCycleId: string | null
): Promise<OrganizationGraphOverlayMap> {
  const supabase = await createSupabaseServerClient();
  const overlays: OrganizationGraphOverlayMap = {};

  const { data: assignmentRows } = await supabase
    .schema("app")
    .from("responsible_assignments")
    .select("organization_unit_id, responsible:responsible_id(full_name)")
    .eq("organization_id", organizationId);
  if ((assignmentRows ?? []).length > 0) {
    for (const row of assignmentRows ?? []) {
      const responsible = Array.isArray(row.responsible) ? row.responsible[0] : row.responsible;
      const fullName = responsible?.full_name?.trim();
      if (!row.organization_unit_id || !fullName) continue;
      const bucket = ensureUnitOverlay(overlays, row.organization_unit_id);
      if (!bucket.responsibles.includes(fullName)) {
        bucket.responsibles.push(fullName);
      }
    }
  } else {
    const { data: legacyAssignmentRows } = await supabase
      .schema("app")
      .from("responsible_assignments")
      .select("org_unit_id, responsible:responsible_id(full_name)")
      .eq("organization_id", organizationId);
    for (const row of legacyAssignmentRows ?? []) {
      const responsible = Array.isArray(row.responsible) ? row.responsible[0] : row.responsible;
      const fullName = responsible?.full_name?.trim();
      if (!row.org_unit_id || !fullName) continue;
      const bucket = ensureUnitOverlay(overlays, row.org_unit_id);
      if (!bucket.responsibles.includes(fullName)) {
        bucket.responsibles.push(fullName);
      }
    }
  }

  if (!planningCycleId) {
    return overlays;
  }

  const dimensionLinks = await getOrganizationUnitDimensionLinks(organizationId, planningCycleId);
  for (const link of dimensionLinks.organizationUnitIndustries) {
    const bucket = ensureUnitOverlay(overlays, link.organization_unit_id);
    if (!bucket.industries.includes(link.industry_name)) {
      bucket.industries.push(link.industry_name);
    }
  }
  for (const link of dimensionLinks.organizationUnitBusinessModels) {
    const bucket = ensureUnitOverlay(overlays, link.organization_unit_id);
    if (!bucket.businessModels.includes(link.business_model_name)) {
      bucket.businessModels.push(link.business_model_name);
    }
  }

  return overlays;
}
