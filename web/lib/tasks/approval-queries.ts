import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cache } from "react";

export type TaskRow = {
  id: string;
  organization_id: string;
  task_type: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_membership_id: string;
  created_by_membership_id: string;
  source_object_type: string;
  source_object_id: string;
  routing_mode: string | null;
  routing_reason: string | null;
  due_at: string | null;
  completed_at: string | null;
  completed_by_membership_id: string | null;
  decision_comment: string | null;
  created_at: string;
  updated_at: string;
  task_payload?: Record<string, unknown> | null;
};

/** OKR-Objective im Status Entwurf — Erinnerung in «Meine Aufgaben» (Owner). */
export type DraftOkrObjectiveReminderRow = {
  id: string;
  title: string;
  okr_cycle_id: string;
  updated_at: string;
};

export type MyTasksListEntry =
  | { kind: "task"; task: TaskRow }
  | { kind: "draft_okr"; draft: DraftOkrObjectiveReminderRow };

export async function fetchDraftOkrObjectiveRemindersForOwner(
  organizationId: string,
  ownerMembershipId: string
): Promise<DraftOkrObjectiveReminderRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id, title, okr_cycle_id, updated_at")
    .eq("organization_id", organizationId)
    .eq("owner_membership_id", ownerMembershipId)
    .eq("status", "draft")
    .order("updated_at", { ascending: false });

  if (error || !data) return [];
  return data as DraftOkrObjectiveReminderRow[];
}

export function mergeMyTasksList(
  tasks: TaskRow[],
  draftOkrs: DraftOkrObjectiveReminderRow[],
  filter: "open" | "completed" | "all"
): MyTasksListEntry[] {
  const taskEntries: MyTasksListEntry[] = tasks.map((task) => ({ kind: "task", task }));
  if (filter === "completed") {
    return [...taskEntries].sort((a, b) => {
      if (a.kind !== "task" || b.kind !== "task") return 0;
      return String(b.task.created_at).localeCompare(String(a.task.created_at));
    });
  }
  const withDrafts: MyTasksListEntry[] = [
    ...taskEntries,
    ...draftOkrs.map((draft) => ({ kind: "draft_okr", draft }) satisfies MyTasksListEntry),
  ];
  return withDrafts.sort((a, b) => {
    const dateA = a.kind === "task" ? a.task.created_at : a.draft.updated_at;
    const dateB = b.kind === "task" ? b.task.created_at : b.draft.updated_at;
    return String(dateB).localeCompare(String(dateA));
  });
}

export const getOpenTaskCountForMembership = cache(
  async (organizationId: string, membershipId: string): Promise<number> => {
    const supabase = await createSupabaseServerClient();
    const [openTasks, draftObjectives] = await Promise.all([
      supabase
        .schema("app")
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("assigned_membership_id", membershipId)
        .eq("status", "open"),
      supabase
        .schema("app")
        .from("okr_objectives")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("owner_membership_id", membershipId)
        .eq("status", "draft"),
    ]);

    const nTasks = openTasks.error ? 0 : openTasks.count ?? 0;
    const nDrafts = draftObjectives.error ? 0 : draftObjectives.count ?? 0;
    return nTasks + nDrafts;
  }
);

function taskStatusHistogram(rows: Pick<TaskRow, "status">[]): Record<string, number> {
  const h: Record<string, number> = {};
  for (const row of rows) {
    const key = row.status ?? "null";
    h[key] = (h[key] ?? 0) + 1;
  }
  return h;
}

export type TaskFetchDiagnostics = {
  filter: "open" | "completed" | "all";
  organizationId: string;
  membershipId: string;
  filteredQueryError: string | null;
  filteredRowCount: number;
  filteredStatusHistogram: Record<string, number>;
  /** Alle Zeilen für diese Membership (ohne Status-Filter), nur zur Ursachenanalyse. */
  allAssignedQueryError: string | null;
  allAssignedRowCount: number;
  allAssignedStatusHistogram: Record<string, number>;
};

async function fetchTasksForMembershipInternal(
  organizationId: string,
  membershipId: string,
  filter: "open" | "completed" | "all",
  includeDiagnostics: boolean,
  supabaseClient?: SupabaseClient
): Promise<{ rows: TaskRow[]; diagnostics?: TaskFetchDiagnostics }> {
  const supabase = supabaseClient ?? (await createSupabaseServerClient());
  let q = supabase
    .schema("app")
    .from("tasks")
    .select(
      "id, organization_id, task_type, title, description, status, priority, assigned_membership_id, created_by_membership_id, source_object_type, source_object_id, routing_mode, routing_reason, due_at, completed_at, completed_by_membership_id, decision_comment, created_at, updated_at, task_payload"
    )
    .eq("organization_id", organizationId)
    .eq("assigned_membership_id", membershipId)
    .order("created_at", { ascending: false });

  if (filter === "open") {
    q = q.eq("status", "open");
  } else if (filter === "completed") {
    q = q.in("status", ["completed"]);
  }

  const { data, error } = await q;
  const filteredError = error?.message ?? null;
  if (error || !data) {
    let diagnostics: TaskFetchDiagnostics | undefined;
    if (includeDiagnostics) {
      const allRes = await supabase
        .schema("app")
        .from("tasks")
        .select("status")
        .eq("organization_id", organizationId)
        .eq("assigned_membership_id", membershipId);
      const allRows = (allRes.data ?? []) as Pick<TaskRow, "status">[];
      diagnostics = {
        filter,
        organizationId,
        membershipId,
        filteredQueryError: filteredError,
        filteredRowCount: 0,
        filteredStatusHistogram: {},
        allAssignedQueryError: allRes.error?.message ?? null,
        allAssignedRowCount: allRows.length,
        allAssignedStatusHistogram: taskStatusHistogram(allRows),
      };
    }
    return { rows: [], diagnostics };
  }

  let rows = data as TaskRow[];
  if (filter === "open") {
    rows = [...rows].sort((a, b) => {
      if (a.status === "open" && b.status !== "open") return -1;
      if (b.status === "open" && a.status !== "open") return 1;
      return String(b.created_at).localeCompare(String(a.created_at));
    });
  }

  let diagnostics: TaskFetchDiagnostics | undefined;
  if (includeDiagnostics) {
    const allRes = await supabase
      .schema("app")
      .from("tasks")
      .select("status")
      .eq("organization_id", organizationId)
      .eq("assigned_membership_id", membershipId);
    const allRows = (allRes.data ?? []) as Pick<TaskRow, "status">[];
    diagnostics = {
      filter,
      organizationId,
      membershipId,
      filteredQueryError: filteredError,
      filteredRowCount: rows.length,
      filteredStatusHistogram: taskStatusHistogram(rows),
      allAssignedQueryError: allRes.error?.message ?? null,
      allAssignedRowCount: allRows.length,
      allAssignedStatusHistogram: taskStatusHistogram(allRows),
    };
  }

  return { rows, diagnostics };
}

export async function fetchTasksForMembership(
  organizationId: string,
  membershipId: string,
  filter: "open" | "completed" | "all",
  supabaseClient?: SupabaseClient
): Promise<TaskRow[]> {
  const { rows } = await fetchTasksForMembershipInternal(
    organizationId,
    membershipId,
    filter,
    false,
    supabaseClient
  );
  return rows;
}

/** Für Debugging: gleiche Daten wie fetchTasksForMembership plus Histogramm aller zugewiesenen Tasks (ohne Statusfilter). */
export async function fetchTasksForMembershipWithDiagnostics(
  organizationId: string,
  membershipId: string,
  filter: "open" | "completed" | "all",
  supabaseClient?: SupabaseClient
): Promise<{ rows: TaskRow[]; diagnostics: TaskFetchDiagnostics }> {
  const { rows, diagnostics } = await fetchTasksForMembershipInternal(
    organizationId,
    membershipId,
    filter,
    true,
    supabaseClient
  );
  return {
    rows,
    diagnostics: diagnostics ?? {
      filter,
      organizationId,
      membershipId,
      filteredQueryError: null,
      filteredRowCount: rows.length,
      filteredStatusHistogram: taskStatusHistogram(rows),
      allAssignedQueryError: null,
      allAssignedRowCount: rows.length,
      allAssignedStatusHistogram: taskStatusHistogram(rows),
    },
  };
}

export function approvalRoutingLabelDe(mode: string | null): string {
  switch (mode) {
    case "direct_manager":
      return "Direkter Vorgesetzter";
    case "executive_fallback":
      return "Geschäftsleitung (Fallback)";
    case "admin_fallback":
      return "Administrator (Fallback)";
    default:
      return "—";
  }
}

const TITLE_TABLES: Record<string, string> = {
  strategic_goal: "strategic_goals",
  functional_strategy: "functional_strategies",
  initiative: "initiatives",
  strategic_direction: "strategic_directions",
  strategy_program: "strategy_programs",
  strategy_objective: "strategy_objectives",
  okr_objective: "okr_objectives",
  key_result: "key_results",
};

export async function resolveSourceObjectTitles(
  organizationId: string,
  tasks: Pick<TaskRow, "source_object_type" | "source_object_id">[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const supabase = await createSupabaseServerClient();
  const byType = new Map<string, string[]>();
  for (const t of tasks) {
    const ids = byType.get(t.source_object_type) ?? [];
    if (!ids.includes(t.source_object_id)) ids.push(t.source_object_id);
    byType.set(t.source_object_type, ids);
  }
  for (const [type, ids] of byType) {
    const table = TITLE_TABLES[type];
    if (!table || ids.length === 0) continue;
    const { data } = await supabase
      .schema("app")
      .from(table)
      .select("id, title")
      .eq("organization_id", organizationId)
      .in("id", ids);
    for (const row of data ?? []) {
      const r = row as { id: string; title: string };
      out.set(`${type}:${r.id}`, r.title);
    }
  }
  return out;
}

export async function fetchMembershipDisplayNames(
  membershipIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const uniq = [...new Set(membershipIds)].filter(Boolean);
  if (uniq.length === 0) return map;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("organization_memberships")
    .select("id, display_name")
    .in("id", uniq);
  for (const row of data ?? []) {
    const r = row as { id: string; display_name: string | null };
    map.set(r.id, r.display_name?.trim() || r.id);
  }
  return map;
}

export async function fetchTaskById(
  organizationId: string,
  membershipId: string,
  taskId: string
): Promise<TaskRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("app")
    .from("tasks")
    .select(
      "id, organization_id, task_type, title, description, status, priority, assigned_membership_id, created_by_membership_id, source_object_type, source_object_id, routing_mode, routing_reason, due_at, completed_at, completed_by_membership_id, decision_comment, created_at, updated_at, task_payload"
    )
    .eq("organization_id", organizationId)
    .eq("assigned_membership_id", membershipId)
    .eq("id", taskId)
    .maybeSingle();

  if (error || !data) return null;
  return data as TaskRow;
}
