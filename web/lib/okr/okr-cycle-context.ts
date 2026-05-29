import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OkrUpdateRow } from "@/lib/review/key-result-progress";
import { getOkrPlanningWorkspaceData, type OkrPlanningWorkspaceData } from "@/lib/okr/planning-data";
import { getOkrCycleInstanceScopeIds } from "@/lib/okr/queries";
import { initiativeWarningNoKeyResultLink, type InitiativeKrLinkRow } from "@/lib/okr/okr-planning-view-model";
import {
  buildOkrObjectiveView,
  computeOkrCycleKpis,
  type OkrCycleKpis,
  type OkrObjectiveView,
} from "@/lib/okr/okr-cycle-view-model";

export type KeyResultSupervisorFeedbackRow = {
  id: string;
  keyResultId: string;
  okrUpdateId: string | null;
  authorMembershipId: string;
  comment: string;
  createdAt: string;
};

export type OkrCycleContext = {
  workspace: OkrPlanningWorkspaceData;
  objectiveViews: OkrObjectiveView[];
  kpis: OkrCycleKpis;
  initiativeIdsWithoutKr: string[];
  updatesByKeyResultId: Map<string, OkrUpdateRow[]>;
  supervisorFeedbackByKeyResultId: Map<string, KeyResultSupervisorFeedbackRow[]>;
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
  preferredOkrCycleId?: string | null,
  supabaseClient?: SupabaseClient
): Promise<OkrCycleContext> {
  const workspace = await getOkrPlanningWorkspaceData(
    organizationId,
    cycleInstanceId,
    preferredOkrCycleId,
    supabaseClient
  );

  const keyResultIds = collectKeyResultIds(workspace);
  const supabase = supabaseClient ?? (await createSupabaseServerClient());
  const okrScopeInstanceIds = await getOkrCycleInstanceScopeIds(
    organizationId,
    cycleInstanceId,
    supabase
  );

  const updatesByKeyResultId = new Map<string, OkrUpdateRow[]>();
  if (keyResultIds.length > 0) {
    const { data: updatesRaw } = await supabase
      .schema("app")
      .from("okr_updates")
      .select("id, key_result_id, progress_value, confidence_level, comment, created_at, verification_status")
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", okrScopeInstanceIds)
      .in("key_result_id", keyResultIds)
      .order("created_at", { ascending: false });

    const rows = (updatesRaw ?? []) as Array<{
      id: string;
      key_result_id: string;
      progress_value: number | null;
      confidence_level: number | null;
      comment: string | null;
      created_at: string;
      verification_status: string | null;
    }>;

    for (const row of rows) {
      const list = updatesByKeyResultId.get(row.key_result_id) ?? [];
      list.push({
        id: row.id,
        progress_value: row.progress_value,
        confidence_level: row.confidence_level,
        created_at: row.created_at,
        comment: row.comment,
        verification_status: row.verification_status as OkrUpdateRow["verification_status"],
      });
      updatesByKeyResultId.set(row.key_result_id, list);
    }
  }

  const selectedCycle =
    workspace.selectedOkrCycleId != null
      ? workspace.okrCycles.find((c) => c.id === workspace.selectedOkrCycleId) ?? null
      : null;
  const okrCycleDates =
    selectedCycle?.start_date &&
    selectedCycle?.end_date &&
    !Number.isNaN(Date.parse(selectedCycle.start_date)) &&
    !Number.isNaN(Date.parse(selectedCycle.end_date))
      ? { start_date: selectedCycle.start_date, end_date: selectedCycle.end_date }
      : null;

  const objectiveViews = workspace.okrObjectives.map((obj) =>
    buildOkrObjectiveView(obj, updatesByKeyResultId, okrCycleDates)
  );

  let initiativeKrLinks: InitiativeKrLinkRow[] = [];
  if (keyResultIds.length > 0) {
    const { data: linkRows } = await supabase
      .schema("app")
      .from("initiative_key_result_links")
      .select("initiative_id, key_result_id")
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", okrScopeInstanceIds)
      .in("key_result_id", keyResultIds);
    initiativeKrLinks = (linkRows ?? []) as InitiativeKrLinkRow[];
  }

  const initiativeIdsWithoutKr = workspace.initiatives
    .filter((i) => initiativeWarningNoKeyResultLink(i.id, initiativeKrLinks))
    .map((i) => i.id);

  const kpis = computeOkrCycleKpis(objectiveViews, new Set(initiativeIdsWithoutKr));

  const supervisorFeedbackByKeyResultId = new Map<string, KeyResultSupervisorFeedbackRow[]>();
  if (keyResultIds.length > 0) {
    const { data: feedbackRaw } = await supabase
      .schema("app")
      .from("key_result_supervisor_feedback")
      .select("id, key_result_id, okr_update_id, author_membership_id, comment, created_at")
      .eq("organization_id", organizationId)
      .in("key_result_id", keyResultIds)
      .order("created_at", { ascending: false });

    for (const row of feedbackRaw ?? []) {
      const krId = row.key_result_id as string;
      const list = supervisorFeedbackByKeyResultId.get(krId) ?? [];
      list.push({
        id: row.id as string,
        keyResultId: krId,
        okrUpdateId: (row.okr_update_id as string | null) ?? null,
        authorMembershipId: row.author_membership_id as string,
        comment: row.comment as string,
        createdAt: row.created_at as string,
      });
      supervisorFeedbackByKeyResultId.set(krId, list);
    }
  }

  return {
    workspace,
    objectiveViews,
    kpis,
    initiativeIdsWithoutKr,
    updatesByKeyResultId,
    supervisorFeedbackByKeyResultId,
  };
}
