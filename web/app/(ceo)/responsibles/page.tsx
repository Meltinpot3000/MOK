import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { OrganizationGraphPanel } from "@/components/ceo/OrganizationGraphPanel";
import { ResponsibleAssignmentPanels } from "@/components/ceo/ResponsibleAssignmentPanels";
import { OrganizationTabs } from "@/components/ceo/OrganizationTabs";
import { ResponsibleCreateForm } from "@/components/ceo/ResponsibleCreateForm";
import { ResponsibleRowEditForm } from "@/components/ceo/ResponsibleRowEditForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getOrganizationUnits,
  getActivePlanningCycle,
  getPhase0Context,
  getResponsibles,
} from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";

type ResponsiblesPageProps = {
  searchParams: Promise<{ error?: string; success?: string; code?: string }>;
};

type AssignmentType = "owner" | "support" | "stakeholder";

type ResponsibleAssignmentRow = {
  id: string;
  responsible_id: string;
  assignment_type: AssignmentType;
  assignment_role_de: string | null;
  organization_unit_id: string | null;
  unit: { id: string; code: string; name: string } | null;
};

type AssignableOrganizationUnit = {
  id: string;
  code: string;
  name: string;
  unit_type_label: string;
};

const RESPONSIBLE_ROLE_OPTIONS: Array<{ value: AssignmentType; label: string }> = [
  { value: "owner", label: "Hauptverantwortung" },
  { value: "support", label: "Unterstuetzung" },
  { value: "stakeholder", label: "Stakeholder" },
];

function roleLabelForType(assignmentType: AssignmentType, assignmentRoleDe?: string | null): string {
  if (assignmentRoleDe && assignmentRoleDe.trim().length > 0) return assignmentRoleDe;
  const option = RESPONSIBLE_ROLE_OPTIONS.find((entry) => entry.value === assignmentType);
  return option?.label ?? assignmentType;
}

function getStatusMessage(error?: string, success?: string, code?: string) {
  if (success === "assigned") return { type: "success", text: "Zuordnung wurde gespeichert." };
  if (success === "assignment-removed") return { type: "success", text: "Zuordnung wurde entfernt." };
  if (error === "assign-failed") {
    return {
      type: "error",
      text: `Zuordnung konnte nicht gespeichert werden. Bitte Eingaben pruefen.${code ? ` (Code: ${code})` : ""}`,
    };
  }
  if (error === "missing-fields") {
    return { type: "error", text: "Bitte alle Pflichtfelder ausfuellen." };
  }
  return null;
}

async function getResponsibleAssignments(organizationId: string): Promise<ResponsibleAssignmentRow[]> {
  const supabase = await createSupabaseServerClient();
  const result = await supabase
    .schema("app")
    .from("responsible_assignments")
    .select(
      "id, responsible_id, assignment_type, assignment_role_de, organization_unit_id, unit:organization_unit_id(id, code, name)"
    )
    .eq("organization_id", organizationId);

  if (result.error?.code === "PGRST204") {
    const noRoleResult = await supabase
      .schema("app")
      .from("responsible_assignments")
      .select("id, responsible_id, assignment_type, organization_unit_id, unit:organization_unit_id(id, code, name)")
      .eq("organization_id", organizationId);
    return (noRoleResult.data ?? []).map((row) => ({
      id: row.id,
      responsible_id: row.responsible_id,
      assignment_type: row.assignment_type as AssignmentType,
      assignment_role_de: null,
      organization_unit_id: row.organization_unit_id ?? null,
      unit: Array.isArray(row.unit) ? row.unit[0] ?? null : row.unit ?? null,
    }));
  }

  return (result.data ?? []).map((row) => ({
    id: row.id,
    responsible_id: row.responsible_id,
    assignment_type: row.assignment_type as AssignmentType,
    assignment_role_de: row.assignment_role_de ?? null,
    organization_unit_id: row.organization_unit_id ?? null,
    unit: Array.isArray(row.unit) ? row.unit[0] ?? null : row.unit ?? null,
  }));
}

async function getAssignableOrganizationUnits(
  _organizationId: string,
  organizationUnits: Awaited<ReturnType<typeof getOrganizationUnits>>
): Promise<AssignableOrganizationUnit[]> {
  return organizationUnits.map((unit) => ({
    id: unit.id,
    code: unit.code,
    name: unit.name,
    unit_type_label: unit.unit_type?.name ?? unit.unit_type?.code ?? "Typ",
  }));
}

export default async function ResponsiblesPage({ searchParams }: ResponsiblesPageProps) {
  const pageAccess = await getSidebarAccessContext("organization");
  if (pageAccess.state === "unauthenticated") {
    redirect("/login");
  }
  if (pageAccess.state === "forbidden") {
    redirect("/no-access");
  }
  const canWrite = pageAccess.canWrite;

  const context = await getPhase0Context();
  if (!context) {
    redirect("/no-access");
  }

  const effectiveOrganizationId = pageAccess.access.organizationId;
  if (context.organizationId !== effectiveOrganizationId) {
    console.error("[responsibles] organization context mismatch", {
      phase0OrganizationId: context.organizationId,
      accessOrganizationId: effectiveOrganizationId,
    });
  }

  const [responsibles, organizationUnits, activeCycle, assignments] = await Promise.all([
    getResponsibles(effectiveOrganizationId),
    getOrganizationUnits(effectiveOrganizationId),
    getActivePlanningCycle(effectiveOrganizationId),
    getResponsibleAssignments(effectiveOrganizationId),
  ]);
  const assignableOrgUnits = await getAssignableOrganizationUnits(
    effectiveOrganizationId,
    organizationUnits
  );
  const params = await searchParams;
  const status = getStatusMessage(params.error, params.success, params.code);
  const assignmentsByResponsible = new Map<string, ResponsibleAssignmentRow[]>();
  for (const assignment of assignments) {
    const bucket = assignmentsByResponsible.get(assignment.responsible_id) ?? [];
    bucket.push(assignment);
    assignmentsByResponsible.set(assignment.responsible_id, bucket);
  }

  async function createResponsible(formData: FormData) {
    "use server";
    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("organization");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");

    const fullName = String(formData.get("full_name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const roleTitle = String(formData.get("role_title") ?? "").trim();
    if (!fullName || !email || !roleTitle) {
      redirect("/responsibles?error=missing-fields");
    }

    const supabase = await createSupabaseServerClient();
    await supabase.schema("app").from("responsibles").insert({
      organization_id: localContext.organizationId,
      full_name: fullName,
      email: email.toLowerCase(),
      role_title: roleTitle,
      membership_id: null,
    });

    revalidatePath("/responsibles");
    redirect("/responsibles");
  }

  async function assignResponsible(formData: FormData) {
    "use server";
    const localAccess = await getSidebarAccessContext("organization");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");
    const actorOrganizationId = localAccess.access.organizationId;

    const responsibleId = String(formData.get("responsible_id"));
    const organizationUnitId = String(formData.get("organization_unit_id"));
    const assignmentType = String(formData.get("assignment_type")) as AssignmentType;
    const assignmentRoleDe = roleLabelForType(assignmentType, null);
    if (!responsibleId || !organizationUnitId || !assignmentType) {
      redirect("/responsibles?error=missing-fields");
    }

    const supabase = await createSupabaseServerClient();
    const { data: responsibleRow, error: responsibleError } = await supabase
      .schema("app")
      .from("responsibles")
      .select("id, organization_id, full_name")
      .eq("id", responsibleId)
      .maybeSingle();
    if (responsibleError) {
      console.error("[assignResponsible] responsible lookup failed", {
        code: responsibleError.code,
        message: responsibleError.message,
        details: responsibleError.details,
        hint: responsibleError.hint,
        actorOrganizationId,
        responsibleId,
      });
    }
    if (!responsibleRow?.organization_id) {
      redirect("/responsibles?error=assign-failed&code=RESP_NOT_FOUND");
    }

    const orgResultNew = await supabase
      .schema("app")
      .from("organization_unit")
      .select("id, code, name, organization_id")
      .eq("id", organizationUnitId)
      .maybeSingle();
    const unitOrganizationId = orgResultNew.data?.organization_id ?? null;
    if (orgResultNew.error) {
      console.error("[assignResponsible] unit lookup diagnostics", {
        actorOrganizationId,
        organizationUnitId,
        orgResultNewError: orgResultNew.error
          ? {
              code: orgResultNew.error.code,
              message: orgResultNew.error.message,
              details: orgResultNew.error.details,
              hint: orgResultNew.error.hint,
            }
          : null,
      });
    }
    if (!unitOrganizationId) {
      const errorCode = encodeURIComponent(orgResultNew.error?.code ?? "UNIT_NOT_FOUND");
      redirect(`/responsibles?error=assign-failed&code=${errorCode}`);
    }
    if (
      responsibleRow.organization_id !== unitOrganizationId ||
      responsibleRow.organization_id !== actorOrganizationId
    ) {
      redirect("/responsibles?error=assign-failed&code=ORG_MISMATCH");
    }

    type Variant = {
      selectColumn: "organization_unit_id";
      payload: Record<string, string>;
      unitIdForColumn: string;
      label: string;
    };
    const variants: Variant[] = [
      {
        selectColumn: "organization_unit_id",
        label: "new_with_role",
        unitIdForColumn: organizationUnitId,
        payload: {
          organization_id: actorOrganizationId,
          responsible_id: responsibleId,
          assignment_type: assignmentType,
          assignment_role_de: assignmentRoleDe,
          organization_unit_id: organizationUnitId,
        },
      },
      {
        selectColumn: "organization_unit_id",
        label: "new_without_role",
        unitIdForColumn: organizationUnitId,
        payload: {
          organization_id: actorOrganizationId,
          responsible_id: responsibleId,
          assignment_type: assignmentType,
          organization_unit_id: organizationUnitId,
        },
      },
    ];

    let lastError: { code?: string; message?: string; details?: string; hint?: string } | null = null;
    for (const variant of variants) {
      if (!variant.unitIdForColumn) {
        console.error("[assignResponsible] skip variant without mapped unit id", {
          variant: variant.label,
          actorOrganizationId,
          submittedOrganizationUnitId: organizationUnitId,
        });
        continue;
      }
      const existingResult = await supabase
        .schema("app")
        .from("responsible_assignments")
        .select("id")
        .eq("organization_id", actorOrganizationId)
        .eq("responsible_id", responsibleId)
        .eq("assignment_type", assignmentType)
        .eq(variant.selectColumn, variant.unitIdForColumn)
        .limit(1);

      if (existingResult.error) {
        lastError = existingResult.error;
        console.error("[assignResponsible] existing assignment lookup failed", {
          variant: variant.label,
          selectColumn: variant.selectColumn,
          unitIdForColumn: variant.unitIdForColumn,
          code: existingResult.error.code,
          message: existingResult.error.message,
          details: existingResult.error.details,
          hint: existingResult.error.hint,
          actorOrganizationId,
          responsibleId,
          assignmentType,
        });
        if (!["42703", "PGRST204"].includes(existingResult.error.code ?? "")) break;
        continue;
      }

      const existingId = existingResult.data?.[0]?.id ?? null;
      const writeResult = existingId
        ? await supabase
            .schema("app")
            .from("responsible_assignments")
            .update(variant.payload)
            .eq("id", existingId)
            .eq("organization_id", actorOrganizationId)
        : await supabase.schema("app").from("responsible_assignments").insert(variant.payload);

      if (!writeResult.error) {
        revalidatePath("/responsibles");
        revalidatePath("/organization");
        redirect("/responsibles?success=assigned");
      }

      lastError = writeResult.error;
      console.error("[assignResponsible] write failed", {
        variant: variant.label,
        selectColumn: variant.selectColumn,
        unitIdForColumn: variant.unitIdForColumn,
        payloadKeys: Object.keys(variant.payload),
        code: writeResult.error.code,
        message: writeResult.error.message,
        details: writeResult.error.details,
        hint: writeResult.error.hint,
        actorOrganizationId,
        responsibleId,
        assignmentType,
      });
      if (!["42703", "PGRST204", "P0001"].includes(writeResult.error.code ?? "")) {
        break;
      }
    }

    if (lastError) {
      const errorCode = encodeURIComponent(lastError.code ?? "unknown");
      redirect(`/responsibles?error=assign-failed&code=${errorCode}`);
    }

    revalidatePath("/responsibles");
    revalidatePath("/organization");
    redirect("/responsibles?success=assigned");
  }

  async function removeResponsibleAssignment(formData: FormData) {
    "use server";
    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("organization");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");

    const assignmentId = String(formData.get("assignment_id") ?? "").trim();
    if (!assignmentId) {
      redirect("/responsibles?error=missing-fields");
    }

    const supabase = await createSupabaseServerClient();
    const result = await supabase
      .schema("app")
      .from("responsible_assignments")
      .delete()
      .eq("organization_id", localContext.organizationId)
      .eq("id", assignmentId);

    if (result.error) {
      redirect("/responsibles?error=assign-failed");
    }

    revalidatePath("/responsibles");
    revalidatePath("/organization");
    redirect("/responsibles?success=assignment-removed");
  }

  async function createReportingLine(formData: FormData) {
    "use server";
    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("organization");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");

    const managerId = String(formData.get("manager_responsible_id"));
    const reportId = String(formData.get("report_responsible_id"));
    if (!managerId || !reportId) {
      redirect("/responsibles?error=missing-fields");
    }

    const supabase = await createSupabaseServerClient();
    await supabase.schema("app").from("responsible_hierarchy").insert({
      organization_id: localContext.organizationId,
      manager_responsible_id: managerId,
      report_responsible_id: reportId,
    });

    revalidatePath("/responsibles");
    redirect("/responsibles");
  }

  async function updateResponsible(formData: FormData) {
    "use server";
    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("organization");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");

    const responsibleId = String(formData.get("id") ?? "").trim();
    const fullName = String(formData.get("full_name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const roleTitle = String(formData.get("role_title") ?? "").trim();
    if (!responsibleId || !fullName || !email || !roleTitle) {
      redirect("/responsibles");
    }

    const supabase = await createSupabaseServerClient();
    await supabase
      .schema("app")
      .from("responsibles")
      .update({
        full_name: fullName,
        email: email.toLowerCase(),
        role_title: roleTitle,
      })
      .eq("organization_id", localContext.organizationId)
      .eq("id", responsibleId);

    revalidatePath("/responsibles");
    redirect("/responsibles");
  }

  async function deleteResponsible(formData: FormData) {
    "use server";
    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("organization");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");

    const responsibleId = String(formData.get("id") ?? "").trim();
    if (!responsibleId) {
      redirect("/responsibles");
    }

    const supabase = await createSupabaseServerClient();
    await supabase
      .schema("app")
      .from("responsibles")
      .delete()
      .eq("organization_id", localContext.organizationId)
      .eq("id", responsibleId);

    revalidatePath("/responsibles");
    redirect("/responsibles");
  }

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Organisationsstruktur</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Verantwortliche</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Lege Verantwortliche an, bearbeite Stammdaten und ordne sie direkt den passenden Bereichen zu.
        </p>
      </header>

      <OrganizationTabs />

      {status ? (
        <p
          className={`rounded-md border p-3 text-sm ${
            status.type === "error"
              ? "border-red-300 bg-red-50 text-red-800"
              : "border-emerald-300 bg-emerald-50 text-emerald-800"
          }`}
        >
          {status.text}
        </p>
      ) : null}

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Verantwortliche anlegen</h2>
        <ResponsibleCreateForm canWrite={canWrite} action={createResponsible} />
      </section>

      <ResponsibleAssignmentPanels
        canWrite={canWrite}
        responsibles={responsibles}
        orgUnits={assignableOrgUnits}
        roleOptions={RESPONSIBLE_ROLE_OPTIONS}
        assignAction={assignResponsible}
        hierarchyAction={createReportingLine}
      />
      {!canWrite ? (
        <p className="brand-surface p-3 text-sm text-zinc-600">
          Diese Rolle hat nur Leserechte für Verantwortliche.
        </p>
      ) : null}

      <OrganizationGraphPanel
        organizationId={context.organizationId}
        cycleInstanceId={activeCycle?.id ?? null}
      />

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Verantwortlichenliste</h2>
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[760px] text-sm">
            <div className="grid grid-cols-10 gap-2 border-b border-zinc-200 pb-2 text-left text-zinc-500">
              <p className="col-span-3">Name</p>
              <p className="col-span-3">E-Mail</p>
              <p className="col-span-2">Rollenbezeichnung</p>
              <p className="col-span-2">Aktionen</p>
            </div>
            <div>
              {responsibles.map((responsible) => (
                <div key={responsible.id} className="border-b border-zinc-100 py-2">
                  <ResponsibleRowEditForm
                    responsible={responsible}
                    canWrite={canWrite}
                    updateAction={updateResponsible}
                    deleteAction={deleteResponsible}
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {(assignmentsByResponsible.get(responsible.id) ?? []).length === 0 ? (
                      <span className="text-xs text-zinc-500">Keine Organisationszuordnung vorhanden.</span>
                    ) : (
                      (assignmentsByResponsible.get(responsible.id) ?? []).map((assignment) => (
                        <form
                          key={assignment.id}
                          action={removeResponsibleAssignment}
                          className="inline-flex items-center gap-2"
                        >
                          <input type="hidden" name="assignment_id" value={assignment.id} />
                          <span className="rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-700">
                            {assignment.unit
                              ? `${assignment.unit.code} - ${assignment.unit.name}`
                              : "Organisationseinheit"}
                            {" | "}
                            {roleLabelForType(assignment.assignment_type, assignment.assignment_role_de)}
                          </span>
                          <button
                            type="submit"
                            disabled={!canWrite}
                            className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            Entfernen
                          </button>
                        </form>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {responsibles.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Noch keine Verantwortlichen vorhanden.</p>
        ) : null}
      </section>
    </div>
  );
}
