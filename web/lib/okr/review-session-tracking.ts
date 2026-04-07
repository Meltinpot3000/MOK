import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OkrReviewCheckInSeriesPoint = {
  at: string;
  cumulativeUniqueCheckInUsers: number;
};

export type OkrReviewSessionCheckInTracking = {
  baselineAt: string | null;
  distinctCheckInUsers: number;
  expectedOwnerMembershipIds: string[];
  expectedCount: number;
  series: OkrReviewCheckInSeriesPoint[];
};

function uniq(ids: (string | null | undefined)[]): string[] {
  const s = new Set<string>();
  for (const id of ids) {
    if (id) s.add(id);
  }
  return [...s];
}

function normMembershipId(id: string | null | undefined): string | null {
  if (!id) return null;
  const t = id.trim().toLowerCase();
  return t.length ? t : null;
}

/**
 * Alle Objective-/KR-Owner und -Deputy (distinct), Zyklus und Instanz, ohne "shifted"-Objectives.
 */
export async function collectOkrCycleOwnerMembershipIds(input: {
  organizationId: string;
  cycleInstanceId: string;
  okrCycleId: string;
}): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  const { data: objectives, error: oErr } = await supabase
    .schema("app")
    .from("okr_objectives")
    .select("id, owner_membership_id, deputy_membership_id")
    .eq("organization_id", input.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .eq("okr_cycle_id", input.okrCycleId)
    .neq("status", "shifted");

  if (oErr || !objectives?.length) {
    if (oErr) console.error("[collectOkrCycleOwnerMembershipIds] objectives", oErr.message);
    return [];
  }

  const objIds = objectives.map((o) => (o as { id: string }).id);
  const fromObj = uniq(
    objectives.flatMap((o) => {
      const r = o as {
        owner_membership_id?: string | null;
        deputy_membership_id?: string | null;
      };
      return [r.owner_membership_id, r.deputy_membership_id];
    })
  );

  const { data: krs, error: kErr } = await supabase
    .schema("app")
    .from("key_results")
    .select("owner_membership_id, deputy_membership_id")
    .eq("organization_id", input.organizationId)
    .in("okr_objective_id", objIds);

  if (kErr) {
    console.error("[collectOkrCycleOwnerMembershipIds] key_results", kErr.message);
    return fromObj;
  }

  const fromKr = uniq(
    (krs ?? []).flatMap((kr) => {
      const r = kr as {
        owner_membership_id?: string | null;
        deputy_membership_id?: string | null;
      };
      return [r.owner_membership_id, r.deputy_membership_id];
    })
  );

  return uniq([...fromObj, ...fromKr]);
}

export async function getOkrReviewSessionCheckInTracking(input: {
  organizationId: string;
  cycleInstanceId: string;
  okrCycleId: string;
  baselineAt: string | null;
}): Promise<OkrReviewSessionCheckInTracking> {
  const expectedOwnerMembershipIds = await collectOkrCycleOwnerMembershipIds({
    organizationId: input.organizationId,
    cycleInstanceId: input.cycleInstanceId,
    okrCycleId: input.okrCycleId,
  });
  const expectedCount = expectedOwnerMembershipIds.length;
  const expectedSet = new Set(
    expectedOwnerMembershipIds.map((id) => normMembershipId(id)).filter((k): k is string => Boolean(k))
  );

  if (!input.baselineAt) {
    return {
      baselineAt: null,
      distinctCheckInUsers: 0,
      expectedOwnerMembershipIds,
      expectedCount,
      series: [],
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: updates, error } = await supabase
    .schema("app")
    .from("okr_updates")
    .select("created_by_membership_id, created_at")
    .eq("organization_id", input.organizationId)
    .eq("cycle_instance_id", input.cycleInstanceId)
    .eq("okr_cycle_id", input.okrCycleId)
    .gte("created_at", input.baselineAt)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[getOkrReviewSessionCheckInTracking]", error.message);
    return {
      baselineAt: input.baselineAt,
      distinctCheckInUsers: 0,
      expectedOwnerMembershipIds,
      expectedCount,
      series: [],
    };
  }

  const rows = (updates ?? []) as Array<{
    created_by_membership_id: string | null;
    created_at: string;
  }>;

  const seen = new Set<string>();
  const series: OkrReviewCheckInSeriesPoint[] = [];

  for (const row of rows) {
    const key = normMembershipId(row.created_by_membership_id);
    if (!key || !expectedSet.has(key) || seen.has(key)) continue;
    seen.add(key);
    series.push({
      at: row.created_at,
      cumulativeUniqueCheckInUsers: seen.size,
    });
  }

  return {
    baselineAt: input.baselineAt,
    distinctCheckInUsers: seen.size,
    expectedOwnerMembershipIds,
    expectedCount,
    series,
  };
}
