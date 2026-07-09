import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeKeyResultProgress, type KeyResultRow } from "@/lib/review/key-result-progress";

export type KeyResultTargetLinkRow = {
  key_result_id: string;
  annual_target_id: string;
  contribution_level?: string | null;
};

export type KeyResultProgressRow = {
  id: string;
  title: string;
  progressPercent: number;
};

/** Key Results, die per Traceability an Jahresziele des Strategiezyklus hängen. */
export async function fetchKeyResultProgressForPlanningCycle(
  organizationId: string,
  planningCycleId: string | null | undefined
): Promise<{
  keyResultTargetLinks: KeyResultTargetLinkRow[];
  keyResults: KeyResultProgressRow[];
}> {
  if (!planningCycleId) {
    return { keyResultTargetLinks: [], keyResults: [] };
  }

  const supabase = await createSupabaseServerClient();
  const { data: links } = await supabase
    .schema("app")
    .from("key_result_target_links")
    .select("key_result_id, annual_target_id, contribution_level")
    .eq("organization_id", organizationId)
    .eq("planning_cycle_id", planningCycleId);

  const keyResultTargetLinks = (links ?? []) as KeyResultTargetLinkRow[];
  const krIds = [...new Set(keyResultTargetLinks.map((l) => l.key_result_id))];
  if (krIds.length === 0) {
    return { keyResultTargetLinks, keyResults: [] };
  }

  const { data: krRows } = await supabase
    .schema("app")
    .from("key_results")
    .select("id, title, metric_type, start_value, target_value, current_value")
    .eq("organization_id", organizationId)
    .in("id", krIds);

  const keyResults: KeyResultProgressRow[] = (krRows ?? []).map((row) => {
    const r = row as KeyResultRow & { title: string };
    return {
      id: r.id,
      title: r.title,
      progressPercent: Math.round(computeKeyResultProgress(r)),
    };
  });

  return { keyResultTargetLinks, keyResults };
}
