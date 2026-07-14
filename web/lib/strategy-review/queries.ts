import {
  buildCoverageIndex,
  type StrategyReviewCoverageIndex,
} from "@/lib/strategy-review/execution-coverage";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ReviewTriggerState, StrategyReviewRow } from "@/lib/strategy-review/types";
import {
  isStrategyReviewParticipantRole,
  type StrategyReviewMemberOption,
  type StrategyReviewParticipant,
  type StrategyReviewParticipantRole,
} from "@/lib/strategy-review/participants";
import {
  buildStrategyReviewChainHubs,
  buildStrategyReviewChainHubsFromPayload,
  preReadPayloadHasChainLinks,
  type StrategyReviewChainHub,
  type StrategyReviewChainItem,
  isArchivedStrategyReviewItem,
} from "@/lib/strategy-review/pre-read-chain";

export type { StrategyReviewCoverageIndex };

export async function fetchReviewTriggerState(cycleInstanceId: string): Promise<ReviewTriggerState | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema("app").rpc("get_review_trigger_state", {
    p_cycle_instance_id: cycleInstanceId,
  });
  if (error) {
    console.error("get_review_trigger_state", error);
    return null;
  }
  return data as ReviewTriggerState;
}

export async function fetchStrategyReviewRow(
  organizationId: string,
  cycleInstanceId: string
): Promise<StrategyReviewRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("app")
    .from("okr_reviews")
    .select(
      "id, organization_id, cycle_instance_id, review_mode, procedure_status, review_lead_time_days, readiness_status, override_forced, override_reason, pre_read_payload, stakeholder_feedback_payload, decision_payload, release_summary, released_to_cycle_instance_id, released_at, announcement_sent_at, announcement_payload, meeting_notes"
    )
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .eq("review_mode", "strategy_review")
    .maybeSingle();

  if (error) {
    console.error("fetchStrategyReviewRow", error);
    return null;
  }
  if (!data) return null;
  return {
    ...data,
    pre_read_payload: (data.pre_read_payload as Record<string, unknown>) ?? {},
    stakeholder_feedback_payload: (data.stakeholder_feedback_payload as Record<string, unknown>) ?? {},
    decision_payload: (data.decision_payload as Record<string, unknown>) ?? {},
    release_summary: (data.release_summary as Record<string, unknown>) ?? {},
    announcement_payload: (data.announcement_payload as Record<string, unknown>) ?? {},
    meeting_notes: typeof data.meeting_notes === "string" ? data.meeting_notes : "",
  } as StrategyReviewRow;
}

export async function fetchStrategyReviewFeedbackEntries(reviewId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("app")
    .from("strategy_review_feedback_entries")
    .select("id, subject_type, subject_id, actor_id, rating, comment, created_at")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchStrategyReviewFeedbackEntries", error);
    return [];
  }
  return data ?? [];
}

type MembershipNameRow = {
  id: string;
  display_name: string | null;
  title: string | null;
  responsible:
    | { full_name: string | null }
    | Array<{ full_name: string | null }>
    | null;
};

type MemberRoleRow = {
  membership_id: string;
  role: { name: string | null } | Array<{ name: string | null }> | null;
};

function membershipDisplayName(m: MembershipNameRow): string {
  const responsible = Array.isArray(m.responsible) ? m.responsible[0] : m.responsible;
  return (
    m.display_name?.trim() ||
    responsible?.full_name?.trim() ||
    m.title?.trim() ||
    "Mitglied"
  );
}

async function loadOrgRolesByMembership(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  membershipIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (membershipIds.length === 0) return map;

  const { data, error } = await supabase
    .schema("rbac")
    .from("member_roles")
    .select("membership_id, role:role_id(name)")
    .in("membership_id", membershipIds);

  if (error) {
    console.error("loadOrgRolesByMembership", error);
    return map;
  }

  const namesById = new Map<string, string[]>();
  for (const row of (data ?? []) as MemberRoleRow[]) {
    const roleVal = Array.isArray(row.role) ? row.role[0] : row.role;
    const name = roleVal?.name?.trim();
    if (!name) continue;
    const list = namesById.get(row.membership_id) ?? [];
    list.push(name);
    namesById.set(row.membership_id, list);
  }

  for (const [id, names] of namesById) {
    map.set(
      id,
      [...new Set(names)].sort((a, b) => a.localeCompare(b, "de")).join(", ")
    );
  }
  return map;
}

export async function fetchStrategyReviewMemberOptions(
  organizationId: string
): Promise<StrategyReviewMemberOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("app")
    .from("organization_memberships")
    .select("id, display_name, title, responsible:responsible_id(full_name)")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("display_name", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("fetchStrategyReviewMemberOptions", error);
    return [];
  }

  const members = (data ?? []) as MembershipNameRow[];
  const rolesByMembership = await loadOrgRolesByMembership(
    supabase,
    members.map((m) => m.id)
  );

  return members
    .map((m) => ({
      membership_id: m.id,
      display_name: membershipDisplayName(m),
      org_roles_label: rolesByMembership.get(m.id) ?? "",
    }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name, "de"));
}

export async function fetchStrategyReviewParticipants(
  reviewId: string
): Promise<StrategyReviewParticipant[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("app")
    .from("strategy_review_participants")
    .select("id, review_id, membership_id, review_role, invited_at")
    .eq("review_id", reviewId)
    .order("invited_at", { ascending: true });

  if (error) {
    console.error("fetchStrategyReviewParticipants", error);
    return [];
  }

  const rows = (data ?? []) as Array<{
    id: string;
    review_id: string;
    membership_id: string;
    review_role: string;
    invited_at: string;
  }>;

  if (rows.length === 0) return [];

  const membershipIds = [...new Set(rows.map((r) => r.membership_id))];
  const { data: membersRaw, error: membersErr } = await supabase
    .schema("app")
    .from("organization_memberships")
    .select("id, display_name, title, responsible:responsible_id(full_name)")
    .in("id", membershipIds);

  if (membersErr) {
    console.error("fetchStrategyReviewParticipants memberships", membersErr);
  }

  const members = (membersRaw ?? []) as MembershipNameRow[];
  const nameById = new Map(members.map((m) => [m.id, membershipDisplayName(m)]));
  const rolesByMembership = await loadOrgRolesByMembership(supabase, membershipIds);

  return rows
    .filter((r): r is typeof r & { review_role: StrategyReviewParticipantRole } =>
      isStrategyReviewParticipantRole(r.review_role)
    )
    .map((r) => ({
      id: r.id,
      review_id: r.review_id,
      membership_id: r.membership_id,
      review_role: r.review_role,
      invited_at: r.invited_at,
      display_name: nameById.get(r.membership_id) ?? "Mitglied",
      org_roles_label: rolesByMembership.get(r.membership_id) ?? "",
    }));
}

function asChainItems(v: unknown): StrategyReviewChainItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object")
    .filter((x) => typeof x.id === "string")
    .map((x) => ({
      id: x.id as string,
      title: typeof x.title === "string" ? x.title : "Ohne Titel",
      description: typeof x.description === "string" ? x.description : null,
      status: typeof x.status === "string" ? x.status : null,
      lifecycleState:
        typeof x.identity_lifecycle_state === "string"
          ? x.identity_lifecycle_state
          : typeof x.lifecycle_state === "string"
            ? x.lifecycle_state
            : typeof x.status === "string"
              ? x.status
              : null,
      ownerLabel: typeof x.owner_label === "string" ? x.owner_label : null,
      priority: (x.priority as string | number | null | undefined) ?? null,
    }))
    .filter((item) => !isArchivedStrategyReviewItem(item));
}

/**
 * Chain-Hubs aus Pre-Read. Bei Legacy-Payload ohne Links werden Links/Programme nachgeladen.
 */
export async function resolveStrategyReviewChainHubs(
  organizationId: string,
  cycleInstanceId: string,
  payload: Record<string, unknown>
): Promise<StrategyReviewChainHub[]> {
  if (preReadPayloadHasChainLinks(payload) && Array.isArray(payload.programs)) {
    const hubs = buildStrategyReviewChainHubsFromPayload(payload);
    return enrichHubProgramsWithOverview(organizationId, hubs);
  }

  const supabase = await createSupabaseServerClient();
  let cycleIds: string[] = [cycleInstanceId];
  const scope = payload.scope;
  if (scope && typeof scope === "object") {
    const ids = (scope as Record<string, unknown>).cycle_instance_ids;
    if (Array.isArray(ids) && ids.every((x) => typeof x === "string")) {
      cycleIds = ids as string[];
    }
  } else {
    const { data: related } = await supabase.schema("app").rpc("cycle_instance_related_ids", {
      p_cycle_instance_id: cycleInstanceId,
    });
    if (Array.isArray(related) && related.every((x) => typeof x === "string")) {
      cycleIds = related as string[];
    }
  }

  const directions = asChainItems(payload.focus_areas);
  const challenges = asChainItems(payload.challenges);
  const objectives = asChainItems(payload.objectives);
  const directionIds = directions.map((d) => d.id);
  const challengeIds = new Set(challenges.map((c) => c.id));
  const objectiveIds = new Set(objectives.map((o) => o.id));

  const [cdRes, doRes, progRes] = await Promise.all([
    directionIds.length > 0
      ? supabase
          .schema("app")
          .from("challenge_direction_links")
          .select("strategic_challenge_id, strategic_direction_id")
          .eq("organization_id", organizationId)
          .in("strategic_direction_id", directionIds)
      : Promise.resolve({ data: [], error: null }),
    directionIds.length > 0
      ? supabase
          .schema("app")
          .from("strategic_direction_objective_links")
          .select("strategic_direction_id, strategy_objective_id")
          .eq("organization_id", organizationId)
          .in("strategic_direction_id", directionIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .schema("app")
      .from("strategy_programs")
      .select(
        "id, title, description, status, strategic_direction_id, start_date, end_date, budget_total, owner:owner_membership_id(display_name, responsible:responsible_id(full_name))"
      )
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", cycleIds),
  ]);

  if (cdRes.error) console.error("resolveStrategyReviewChainHubs cd", cdRes.error);
  if (doRes.error) console.error("resolveStrategyReviewChainHubs do", doRes.error);
  if (progRes.error) console.error("resolveStrategyReviewChainHubs programs", progRes.error);

  type OwnerJoin =
    | {
        display_name: string | null;
        responsible: { full_name: string | null } | Array<{ full_name: string | null }> | null;
      }
    | Array<{
        display_name: string | null;
        responsible: { full_name: string | null } | Array<{ full_name: string | null }> | null;
      }>
    | null;

  const programsBase = ((progRes.data ?? []) as Array<{
    id: string;
    title: string;
    description: string | null;
    status: string | null;
    strategic_direction_id: string | null;
    start_date: string | null;
    end_date: string | null;
    budget_total: number | string | null;
    owner: OwnerJoin;
  }>).map((p) => {
    const owner = Array.isArray(p.owner) ? p.owner[0] : p.owner;
    const responsible = owner
      ? Array.isArray(owner.responsible)
        ? owner.responsible[0]
        : owner.responsible
      : null;
    const ownerLabel =
      owner?.display_name?.trim() || responsible?.full_name?.trim() || null;
    return {
      id: p.id,
      title: p.title,
      description: p.description,
      status: p.status,
      lifecycleState: p.status,
      ownerLabel,
      strategic_direction_id: p.strategic_direction_id,
      startDate: p.start_date,
      endDate: p.end_date,
      budgetTotal:
        p.budget_total != null && Number.isFinite(Number(p.budget_total))
          ? Number(p.budget_total)
          : null,
    };
  });

  const overviewById = await fetchProgramOverviewByIds(
    organizationId,
    programsBase.map((p) => p.id)
  );
  const programs = programsBase.map((p) => {
    const o = overviewById.get(p.id);
    return {
      ...p,
      progressPercent: o?.progressPercent ?? null,
      initiativeCount: o?.initiativeCount ?? null,
      initiativeActiveCount: o?.initiativeActiveCount ?? null,
    };
  });

  const challengeDirectionLinks = ((cdRes.data ?? []) as Array<{
    strategic_challenge_id: string;
    strategic_direction_id: string;
  }>).filter((l) => challengeIds.has(l.strategic_challenge_id));

  let directionObjectiveLinks = ((doRes.data ?? []) as Array<{
    strategic_direction_id: string;
    strategy_objective_id?: string;
    objective_id?: string;
  }>).map((l) => ({
    strategic_direction_id: l.strategic_direction_id,
    strategy_objective_id: l.strategy_objective_id ?? l.objective_id ?? "",
  }));

  if (doRes.error?.message?.includes("strategy_objective_id")) {
    const legacy = await supabase
      .schema("app")
      .from("strategic_direction_objective_links")
      .select("strategic_direction_id, objective_id")
      .eq("organization_id", organizationId)
      .in("strategic_direction_id", directionIds);
    directionObjectiveLinks = ((legacy.data ?? []) as Array<{
      strategic_direction_id: string;
      objective_id: string;
    }>).map((l) => ({
      strategic_direction_id: l.strategic_direction_id,
      strategy_objective_id: l.objective_id,
    }));
  }

  directionObjectiveLinks = directionObjectiveLinks.filter((l) =>
    objectiveIds.has(l.strategy_objective_id)
  );

  return buildStrategyReviewChainHubs({
    directions,
    challenges,
    objectives,
    programs,
    challengeDirectionLinks,
    directionObjectiveLinks,
  });
}

async function fetchProgramOverviewByIds(
  organizationId: string,
  programIds: string[]
): Promise<
  Map<
    string,
    {
      progressPercent: number;
      initiativeCount: number;
      initiativeActiveCount: number;
    }
  >
> {
  const map = new Map<
    string,
    {
      progressPercent: number;
      initiativeCount: number;
      initiativeActiveCount: number;
    }
  >();
  if (programIds.length === 0) return map;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("app")
    .from("v_program_overview")
    .select("id, progress_percent, initiative_count, initiative_active_count")
    .in("id", programIds);
  if (error) {
    console.error("fetchProgramOverviewByIds", error);
    return map;
  }
  for (const row of (data ?? []) as Array<{
    id: string;
    progress_percent: number | string | null;
    initiative_count: number | string | null;
    initiative_active_count: number | string | null;
  }>) {
    map.set(row.id, {
      progressPercent: Number(row.progress_percent) || 0,
      initiativeCount: Number(row.initiative_count) || 0,
      initiativeActiveCount: Number(row.initiative_active_count) || 0,
    });
  }
  void organizationId;
  return map;
}

async function enrichHubProgramsWithOverview(
  organizationId: string,
  hubs: StrategyReviewChainHub[]
): Promise<StrategyReviewChainHub[]> {
  const ids = [...new Set(hubs.flatMap((h) => h.programs.map((p) => p.id)))];
  if (ids.length === 0) return hubs;

  const supabase = await createSupabaseServerClient();
  const [overviewById, progRes] = await Promise.all([
    fetchProgramOverviewByIds(organizationId, ids),
    supabase
      .schema("app")
      .from("strategy_programs")
      .select(
        "id, status, start_date, end_date, budget_total, owner:owner_membership_id(display_name, responsible:responsible_id(full_name))"
      )
      .eq("organization_id", organizationId)
      .in("id", ids),
  ]);

  type OwnerJoin =
    | {
        display_name: string | null;
        responsible: { full_name: string | null } | Array<{ full_name: string | null }> | null;
      }
    | Array<{
        display_name: string | null;
        responsible: { full_name: string | null } | Array<{ full_name: string | null }> | null;
      }>
    | null;

  const detailById = new Map<
    string,
    {
      status: string | null;
      startDate: string | null;
      endDate: string | null;
      budgetTotal: number | null;
      ownerLabel: string | null;
    }
  >();
  for (const row of (progRes.data ?? []) as Array<{
    id: string;
    status: string | null;
    start_date: string | null;
    end_date: string | null;
    budget_total: number | string | null;
    owner: OwnerJoin;
  }>) {
    const owner = Array.isArray(row.owner) ? row.owner[0] : row.owner;
    const responsible = owner
      ? Array.isArray(owner.responsible)
        ? owner.responsible[0]
        : owner.responsible
      : null;
    detailById.set(row.id, {
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      budgetTotal:
        row.budget_total != null && Number.isFinite(Number(row.budget_total))
          ? Number(row.budget_total)
          : null,
      ownerLabel: owner?.display_name?.trim() || responsible?.full_name?.trim() || null,
    });
  }

  return hubs.map((hub) => ({
    ...hub,
    programs: hub.programs.map((p) => {
      const o = overviewById.get(p.id);
      const d = detailById.get(p.id);
      return {
        ...p,
        status: d?.status ?? p.status,
        lifecycleState: d?.status ?? p.lifecycleState,
        ownerLabel: d?.ownerLabel ?? p.ownerLabel,
        startDate: d?.startDate ?? p.startDate,
        endDate: d?.endDate ?? p.endDate,
        budgetTotal: d?.budgetTotal ?? p.budgetTotal,
        progressPercent: o?.progressPercent ?? p.progressPercent ?? null,
        initiativeCount: o?.initiativeCount ?? p.initiativeCount ?? null,
        initiativeActiveCount: o?.initiativeActiveCount ?? p.initiativeActiveCount ?? null,
      };
    }),
  }));
}

/** Alle strategischen Ziele aus dem übergeordneten L1-Strategiezyklus (nicht nur verknüpfte). */
export async function fetchStrategyObjectivesForParentStrategyCycle(
  organizationId: string,
  reviewCycleInstanceId: string
): Promise<StrategyReviewChainItem[]> {
  const supabase = await createSupabaseServerClient();

  let currentId: string | null = reviewCycleInstanceId;
  let strategyCycleId: string | null = null;
  for (let depth = 0; depth < 8 && currentId; depth += 1) {
    const { data, error } = await supabase
      .schema("app")
      .from("cycle_instances")
      .select("id, level_no, parent_instance_id")
      .eq("organization_id", organizationId)
      .eq("id", currentId)
      .maybeSingle();
    if (error) {
      console.error("fetchStrategyObjectivesForParentStrategyCycle cycle", error);
      break;
    }
    if (!data) break;
    if (data.level_no === 1) {
      strategyCycleId = data.id;
      break;
    }
    currentId = (data.parent_instance_id as string | null) ?? null;
  }

  if (!strategyCycleId) {
    console.error(
      "fetchStrategyObjectivesForParentStrategyCycle: kein L1-Strategiezyklus zu",
      reviewCycleInstanceId
    );
    return [];
  }

  const { data, error } = await supabase
    .schema("app")
    .from("strategy_objectives")
    .select("id, title, description, status, identity_lifecycle_state")
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", strategyCycleId)
    .order("title", { ascending: true });

  if (error) {
    // Fallback ohne Lifecycle-Spalte (ältere Schemas)
    const legacy = await supabase
      .schema("app")
      .from("strategy_objectives")
      .select("id, title, description, status")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", strategyCycleId)
      .order("title", { ascending: true });
    if (legacy.error) {
      console.error("fetchStrategyObjectivesForParentStrategyCycle objectives", error);
      return [];
    }
    return ((legacy.data ?? []) as Array<{
      id: string;
      title: string;
      description: string | null;
      status: string | null;
    }>).map((o) => ({
      id: o.id,
      title: o.title,
      description: o.description,
      status: o.status,
      lifecycleState: o.status,
    }));
  }

  return ((data ?? []) as Array<{
    id: string;
    title: string;
    description: string | null;
    status: string | null;
    identity_lifecycle_state?: string | null;
  }>)
    .map((o) => ({
      id: o.id,
      title: o.title,
      description: o.description,
      status: o.status,
      lifecycleState: o.identity_lifecycle_state ?? o.status,
    }))
    .filter((item) => !isArchivedStrategyReviewItem(item));
}

async function resolveReviewCycleIds(
  organizationId: string,
  cycleInstanceId: string,
  payload: Record<string, unknown>
): Promise<string[]> {
  const scope = payload.scope;
  if (scope && typeof scope === "object") {
    const ids = (scope as Record<string, unknown>).cycle_instance_ids;
    if (Array.isArray(ids) && ids.length > 0 && ids.every((x) => typeof x === "string")) {
      return ids as string[];
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data: related } = await supabase.schema("app").rpc("cycle_instance_related_ids", {
    p_cycle_instance_id: cycleInstanceId,
  });
  if (Array.isArray(related) && related.every((x) => typeof x === "string") && related.length > 0) {
    return related as string[];
  }
  return [cycleInstanceId];
}

/**
 * Programme / Jahresziele / Initiativen / OKRs pro Kettenobjekt (für Vorab-Liste).
 */
export async function fetchStrategyReviewExecutionCoverage(
  organizationId: string,
  cycleInstanceId: string,
  payload: Record<string, unknown>
): Promise<StrategyReviewCoverageIndex> {
  const empty: StrategyReviewCoverageIndex = {
    challenge: {},
    focus_area: {},
    objective: {},
    program: {},
  };

  const supabase = await createSupabaseServerClient();
  const cycleIds = await resolveReviewCycleIds(organizationId, cycleInstanceId, payload);

  const [progRes, atRes, initRes, okrAtRes, doRes, cdRes] = await Promise.all([
    supabase
      .schema("app")
      .from("strategy_programs")
      .select(
        "id, title, strategic_direction_id, strategic_challenge_id, supported_objective_ids"
      )
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", cycleIds),
    supabase
      .schema("app")
      .from("annual_targets")
      .select("id, title, strategic_direction_id, strategy_program_id")
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", cycleIds),
    supabase
      .schema("app")
      .from("initiatives")
      .select("id, title, program_id")
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", cycleIds),
    supabase
      .schema("app")
      .from("annual_target_okr_objective_links")
      .select("annual_target_id, okr_objective_id")
      .eq("organization_id", organizationId)
      .in("cycle_instance_id", cycleIds),
    supabase
      .schema("app")
      .from("strategic_direction_objective_links")
      .select("strategic_direction_id, strategy_objective_id")
      .eq("organization_id", organizationId),
    supabase
      .schema("app")
      .from("challenge_direction_links")
      .select("strategic_challenge_id, strategic_direction_id")
      .eq("organization_id", organizationId),
  ]);

  if (progRes.error) console.error("fetchStrategyReviewExecutionCoverage programs", progRes.error);
  if (atRes.error) console.error("fetchStrategyReviewExecutionCoverage annual_targets", atRes.error);
  if (initRes.error) console.error("fetchStrategyReviewExecutionCoverage initiatives", initRes.error);
  if (okrAtRes.error) {
    console.error("fetchStrategyReviewExecutionCoverage okr-at-links", okrAtRes.error);
  }
  if (cdRes.error) {
    console.error("fetchStrategyReviewExecutionCoverage challenge-direction", cdRes.error);
  }

  const programs = ((progRes.data ?? []) as Array<{
    id: string;
    title: string | null;
    strategic_direction_id: string | null;
    strategic_challenge_id: string | null;
    supported_objective_ids: string[] | null;
  }>).map((p) => ({
    id: p.id,
    title: p.title,
    strategic_direction_id: p.strategic_direction_id,
    strategic_challenge_id: p.strategic_challenge_id,
    supported_objective_ids: p.supported_objective_ids,
  }));

  const annualTargets = ((atRes.data ?? []) as Array<{
    id: string;
    title: string | null;
    strategic_direction_id: string | null;
    strategy_program_id: string | null;
  }>);

  const initiatives = ((initRes.data ?? []) as Array<{
    id: string;
    title: string | null;
    program_id: string | null;
  }>);

  let directionObjectiveLinks = ((doRes.data ?? []) as Array<{
    strategic_direction_id: string;
    strategy_objective_id?: string;
    objective_id?: string;
  }>).map((l) => ({
    strategic_direction_id: l.strategic_direction_id,
    strategy_objective_id: l.strategy_objective_id ?? l.objective_id ?? "",
  })).filter((l) => l.strategy_objective_id);

  if (doRes.error?.message?.includes("strategy_objective_id")) {
    const legacy = await supabase
      .schema("app")
      .from("strategic_direction_objective_links")
      .select("strategic_direction_id, objective_id")
      .eq("organization_id", organizationId);
    directionObjectiveLinks = ((legacy.data ?? []) as Array<{
      strategic_direction_id: string;
      objective_id: string;
    }>).map((l) => ({
      strategic_direction_id: l.strategic_direction_id,
      strategy_objective_id: l.objective_id,
    }));
  } else if (doRes.error) {
    console.error("fetchStrategyReviewExecutionCoverage dir-obj-links", doRes.error);
  }

  const strategyObjectiveIds = [
    ...new Set([
      ...directionObjectiveLinks.map((l) => l.strategy_objective_id),
      ...programs.flatMap((p) => p.supported_objective_ids ?? []),
      ...asChainItems(payload.objectives).map((o) => o.id),
    ]),
  ];

  const okrIds = new Set<string>();
  const strategyOkrPairs: Array<{ strategy_objective_id: string; okr_objective_id: string }> = [];
  if (strategyObjectiveIds.length > 0) {
    const { data: okrLinks, error: okrErr } = await supabase
      .schema("app")
      .from("okr_objective_strategy_objectives")
      .select("strategy_objective_id, okr_objective_id")
      .in("strategy_objective_id", strategyObjectiveIds);
    if (okrErr) {
      console.error("fetchStrategyReviewExecutionCoverage okr-strategy-links", okrErr);
    } else {
      for (const row of (okrLinks ?? []) as Array<{
        strategy_objective_id: string;
        okr_objective_id: string;
      }>) {
        strategyOkrPairs.push(row);
        okrIds.add(row.okr_objective_id);
      }
    }
  }

  const atOkrPairs = ((okrAtRes.data ?? []) as Array<{
    annual_target_id: string;
    okr_objective_id: string;
  }>);
  for (const row of atOkrPairs) okrIds.add(row.okr_objective_id);

  const okrTitleById = new Map<string, string>();
  if (okrIds.size > 0) {
    const { data: okrRows, error: okrTitleErr } = await supabase
      .schema("app")
      .from("okr_objectives")
      .select("id, title")
      .in("id", [...okrIds]);
    if (okrTitleErr) {
      console.error("fetchStrategyReviewExecutionCoverage okr titles", okrTitleErr);
    } else {
      for (const row of (okrRows ?? []) as Array<{ id: string; title: string | null }>) {
        okrTitleById.set(row.id, row.title?.trim() || "Ohne Titel");
      }
    }
  }

  const okrsByStrategyObjectiveId: Record<string, Array<{ id: string; title: string }>> = {};
  for (const row of strategyOkrPairs) {
    const list = okrsByStrategyObjectiveId[row.strategy_objective_id] ?? [];
    list.push({
      id: row.okr_objective_id,
      title: okrTitleById.get(row.okr_objective_id) ?? "Ohne Titel",
    });
    okrsByStrategyObjectiveId[row.strategy_objective_id] = list;
  }

  const okrsByAnnualTargetId: Record<string, Array<{ id: string; title: string }>> = {};
  for (const row of atOkrPairs) {
    const list = okrsByAnnualTargetId[row.annual_target_id] ?? [];
    list.push({
      id: row.okr_objective_id,
      title: okrTitleById.get(row.okr_objective_id) ?? "Ohne Titel",
    });
    okrsByAnnualTargetId[row.annual_target_id] = list;
  }

  const challengeDirectionLinks = ((cdRes.data ?? []) as Array<{
    strategic_challenge_id: string;
    strategic_direction_id: string;
  }>);

  if (
    programs.length === 0 &&
    annualTargets.length === 0 &&
    initiatives.length === 0 &&
    Object.keys(okrsByStrategyObjectiveId).length === 0
  ) {
    return empty;
  }

  return buildCoverageIndex({
    programs,
    annualTargets,
    initiatives,
    okrsByStrategyObjectiveId,
    okrsByAnnualTargetId,
    directionObjectiveLinks,
    challengeDirectionLinks,
  });
}

/** Leerer Coverage-Index (z. B. wenn Pre-Read noch nicht offen). */
export function emptyStrategyReviewCoverageIndex(): StrategyReviewCoverageIndex {
  return {
    challenge: {},
    focus_area: {},
    objective: {},
    program: {},
  };
}
