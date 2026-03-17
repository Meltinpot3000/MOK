import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PlanningCycleRecord = {
  id: string;
  code: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  level_no: number;
  cycle_scheme_id: string;
  cycle_scheme_name: string;
  is_active_scheme: boolean;
  legacy_planning_cycle_id: string | null;
};

function pickDefaultCycle(cycles: PlanningCycleRecord[]): PlanningCycleRecord | null {
  if (cycles.length === 0) return null;

  const scope = cycles.some((cycle) => cycle.is_active_scheme)
    ? cycles.filter((cycle) => cycle.is_active_scheme)
    : cycles;

  const nowMs = Date.now();
  const byDeepestThenLatestStart = (a: PlanningCycleRecord, b: PlanningCycleRecord) =>
    (b.level_no ?? 1) - (a.level_no ?? 1) || Date.parse(b.start_date) - Date.parse(a.start_date);
  const byEarliestStartThenDeepest = (a: PlanningCycleRecord, b: PlanningCycleRecord) =>
    Date.parse(a.start_date) - Date.parse(b.start_date) || (b.level_no ?? 1) - (a.level_no ?? 1);
  const byLatestEndThenDeepest = (a: PlanningCycleRecord, b: PlanningCycleRecord) =>
    Date.parse(b.end_date) - Date.parse(a.end_date) || (b.level_no ?? 1) - (a.level_no ?? 1);

  const current = scope
    .filter((cycle) => Date.parse(cycle.start_date) <= nowMs && nowMs < Date.parse(cycle.end_date))
    .sort(byDeepestThenLatestStart);
  if (current.length > 0) return current[0];

  const upcoming = scope.filter((cycle) => Date.parse(cycle.start_date) > nowMs).sort(byEarliestStartThenDeepest);
  if (upcoming.length > 0) return upcoming[0];

  const past = scope.filter((cycle) => Date.parse(cycle.end_date) <= nowMs).sort(byLatestEndThenDeepest);
  if (past.length > 0) return past[0];

  return scope[0] ?? null;
}

export async function getPlanningCyclesForOrganization(organizationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("cycle_instances")
    .select(
      "id, code, name, starts_on, ends_on, status, level_no, cycle_scheme_id, legacy_planning_cycle_id, scheme:cycle_scheme_id(name, is_active)"
    )
    .eq("organization_id", organizationId)
    .order("starts_on", { ascending: false });

  const rows = (data ?? []) as Array<{
    id: string;
    code: string;
    name: string;
    starts_on: string;
    ends_on: string;
    status: string;
    level_no: number;
    cycle_scheme_id: string;
    legacy_planning_cycle_id: string | null;
    scheme:
      | { name: string; is_active: boolean }
      | Array<{ name: string; is_active: boolean }>
      | null;
  }>;

  return rows.map((row) => {
    const scheme = Array.isArray(row.scheme) ? row.scheme[0] ?? null : row.scheme ?? null;
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      start_date: row.starts_on,
      end_date: row.ends_on,
      status: row.status,
      level_no: row.level_no,
      cycle_scheme_id: row.cycle_scheme_id,
      cycle_scheme_name: scheme?.name ?? "Cycle Scheme",
      is_active_scheme: Boolean(scheme?.is_active),
      legacy_planning_cycle_id: row.legacy_planning_cycle_id,
    } satisfies PlanningCycleRecord;
  });
}

export async function getCurrentPlanningCycle(organizationId: string) {
  const cycles = await getPlanningCyclesForOrganization(organizationId);
  return pickDefaultCycle(cycles);
}

export async function getPlanningCycleById(organizationId: string, cycleId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("cycle_instances")
    .select(
      "id, code, name, starts_on, ends_on, status, level_no, cycle_scheme_id, legacy_planning_cycle_id, scheme:cycle_scheme_id(name, is_active)"
    )
    .eq("organization_id", organizationId)
    .eq("id", cycleId)
    .maybeSingle();

  if (!data) return null;
  const scheme = Array.isArray(data.scheme) ? data.scheme[0] ?? null : data.scheme ?? null;
  return {
    id: data.id,
    code: data.code,
    name: data.name,
    start_date: data.starts_on,
    end_date: data.ends_on,
    status: data.status,
    level_no: data.level_no,
    cycle_scheme_id: data.cycle_scheme_id,
    cycle_scheme_name: scheme?.name ?? "Cycle Scheme",
    is_active_scheme: Boolean(scheme?.is_active),
    legacy_planning_cycle_id: data.legacy_planning_cycle_id ?? null,
  } satisfies PlanningCycleRecord;
}
