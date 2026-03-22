import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OkrUpdateRow } from "@/lib/review/key-result-progress";
import { getOkrPlanningWorkspaceData, type OkrPlanningWorkspaceData } from "@/lib/okr/planning-data";
import { initiativeWarningNoKeyResultLink, type InitiativeKrLinkRow } from "@/lib/okr/okr-planning-view-model";
import {
  buildOkrObjectiveView,
  computeOkrCycleKpis,
  type OkrCycleKpis,
  type OkrObjectiveView,
} from "@/lib/okr/okr-cycle-view-model";

export type OkrReviewRow = {
  id: string;
  summary: string | null;
  successes: string | null;
  problems: string | null;
  lessons_learned: string | null;
  next_actions: string | null;
  review_type: string;
};

export type OkrCycleContext = {
  workspace: OkrPlanningWorkspaceData;
  objectiveViews: OkrObjectiveView[];
  kpis: OkrCycleKpis;
  initiativeIdsWithoutKr: string[];
  updatesByKeyResultId: Map<string, OkrUpdateRow[]>;
  okrReview: OkrReviewRow | null;
};

function collectKeyResultIds(workspace: OkrPlanningWorkspaceData): string[] {
  const ids: string[] = [];
  for (const obj of workspace.okrObjectives) {
    for (const kr of obj.keyResults) ids.push(kr.id);
  }
  return ids;
}

export async function getOkrCycleContext(
  organizationId: string,
  cycleInstanceId: string,
  preferredOkrCycleId?: string | null
): Promise<OkrCycleContext> {
  const workspace = await getOkrPlanningWorkspaceData(
    organizationId,
    cycleInstanceId,
    preferredOkrCycleId
  );

  const keyResultIds = collectKeyResultIds(workspace);
  const supabase = await createSupabaseServerClient();

  const updatesByKeyResultId = new Map<string, OkrUpdateRow[]>();
  if (keyResultIds.length > 0) {
    const { data: updatesRaw } = await supabase
      .schema("app")
      .from("okr_updates")
      .select("key_result_id, progress_value, confidence_level, created_at")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .in("key_result_id", keyResultIds)
      .order("created_at", { ascending: false });

    const rows = (updatesRaw ?? []) as Array<{
      key_result_id: string;
      progress_value: number | null;
      confidence_level: number | null;
      created_at: string;
    }>;

    for (const row of rows) {
      const list = updatesByKeyResultId.get(row.key_result_id) ?? [];
      list.push({
        progress_value: row.progress_value,
        confidence_level: row.confidence_level,
        created_at: row.created_at,
      });
      updatesByKeyResultId.set(row.key_result_id, list);
    }
  }

  let okrReview: OkrReviewRow | null = null;
  if (workspace.selectedOkrCycleId) {
    const { data: rev } = await supabase
      .schema("app")
      .from("okr_reviews")
      .select("id, summary, successes, problems, lessons_learned, next_actions, review_type")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .eq("okr_cycle_id", workspace.selectedOkrCycleId)
      .eq("review_type", "quarterly_review")
      .maybeSingle();
    if (rev) okrReview = rev as OkrReviewRow;
  }

  const objectiveViews = workspace.okrObjectives.map((obj) =>
    buildOkrObjectiveView(obj, updatesByKeyResultId)
  );

  let initiativeKrLinks: InitiativeKrLinkRow[] = [];
  if (keyResultIds.length > 0) {
    const { data: linkRows } = await supabase
      .schema("app")
      .from("initiative_key_result_links")
      .select("initiative_id, key_result_id")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .in("key_result_id", keyResultIds);
    initiativeKrLinks = (linkRows ?? []) as InitiativeKrLinkRow[];
  }

  const initiativeIdsWithoutKr = workspace.initiatives
    .filter((i) => initiativeWarningNoKeyResultLink(i.id, initiativeKrLinks))
    .map((i) => i.id);

  const kpis = computeOkrCycleKpis(objectiveViews, new Set(initiativeIdsWithoutKr));

  return {
    workspace,
    objectiveViews,
    kpis,
    initiativeIdsWithoutKr,
    updatesByKeyResultId,
    okrReview,
  };
}
