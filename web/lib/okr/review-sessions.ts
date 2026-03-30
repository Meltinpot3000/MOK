import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OkrReviewSessionRow = {
  id: string;
  title: string;
  session_type: string;
  status: string;
  scheduled_at: string | null;
  facilitator_membership_id: string | null;
  summary: string | null;
  meeting_notes: string | null;
  discussion_notes: string | null;
  decisions_next_steps: string | null;
  check_in_tracking_baseline_at: string | null;
  started_at: string | null;
  created_at: string;
  updated_at: string;
};

const OKR_REVIEW_SESSION_SELECT_FULL =
  "id, title, session_type, status, scheduled_at, facilitator_membership_id, summary, meeting_notes, discussion_notes, decisions_next_steps, check_in_tracking_baseline_at, started_at, created_at, updated_at";

const OKR_REVIEW_SESSION_SELECT_LEGACY =
  "id, title, session_type, status, scheduled_at, facilitator_membership_id, summary, meeting_notes, discussion_notes, decisions_next_steps, created_at, updated_at";

/** Exportiert für Server Actions, wenn DB noch ohne Migration 0108 ist. */
export function isMissingReviewSessionMigrationColumns(message: string): boolean {
  return (
    message.includes("check_in_tracking_baseline_at") ||
    (message.includes("column") && message.includes("started_at"))
  );
}

export async function listOkrReviewSessionsForCycle(
  organizationId: string,
  cycleInstanceId: string,
  okrCycleId: string
): Promise<OkrReviewSessionRow[]> {
  const supabase = await createSupabaseServerClient();
  const full = await supabase
    .schema("app")
    .from("okr_review_sessions")
    .select(OKR_REVIEW_SESSION_SELECT_FULL)
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .eq("okr_cycle_id", okrCycleId)
    .order("updated_at", { ascending: false });

  let data = full.data;
  let error = full.error;

  if (error && isMissingReviewSessionMigrationColumns(String(error.message ?? ""))) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[listOkrReviewSessionsForCycle] Migration 0108 fehlt — nutze Legacy-Select. bitte `supabase db push` / Migration anwenden."
      );
    }
    const legacy = await supabase
      .schema("app")
      .from("okr_review_sessions")
      .select(OKR_REVIEW_SESSION_SELECT_LEGACY)
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .eq("okr_cycle_id", okrCycleId)
      .order("updated_at", { ascending: false });
    data = legacy.data as typeof full.data;
    error = legacy.error;
  }

  if (error) {
    console.error("[listOkrReviewSessionsForCycle]", error.message);
    return [];
  }

  const rows = (data ?? []) as OkrReviewSessionRow[];
  return rows.map((r) => ({
    ...r,
    check_in_tracking_baseline_at: r.check_in_tracking_baseline_at ?? null,
    started_at: r.started_at ?? null,
  }));
}

export type OkrReviewSessionTaskRow = {
  id: string;
  okr_review_session_id: string;
  title: string;
  is_done: boolean;
  sort_order: number;
  assignee_membership_id: string | null;
  /** ISO timestamptz — Pflichtfeld; bei Legacy-Zeilen ohne Spalte aus created_at abgeleitet. */
  due_at: string;
  created_at: string;
  updated_at: string;
};

export function isMissingOkrReviewSessionTasksTable(message: string): boolean {
  return (
    message.includes("okr_review_session_tasks") &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("Could not find"))
  );
}

function mapOkrReviewSessionTaskRows(rows: unknown[]): OkrReviewSessionTaskRow[] {
  return rows.map((raw) => {
    const r = raw as Record<string, unknown>;
    const created = String(r.created_at);
    return {
      id: String(r.id),
      okr_review_session_id: String(r.okr_review_session_id),
      title: String(r.title),
      is_done: Boolean(r.is_done),
      sort_order: Number(r.sort_order),
      assignee_membership_id: (r.assignee_membership_id as string | null | undefined) ?? null,
      due_at:
        r.due_at != null && String(r.due_at).trim() !== ""
          ? String(r.due_at)
          : created,
      created_at: created,
      updated_at: String(r.updated_at),
    };
  });
}

export async function listOkrReviewSessionTasks(sessionId: string): Promise<OkrReviewSessionTaskRow[]> {
  const supabase = await createSupabaseServerClient();
  const full = await supabase
    .schema("app")
    .from("okr_review_session_tasks")
    .select(
      "id, okr_review_session_id, title, is_done, sort_order, assignee_membership_id, due_at, created_at, updated_at"
    )
    .eq("okr_review_session_id", sessionId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!full.error) {
    return mapOkrReviewSessionTaskRows(full.data ?? []);
  }

  const msg = String(full.error.message ?? "");
  if (isMissingOkrReviewSessionTasksTable(msg)) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[listOkrReviewSessionTasks] Tabelle fehlt oder Schema-Cache veraltet — Migrationen 0108+ anwenden und ggf. Supabase »Reload schema«."
      );
    }
    return [];
  }

  const legacy = await supabase
    .schema("app")
    .from("okr_review_session_tasks")
    .select("id, okr_review_session_id, title, is_done, sort_order, created_at, updated_at")
    .eq("okr_review_session_id", sessionId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (legacy.error) {
    console.error("[listOkrReviewSessionTasks]", legacy.error.message);
    return [];
  }
  return mapOkrReviewSessionTaskRows(legacy.data ?? []).map((r) => ({
    ...r,
    assignee_membership_id: null,
  }));
}