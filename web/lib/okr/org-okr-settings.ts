import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OrgOkrSettings = {
  okrKrOwnerMustMatchObjective: boolean;
};

export async function getOrgOkrSettings(organizationId: string): Promise<OrgOkrSettings> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("app")
    .from("organizations")
    .select("okr_kr_owner_must_match_objective")
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !data) {
    return { okrKrOwnerMustMatchObjective: false };
  }
  const row = data as { okr_kr_owner_must_match_objective?: boolean };
  return { okrKrOwnerMustMatchObjective: Boolean(row.okr_kr_owner_must_match_objective) };
}
