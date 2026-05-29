import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MemberNotificationRow = {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  key_result_id: string | null;
  created_at: string;
  read_at: string | null;
};

export const getUnreadMemberNotificationCount = cache(
  async (organizationId: string, membershipId: string): Promise<number> => {
    const supabase = await createSupabaseServerClient();
    const { count, error } = await supabase
      .schema("app")
      .from("member_notifications")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("recipient_membership_id", membershipId)
      .is("read_at", null);

    if (error) return 0;
    return count ?? 0;
  }
);

export async function fetchRecentMemberNotifications(
  organizationId: string,
  membershipId: string,
  limit = 20
): Promise<MemberNotificationRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("app")
    .from("member_notifications")
    .select("id, notification_type, title, body, key_result_id, created_at, read_at")
    .eq("organization_id", organizationId)
    .eq("recipient_membership_id", membershipId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as MemberNotificationRow[];
}
