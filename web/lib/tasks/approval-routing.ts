import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ApprovalRoutingMode, ApprovalRoutingReason } from "@/lib/tasks/approval-source-types";

export type ApprovalAssigneeResolution = {
  assigneeMembershipId: string;
  routingMode: ApprovalRoutingMode;
  routingReason: ApprovalRoutingReason;
};

/**
 * Primär: Manager über responsible_hierarchy (Report = einreichender Responsible).
 * Fallback: erster aktiver Executive, dann Admin — deterministisch sortiert.
 */
export async function resolveApprovalAssignee(
  organizationId: string,
  submitterMembershipId: string
): Promise<ApprovalAssigneeResolution> {
  const supabase = await createSupabaseServerClient();

  const { data: submitter, error: subErr } = await supabase
    .schema("app")
    .from("organization_memberships")
    .select("id, responsible_id, status")
    .eq("id", submitterMembershipId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (subErr || !submitter || submitter.status !== "active") {
    throw new Error("approval-submitter-not-found");
  }

  const responsibleId = submitter.responsible_id;
  if (responsibleId) {
    const { data: edge } = await supabase
      .schema("app")
      .from("responsible_hierarchy")
      .select("manager_responsible_id")
      .eq("report_responsible_id", responsibleId)
      .maybeSingle();

    if (edge?.manager_responsible_id) {
      const { data: managerResp } = await supabase
        .schema("app")
        .from("responsibles")
        .select("membership_id")
        .eq("id", edge.manager_responsible_id)
        .eq("organization_id", organizationId)
        .maybeSingle();

      const mid = managerResp?.membership_id;
      if (mid) {
        const { data: mgrMem } = await supabase
          .schema("app")
          .from("organization_memberships")
          .select("id, status")
          .eq("id", mid)
          .eq("organization_id", organizationId)
          .maybeSingle();
        if (mgrMem?.status === "active") {
          return {
            assigneeMembershipId: mid,
            routingMode: "direct_manager",
            routingReason: null,
          };
        }
      }
    }
  }

  const exec = await pickFallbackMembership(supabase, organizationId, "executive");
  if (exec) {
    return {
      assigneeMembershipId: exec,
      routingMode: "executive_fallback",
      routingReason: "manager_not_found",
    };
  }

  const admin = await pickFallbackMembership(supabase, organizationId, "org_admin");
  if (admin) {
    return {
      assigneeMembershipId: admin,
      routingMode: "admin_fallback",
      routingReason: "executive_not_found",
    };
  }

  throw new Error("approval-no-assignee");
}

type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function pickFallbackMembership(
  supabase: SupabaseServer,
  organizationId: string,
  roleCode: "executive" | "org_admin"
): Promise<string | null> {
  const { data: roleRow } = await supabase
    .schema("rbac")
    .from("roles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("code", roleCode)
    .maybeSingle();

  if (!roleRow?.id) return null;

  const { data: memberRows } = await supabase
    .schema("rbac")
    .from("member_roles")
    .select("membership_id")
    .eq("role_id", roleRow.id);

  const ids = [...new Set((memberRows ?? []).map((r) => r.membership_id))];
  if (ids.length === 0) return null;

  const { data: memberships } = await supabase
    .schema("app")
    .from("organization_memberships")
    .select("id, hierarchy_level, created_at, display_name")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .in("id", ids);

  const rows = memberships ?? [];
  if (rows.length === 0) return null;

  rows.sort((a, b) => {
    const ha = a.hierarchy_level ?? -1;
    const hb = b.hierarchy_level ?? -1;
    if (ha !== hb) return hb - ha;
    const ca = a.created_at ? String(a.created_at) : "";
    const cb = b.created_at ? String(b.created_at) : "";
    if (ca !== cb) return ca.localeCompare(cb);
    return (a.display_name ?? "").localeCompare(b.display_name ?? "", "de");
  });

  return rows[0]?.id ?? null;
}
