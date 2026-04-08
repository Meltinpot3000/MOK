import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthUserIdentity = {
  email: string | null;
  name: string | null;
};

export async function resolveAuthUserIdentity(userId: string): Promise<AuthUserIdentity> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { email: null, name: null };
  }
  const { data } = await admin.auth.admin.getUserById(userId);
  const email = data.user?.email?.toLowerCase() ?? null;
  const metadata =
    data.user?.user_metadata && typeof data.user.user_metadata === "object"
      ? (data.user.user_metadata as Record<string, unknown>)
      : null;
  const fullNameRaw = metadata?.full_name ?? metadata?.name ?? metadata?.display_name ?? null;
  const name =
    typeof fullNameRaw === "string" && fullNameRaw.trim().length > 0 ? fullNameRaw.trim() : null;
  return { email, name };
}

export type EnsureResponsibleResult = { ok: true; responsibleId: string } | { ok: false; code: string };

/**
 * Einziger unterstützter Weg, um eine Zeile in `app.responsibles` anzulegen oder den Cache
 * (full_name, email, role_title) zu aktualisieren. `membership_id` ist Pflicht in der DB.
 *
 * Nicht `app.responsibles` direkt per Insert/Seed befüllen, außer über
 * `supabase/seed/013_responsibles_backfill_from_memberships.sql`, das dieselbe semantische Kette nutzt.
 */
export async function ensureResponsibleForMembership(
  organizationId: string,
  membershipId: string
): Promise<EnsureResponsibleResult> {
  const supabase = await createSupabaseServerClient();

  const { data: membership, error: memErr } = await supabase
    .schema("app")
    .from("organization_memberships")
    .select("id, organization_id, user_id, display_name, title, responsible_id, status")
    .eq("id", membershipId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (memErr || !membership) {
    console.error("[ensureResponsibleForMembership] membership", memErr);
    return { ok: false, code: "MEMBERSHIP" };
  }

  type MemRow = {
    id: string;
    organization_id: string;
    user_id: string;
    display_name: string | null;
    title: string | null;
    responsible_id: string | null;
    status: string;
  };
  const m = membership as MemRow;

  if (m.status !== "active" && m.status !== "invited") {
    return { ok: false, code: "MEMBERSHIP_STATUS" };
  }

  const identity = await resolveAuthUserIdentity(m.user_id);
  const fullName =
    (m.display_name && m.display_name.trim().length > 0 ? m.display_name.trim() : null) ??
    identity.name ??
    (identity.email ? identity.email.split("@")[0] : null) ??
    "Nutzer";
  const emailLower = identity.email?.toLowerCase() ?? "";
  const roleTitle = m.title ?? null;

  const { data: byMembership } = await supabase
    .schema("app")
    .from("responsibles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("membership_id", membershipId)
    .maybeSingle();

  let responsibleId: string | null = byMembership?.id ?? null;

  if (responsibleId) {
    const upd = await supabase
      .schema("app")
      .from("responsibles")
      .update({
        membership_id: membershipId,
        full_name: fullName,
        email: emailLower.length > 0 ? emailLower : null,
        role_title: roleTitle,
      })
      .eq("id", responsibleId)
      .eq("organization_id", organizationId);

    if (upd.error) {
      console.error("[ensureResponsibleForMembership] update", upd.error);
      return { ok: false, code: upd.error.code ?? "UPDATE" };
    }
  } else {
    const ins = await supabase
      .schema("app")
      .from("responsibles")
      .insert({
        organization_id: organizationId,
        membership_id: membershipId,
        full_name: fullName,
        email: emailLower.length > 0 ? emailLower : null,
        role_title: roleTitle,
      })
      .select("id")
      .maybeSingle();

    if (ins.error || !ins.data?.id) {
      console.error("[ensureResponsibleForMembership] insert", ins.error);
      return { ok: false, code: ins.error?.code ?? "INSERT" };
    }
    responsibleId = ins.data.id;
  }

  const memUpd = await supabase
    .schema("app")
    .from("organization_memberships")
    .update({ responsible_id: responsibleId })
    .eq("id", membershipId)
    .eq("organization_id", organizationId);

  if (memUpd.error) {
    console.error("[ensureResponsibleForMembership] membership responsible_id", memUpd.error);
    return { ok: false, code: memUpd.error.code ?? "MEMLINK" };
  }

  if (!responsibleId) {
    return { ok: false, code: "ASSERT" };
  }

  return { ok: true, responsibleId };
}

/** Entfernt alle Kanten manager -> focal; optional eine neue Kante setzen. */
export async function syncResponsibleManagerEdge(
  supabase: SupabaseClient,
  organizationId: string,
  focalResponsibleId: string,
  managerResponsibleId: string | null
): Promise<{ ok: true } | { ok: false; code: string }> {
  const del = await supabase
    .schema("app")
    .from("responsible_hierarchy")
    .delete()
    .eq("organization_id", organizationId)
    .eq("report_responsible_id", focalResponsibleId);

  if (del.error) {
    return { ok: false, code: del.error.code ?? "H_DEL" };
  }

  if (managerResponsibleId && managerResponsibleId !== focalResponsibleId) {
    const ins = await supabase.schema("app").from("responsible_hierarchy").insert({
      organization_id: organizationId,
      manager_responsible_id: managerResponsibleId,
      report_responsible_id: focalResponsibleId,
    });
    if (ins.error) {
      return { ok: false, code: ins.error.code ?? "H_INS" };
    }
  }

  return { ok: true };
}

/** Synct Reports unterhalb von focal: gewuenschte Menge (focal ist Manager). */
export async function syncResponsibleReportEdges(
  supabase: SupabaseClient,
  organizationId: string,
  focalResponsibleId: string,
  reportResponsibleIds: string[]
): Promise<{ ok: true } | { ok: false; code: string }> {
  const desired = new Set(
    reportResponsibleIds.map((id) => id.trim()).filter((id) => id.length > 0 && id !== focalResponsibleId)
  );

  const { data: existingRows, error: selErr } = await supabase
    .schema("app")
    .from("responsible_hierarchy")
    .select("report_responsible_id")
    .eq("organization_id", organizationId)
    .eq("manager_responsible_id", focalResponsibleId);

  if (selErr) {
    return { ok: false, code: selErr.code ?? "H_SEL" };
  }

  const existing = new Set((existingRows ?? []).map((r) => r.report_responsible_id));

  for (const rid of existing) {
    if (!desired.has(rid)) {
      const d = await supabase
        .schema("app")
        .from("responsible_hierarchy")
        .delete()
        .eq("organization_id", organizationId)
        .eq("manager_responsible_id", focalResponsibleId)
        .eq("report_responsible_id", rid);
      if (d.error) {
        return { ok: false, code: d.error.code ?? "H_RDEL" };
      }
    }
  }

  for (const rid of desired) {
    if (!existing.has(rid)) {
      const ins = await supabase.schema("app").from("responsible_hierarchy").insert({
        organization_id: organizationId,
        manager_responsible_id: focalResponsibleId,
        report_responsible_id: rid,
      });
      if (ins.error) {
        return { ok: false, code: ins.error.code ?? "H_RINS" };
      }
    }
  }

  return { ok: true };
}
