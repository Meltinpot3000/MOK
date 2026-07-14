import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchDirectionsForCycle, fetchObjectivesForCycle } from "@/lib/strategy-objects/queries";
import {
  filterMembershipsForAnnualTargetOwnerSelect,
  filterMembershipsForAnnualTargetTeamView,
  type AnnualTargetOwnerOption,
} from "@/lib/annual-targets/eligible-memberships";
import {
  filterDirectionsForAnnualTargetSelect,
  filterObjectivesForAnnualTargetSelect,
  filterProgramsForAnnualTargetSelect,
} from "@/lib/annual-targets/alignment-eligibility";
import { parseAnnualTargetSmartCheck, parseAnnualTargetSmartFormulation, parseAnnualTargetSmartProposal, parseAnnualTargetAnchorFit } from "@/lib/annual-targets/smart-check";
import { getOrgAnnualTargetSignatureSettings } from "@/lib/annual-targets/org-settings";
import type {
  AnnualTargetPlanningRow,
  AnnualTargetsFilters,
  AnnualTargetsTab,
  AnnualTargetWorkspaceContext,
  AnnualTargetLifecycleStatus,
  AnnualTargetType,
  ProgressCalculationMode,
} from "@/lib/annual-targets/types";

const TARGET_SELECT_CORE =
  "id, organization_id, cycle_instance_id, planning_cycle_id, strategic_direction_id, strategy_program_id, title, description, measurement_logic, baseline, current_measure, progress_percent, target_year, annual_target_type, progress_calculation_mode, bonus_weight, owner_membership_id, created_by_membership_id, derivation_note, status, signature_status, comment, is_primary, ai_assisted, ai_model_provider, ai_generated_at, smart_check, smart_formulation, updated_at";

const TARGET_SELECT = `${TARGET_SELECT_CORE}, smart_proposal, anchor_fit`;

function normMembershipId(id: string | null | undefined): string {
  return (id ?? "").trim().toLowerCase();
}

export type AnnualTargetAlignmentPreserveIds = {
  directionId?: string | null;
  programId?: string | null;
  objectiveId?: string | null;
};

export async function getAnnualTargetsWorkspaceData(input: {
  organizationId: string;
  cycleInstanceId: string;
  currentMembershipId: string;
  tab: AnnualTargetsTab;
  filters: AnnualTargetsFilters;
  /** Beim Bearbeiten: bereits verknüpfte IDs trotzdem in Dropdowns behalten. */
  preserveAlignmentIds?: AnnualTargetAlignmentPreserveIds;
  editTargetId?: string | null;
}): Promise<{ rows: AnnualTargetPlanningRow[]; context: AnnualTargetWorkspaceContext }> {
  const supabase = await createSupabaseServerClient();

  const [
    targetsResult,
    directionsResult,
    programsResult,
    objectivesResult,
    objectiveLinksResult,
    okrLinksResult,
    initiativeLinksResult,
    responsiblesResult,
    membershipsResult,
    orgSignatureSettings,
  ] = await Promise.all([
    (async () => {
      const primary = await supabase
        .schema("app")
        .from("annual_targets")
        .select(TARGET_SELECT)
        .eq("organization_id", input.organizationId)
        .eq("cycle_instance_id", input.cycleInstanceId);
      if (!primary.error) return primary;
      console.error(
        "[annual-targets] select with proposal columns failed, falling back:",
        primary.error.message
      );
      return supabase
        .schema("app")
        .from("annual_targets")
        .select(TARGET_SELECT_CORE)
        .eq("organization_id", input.organizationId)
        .eq("cycle_instance_id", input.cycleInstanceId);
    })(),
    fetchDirectionsForCycle(input.organizationId, input.cycleInstanceId, { supabase }),
    supabase
      .schema("app")
      .from("strategy_programs")
      .select("id, title, status, strategic_direction_id")
      .eq("organization_id", input.organizationId)
      .eq("cycle_instance_id", input.cycleInstanceId)
      .order("title"),
    fetchObjectivesForCycle(input.organizationId, input.cycleInstanceId, { supabase }),
    supabase
      .schema("app")
      .from("objective_target_links")
      .select("annual_target_id, strategy_objective_id")
      .eq("organization_id", input.organizationId)
      .eq("cycle_instance_id", input.cycleInstanceId),
    supabase
      .schema("app")
      .from("annual_target_okr_objective_links")
      .select("annual_target_id")
      .eq("organization_id", input.organizationId)
      .eq("cycle_instance_id", input.cycleInstanceId),
    supabase
      .schema("app")
      .from("initiative_target_links")
      .select("annual_target_id")
      .eq("organization_id", input.organizationId),
    supabase
      .schema("app")
      .from("responsibles")
      .select("membership_id, full_name")
      .eq("organization_id", input.organizationId)
      .not("membership_id", "is", null)
      .order("full_name"),
    supabase
      .schema("app")
      .from("organization_memberships")
      .select("id, display_name")
      .eq("organization_id", input.organizationId)
      .in("status", ["active", "invited"]),
    getOrgAnnualTargetSignatureSettings(input.organizationId),
  ]);

  const directionById = new Map(
    directionsResult.map((d) => [d.id, d.title])
  );
  const programById = new Map(
    (programsResult.data ?? []).map((p) => [p.id as string, String(p.title ?? "")])
  );
  const objectiveById = new Map(
    objectivesResult.map((o) => [o.id, o.title])
  );
  const objectiveByTargetId = new Map<string, string>();
  for (const link of objectiveLinksResult.data ?? []) {
    const strategyObjectiveId =
      (link as { strategy_objective_id?: string | null }).strategy_objective_id ??
      (link as { objective_id?: string | null }).objective_id;
    if (strategyObjectiveId) {
      objectiveByTargetId.set(String(link.annual_target_id), String(strategyObjectiveId));
    }
  }
  const okrCountByTarget = new Map<string, number>();
  for (const link of okrLinksResult.data ?? []) {
    const id = String(link.annual_target_id);
    okrCountByTarget.set(id, (okrCountByTarget.get(id) ?? 0) + 1);
  }
  const initiativeCountByTarget = new Map<string, number>();
  for (const link of initiativeLinksResult.data ?? []) {
    const id = String(link.annual_target_id);
    initiativeCountByTarget.set(id, (initiativeCountByTarget.get(id) ?? 0) + 1);
  }
  const membershipNameById = new Map(
    (membershipsResult.data ?? []).map((m) => [m.id as string, String(m.display_name ?? m.id)])
  );

  const responsibles: AnnualTargetOwnerOption[] = (responsiblesResult.data ?? []).map((r) => ({
    membershipId: String(r.membership_id),
    fullName: String(r.full_name ?? r.membership_id),
  }));

  const [ownerScopeResolved, teamOwnerOptions] = await Promise.all([
    filterMembershipsForAnnualTargetOwnerSelect({
      organizationId: input.organizationId,
      currentMembershipId: input.currentMembershipId,
      responsibles,
    }),
    filterMembershipsForAnnualTargetTeamView({
      organizationId: input.organizationId,
      currentMembershipId: input.currentMembershipId,
      responsibles,
    }),
  ]);

  if (targetsResult.error) {
    console.error("[annual-targets] targets select failed:", targetsResult.error.message);
  }

  let rows = (targetsResult.data ?? []).map((raw) => {
    const id = raw.id as string;
    const objectiveId = objectiveByTargetId.get(id) ?? null;
    const okrCount = okrCountByTarget.get(id) ?? 0;
    return {
      ...(raw as AnnualTargetPlanningRow),
      directionTitle: directionById.get(String(raw.strategic_direction_id)) ?? "—",
      programTitle: raw.strategy_program_id
        ? programById.get(String(raw.strategy_program_id)) ?? null
        : null,
      strategicObjectiveId: objectiveId,
      strategicObjectiveTitle: objectiveId ? objectiveById.get(objectiveId) ?? null : null,
      ownerDisplayName:
        membershipNameById.get(String(raw.owner_membership_id ?? "")) ?? "—",
      okrAlignmentLabel: okrCount > 0 ? `${okrCount} OKR(s)` : "Kein Alignment",
      okrLinkCount: okrCount,
      initiativeLinkCount: initiativeCountByTarget.get(id) ?? 0,
      status: raw.status as AnnualTargetLifecycleStatus,
      annual_target_type: raw.annual_target_type as AnnualTargetType,
      progress_calculation_mode: raw.progress_calculation_mode as ProgressCalculationMode,
      smart_check: parseAnnualTargetSmartCheck(raw.smart_check),
      smart_formulation: parseAnnualTargetSmartFormulation(raw.smart_formulation, {
        description: raw.description as string | null,
        measurementLogic: raw.measurement_logic as string | null,
      }),
      smart_proposal: parseAnnualTargetSmartProposal(raw.smart_proposal),
      anchor_fit: parseAnnualTargetAnchorFit(raw.anchor_fit),
    };
  });

  const currentMembershipNorm = normMembershipId(input.currentMembershipId);

  if (input.tab === "mine") {
    rows = rows.filter(
      (r) =>
        (input.editTargetId != null && r.id === input.editTargetId) ||
        normMembershipId(r.owner_membership_id) === currentMembershipNorm ||
        normMembershipId(r.created_by_membership_id) === currentMembershipNorm
    );
  } else {
    const allowedOwners = new Set(teamOwnerOptions.map((o) => normMembershipId(o.membershipId)));
    rows = rows.filter(
      (r) =>
        (input.editTargetId != null && r.id === input.editTargetId) ||
        (r.owner_membership_id && allowedOwners.has(normMembershipId(r.owner_membership_id)))
    );
  }

  const f = input.filters;
  if (f.targetYear != null) rows = rows.filter((r) => r.target_year === f.targetYear);
  if (f.ownerMembershipId)
    rows = rows.filter(
      (r) => normMembershipId(r.owner_membership_id) === normMembershipId(f.ownerMembershipId)
    );
  if (f.strategicDirectionId)
    rows = rows.filter((r) => r.strategic_direction_id === f.strategicDirectionId);
  if (f.strategicObjectiveId)
    rows = rows.filter((r) => r.strategicObjectiveId === f.strategicObjectiveId);
  if (f.status) rows = rows.filter((r) => r.status === f.status);
  if (f.annualTargetType) rows = rows.filter((r) => r.annual_target_type === f.annualTargetType);
  if (f.okrAlignment === "aligned") rows = rows.filter((r) => r.okrLinkCount > 0);
  if (f.okrAlignment === "not_aligned") rows = rows.filter((r) => r.okrLinkCount === 0);

  rows.sort((a, b) => {
    const ya = a.target_year ?? 0;
    const yb = b.target_year ?? 0;
    if (yb !== ya) return yb - ya;
    return a.title.localeCompare(b.title, "de");
  });

  const preserve =
    input.preserveAlignmentIds ??
    (input.editTargetId
      ? (() => {
          const raw = (targetsResult.data ?? []).find((t) => String(t.id) === input.editTargetId);
          if (!raw) return undefined;
          return {
            directionId: String(raw.strategic_direction_id ?? ""),
            programId: (raw.strategy_program_id as string | null) ?? null,
            objectiveId: objectiveByTargetId.get(String(raw.id)) ?? null,
          };
        })()
      : undefined);
  const allDirections = directionsResult.map((d) => ({
    id: d.id,
    title: d.title,
    versioning: d.versioning,
  }));
  const allPrograms = (programsResult.data ?? []).map((p) => ({
    id: p.id as string,
    title: String(p.title ?? ""),
    status: String(p.status ?? ""),
    strategic_direction_id: (p.strategic_direction_id as string | null) ?? null,
  }));
  const allObjectives = objectivesResult.map((o) => ({
    id: o.id,
    title: o.title,
    versioning: o.versioning,
  }));

  return {
    rows,
    context: {
      directions: filterDirectionsForAnnualTargetSelect(
        allDirections,
        preserve?.directionId
      ),
      programs: filterProgramsForAnnualTargetSelect(allPrograms, preserve?.programId),
      strategicObjectives: filterObjectivesForAnnualTargetSelect(
        allObjectives,
        preserve?.objectiveId
      ),
      ownerOptions: ownerScopeResolved.options,
      teamOwnerOptions,
      canPickOwner: ownerScopeResolved.canPickOwner,
      defaultOwnerMembershipId: input.currentMembershipId,
      orgSignatureSettings,
    },
  };
}
