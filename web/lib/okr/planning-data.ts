import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOkrCycles, getOkrCycleInstanceScopeIds } from "@/lib/okr/queries";
import { readAnalysisNetworkLlmPolicy, isLlmFeatureEnabled } from "@/lib/analysis-network/policy";
import { orderOkrCyclesByPickPreference, pickDefaultOkrCycle } from "@/lib/okr/pick-default-okr-cycle";
import { deriveOkrStrategicDirection } from "@/lib/change-run/change-run-model";

function unwrapJoinedRow<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
import {
  resolveStrategicDirectionForInitiative,
  type ReviewCycleAnnualTargetRow,
  type ReviewCycleProgramRow,
  type ReviewCycleInitiativeTargetLinkRow,
} from "@/lib/review/review-cycle-view-model";
import {
  initiativeIdsByKeyResultId,
  initiativeWarningNoKeyResultLink,
  keyResultWarningNoInitiativeLink,
  type InitiativeKrLinkRow,
} from "@/lib/okr/okr-planning-view-model";

const INITIATIVE_SELECT_WITH_REVIEW =
  "id, title, status, program_id, owner_membership_id, start_date, end_date, weight, progress_percent, last_review_update_at";

const INITIATIVE_SELECT_LEGACY =
  "id, title, status, program_id, owner_membership_id, start_date, end_date";

function isMissingReviewRollupColumnsError(message: string): boolean {
  if (!message.includes("does not exist")) return false;
  return (
    message.includes("weight") ||
    message.includes("progress_percent") ||
    message.includes("last_review_update_at")
  );
}

type MembershipOwnerRow = {
  id: string;
  user_id: string;
  display_name: string | null;
  title: string | null;
};

type AuthUserIdentity = { email: string | null; name: string | null };

async function fetchAuthIdentityByUserId(userIds: string[]): Promise<Map<string, AuthUserIdentity>> {
  const identityByUserId = new Map<string, AuthUserIdentity>();
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) return identityByUserId;

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) return identityByUserId;

  const { data: rpcRows, error: rpcError } = await adminClient
    .schema("app")
    .rpc("resolve_auth_user_identities", { p_user_ids: uniqueUserIds });

  if (!rpcError && rpcRows && Array.isArray(rpcRows)) {
    for (const row of rpcRows as Array<{
      user_id: string;
      email: string | null;
      meta_full_name: string | null;
    }>) {
      identityByUserId.set(row.user_id, {
        email: row.email?.trim() || null,
        name: row.meta_full_name?.trim() || null,
      });
    }
    return identityByUserId;
  }

  if (rpcError) {
    console.error("[getOkrPlanningWorkspaceData] resolve_auth_user_identities", rpcError.message);
  }

  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      const { data } = await adminClient.auth.admin.getUserById(userId);
      const email = data.user?.email?.trim() ? data.user.email.trim() : null;
      const metadata =
        data.user?.user_metadata && typeof data.user.user_metadata === "object"
          ? (data.user.user_metadata as Record<string, unknown>)
          : null;
      const fullNameRaw = metadata?.full_name ?? metadata?.name ?? metadata?.display_name ?? null;
      const name =
        typeof fullNameRaw === "string" && fullNameRaw.trim().length > 0 ? fullNameRaw.trim() : null;
      identityByUserId.set(userId, { email, name });
    })
  );
  return identityByUserId;
}

function okrOwnerLabelFromUserIdentity(
  row: MembershipOwnerRow,
  identityByUserId: Map<string, AuthUserIdentity>
): string {
  const identity = identityByUserId.get(row.user_id);
  return (
    row.display_name?.trim() ||
    identity?.name ||
    identity?.email ||
    row.title?.trim() ||
    "Mitglied"
  );
}

export type OkrPlanningKeyResultRow = {
  id: string;
  objectiveId: string;
  title: string;
  status: string;
  metricType: string;
  startValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
  measurementUnit: string | null;
  dueDate: string | null;
  updatedAt: string | null;
  ownerMembershipId: string | null;
  ownerDisplayName: string | null;
  deputyMembershipId: string | null;
  deputyDisplayName: string | null;
  linkedInitiativeIds: string[];
  linkedInitiativeTitles: string[];
  warningNoInitiativeLink: boolean;
  initiativeSuggestions: Array<{
    initiativeId: string;
    initiativeTitle: string;
    llmLevel: "low" | "medium" | "high" | null;
    llmReason: string | null;
    confirmedLevel: "low" | "medium" | "high" | null;
    confirmationStatus: "none" | "pending" | "accepted" | "rejected" | "manual";
    llmRunId: string | null;
  }>;
  latestMatchingRun:
    | {
        status: "ok" | "insufficient_context" | "failed";
        insufficientContextReason: string | null;
      }
    | null;
};

export type OkrContributionEdgePlanningRow = {
  targetType: "initiative" | "strategy_objective" | "strategic_direction";
  targetId: string;
  targetTitle: string;
  llmLevel: "low" | "medium" | "high" | "insufficient" | null;
  llmAlignmentLevel: "low" | "medium" | "high" | "insufficient" | null;
  /** @deprecated v4 — Lesen: llmFormulationLevel ?? llmAmbitionLevel */
  llmAmbitionLevel: "low" | "medium" | "high" | "insufficient" | null;
  llmFormulationLevel: "low" | "medium" | "high" | "insufficient" | null;
  llmScopeFitLevel: "low" | "medium" | "high" | "insufficient" | null;
  llmReason: string | null;
  llmImprovementHint: string | null;
  confirmedLevel: "low" | "medium" | "high" | "insufficient" | null;
  valueSource: "none" | "llm_accepted" | "manual";
  llmSuggestionDismissed: boolean;
};

export type OkrPlanningObjectiveRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  ownerMembershipId: string | null;
  ownerDisplayName: string | null;
  deputyMembershipId: string | null;
  deputyDisplayName: string | null;
  leadingStrategicDirectionId: string | null;
  leadingStrategicDirectionTitle: string | null;
  /** Stoßrichtung wird abgeleitet — kein direktes Setzen mehr. */
  warningNoChangeAnchor?: boolean;
  warningDirectionConflict?: boolean;
  strategicDirectionDerived?: boolean;
  linkedAnnualTargetIds: string[];
  linkedAnnualTargetTitles: string[];
  linkedInitiativeIds: string[];
  linkedInitiativeTitles: string[];
  keyResults: OkrPlanningKeyResultRow[];
  contributionEdges: OkrContributionEdgePlanningRow[];
};

export type OkrPlanningInitiativeRow = {
  id: string;
  title: string;
  status: string;
  weight: number;
  progressPercent: number;
  lastReviewUpdateAt: string | null;
  startDate: string | null;
  endDate: string | null;
  ownerMembershipId: string | null;
  ownerDisplayName: string | null;
  programId: string | null;
  programTitle: string | null;
  strategicDirectionId: string | null;
  strategicDirectionTitle: string | null;
  linkedKeyResultTitles: string[];
  warningNoKeyResultLink: boolean;
};

export type OkrCycleOption = {
  id: string;
  name: string;
  code: string | null;
  start_date: string;
  end_date: string;
  status: string;
};

export type OkrResponsibleOption = {
  membershipId: string;
  fullName: string;
};

export type OkrPlanningWorkspaceData = {
  cycleInstanceId: string;
  okrCycles: OkrCycleOption[];
  selectedOkrCycleId: string | null;
  strategicDirections: Array<{ id: string; title: string }>;
  responsibles: OkrResponsibleOption[];
  initiatives: OkrPlanningInitiativeRow[];
  annualTargets: Array<{ id: string; title: string; strategyProgramId: string | null }>;
  okrObjectives: OkrPlanningObjectiveRow[];
  /** Organisationsregel: kein separater KR-Owner in der Planung; wird an Objective-Owner gebunden. */
  okrKrOwnerMustMatchObjective: boolean;
  /** Tenant-Flag: automatische LLM-Contribution-Bewertung für OKRs. */
  okrContributionAssessmentEnabled: boolean;
  /** Tenant-Flag: automatische LLM-Matching-Vorschlaege fuer KR-Initiativen. */
  krInitiativeMatchingEnabled: boolean;
};

export async function getOkrPlanningWorkspaceData(
  organizationId: string,
  cycleInstanceId: string,
  preferredOkrCycleId?: string | null,
  supabaseClient?: SupabaseClient
): Promise<OkrPlanningWorkspaceData> {
  const supabase = supabaseClient ?? (await createSupabaseServerClient());

  const okrCyclesRaw = await getOkrCycles(organizationId, cycleInstanceId, supabase);
  const okrCycles = okrCyclesRaw as OkrCycleOption[];
  const okrCycleIds = okrCycles.map((c) => c.id);
  const preferredExplicit =
    Boolean(preferredOkrCycleId) && okrCycles.some((c) => c.id === preferredOkrCycleId);
  const selectedOkrCycleId =
    (preferredOkrCycleId && okrCycles.some((c) => c.id === preferredOkrCycleId)
      ? preferredOkrCycleId
      : null) ?? pickDefaultOkrCycle(okrCycles);

  const okrScopeInstanceIds = await getOkrCycleInstanceScopeIds(organizationId, cycleInstanceId, supabase);

  const initiativesFirst = await supabase
    .schema("app")
    .from("initiatives")
    .select(INITIATIVE_SELECT_WITH_REVIEW)
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });

  const initiativesQuery =
    initiativesFirst.error && isMissingReviewRollupColumnsError(initiativesFirst.error.message)
      ? await supabase
          .schema("app")
          .from("initiatives")
          .select(INITIATIVE_SELECT_LEGACY)
          .eq("organization_id", organizationId)
          .eq("cycle_instance_id", cycleInstanceId)
          .order("priority", { ascending: true })
          .order("created_at", { ascending: false })
      : initiativesFirst;

  const [
    directionsResult,
    programsResult,
    membershipsResult,
    linksResult,
    targetsResult,
    objectivesResult,
    orgSettingsResult,
    brandingResult,
  ] = await Promise.all([
    supabase
      .schema("app")
      .from("strategic_directions")
      .select("id, title")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .order("priority", { ascending: true }),
    supabase
      .schema("app")
      .from("strategy_programs")
      .select("id, title, strategic_direction_id")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId),
    supabase
      .schema("app")
      .from("organization_memberships")
      .select("id, user_id, display_name, title")
      .eq("organization_id", organizationId)
      .in("status", ["active", "invited"])
      .order("display_name", { ascending: true })
      .order("id", { ascending: true }),
    supabase
      .schema("app")
      .from("initiative_target_links")
      .select("initiative_id, annual_target_id")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId),
    supabase
      .schema("app")
      .from("annual_targets")
      .select("id, title, strategic_direction_id, strategy_program_id")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .order("title", { ascending: true }),
    okrScopeInstanceIds.length > 0
      ? supabase
          .schema("app")
          .from("okr_objectives")
          .select(
            "id, title, description, status, okr_cycle_id, cycle_instance_id, owner_membership_id, deputy_membership_id, leading_strategic_direction_id"
          )
          .eq("organization_id", organizationId)
          .in("cycle_instance_id", okrScopeInstanceIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as const, error: null }),
    supabase
      .schema("app")
      .from("organizations")
      .select("okr_kr_owner_must_match_objective")
      .eq("id", organizationId)
      .maybeSingle(),
    supabase
      .schema("app")
      .from("tenant_branding")
      .select("branding_config")
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);

  const orgSettingsRow = orgSettingsResult.data as
    | { okr_kr_owner_must_match_objective?: boolean }
    | null
    | undefined;
  const okrKrOwnerMustMatchObjective = Boolean(orgSettingsRow?.okr_kr_owner_must_match_objective);
  const llmPolicy = readAnalysisNetworkLlmPolicy(brandingResult.data?.branding_config ?? null);
  const okrContributionAssessmentEnabled = isLlmFeatureEnabled(llmPolicy, "okr_contribution_assessment");
  const krInitiativeMatchingEnabled = isLlmFeatureEnabled(llmPolicy, "kr_initiative_matching");

  const directions = (directionsResult.data ?? []) as Array<{ id: string; title: string }>;
  const directionTitleById = new Map(directions.map((d) => [d.id, d.title]));
  const programs = (programsResult.data ?? []) as Array<{
    id: string;
    title: string;
    strategic_direction_id: string | null;
  }>;
  const programById = new Map<string, ReviewCycleProgramRow>(
    programs.map((p) => [p.id, { id: p.id, strategic_direction_id: p.strategic_direction_id }])
  );
  const programTitleById = new Map(programs.map((p) => [p.id, p.title]));
  const membershipOwnerRows = (membershipsResult.data ?? []) as MembershipOwnerRow[];
  const identityByUserId = await fetchAuthIdentityByUserId(
    membershipOwnerRows.map((r) => r.user_id)
  );
  const ownerByMembership = new Map(
    membershipOwnerRows.map(
      (row) => [row.id, okrOwnerLabelFromUserIdentity(row, identityByUserId)] as const
    )
  );
  const targetLinks = (linksResult.data ?? []) as ReviewCycleInitiativeTargetLinkRow[];
  const annualTargetRows = (targetsResult.data ?? []) as Array<{
    id: string;
    title: string;
    strategic_direction_id: string;
    strategy_program_id: string | null;
  }>;
  const annualTargetById = new Map<string, ReviewCycleAnnualTargetRow & { strategy_program_id: string | null }>(
    annualTargetRows.map((t) => [
      t.id,
      {
        id: t.id,
        strategic_direction_id: t.strategic_direction_id,
        strategy_program_id: t.strategy_program_id,
      },
    ])
  );
  const annualTargetsForWorkspace = annualTargetRows.map((t) => ({
    id: String(t.id),
    title: String(t.title ?? ""),
    strategyProgramId: t.strategy_program_id ?? null,
  }));

  type InitiativeRaw = {
    id: string;
    title: string;
    status: string;
    program_id: string | null;
    owner_membership_id: string | null;
    start_date: string | null;
    end_date: string | null;
    weight?: number | null;
    progress_percent?: number | null;
    last_review_update_at?: string | null;
  };

  const initiativesRaw = (initiativesQuery.data ?? []) as InitiativeRaw[];

  type ObjectiveRow = {
    id: string;
    title: string;
    description: string | null;
    status: string;
    okr_cycle_id: string | null;
    cycle_instance_id: string | null;
    owner_membership_id: string | null;
    deputy_membership_id: string | null;
  };

  const objectivesAll = (objectivesResult.data ?? []) as ObjectiveRow[];

  let effectiveOkrCycleId = selectedOkrCycleId;
  if (effectiveOkrCycleId && !preferredExplicit) {
    const countFor = (id: string) => objectivesAll.filter((o) => o.okr_cycle_id === id).length;
    if (countFor(effectiveOkrCycleId) === 0) {
      for (const c of orderOkrCyclesByPickPreference(okrCycles)) {
        if (countFor(c.id) > 0) {
          effectiveOkrCycleId = c.id;
          break;
        }
      }
    }
  }

  let objectives = objectivesAll.filter((o) => o.okr_cycle_id === effectiveOkrCycleId);
  if (objectives.length === 0 && objectivesAll.length > 0) {
    // Defensive fallback: falls okr_cycle_id inkonsistent ist, aber cycle_instance_id
    // korrekt im Scope liegt, verlieren wir nicht den gesamten Objective-Kontext.
    objectives = objectivesAll;
  }
  const objectiveIds = objectives.map((o) => o.id);

  const atOkrLinksByObjectiveId = new Map<
    string,
    Array<{
      annualTargetId: string;
      strategyProgramId: string | null;
      strategicDirectionId: string | null;
      programDirectionId: string | null;
    }>
  >();
  const annualTargetTitleById = new Map<string, string>();
  if (objectiveIds.length > 0) {
    const { data: atOkrLinks } = await supabase
      .schema("app")
      .from("annual_target_okr_objective_links")
      .select(
        "okr_objective_id, annual_target_id, annual_targets(id, title, strategy_program_id, strategic_direction_id)"
      )
      .eq("organization_id", organizationId)
      .in("okr_objective_id", objectiveIds);
    for (const row of atOkrLinks ?? []) {
      const objectiveId = String(row.okr_objective_id);
      const at = unwrapJoinedRow(
        row.annual_targets as
          | {
              id: string;
              title: string;
              strategy_program_id: string | null;
              strategic_direction_id: string | null;
            }
          | Array<{
              id: string;
              title: string;
              strategy_program_id: string | null;
              strategic_direction_id: string | null;
            }>
          | null
      );
      if (at?.id) annualTargetTitleById.set(String(at.id), at.title);
      const programDirectionId =
        at?.strategy_program_id != null
          ? (programById.get(at.strategy_program_id)?.strategic_direction_id ?? null)
          : null;
      const list = atOkrLinksByObjectiveId.get(objectiveId) ?? [];
      list.push({
        annualTargetId: String(row.annual_target_id),
        strategyProgramId: at?.strategy_program_id ?? null,
        strategicDirectionId: at?.strategic_direction_id ?? null,
        programDirectionId,
      });
      atOkrLinksByObjectiveId.set(objectiveId, list);
    }
  }

  const programDirectionForInitiative = (initiativeId: string): string | null => {
    const init = initiativesRaw.find((i) => i.id === initiativeId);
    if (!init?.program_id) return null;
    return programById.get(init.program_id)?.strategic_direction_id ?? null;
  };

  const initOkrLinksByObjectiveId = new Map<
    string,
    Array<{ initiativeId: string; programDirectionId: string | null }>
  >();
  if (objectiveIds.length > 0) {
    const { data: initOkrLinks } = await supabase
      .schema("app")
      .from("initiative_okr_objective_links")
      .select("okr_objective_id, initiative_id")
      .eq("organization_id", organizationId)
      .in("okr_objective_id", objectiveIds);
    for (const row of initOkrLinks ?? []) {
      const objectiveId = String(row.okr_objective_id);
      const initiativeId = String(row.initiative_id);
      const list = initOkrLinksByObjectiveId.get(objectiveId) ?? [];
      list.push({
        initiativeId,
        programDirectionId: programDirectionForInitiative(initiativeId),
      });
      initOkrLinksByObjectiveId.set(objectiveId, list);
    }
  }

  for (const t of annualTargetsForWorkspace) {
    if (!annualTargetTitleById.has(t.id)) annualTargetTitleById.set(t.id, t.title);
  }

  let keyResults: Array<{
    id: string;
    okr_objective_id: string;
    title: string;
    status: string;
    metric_type: string;
    start_value: number | null;
    target_value: number | null;
    current_value: number | null;
    measurement_unit: string | null;
    due_date: string | null;
    updated_at: string | null;
    owner_membership_id: string | null;
    deputy_membership_id: string | null;
  }> = [];

  if (objectiveIds.length > 0) {
    const krRes = await supabase
      .schema("app")
      .from("key_results")
      .select(
        "id, okr_objective_id, title, status, metric_type, start_value, target_value, current_value, measurement_unit, due_date, updated_at, owner_membership_id, deputy_membership_id"
      )
      .eq("organization_id", organizationId)
      .in("okr_objective_id", objectiveIds)
      .order("okr_objective_id", { ascending: true })
      .order("created_at", { ascending: true });
    keyResults = (krRes.data ?? []) as typeof keyResults;
  }

  const keyResultIds = keyResults.map((k) => k.id);
  let initiativeKrLinks: InitiativeKrLinkRow[] = [];
  let linkMetaRows: Array<{
    initiative_id: string;
    key_result_id: string;
    llm_level: "low" | "medium" | "high" | null;
    llm_reason: string | null;
    llm_run_id: string | null;
    confirmed_level: "low" | "medium" | "high" | null;
    confirmation_status: "none" | "pending" | "accepted" | "rejected" | "manual";
  }> = [];
  if (keyResultIds.length > 0) {
    const linkRes = await supabase
      .schema("app")
      .from("initiative_key_result_links")
      .select(
        "initiative_id, key_result_id, llm_level, llm_reason, llm_run_id, confirmed_level, confirmation_status"
      )
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .in("key_result_id", keyResultIds);
    linkMetaRows = (linkRes.data ?? []) as typeof linkMetaRows;
    initiativeKrLinks = linkMetaRows.map((r) => ({
      initiative_id: r.initiative_id,
      key_result_id: r.key_result_id,
    }));
  }

  const latestRunByKrId = new Map<
    string,
    { status: "ok" | "insufficient_context" | "failed"; insufficientContextReason: string | null }
  >();
  if (keyResultIds.length > 0) {
    const { data: runs } = await supabase
      .schema("app")
      .from("kr_initiative_matching_runs")
      .select("key_result_id, status, insufficient_context_reason, created_at")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .in("key_result_id", keyResultIds)
      .order("created_at", { ascending: false });
    for (const run of runs ?? []) {
      const keyResultId = run.key_result_id as string;
      if (latestRunByKrId.has(keyResultId)) continue;
      latestRunByKrId.set(keyResultId, {
        status: run.status as "ok" | "insufficient_context" | "failed",
        insufficientContextReason: (run.insufficient_context_reason as string | null) ?? null,
      });
    }
  }

  const krTitleById = new Map(keyResults.map((k) => [k.id, k.title]));
  const initiativeTitleById = new Map(initiativesRaw.map((i) => [i.id, i.title]));
  const krToInitiatives = initiativeIdsByKeyResultId(initiativeKrLinks);
  const linksByKrId = new Map<string, typeof linkMetaRows>();
  for (const row of linkMetaRows) {
    const list = linksByKrId.get(row.key_result_id) ?? [];
    list.push(row);
    linksByKrId.set(row.key_result_id, list);
  }

  const initiatives: OkrPlanningInitiativeRow[] = initiativesRaw.map((row) => {
    const resolution = resolveStrategicDirectionForInitiative(
      { id: row.id, program_id: row.program_id },
      programById,
      targetLinks,
      annualTargetById
    );
    const directionId = resolution.directionId;
    const linkedKrTitles = initiativeKrLinks
      .filter((l) => l.initiative_id === row.id)
      .map((l) => krTitleById.get(l.key_result_id))
      .filter((t): t is string => Boolean(t));

    return {
      id: row.id,
      title: row.title,
      status: row.status,
      weight: row.weight ?? 3,
      progressPercent: row.progress_percent ?? 0,
      lastReviewUpdateAt: row.last_review_update_at ?? null,
      startDate: row.start_date,
      endDate: row.end_date,
      ownerMembershipId: row.owner_membership_id,
      ownerDisplayName: row.owner_membership_id
        ? ownerByMembership.get(row.owner_membership_id) ?? null
        : null,
      programId: row.program_id,
      programTitle: row.program_id ? programTitleById.get(row.program_id) ?? null : null,
      strategicDirectionId: directionId,
      strategicDirectionTitle: directionId ? directionTitleById.get(directionId) ?? null : null,
      linkedKeyResultTitles: linkedKrTitles,
      warningNoKeyResultLink: initiativeWarningNoKeyResultLink(row.id, initiativeKrLinks),
    };
  });

  const keyResultsByObjective = new Map<string, typeof keyResults>();
  for (const kr of keyResults) {
    const list = keyResultsByObjective.get(kr.okr_objective_id) ?? [];
    list.push(kr);
    keyResultsByObjective.set(kr.okr_objective_id, list);
  }

  const okrObjectivesBase: OkrPlanningObjectiveRow[] = objectives.map((obj) => {
    const legacyDir =
      (obj as { leading_strategic_direction_id?: string | null }).leading_strategic_direction_id ??
      null;
    const krs = (keyResultsByObjective.get(obj.id) ?? []).map((kr) => {
      const iids = krToInitiatives.get(kr.id) ?? [];
      const krOwner = kr.owner_membership_id;
      const krDeputy = kr.deputy_membership_id;
      return {
        id: kr.id,
        objectiveId: kr.okr_objective_id,
        title: kr.title,
        status: kr.status,
        metricType: kr.metric_type,
        startValue: kr.start_value,
        targetValue: kr.target_value,
        currentValue: kr.current_value,
        measurementUnit: kr.measurement_unit,
        dueDate: kr.due_date,
        updatedAt: kr.updated_at,
        ownerMembershipId: krOwner,
        ownerDisplayName: krOwner ? ownerByMembership.get(krOwner) ?? null : null,
        deputyMembershipId: krDeputy,
        deputyDisplayName: krDeputy ? ownerByMembership.get(krDeputy) ?? null : null,
        linkedInitiativeIds: iids,
        linkedInitiativeTitles: iids.map((id) => initiativeTitleById.get(id) ?? id),
        warningNoInitiativeLink: keyResultWarningNoInitiativeLink(kr.id, initiativeKrLinks),
        initiativeSuggestions: (linksByKrId.get(kr.id) ?? []).map((r) => ({
          initiativeId: r.initiative_id,
          initiativeTitle: initiativeTitleById.get(r.initiative_id) ?? r.initiative_id,
          llmLevel: r.llm_level ?? null,
          llmReason: r.llm_reason ?? null,
          confirmedLevel: r.confirmed_level ?? null,
          confirmationStatus: r.confirmation_status ?? "none",
          llmRunId: r.llm_run_id ?? null,
        })),
        latestMatchingRun: latestRunByKrId.get(kr.id) ?? null,
      };
    });
    const atLinks = atOkrLinksByObjectiveId.get(obj.id) ?? [];
    const initLinks = initOkrLinksByObjectiveId.get(obj.id) ?? [];
    const derived = deriveOkrStrategicDirection({
      leadingStrategicDirectionId: legacyDir,
      annualTargetLinks: atLinks,
      initiativeObjectiveLinks: initLinks,
      krInitiativeLinks: (keyResultsByObjective.get(obj.id) ?? []).flatMap((kr) =>
        (krToInitiatives.get(kr.id) ?? []).map((initiativeId) => ({
          initiativeId,
          programDirectionId: programDirectionForInitiative(initiativeId),
        }))
      ),
    });
    const dirId = derived.directionId;
    const objDeputy = obj.deputy_membership_id;
    const linkedAnnualTargetIds = atLinks.map((l) => l.annualTargetId);
    const linkedInitiativeIds = initLinks.map((l) => l.initiativeId);
    return {
      id: obj.id,
      title: obj.title,
      description: obj.description,
      status: obj.status,
      ownerMembershipId: obj.owner_membership_id,
      ownerDisplayName: obj.owner_membership_id
        ? ownerByMembership.get(obj.owner_membership_id) ?? null
        : null,
      deputyMembershipId: objDeputy,
      deputyDisplayName: objDeputy ? ownerByMembership.get(objDeputy) ?? null : null,
      leadingStrategicDirectionId: dirId,
      leadingStrategicDirectionTitle: dirId ? directionTitleById.get(dirId) ?? null : null,
      warningNoChangeAnchor: derived.warning === "no_change_anchor",
      warningDirectionConflict: derived.warning === "objective_direction_conflict",
      strategicDirectionDerived: derived.source !== "legacy_direct" && derived.source !== "unresolved",
      linkedAnnualTargetIds,
      linkedAnnualTargetTitles: linkedAnnualTargetIds.map(
        (id) => annualTargetTitleById.get(id) ?? id
      ),
      linkedInitiativeIds,
      linkedInitiativeTitles: linkedInitiativeIds.map(
        (id) => initiativeTitleById.get(id) ?? id
      ),
      keyResults: krs,
      contributionEdges: [],
    };
  });

  let okrObjectives = okrObjectivesBase;
  if (objectiveIds.length > 0) {
    const { data: edgeRows } = await supabase
      .schema("app")
      .from("okr_contribution_edges")
      .select(
        "okr_objective_id, target_type, target_id, llm_level, llm_alignment_level, llm_ambition_level, llm_formulation_level, llm_scope_fit_level, llm_reason, llm_tension_note, confirmed_level, value_source, llm_suggestion_dismissed"
      )
      .eq("organization_id", organizationId)
      .in("okr_objective_id", objectiveIds);

    const soIds = [
      ...new Set(
        (edgeRows ?? [])
          .filter((e) => e.target_type === "strategy_objective")
          .map((e) => e.target_id as string)
      ),
    ];
    const dirIds = [
      ...new Set(
        (edgeRows ?? [])
          .filter((e) => e.target_type === "strategic_direction")
          .map((e) => e.target_id as string)
      ),
    ];
    const soTitleById = new Map<string, string>();
    if (soIds.length > 0) {
      const { data: soRows } = await supabase
        .schema("app")
        .from("strategy_objectives")
        .select("id, title")
        .eq("organization_id", organizationId)
        .in("id", soIds);
      for (const r of soRows ?? []) {
        soTitleById.set(r.id, r.title);
      }
    }
    const dirTitleById = new Map<string, string>();
    if (dirIds.length > 0) {
      const { data: dirRows } = await supabase
        .schema("app")
        .from("strategic_directions")
        .select("id, title")
        .eq("organization_id", organizationId)
        .in("id", dirIds);
      for (const r of dirRows ?? []) {
        dirTitleById.set(r.id as string, r.title as string);
      }
    }

    const edgesByOkr = new Map<string, OkrContributionEdgePlanningRow[]>();
    for (const e of edgeRows ?? []) {
      const oid = e.okr_objective_id as string;
      const tt = e.target_type as string;
      if (tt !== "initiative" && tt !== "strategy_objective" && tt !== "strategic_direction") {
        continue;
      }
      const targetType = tt as OkrContributionEdgePlanningRow["targetType"];
      const targetId = e.target_id as string;
      const targetTitle =
        targetType === "initiative"
          ? initiativeTitleById.get(targetId) ?? targetId
          : targetType === "strategic_direction"
            ? dirTitleById.get(targetId) ?? targetId
            : soTitleById.get(targetId) ?? targetId;
      const row: OkrContributionEdgePlanningRow = {
        targetType,
        targetId,
        targetTitle,
        llmLevel: (e.llm_level as OkrContributionEdgePlanningRow["llmLevel"]) ?? null,
        llmAlignmentLevel:
          (e.llm_alignment_level as OkrContributionEdgePlanningRow["llmAlignmentLevel"]) ?? null,
        llmAmbitionLevel:
          (e.llm_ambition_level as OkrContributionEdgePlanningRow["llmAmbitionLevel"]) ?? null,
        llmFormulationLevel:
          (e.llm_formulation_level as OkrContributionEdgePlanningRow["llmFormulationLevel"]) ??
          (e.llm_ambition_level as OkrContributionEdgePlanningRow["llmFormulationLevel"]) ??
          null,
        llmScopeFitLevel:
          (e.llm_scope_fit_level as OkrContributionEdgePlanningRow["llmScopeFitLevel"]) ?? null,
        llmReason: (e.llm_reason as string | null) ?? null,
        llmImprovementHint: (e.llm_tension_note as string | null) ?? null,
        confirmedLevel: (e.confirmed_level as OkrContributionEdgePlanningRow["confirmedLevel"]) ?? null,
        valueSource: (e.value_source as OkrContributionEdgePlanningRow["valueSource"]) ?? "none",
        llmSuggestionDismissed: Boolean(e.llm_suggestion_dismissed),
      };
      const list = edgesByOkr.get(oid) ?? [];
      list.push(row);
      edgesByOkr.set(oid, list);
    }

    okrObjectives = okrObjectivesBase.map((o) => ({
      ...o,
      contributionEdges: edgesByOkr.get(o.id) ?? [],
    }));
  }

  const responsibles: OkrResponsibleOption[] = membershipOwnerRows.map((row) => ({
    membershipId: row.id,
    fullName: okrOwnerLabelFromUserIdentity(row, identityByUserId),
  }));
  responsibles.sort((a, b) => a.fullName.localeCompare(b.fullName, "de"));

  return {
    cycleInstanceId,
    okrCycles,
    selectedOkrCycleId: effectiveOkrCycleId,
    strategicDirections: directions,
    responsibles,
    initiatives,
    annualTargets: annualTargetsForWorkspace,
    okrObjectives,
    okrKrOwnerMustMatchObjective,
    okrContributionAssessmentEnabled,
    krInitiativeMatchingEnabled,
  };
}
