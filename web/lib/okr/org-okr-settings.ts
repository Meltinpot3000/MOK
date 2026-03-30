import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OrgOkrSettings = {
  okrKrOwnerMustMatchObjective: boolean;
  okrReviewNotifyOwnersOnSchedule: boolean;
};

export async function getOrgOkrSettings(organizationId: string): Promise<OrgOkrSettings> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("app")
    .from("organizations")
    .select("okr_kr_owner_must_match_objective, okr_review_notify_owners_on_schedule")
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !data) {
    return { okrKrOwnerMustMatchObjective: false, okrReviewNotifyOwnersOnSchedule: false };
  }
  const row = data as {
    okr_kr_owner_must_match_objective?: boolean;
    okr_review_notify_owners_on_schedule?: boolean;
  };
  return {
    okrKrOwnerMustMatchObjective: Boolean(row.okr_kr_owner_must_match_objective),
    okrReviewNotifyOwnersOnSchedule: Boolean(row.okr_review_notify_owners_on_schedule),
  };
}
