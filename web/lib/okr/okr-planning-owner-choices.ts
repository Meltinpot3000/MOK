import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPermissionCodesForMembership } from "@/lib/rbac/permission-codes";
import type { OkrResponsibleOption } from "@/lib/okr/planning-data";

function normMembershipId(id: string): string {
  return id.trim().toLowerCase();
}

/**
 * Optionen für „OKR-Objective-Owner“: Mit nur `okr.objective.update.own` (ohne `.all`)
 * erscheint nur die eigene Person; mit zusätzlich `okr.objective.update.department` auch direkte Mitarbeitende.
 */
export async function filterResponsiblesForOkrObjectiveOwnerSelect(params: {
  organizationId: string;
  currentMembershipId: string;
  responsibles: OkrResponsibleOption[];
}): Promise<OkrResponsibleOption[]> {
  const codes = await getPermissionCodesForMembership(params.currentMembershipId);
  if (codes.has("okr.objective.update.all")) {
    return params.responsibles;
  }

  const allowed = new Set<string>();
  const selfNorm = normMembershipId(params.currentMembershipId);
  if (codes.has("okr.objective.update.own")) {
    allowed.add(selfNorm);
  }
  if (codes.has("okr.objective.update.department")) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .schema("app")
      .from("organization_memberships")
      .select("id")
      .eq("organization_id", params.organizationId)
      .eq("reports_to_membership_id", params.currentMembershipId)
      .in("status", ["active", "invited"]);
    for (const row of data ?? []) {
      if (row?.id) allowed.add(normMembershipId(String(row.id)));
    }
  }

  if (allowed.size === 0) {
    return params.responsibles;
  }

  let out = params.responsibles.filter((r) => allowed.has(normMembershipId(r.membershipId)));

  if (codes.has("okr.objective.update.own") && !out.some((r) => normMembershipId(r.membershipId) === selfNorm)) {
    const supabase = await createSupabaseServerClient();
    const { data: m } = await supabase
      .schema("app")
      .from("organization_memberships")
      .select("id, display_name")
      .eq("id", params.currentMembershipId)
      .maybeSingle();
    if (m?.id) {
      out = [
        { membershipId: m.id, fullName: m.display_name?.trim() || "Mitglied" },
        ...out.filter((r) => normMembershipId(r.membershipId) !== normMembershipId(m.id)),
      ];
    }
  }

  return out;
}
