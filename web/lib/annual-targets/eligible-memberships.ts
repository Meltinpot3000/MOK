import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPermissionCodesForMembership } from "@/lib/rbac/permission-codes";
import {
  collectAncestorMembershipIds,
  collectDescendantMembershipIds,
  normMembershipId,
  type MembershipReportingRow,
} from "@/lib/annual-targets/membership-reporting-tree";

export type AnnualTargetOwnerOption = {
  membershipId: string;
  fullName: string;
};

export async function loadOrganizationMembershipReportingTree(
  organizationId: string
): Promise<MembershipReportingRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("organization_memberships")
    .select("id, reports_to_membership_id")
    .eq("organization_id", organizationId)
    .in("status", ["active", "invited"]);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    reportsToMembershipId: (row.reports_to_membership_id as string | null) ?? null,
  }));
}

/**
 * Team-Tab: nur Jahresziele von Unterstellten (rekursiv), nie die ganze Organisation.
 */
export async function filterMembershipsForAnnualTargetTeamView(params: {
  organizationId: string;
  currentMembershipId: string;
  responsibles: AnnualTargetOwnerOption[];
}): Promise<AnnualTargetOwnerOption[]> {
  const tree = await loadOrganizationMembershipReportingTree(params.organizationId);
  const descendantIds = collectDescendantMembershipIds(params.currentMembershipId, tree);
  return params.responsibles.filter((r) => descendantIds.has(normMembershipId(r.membershipId)));
}

/**
 * Memberships, für die der aktuelle User Jahresziele anlegen/bearbeiten darf.
 * Analog OKR Owner-Select — keine globale Userliste.
 */
export async function filterMembershipsForAnnualTargetOwnerSelect(params: {
  organizationId: string;
  currentMembershipId: string;
  responsibles: AnnualTargetOwnerOption[];
}): Promise<{ options: AnnualTargetOwnerOption[]; canPickOwner: boolean }> {
  const codes = await getPermissionCodesForMembership(params.currentMembershipId);
  const tree = await loadOrganizationMembershipReportingTree(params.organizationId);
  const selfNorm = normMembershipId(params.currentMembershipId);

  // Nur org-weites Zuweisen mit explizitem Granular-Recht — nicht über nav.* allein.
  if (codes.has("annual_targets.write.all")) {
    return { options: params.responsibles, canPickOwner: true };
  }

  const ancestors = collectAncestorMembershipIds(params.currentMembershipId, tree);
  const allowed = new Set<string>();

  if (codes.has("annual_targets.write.own")) {
    allowed.add(selfNorm);
  }

  if (codes.has("annual_targets.write.department")) {
    for (const id of collectDescendantMembershipIds(params.currentMembershipId, tree)) {
      allowed.add(id);
    }
  }

  if (allowed.size === 0) {
    return { options: [], canPickOwner: false };
  }

  let out = params.responsibles.filter(
    (r) =>
      allowed.has(normMembershipId(r.membershipId)) &&
      !ancestors.has(normMembershipId(r.membershipId))
  );

  if (codes.has("annual_targets.write.own") && !out.some((r) => normMembershipId(r.membershipId) === selfNorm)) {
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

  const canPickOwner =
    (codes.has("annual_targets.write.department") &&
      out.some((r) => normMembershipId(r.membershipId) !== selfNorm)) ||
    (allowed.size > 1 && out.length > 1);

  return { options: out, canPickOwner: canPickOwner && out.length > 0 };
}

export async function assertCanAssignAnnualTargetOwner(params: {
  organizationId: string;
  currentMembershipId: string;
  targetOwnerMembershipId: string;
  responsibles: AnnualTargetOwnerOption[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { options } = await filterMembershipsForAnnualTargetOwnerSelect({
    organizationId: params.organizationId,
    currentMembershipId: params.currentMembershipId,
    responsibles: params.responsibles,
  });
  const allowed = new Set(options.map((o) => normMembershipId(o.membershipId)));
  if (!allowed.has(normMembershipId(params.targetOwnerMembershipId))) {
    return { ok: false, error: "Keine Berechtigung, ein Jahresziel für diese Membership anzulegen." };
  }
  return { ok: true };
}
