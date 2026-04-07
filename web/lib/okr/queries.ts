import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Blatt-`cycle_instances`-IDs, die zur gleichen „OKR-Weiche“ gehören wie die aktive Instanz:
 * – Ist die aktive Instanz ein Blatt: alle Geschwister mit gleichem Parent und gleicher Ebene (z. B. alle Q unter demselben Halbjahr).
 * – Sonst: alle Blatt-Nachfahren unter dieser Instanz.
 *
 * In `app.okr_cycles` existiert pro Blatt-Instanz höchstens eine Zeile (Migration 0090); die App zeigt
 * bisher alle zugehörigen OKR-Zeiträume für die gewählte Strategie-Ebene, nicht nur eine UUID.
 */
export async function getOkrCycleInstanceScopeIds(
  organizationId: string,
  activeCycleInstanceId: string
): Promise<string[]> {
  const supabase = await createSupabaseServerClient();

  const { data: active } = await supabase
    .schema("app")
    .from("cycle_instances")
    .select("id, parent_instance_id, level_no")
    .eq("organization_id", organizationId)
    .eq("id", activeCycleInstanceId)
    .maybeSingle();

  if (!active) return [activeCycleInstanceId];

  const { data: directChildren } = await supabase
    .schema("app")
    .from("cycle_instances")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("parent_instance_id", active.id)
    .limit(1);

  const isLeaf = !directChildren?.length;

  if (isLeaf && active.parent_instance_id) {
    const { data: siblings } = await supabase
      .schema("app")
      .from("cycle_instances")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("parent_instance_id", active.parent_instance_id)
      .eq("level_no", active.level_no);

    const ids = (siblings ?? []).map((r) => r.id).filter(Boolean);
    return ids.length > 0 ? ids : [active.id];
  }

  const leaves: string[] = [];
  const queue: string[] = [active.id];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);

    const { data: children } = await supabase
      .schema("app")
      .from("cycle_instances")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("parent_instance_id", id);

    if (!children?.length) {
      leaves.push(id);
    } else {
      for (const row of children) queue.push(row.id);
    }
  }

  return leaves.length > 0 ? leaves : [active.id];
}

export async function getOkrCycles(organizationId: string, cycleInstanceId: string) {
  const supabase = await createSupabaseServerClient();
  const scopeIds = await getOkrCycleInstanceScopeIds(organizationId, cycleInstanceId);
  const { data } = await supabase
    .schema("app")
    .from("okr_cycles")
    .select("id, name, code, start_date, end_date, status")
    .eq("organization_id", organizationId)
    .in("cycle_instance_id", scopeIds)
    .order("start_date", { ascending: false });

  return data ?? [];
}

export async function getObjectivesForCycle(organizationId: string, cycleInstanceId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id, title, description, status, progress_percent, confidence_level, okr_cycle_id, created_at")
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .order("created_at", { ascending: true });

  return data ?? [];
}

export async function getKeyResultsForObjectives(organizationId: string, okrObjectiveIds: string[]) {
  if (okrObjectiveIds.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("key_results")
    .select(
      "id, okr_objective_id, title, status, metric_type, start_value, target_value, current_value, measurement_unit"
    )
    .eq("organization_id", organizationId)
    .in("okr_objective_id", okrObjectiveIds)
    .order("okr_objective_id", { ascending: true })
    .order("created_at", { ascending: true });

  return data ?? [];
}

export async function getOkrUpdatesForKeyResult(organizationId: string, keyResultId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("okr_updates")
    .select("id, progress_value, confidence_level, comment, created_at")
    .eq("organization_id", organizationId)
    .eq("key_result_id", keyResultId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

