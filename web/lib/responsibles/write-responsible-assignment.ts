import type { SupabaseClient } from "@supabase/supabase-js";

export type ResponsibleAssignmentType = "owner" | "support" | "stakeholder";

export type ResponsibleAssignmentWriteResult = { ok: true } | { ok: false; code: string };

/** Persistiert eine Bereichszuordnung (Upsert nach responsible + Einheit + assignment_type). */
export async function writeResponsibleAssignment(
  supabase: SupabaseClient,
  actorOrganizationId: string,
  responsibleId: string,
  organizationUnitId: string,
  assignmentType: ResponsibleAssignmentType,
  roleLabelForType: (t: ResponsibleAssignmentType, roleDe: string | null) => string
): Promise<ResponsibleAssignmentWriteResult> {
  const assignmentRoleDe = roleLabelForType(assignmentType, null);

  const { data: responsibleRow, error: responsibleError } = await supabase
    .schema("app")
    .from("responsibles")
    .select("id, organization_id, full_name")
    .eq("id", responsibleId)
    .maybeSingle();

  if (responsibleError) {
    console.error("[writeResponsibleAssignment] responsible lookup failed", {
      code: responsibleError.code,
      message: responsibleError.message,
      actorOrganizationId,
      responsibleId,
    });
  }
  if (!responsibleRow?.organization_id) {
    return { ok: false, code: "RESP_NOT_FOUND" };
  }

  const orgResultNew = await supabase
    .schema("app")
    .from("organization_unit")
    .select("id, code, name, organization_id")
    .eq("id", organizationUnitId)
    .maybeSingle();
  const unitOrganizationId = orgResultNew.data?.organization_id ?? null;
  if (orgResultNew.error) {
    console.error("[writeResponsibleAssignment] unit lookup diagnostics", {
      actorOrganizationId,
      organizationUnitId,
      code: orgResultNew.error.code,
      message: orgResultNew.error.message,
    });
  }
  if (!unitOrganizationId) {
    return { ok: false, code: orgResultNew.error?.code ?? "UNIT_NOT_FOUND" };
  }
  if (
    responsibleRow.organization_id !== unitOrganizationId ||
    responsibleRow.organization_id !== actorOrganizationId
  ) {
    return { ok: false, code: "ORG_MISMATCH" };
  }

  const payload = {
    organization_id: actorOrganizationId,
    responsible_id: responsibleId,
    assignment_type: assignmentType,
    assignment_role_de: assignmentRoleDe,
    organization_unit_id: organizationUnitId,
  };

  const existingResult = await supabase
    .schema("app")
    .from("responsible_assignments")
    .select("id")
    .eq("organization_id", actorOrganizationId)
    .eq("responsible_id", responsibleId)
    .eq("assignment_type", assignmentType)
    .eq("organization_unit_id", organizationUnitId)
    .limit(1);

  if (existingResult.error) {
    return { ok: false, code: existingResult.error.code ?? "LOOKUP" };
  }

  const existingId = existingResult.data?.[0]?.id ?? null;
  const writeResult = existingId
    ? await supabase
        .schema("app")
        .from("responsible_assignments")
        .update(payload)
        .eq("id", existingId)
        .eq("organization_id", actorOrganizationId)
    : await supabase.schema("app").from("responsible_assignments").insert(payload);

  if (writeResult.error) {
    return { ok: false, code: writeResult.error.code ?? "WRITE" };
  }

  return { ok: true };
}
