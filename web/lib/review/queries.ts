import { createSupabaseServerClient } from "@/lib/supabase/server";

export {
  getReviewCycleData,
  type ReviewCycleData,
  type ReviewCycleAnnualTargetBrief,
} from "./review-cycle-data";

export async function getReviewSnapshots(
  organizationId: string,
  cycleInstanceId: string,
  limit = 10
) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("review_snapshots")
    .select("id, snapshot_type, snapshot_at, summary_json, comment, created_by_membership_id")
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .order("snapshot_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getReviewFeedback(
  organizationId: string,
  cycleInstanceId: string,
  objectType?: string,
  objectId?: string
) {
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .schema("app")
    .from("review_feedback")
    .select("id, feedback_type, object_type, object_id, comment, created_at, created_by_membership_id")
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .order("created_at", { ascending: false });
  if (objectType && objectId) {
    q = q.eq("object_type", objectType).eq("object_id", objectId);
  }
  const { data } = await q;
  return data ?? [];
}
