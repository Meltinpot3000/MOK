import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOkrCycleInstanceScopeIds } from "@/lib/okr/queries";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function fetchLeadingStrategicDirectionIdForOkr(
  supabase: Supabase,
  organizationId: string,
  cycleInstanceId: string,
  okrObjectiveId: string
): Promise<string | null> {
  const { data: junctionRows } = await supabase
    .schema("app")
    .from("okr_objective_strategy_objectives")
    .select("strategy_objective_id")
    .eq("okr_objective_id", okrObjectiveId)
    .limit(1);
  const strategyObjectiveId = junctionRows?.[0]?.strategy_objective_id;
  if (!strategyObjectiveId) return null;
  const scopeIds = await getOkrCycleInstanceScopeIds(organizationId, cycleInstanceId);
  const { data: link } = await supabase
    .schema("app")
    .from("strategic_direction_objective_links")
    .select("strategic_direction_id")
    .eq("organization_id", organizationId)
    .eq("strategy_objective_id", strategyObjectiveId)
    .in("cycle_instance_id", scopeIds)
    .limit(1)
    .maybeSingle();
  return link?.strategic_direction_id ?? null;
}

export type KeyResultContentSignatureRow = {
  id: string;
  title: string;
  metric_type: string;
  start_value: number | null;
  target_value: number | null;
  measurement_unit: string | null;
};

function stableKrSignature(rows: KeyResultContentSignatureRow[]): string {
  const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(
    sorted.map((r) => ({
      id: r.id,
      title: r.title.trim(),
      metric_type: r.metric_type,
      start_value: r.start_value,
      target_value: r.target_value,
      measurement_unit: r.measurement_unit ?? null,
    }))
  );
}

export async function fetchKeyResultContentSignatureForOkr(
  supabase: Supabase,
  organizationId: string,
  okrObjectiveId: string
): Promise<string> {
  const { data: rows } = await supabase
    .schema("app")
    .from("key_results")
    .select("id, title, metric_type, start_value, target_value, measurement_unit")
    .eq("organization_id", organizationId)
    .eq("okr_objective_id", okrObjectiveId);
  return stableKrSignature((rows ?? []) as KeyResultContentSignatureRow[]);
}

export async function fetchInitiativeLinkSignatureForOkr(
  supabase: Supabase,
  organizationId: string,
  cycleInstanceId: string,
  okrObjectiveId: string
): Promise<string> {
  const { data: krs } = await supabase
    .schema("app")
    .from("key_results")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("okr_objective_id", okrObjectiveId);
  const krIds = (krs ?? []).map((r) => r.id);
  if (krIds.length === 0) return "[]";
  const { data: links } = await supabase
    .schema("app")
    .from("initiative_key_result_links")
    .select("key_result_id, initiative_id")
    .eq("organization_id", organizationId)
    .eq("cycle_instance_id", cycleInstanceId)
    .in("key_result_id", krIds);
  const byKr = new Map<string, string[]>();
  for (const l of links ?? []) {
    const kid = l.key_result_id as string;
    const iid = l.initiative_id as string;
    const arr = byKr.get(kid) ?? [];
    arr.push(iid);
    byKr.set(kid, arr);
  }
  const parts: string[] = [];
  for (const krId of [...krIds].sort((a, b) => a.localeCompare(b))) {
    const inits = [...(byKr.get(krId) ?? [])].sort((a, b) => a.localeCompare(b));
    parts.push(`${krId}:${inits.join(",")}`);
  }
  return parts.join("|");
}

export function keyResultContentFieldsChanged(
  before: KeyResultContentSignatureRow,
  after: {
    title: string;
    metric_type: string;
    start_value: number | null;
    target_value: number | null;
    measurement_unit: string | null;
  }
): boolean {
  return (
    before.title.trim() !== after.title.trim() ||
    before.metric_type !== after.metric_type ||
    before.start_value !== after.start_value ||
    before.target_value !== after.target_value ||
    (before.measurement_unit ?? null) !== (after.measurement_unit ?? null)
  );
}

export type OkrContributionTargetRef = {
  targetType: "initiative" | "strategy_objective";
  targetId: string;
};

/**
 * Alle Kanten-Ziele für die einheitliche OKR-Einstufung (Initiativen über KR-Links + Strategieziele).
 */
export async function fetchOkrContributionTargetsForObjective(
  supabase: Supabase,
  organizationId: string,
  cycleInstanceId: string,
  okrObjectiveId: string
): Promise<OkrContributionTargetRef[]> {
  const { data: krs } = await supabase
    .schema("app")
    .from("key_results")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("okr_objective_id", okrObjectiveId);
  const krIds = (krs ?? []).map((r) => r.id as string);
  const initiativeIds = new Set<string>();
  if (krIds.length > 0) {
    const { data: links } = await supabase
      .schema("app")
      .from("initiative_key_result_links")
      .select("initiative_id")
      .eq("organization_id", organizationId)
      .eq("cycle_instance_id", cycleInstanceId)
      .in("key_result_id", krIds);
    for (const l of links ?? []) {
      initiativeIds.add(l.initiative_id as string);
    }
  }

  const { data: soRows } = await supabase
    .schema("app")
    .from("okr_objective_strategy_objectives")
    .select("strategy_objective_id")
    .eq("okr_objective_id", okrObjectiveId);

  const targets: OkrContributionTargetRef[] = [];
  for (const iid of [...initiativeIds].sort((a, b) => a.localeCompare(b))) {
    targets.push({ targetType: "initiative", targetId: iid });
  }
  for (const row of soRows ?? []) {
    const sid = row.strategy_objective_id as string | undefined;
    if (sid) targets.push({ targetType: "strategy_objective", targetId: sid });
  }
  return targets;
}
