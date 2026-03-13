import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUserId, getCeoAccessContext } from "@/lib/ceo/queries";

export type Phase0Context = {
  organizationId: string;
  membershipId: string;
};

export type OrgUnit = {
  id: string;
  organization_id: string;
  parent_unit_id: string | null;
  level_no: number;
  unit_type: "organization" | "division" | "team";
  code: string;
  name: string;
};

export type Responsible = {
  id: string;
  full_name: string;
  email: string | null;
  role_title: string | null;
  is_active: boolean;
};

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

export async function getOrgUnits(organizationId: string): Promise<OrgUnit[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("org_units")
    .select("id, organization_id, parent_unit_id, level_no, unit_type, code, name")
    .eq("organization_id", organizationId)
    .order("level_no", { ascending: true })
    .order("name", { ascending: true });

  return (data ?? []) as OrgUnit[];
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
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("planning_cycles")
    .select("id, code, name, start_date, end_date, status, source_cycle_id, clone_type, cloned_at")
    .eq("organization_id", organizationId)
    .order("start_date", { ascending: false });

  return data ?? [];
}
