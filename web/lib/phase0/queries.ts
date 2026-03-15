import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUserId, getCeoAccessContext } from "@/lib/ceo/queries";
import { getPlanningCyclesForOrganization } from "@/lib/planning/queries";

export type Phase0Context = {
  organizationId: string;
  membershipId: string;
};

export type OrganizationUnitType = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

export type OrganizationUnit = {
  id: string;
  organization_id: string;
  parent_id: string | null;
  organization_unit_type_id: string;
  code: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  sort_order: number;
  created_at: string;
  updated_at: string;
  unit_type: Pick<OrganizationUnitType, "id" | "code" | "name"> | null;
};

export type Responsible = {
  id: string;
  full_name: string;
  email: string | null;
  role_title: string | null;
  is_active: boolean;
};

const DEFAULT_ORGANIZATION_UNIT_TYPES: Array<
  Pick<OrganizationUnitType, "code" | "name" | "description" | "is_active" | "sort_order">
> = [
  { code: "organization", name: "Organisation", description: "Top-level organizational root", is_active: true, sort_order: 10 },
  { code: "division", name: "Division", description: "Major division or segment", is_active: true, sort_order: 20 },
  { code: "business_unit", name: "Business Unit", description: "Business unit across products or markets", is_active: true, sort_order: 30 },
  { code: "function", name: "Function", description: "Cross-functional capability area", is_active: true, sort_order: 40 },
  { code: "department", name: "Department", description: "Department within a division or function", is_active: true, sort_order: 50 },
  { code: "team", name: "Team", description: "Execution team", is_active: true, sort_order: 60 },
  { code: "program", name: "Program", description: "Program-level coordination entity", is_active: true, sort_order: 70 },
  { code: "region", name: "Region", description: "Geographic entity", is_active: true, sort_order: 80 },
  { code: "legal_entity", name: "Legal Entity", description: "Legal company entity", is_active: true, sort_order: 90 },
];

export async function getPhase0Context(): Promise<Phase0Context | null> {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return null;
  }

  const access = await getCeoAccessContext(userId);
  if (!access) {
    return null;
  }

  return {
    organizationId: access.organizationId,
    membershipId: access.membershipId,
  };
}

export async function getOrganizationUnitTypes(): Promise<OrganizationUnitType[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("app")
    .from("organization_unit_type")
    .select("id, code, name, description, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (!error && (data ?? []).length > 0) {
    return (data ?? []) as OrganizationUnitType[];
  }

  const admin = createSupabaseAdminClient();
  if (admin) {
    await admin.schema("app").from("organization_unit_type").upsert(
      DEFAULT_ORGANIZATION_UNIT_TYPES,
      { onConflict: "code" }
    );
  }

  const { data: retriedData } = await supabase
    .schema("app")
    .from("organization_unit_type")
    .select("id, code, name, description, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  return (retriedData ?? []) as OrganizationUnitType[];
}

export async function getOrganizationUnits(organizationId: string): Promise<OrganizationUnit[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("organization_unit")
    .select(
      "id, organization_id, parent_id, organization_unit_type_id, code, name, description, status, sort_order, created_at, updated_at, unit_type:organization_unit_type_id(id, code, name)"
    )
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const rows = (data ?? []) as Array<
    Omit<OrganizationUnit, "unit_type"> & {
      unit_type:
        | Array<Pick<OrganizationUnitType, "id" | "code" | "name">>
        | Pick<OrganizationUnitType, "id" | "code" | "name">
        | null;
    }
  >;

  return rows.map((row) => ({
    ...row,
    unit_type: Array.isArray(row.unit_type) ? row.unit_type[0] ?? null : row.unit_type ?? null,
  }));
}

export async function getResponsibles(organizationId: string): Promise<Responsible[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("responsibles")
    .select("id, full_name, email, role_title, is_active")
    .eq("organization_id", organizationId)
    .order("full_name", { ascending: true });

  return (data ?? []) as Responsible[];
}

export async function getPlanningCycles(organizationId: string) {
  return getPlanningCyclesForOrganization(organizationId);
}
