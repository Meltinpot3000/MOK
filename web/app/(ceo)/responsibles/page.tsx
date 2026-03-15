import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { OrganizationGraphPanel } from "@/components/ceo/OrganizationGraphPanel";
import { OrganizationTabs } from "@/components/ceo/OrganizationTabs";
import { ResponsibleCreateForm } from "@/components/ceo/ResponsibleCreateForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getOrganizationUnits,
  getPhase0Context,
  getPlanningCycles,
  getResponsibles,
} from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";

type ResponsiblesPageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
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

function getStatusMessage(error?: string, success?: string) {
  if (success === "assigned") return { type: "success", text: "Zuordnung wurde gespeichert." };
  if (success === "assignment-removed") return { type: "success", text: "Zuordnung wurde entfernt." };
  if (error === "assign-failed") {
    return { type: "error", text: "Zuordnung konnte nicht gespeichert werden. Bitte Eingaben pruefen." };
  }
  if (error === "missing-fields") {
    return { type: "error", text: "Bitte alle Pflichtfelder ausfuellen." };
  }
  return null;
}

async function getResponsibleAssignments(organizationId: string): Promise<ResponsibleAssignmentRow[]> {
  const supabase = await createSupabaseServerClient();
  const newResult = await supabase
    .schema("app")
    .from("responsible_assignments")
    .select(
      "id, responsible_id, assignment_type, assignment_role_de, organization_unit_id, unit:organization_unit_id(id, code, name)"
    )
    .eq("organization_id", organizationId);

  if (!newResult.error) {
    return (newResult.data ?? []).map((row) => ({
      id: row.id,
      responsible_id: row.responsible_id,
      assignment_type: row.assignment_type as AssignmentType,
      assignment_role_de: row.assignment_role_de ?? null,
      organization_unit_id: row.organization_unit_id ?? null,
      unit: Array.isArray(row.unit) ? row.unit[0] ?? null : row.unit ?? null,
    }));
  }

  const fallbackResult = await supabase
    .schema("app")
    .from("responsible_assignments")
    .select("id, responsible_id, assignment_type, org_unit_id, unit:org_unit_id(id, code, name)")
    .eq("organization_id", organizationId);

  return (fallbackResult.data ?? []).map((row) => ({
    id: row.id,
    responsible_id: row.responsible_id,
    assignment_type: row.assignment_type as AssignmentType,
    assignment_role_de: null,
    organization_unit_id: row.org_unit_id ?? null,
    unit: Array.isArray(row.unit) ? row.unit[0] ?? null : row.unit ?? null,
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

  const [responsibles, orgUnits, cycles, assignments] = await Promise.all([
    getResponsibles(context.organizationId),
    getOrganizationUnits(context.organizationId),
    getPlanningCycles(context.organizationId),
    getResponsibleAssignments(context.organizationId),
  ]);
  const params = await searchParams;
  const status = getStatusMessage(params.error, params.success);
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
      membership_id: localContext.membershipId,
    });

    revalidatePath("/responsibles");
    redirect("/responsibles");
  }

  async function assignResponsible(formData: FormData) {
    "use server";
    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("organization");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");

    const responsibleId = String(formData.get("responsible_id"));
    const organizationUnitId = String(formData.get("organization_unit_id"));
    const assignmentType = String(formData.get("assignment_type")) as AssignmentType;
    const assignmentRoleDe = roleLabelForType(assignmentType, null);
    if (!responsibleId || !organizationUnitId || !assignmentType) {
      redirect("/responsibles?error=missing-fields");
    }

    const supabase = await createSupabaseServerClient();
    let result = await supabase.schema("app").from("responsible_assignments").upsert(
      {
        organization_id: localContext.organizationId,
        responsible_id: responsibleId,
        organization_unit_id: organizationUnitId,
        assignment_type: assignmentType,
        assignment_role_de: assignmentRoleDe,
      },
      { onConflict: "responsible_id,organization_unit_id,assignment_type" }
    );

    if (result.error?.code === "42703") {
      result = await supabase.schema("app").from("responsible_assignments").upsert(
        {
          organization_id: localContext.organizationId,
          responsible_id: responsibleId,
          organization_unit_id: organizationUnitId,
          assignment_type: assignmentType,
        },
        { onConflict: "responsible_id,organization_unit_id,assignment_type" }
      );
    }

    if (result.error?.code === "42703") {
      result = await supabase.schema("app").from("responsible_assignments").upsert(
        {
          organization_id: localContext.organizationId,
          responsible_id: responsibleId,
          org_unit_id: organizationUnitId,
          assignment_type: assignmentType,
        },
        { onConflict: "responsible_id,org_unit_id,assignment_type" }
      );
    }

    if (result.error) {
      redirect("/responsibles?error=assign-failed");
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
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Phase 0 Fundament</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Verantwortliche</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Verantwortliche verwalten, Bereichen zuordnen und hierarchisch strukturieren.
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

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Bereichszuordnung</h2>
          <form action={assignResponsible} className="mt-4 space-y-3">
            <select name="responsible_id" required className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm">
              <option value="">Verantwortliche auswählen</option>
              {responsibles.map((responsible) => (
                <option key={responsible.id} value={responsible.id}>
                  {responsible.full_name}
                </option>
              ))}
            </select>
            <select
              name="organization_unit_id"
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Organisationseinheit auswählen</option>
              {orgUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} - {unit.name} ({unit.unit_type?.name ?? unit.unit_type?.code ?? "Typ"})
                </option>
              ))}
            </select>
            <select
              name="assignment_type"
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              {RESPONSIBLE_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!canWrite}
              className="brand-btn px-4 py-2 text-sm"
            >
              Zuordnung speichern
            </button>
          </form>
        </article>

        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">
            Hierarchie (Manager {"->"} Report)
          </h2>
          <form action={createReportingLine} className="mt-4 space-y-3">
            <select
              name="manager_responsible_id"
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Manager auswählen</option>
              {responsibles.map((responsible) => (
                <option key={responsible.id} value={responsible.id}>
                  {responsible.full_name}
                </option>
              ))}
            </select>
            <select
              name="report_responsible_id"
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Report auswählen</option>
              {responsibles.map((responsible) => (
                <option key={responsible.id} value={responsible.id}>
                  {responsible.full_name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!canWrite}
              className="brand-btn px-4 py-2 text-sm"
            >
              Hierarchie speichern
            </button>
          </form>
        </article>
      </section>
      {!canWrite ? (
        <p className="brand-surface p-3 text-sm text-zinc-600">
          Diese Rolle hat nur Leserechte für Verantwortliche.
        </p>
      ) : null}

      <OrganizationGraphPanel
        organizationId={context.organizationId}
        planningCycleId={cycles[0]?.id ?? null}
      />

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Verantwortlichenliste</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500">
                <th className="py-2">Name</th>
                <th className="py-2">E-Mail</th>
                <th className="py-2">Rollenbezeichnung</th>
                <th className="py-2">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {responsibles.map((responsible) => (
                <tr key={responsible.id} className="border-b border-zinc-100">
                  <td className="py-2 align-top" colSpan={4}>
                    <form action={updateResponsible} className="grid min-w-[760px] grid-cols-10 gap-2">
                      <input type="hidden" name="id" value={responsible.id} />
                      <input
                        name="full_name"
                        required
                        defaultValue={responsible.full_name}
                        className="col-span-3 rounded-md border border-zinc-300 px-3 py-2 text-sm"
                      />
                      <input
                        name="email"
                        required
                        type="email"
                        defaultValue={responsible.email ?? ""}
                        className="col-span-3 rounded-md border border-zinc-300 px-3 py-2 text-sm"
                      />
                      <input
                        name="role_title"
                        required
                        defaultValue={responsible.role_title ?? ""}
                        className="col-span-2 rounded-md border border-zinc-300 px-3 py-2 text-sm"
                      />
                      <div className="col-span-2 flex gap-2">
                        <button
                          type="submit"
                          disabled={!canWrite}
                          className="brand-btn px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="submit"
                          formAction={deleteResponsible}
                          formNoValidate
                          disabled={!canWrite}
                          className="rounded-md border border-red-300 px-3 py-2 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Löschen
                        </button>
                      </div>
                    </form>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {responsibles.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Noch keine Verantwortlichen vorhanden.</p>
        ) : null}
      </section>
    </div>
  );
}
