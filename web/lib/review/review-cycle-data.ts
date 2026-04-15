import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_INITIATIVE_WEIGHT } from "./initiative-review-fields";
import { buildAttentionItems, type ReviewAttentionItem } from "./review-attention-rules";
import {
  buildReviewCycleInitiativeRows,
  buildReviewCycleKpis,
  buildStrategicDirectionReviewSummaries,
  type ReviewCycleInitiativeInput,
  type ReviewCycleKpis,
  type ReviewCycleProgramRow,
  type StrategicDirectionReviewSummary,
} from "./review-cycle-view-model";

const INITIATIVE_SELECT_WITH_REVIEW_ROLLUP =
  "id, title, status, priority, program_id, owner_membership_id, start_date, end_date, execution_health_override, execution_health_override_by_membership_id, execution_health_override_at, review_comment, weight, progress_percent, last_review_update_at";

const INITIATIVE_SELECT_LEGACY =
  "id, title, status, priority, program_id, owner_membership_id, start_date, end_date, execution_health_override, execution_health_override_by_membership_id, execution_health_override_at, review_comment";

function isMissingReviewRollupColumnsError(message: string): boolean {
  if (!message.includes("does not exist")) return false;
  return (
    message.includes("weight") ||
    message.includes("progress_percent") ||
    message.includes("last_review_update_at")
  );
}

/** DB ohne Migration 0114: keine Tabelle app.strategy_objectives im PostgREST-Cache / Schema. */
function isMissingStrategyObjectivesTable(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("strategy_objectives") &&
    (m.includes("schema cache") || m.includes("does not exist") || m.includes("could not find"))
  );
}

/** DB ohne Umbenennung 0114: strategic_direction_objective_links.objective_id statt strategy_objective_id. */
function isMissingStrategyObjectiveIdColumn(message: string | undefined): boolean {
  if (!message) return false;
  return message.includes("strategy_objective_id") && message.includes("does not exist");
}

function shouldUseLegacyReviewCycleObjectiveModel(
  objErr: { message?: string } | null,
  linkErr: { message?: string } | null
): boolean {
  return isMissingStrategyObjectivesTable(objErr?.message) || isMissingStrategyObjectiveIdColumn(linkErr?.message);
}

function isMissingOkrObjectivesTable(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("okr_objectives") &&
    (m.includes("schema cache") || m.includes("does not exist") || m.includes("could not find"))
  );
}

function isMissingKeyResultsOkrObjectiveIdColumn(message: string | undefined): boolean {
  if (!message) return false;
  return message.includes("okr_objective_id") && message.includes("does not exist");
}

async function fetchInitiativesForReviewCycle(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  cycleIds: string[]
) {
  const first = await supabase
    .schema("app")
    .from("initiatives")
    .select(INITIATIVE_SELECT_WITH_REVIEW_ROLLUP)
    .eq("organization_id", organizationId)
    .in("cycle_instance_id", cycleIds);

  if (!first.error) return first;

  if (isMissingReviewRollupColumnsError(first.error.message)) {
    console.warn(
      "[getReviewCycleData] initiatives: Spalten weight/progress_percent/last_review_update_at fehlen \u2014 Fallback ohne Roll-up. Bitte Migration 0073_review_initiative_rollup.sql auf dieser Datenbank ausf\u00FChren (gleiche DB wie NEXT_PUBLIC_SUPABASE / Service-Role)."
    );
    return supabase
      .schema("app")
      .from("initiatives")
      .select(INITIATIVE_SELECT_LEGACY)
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", cycleIds);
  }

  return first;
}

async function getCycleInstanceIdsForReview(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  cycleInstanceId: string
): Promise<string[]> {
  const ids = new Set<string>([cycleInstanceId]);
  let currentId: string | null = cycleInstanceId;

  while (currentId) {
    const parentRow = await supabase
      .schema("app")
      .from("cycle_instances")
      .select("parent_instance_id")
      .eq("id", currentId)
      .maybeSingle();
    const data = parentRow.data as { parent_instance_id: string | null } | null;
    const parentId = data?.parent_instance_id ?? null;
    if (!parentId) break;
    ids.add(parentId);
    currentId = parentId;
  }

  let frontier: string[] = [cycleInstanceId];
  while (frontier.length > 0) {
    const { data: children } = await supabase
      .schema("app")
      .from("cycle_instances")
      .select("id")
      .in("parent_instance_id", frontier);
    const childIds = ((children ?? []) as Array<{ id: string }>).map((c) => c.id);
    if (childIds.length === 0) break;
    childIds.forEach((id) => ids.add(id));
    frontier = childIds;
  }

  return [...ids];
}

export type ReviewCycleAnnualTargetBrief = {
  id: string;
  strategic_direction_id: string;
  title: string;
  progress_percent: number;
};

/** Aktive Organisationsmitglieder fuer Review-Owner-Auswahl (Namen + Rollen aus dem Tenant). */
export type ReviewCycleOwnerOption = {
  membership_id: string;
  display_name: string;
  roles_label: string;
};

type OrgMembershipOwnerRow = {
  id: string;
  user_id: string;
  status: string;
  display_name: string | null;
  title: string | null;
  responsible:
    | {
        full_name: string;
        email: string | null;
        role_title: string | null;
      }
    | Array<{
        full_name: string;
        email: string | null;
        role_title: string | null;
      }>
    | null;
};

type MemberRoleAssignmentRow = {
  membership_id: string;
  role: { name: string } | { name: string }[] | null;
};

function normalizeMembershipResponsible(m: OrgMembershipOwnerRow) {
  const r = m.responsible;
  return Array.isArray(r) ? r[0] ?? null : r;
}

function baseDisplayNameForMembership(
  m: OrgMembershipOwnerRow,
  identityByUserId: Map<string, { email: string | null; name: string | null }>
): string {
  const responsible = normalizeMembershipResponsible(m);
  const identity = identityByUserId.get(m.user_id);
  const displayEmail = identity?.email ?? responsible?.email ?? null;
  const orgDisplay = m.display_name?.trim() ? m.display_name.trim() : null;
  return (
    orgDisplay ??
    identity?.name ??
    responsible?.full_name ??
    (displayEmail ? displayEmail.split("@")[0] : "Mitglied")
  );
}

async function loadReviewCycleOwnerContext(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  initiativeOwnerMembershipIds: (string | null)[]
): Promise<{
  ownerLabelByMembershipId: Map<string, string>;
  ownerOptions: ReviewCycleOwnerOption[];
}> {
  const ownerIdsFromInitiatives = new Set(
    initiativeOwnerMembershipIds.filter((x): x is string => Boolean(x))
  );

  const { data: activeMembersRaw, error: activeErr } = await supabase
    .schema("app")
    .from("organization_memberships")
    .select(
      "id, user_id, status, display_name, title, responsible:responsible_id(full_name, email, role_title)"
    )
    .eq("organization_id", organizationId)
    .eq("status", "active");

  if (activeErr) {
    console.error("[getReviewCycleData] organization_memberships (active)", activeErr.message);
  }

  const activeMembers = (activeMembersRaw ?? []) as OrgMembershipOwnerRow[];
  const activeIdSet = new Set(activeMembers.map((m) => m.id));
  const missingForLabels = [...ownerIdsFromInitiatives].filter((id) => !activeIdSet.has(id));

  let extraMembers: OrgMembershipOwnerRow[] = [];
  if (missingForLabels.length > 0) {
    const { data: extraRaw, error: extraErr } = await supabase
      .schema("app")
      .from("organization_memberships")
      .select(
        "id, user_id, status, display_name, title, responsible:responsible_id(full_name, email, role_title)"
      )
      .eq("organization_id", organizationId)
      .in("id", missingForLabels);
    if (extraErr) {
      console.error("[getReviewCycleData] organization_memberships (extra owners)", extraErr.message);
    }
    extraMembers = (extraRaw ?? []) as OrgMembershipOwnerRow[];
  }

  const allMembers = [...activeMembers, ...extraMembers];
  const allIds = [...new Set(allMembers.map((m) => m.id))];

  const roleNamesByMembership = new Map<string, string[]>();
  if (allIds.length > 0) {
    const { data: roleRows, error: roleErr } = await supabase
      .schema("rbac")
      .from("member_roles")
      .select("membership_id, role:role_id(name)")
      .in("membership_id", allIds);
    if (roleErr) {
      console.error("[getReviewCycleData] member_roles", roleErr.message);
    }
    for (const row of (roleRows ?? []) as MemberRoleAssignmentRow[]) {
      const roleVal = Array.isArray(row.role) ? row.role[0] : row.role;
      const name = roleVal?.name?.trim();
      if (!name) continue;
      const list = roleNamesByMembership.get(row.membership_id) ?? [];
      list.push(name);
      roleNamesByMembership.set(row.membership_id, list);
    }
    for (const [k, names] of [...roleNamesByMembership.entries()]) {
      roleNamesByMembership.set(
        k,
        [...new Set(names)].sort((a, b) => a.localeCompare(b, "de"))
      );
    }
  }

  const identityByUserId = new Map<string, { email: string | null; name: string | null }>();
  const adminClient = createSupabaseAdminClient();
  const uniqueUserIds = [...new Set(allMembers.map((m) => m.user_id))];
  if (adminClient && uniqueUserIds.length > 0) {
    await Promise.all(
      uniqueUserIds.map(async (userId) => {
        const { data } = await adminClient.auth.admin.getUserById(userId);
        const email = data.user?.email?.toLowerCase() ?? null;
        const metadata =
          data.user?.user_metadata && typeof data.user.user_metadata === "object"
            ? (data.user.user_metadata as Record<string, unknown>)
            : null;
        const fullNameRaw = metadata?.full_name ?? metadata?.name ?? metadata?.display_name ?? null;
        const fullName =
          typeof fullNameRaw === "string" && fullNameRaw.trim().length > 0 ? fullNameRaw.trim() : null;
        identityByUserId.set(userId, { email, name: fullName });
      })
    );
  }

  const ownerLabelByMembershipId = new Map<string, string>();
  const ownerOptions: ReviewCycleOwnerOption[] = [];

  const pushLabel = (membershipId: string, displayName: string, rolesSorted: string[]) => {
    const roles_label = rolesSorted.join(", ");
    const label = roles_label.length > 0 ? `${displayName} · ${roles_label}` : displayName;
    ownerLabelByMembershipId.set(membershipId, label);
  };

  for (const m of extraMembers) {
    const displayName = baseDisplayNameForMembership(m, identityByUserId);
    const rolesSorted = roleNamesByMembership.get(m.id) ?? [];
    pushLabel(m.id, displayName, rolesSorted);
  }

  for (const m of activeMembers) {
    const displayName = baseDisplayNameForMembership(m, identityByUserId);
    const rolesSorted = roleNamesByMembership.get(m.id) ?? [];
    pushLabel(m.id, displayName, rolesSorted);
    ownerOptions.push({
      membership_id: m.id,
      display_name: displayName,
      roles_label: rolesSorted.join(", "),
    });
  }

  ownerOptions.sort((a, b) =>
    a.display_name.localeCompare(b.display_name, "de", { sensitivity: "base" })
  );

  return { ownerLabelByMembershipId, ownerOptions };
}

export type ReviewCycleData = {
  initiativeRows: ReviewCycleInitiativeInput[];
  directionSummaries: StrategicDirectionReviewSummary[];
  attentionItems: ReviewAttentionItem[];
  kpis: ReviewCycleKpis;
  directions: Array<{ id: string; title: string; status: string; priority: number }>;
  ownerOptions: ReviewCycleOwnerOption[];
  annualTargetsByDirectionId: Record<string, ReviewCycleAnnualTargetBrief[]>;
  cycleInstanceId: string;
};

export async function getReviewCycleData(
  organizationId: string,
  cycleInstanceId: string
): Promise<ReviewCycleData> {
  const supabase = await createSupabaseServerClient();
  const cycleIds = await getCycleInstanceIdsForReview(supabase, cycleInstanceId);

  const [
    directionsResult,
    programsResult,
    initiativesResult,
    linksResult,
    targetsResult,
  ] = await Promise.all([
    supabase
      .schema("app")
      .from("strategic_directions")
      .select("id, title, status, priority")
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", cycleIds)
      .order("priority", { ascending: true }),
    supabase
      .schema("app")
      .from("strategy_programs")
      .select("id, title, strategic_direction_id")
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", cycleIds),
    supabase
      .schema("app")
      .from("initiatives")
      .select(
        "id, title, status, priority, program_id, owner_membership_id, start_date, end_date, execution_health_override, execution_health_override_by_membership_id, execution_health_override_at, review_comment, weight, progress_percent, last_review_update_at"
      )
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", cycleIds),
    supabase
      .schema("app")
      .from("initiative_target_links")
      .select("initiative_id, annual_target_id")
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", cycleIds),
    supabase
      .schema("app")
      .from("annual_targets")
      .select("id, strategic_direction_id, title, progress_percent")
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", cycleIds),
  ]);

  let objectivesResult = await supabase
    .schema("app")
    .from("strategy_objectives")
    .select("id, title")
    .eq("organization_id", organizationId)
    .in("cycle_instance_id", cycleIds);

  let dirObjLinksResult = await supabase
    .schema("app")
    .from("strategic_direction_objective_links")
    .select("strategic_direction_id, strategy_objective_id")
    .eq("organization_id", organizationId);

  if (shouldUseLegacyReviewCycleObjectiveModel(objectivesResult.error, dirObjLinksResult.error)) {
    objectivesResult = await supabase
      .schema("app")
      .from("objectives")
      .select("id, title")
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", cycleIds);
    dirObjLinksResult = (await supabase
      .schema("app")
      .from("strategic_direction_objective_links")
      .select("strategic_direction_id, objective_id")
      .eq("organization_id", organizationId)) as typeof dirObjLinksResult;
    if (objectivesResult.error) {
      console.error("[getReviewCycleData] objectives (legacy app.objectives)", objectivesResult.error.message);
    }
    if (dirObjLinksResult.error) {
      console.error("[getReviewCycleData] dirObjLinks (legacy objective_id)", dirObjLinksResult.error.message);
    }
  } else {
    for (const label of ["objectives", "dirObjLinks"] as const) {
      const err =
        label === "objectives" ? objectivesResult.error : dirObjLinksResult.error;
      if (err) console.error(`[getReviewCycleData] ${label}`, err.message);
    }
  }

  for (const label of ["directions", "programs", "initiatives", "links", "targets"] as const) {
    const err =
      label === "directions"
        ? directionsResult.error
        : label === "programs"
          ? programsResult.error
          : label === "initiatives"
            ? initiativesResult.error
            : label === "links"
              ? linksResult.error
              : targetsResult.error;
    if (err) console.error(`[getReviewCycleData] ${label}`, err.message);
  }

  const directions = (directionsResult.data ?? []) as Array<{
    id: string;
    title: string;
    status: string;
    priority: number;
  }>;
  const programs = (programsResult.data ?? []) as Array<{
    id: string;
    title: string;
    strategic_direction_id: string | null;
  }>;
  const initiativesRaw = (initiativesResult.data ?? []) as Array<{
    id: string;
    title: string;
    status: string;
    priority: number | null;
    program_id: string | null;
    owner_membership_id: string | null;
    start_date: string | null;
    end_date: string | null;
    execution_health_override: string | null;
    execution_health_override_by_membership_id: string | null;
    execution_health_override_at: string | null;
    review_comment: string | null;
    weight: number | null;
    progress_percent: number | null;
    last_review_update_at: string | null;
  }>;

  const { ownerLabelByMembershipId, ownerOptions } = await loadReviewCycleOwnerContext(
    supabase,
    organizationId,
    initiativesRaw.map((r) => r.owner_membership_id)
  );

  const targetLinks = (linksResult.data ?? []) as Array<{
    initiative_id: string;
    annual_target_id: string;
  }>;
  const annualTargets = (targetsResult.data ?? []) as Array<{
    id: string;
    strategic_direction_id: string;
    title: string;
    progress_percent: number;
  }>;
  const objectives = (objectivesResult.data ?? []) as Array<{ id: string; title: string }>;
  const directionObjectiveLinksRaw = (dirObjLinksResult.data ?? []) as Array<{
    strategic_direction_id: string;
    strategy_objective_id?: string;
    objective_id?: string;
  }>;
  const directionObjectiveLinks = directionObjectiveLinksRaw
    .map((l) => ({
      strategic_direction_id: l.strategic_direction_id,
      objective_id: l.strategy_objective_id ?? l.objective_id ?? "",
    }))
    .filter((l) => l.objective_id.length > 0);

  const objectiveIds = new Set(objectives.map((o) => o.id));
  const directionIds = new Set(directions.map((d) => d.id));

  const filteredDirObjLinks = directionObjectiveLinks.filter(
    (l) => directionIds.has(l.strategic_direction_id) && objectiveIds.has(l.objective_id)
  );

  let okrObjectiveIds = new Set<string>();
  const okrInCyclesRes = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id")
    .eq("organization_id", organizationId)
    .in("cycle_instance_id", cycleIds);

  if (!okrInCyclesRes.error) {
    okrObjectiveIds = new Set((okrInCyclesRes.data ?? []).map((r) => r.id));
  } else if (isMissingOkrObjectivesTable(okrInCyclesRes.error.message)) {
    const legacy = await supabase
      .schema("app")
      .from("objectives")
      .select("id")
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", cycleIds)
      .not("okr_cycle_id", "is", null);
    if (legacy.error) {
      console.error("[getReviewCycleData] objectives for KR scope (legacy)", legacy.error.message);
    } else {
      okrObjectiveIds = new Set((legacy.data ?? []).map((r) => r.id));
    }
  } else {
    console.error("[getReviewCycleData] okr_objectives", okrInCyclesRes.error.message);
  }

  let keyResultsQuery =
    okrObjectiveIds.size > 0
      ? await supabase
          .schema("app")
          .from("key_results")
          .select("id, okr_objective_id, title, due_date, status")
          .eq("organization_id", organizationId)
          .in("okr_objective_id", [...okrObjectiveIds])
      : { data: [] as unknown[], error: null };

  if (keyResultsQuery.error && isMissingKeyResultsOkrObjectiveIdColumn(keyResultsQuery.error.message)) {
    keyResultsQuery = await supabase
      .schema("app")
      .from("key_results")
      .select("id, objective_id, title, due_date, status")
      .eq("organization_id", organizationId)
      .in("objective_id", [...okrObjectiveIds]);
  }

  if (keyResultsQuery.error) {
    console.error("[getReviewCycleData] key_results", keyResultsQuery.error.message);
  }

  const keyResults = (keyResultsQuery.data ?? []).map((kr) => {
    const r = kr as {
      id: string;
      okr_objective_id?: string;
      objective_id?: string;
      title: string;
      due_date: string | null;
      status: string;
    };
    const objId = r.okr_objective_id ?? r.objective_id ?? "";
    return {
      id: r.id,
      objective_id: objId,
      title: r.title,
      due_date: r.due_date,
      status: r.status,
    };
  }).filter((r) => r.objective_id.length > 0);

  const programById = new Map<string, ReviewCycleProgramRow>(
    programs.map((p) => [p.id, { id: p.id, strategic_direction_id: p.strategic_direction_id }])
  );
  const programTitleById = new Map(programs.map((p) => [p.id, p.title]));
  const annualTargetById = new Map(annualTargets.map((t) => [t.id, t]));

  const now = new Date();
  let overdueKeyResultCount = 0;
  for (const kr of keyResults) {
    if (!kr.due_date) continue;
    if (new Date(kr.due_date) >= now) continue;
    if (kr.status === "completed" || kr.status === "archived") continue;
    overdueKeyResultCount += 1;
  }

  const initiatives = initiativesRaw.map((row) => ({
    ...row,
    priority: row.priority ?? 3,
    weight: row.weight ?? DEFAULT_INITIATIVE_WEIGHT,
    progress_percent: row.progress_percent ?? 0,
    program_title: row.program_id ? programTitleById.get(row.program_id) ?? null : null,
    owner_display_name: row.owner_membership_id
      ? ownerLabelByMembershipId.get(row.owner_membership_id) ?? null
      : null,
  }));

  const initiativeRows = buildReviewCycleInitiativeRows(
    initiatives,
    programById,
    programTitleById,
    targetLinks,
    annualTargetById
  );

  const directionSummaries = buildStrategicDirectionReviewSummaries(directions, initiativeRows);
  const attentionItems = buildAttentionItems(initiativeRows, directionSummaries, directions);
  const kpis = buildReviewCycleKpis(directionSummaries, initiativeRows, overdueKeyResultCount);

  const annualTargetsByDirectionId: Record<string, ReviewCycleAnnualTargetBrief[]> = {};
  for (const t of annualTargets) {
    const list = annualTargetsByDirectionId[t.strategic_direction_id] ?? [];
    list.push({
      id: t.id,
      strategic_direction_id: t.strategic_direction_id,
      title: t.title,
      progress_percent: Number(t.progress_percent),
    });
    annualTargetsByDirectionId[t.strategic_direction_id] = list;
  }

  return {
    initiativeRows,
    directionSummaries,
    attentionItems,
    kpis,
    directions,
    ownerOptions,
    annualTargetsByDirectionId,
    cycleInstanceId,
  };
}
