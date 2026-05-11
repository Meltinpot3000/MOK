import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { OrganizationGraphPanel } from "@/components/ceo/OrganizationGraphPanel";
import { OrganizationTabs } from "@/components/ceo/OrganizationTabs";
import { ResponsibleRowEditForm } from "@/components/ceo/ResponsibleRowEditForm";
import { ResponsibleSetupForm } from "@/components/ceo/ResponsibleSetupForm";
import {
  fetchMaxAssignmentRankInUnit,
  rankFromAssignmentType,
} from "@/lib/responsibles/assignment-rank";
import {
  fetchMaxRbacRankForMembership,
  fetchMaxRbacRankForResponsible,
  fetchRbacMaxRankByMembershipIds,
} from "@/lib/rbac/org-role-rank";
import { ConfirmBeforeSubmitForm } from "@/components/ui/ConfirmBeforeSubmitForm";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getMembershipsForResponsibleSetup,
  getOrganizationUnits,
  getActivePlanningCycle,
  getPhase0Context,
  getResponsibles,
} from "@/lib/phase0/queries";
import {
  ensureResponsibleForMembership,
  syncResponsibleManagerEdge,
  syncResponsibleReportEdges,
} from "@/lib/responsibles/membership-responsible";
import { writeResponsibleAssignment } from "@/lib/responsibles/write-responsible-assignment";
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
  { value: "support", label: "Unterst\u00FCtzung" },
  { value: "stakeholder", label: "Stakeholder" },
];

function roleLabelForType(assignmentType: AssignmentType, assignmentRoleDe?: string | null): string {
  if (assignmentRoleDe && assignmentRoleDe.trim().length > 0) return assignmentRoleDe;
  const option = RESPONSIBLE_ROLE_OPTIONS.find((entry) => entry.value === assignmentType);
  return option?.label ?? assignmentType;
}

function getStatusMessage(error?: string, success?: string, code?: string) {
  if (success === "saved") return { type: "success", text: "Aenderungen wurden gespeichert." };
  if (success === "assigned") return { type: "success", text: "Zuordnung wurde gespeichert." };
  if (success === "assignment-removed") return { type: "success", text: "Zuordnung wurde entfernt." };
  if (error === "assign-failed") {
    return {
      type: "error",
      text: `Zuordnung konnte nicht gespeichert werden. Bitte Eingaben pruefen.${code ? ` (Code: ${code})` : ""}`,
    };
  }
  if (error === "bundle-failed") {
    return {
      type: "error",
      text: `Speichern fehlgeschlagen.${code ? ` (Code: ${code})` : ""}`,
    };
  }
  if (error === "missing-fields") {
    return { type: "error", text: "Bitte alle Pflichtfelder ausf\u00FCllen." };
  }
  if (error === "hierarchy-role-order") {
    return {
      type: "error",
      text: "Reporting passt nicht zur Rollenlogik: Manager mindestens auf gleicher Organisations-Rollenstufe wie die gewählte Mitgliedschaft; Reports höchstens auf gleicher Stufe. Bei gewählter Organisationseinheit gelten zusätzlich die Regeln für Hauptverantwortung / Unterstützung / Stakeholder.",
    };
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

type UserIdentity = { email: string | null; name: string | null };

async function buildMembershipPickerOptions(
  organizationId: string
): Promise<
  Array<{ id: string; label: string; email: string | null; title: string | null; responsibleId: string | null }>
> {
  const raw = await getMembershipsForResponsibleSetup(organizationId);
  const adminClient = createSupabaseAdminClient();
  const identityByUserId = new Map<string, UserIdentity>();

  if (adminClient) {
    await Promise.all(
      Array.from(new Set(raw.map((m) => m.user_id))).map(async (userId) => {
        const { data } = await adminClient.auth.admin.getUserById(userId);
        const email = data.user?.email?.toLowerCase() ?? null;
        const metadata =
          data.user?.user_metadata && typeof data.user.user_metadata === "object"
            ? (data.user.user_metadata as Record<string, unknown>)
            : null;
        const fullNameRaw = metadata?.full_name ?? metadata?.name ?? metadata?.display_name ?? null;
        const name =
          typeof fullNameRaw === "string" && fullNameRaw.trim().length > 0 ? fullNameRaw.trim() : null;
        identityByUserId.set(userId, { email, name });
      })
    );
  }

  return raw.map((m) => {
    const ident = identityByUserId.get(m.user_id);
    const email = ident?.email ?? null;
    const display =
      (m.display_name && m.display_name.trim().length > 0 ? m.display_name.trim() : null) ??
      ident?.name ??
      (email ? email.split("@")[0] : null) ??
      "Mitglied";
    const label = `${display}${email ? ` (${email})` : ""}${m.title?.trim() ? ` — ${m.title.trim()}` : ""}`;
    return {
      id: m.id,
      label,
      email,
      title: m.title,
      responsibleId: m.responsible_id,
    };
  });
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

  const [responsibles, organizationUnits, activeCycle, assignments, membershipOptions] = await Promise.all([
    getResponsibles(effectiveOrganizationId),
    getOrganizationUnits(effectiveOrganizationId),
    getActivePlanningCycle(effectiveOrganizationId),
    getResponsibleAssignments(effectiveOrganizationId),
    buildMembershipPickerOptions(effectiveOrganizationId),
  ]);
  const supabaseClient = await createSupabaseServerClient();
  const rbacMaxRankByMembershipId = await fetchRbacMaxRankByMembershipIds(
    supabaseClient,
    effectiveOrganizationId,
    [
      ...membershipOptions.map((m) => m.id),
      ...responsibles.map((r) => r.membership_id).filter((id): id is string => Boolean(id)),
    ]
  );
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

  const unitAssignmentsForForm = assignments
    .filter((a): a is ResponsibleAssignmentRow & { organization_unit_id: string } =>
      Boolean(a.organization_unit_id)
    )
    .map((a) => ({
      responsible_id: a.responsible_id,
      organization_unit_id: a.organization_unit_id,
      assignment_type: a.assignment_type,
    }));

  async function saveResponsibleSetup(formData: FormData) {
    "use server";
    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("organization");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");
    const actorOrganizationId = localAccess.access.organizationId;

    const membershipId = String(formData.get("membership_id") ?? "").trim();
    const organizationUnitId = String(formData.get("organization_unit_id") ?? "").trim();
    const assignmentTypeRaw = String(formData.get("assignment_type") ?? "").trim();
    const managerIdRaw = String(formData.get("manager_responsible_id") ?? "").trim();
    const managerId = managerIdRaw.length > 0 ? managerIdRaw : null;

    const reportIds = [
      ...new Set(
        formData
          .getAll("report_responsible_ids")
          .map((value) => String(value ?? "").trim())
          .filter(Boolean)
      ),
    ];

    if (!membershipId) {
      redirect("/responsibles?error=missing-fields");
    }

    const assignmentType: AssignmentType =
      assignmentTypeRaw === "support" || assignmentTypeRaw === "stakeholder" ? assignmentTypeRaw : "owner";

    const ensured = await ensureResponsibleForMembership(actorOrganizationId, membershipId);
    if (!ensured.ok) {
      redirect(`/responsibles?error=bundle-failed&code=${encodeURIComponent(ensured.code)}`);
    }
    const focalId = ensured.responsibleId;

    if (managerId && reportIds.includes(managerId)) {
      redirect("/responsibles?error=missing-fields");
    }
    if (managerId === focalId) {
      redirect("/responsibles?error=missing-fields");
    }
    if (reportIds.includes(focalId)) {
      redirect("/responsibles?error=missing-fields");
    }

    const supabase = await createSupabaseServerClient();

    const focalRbacRank = await fetchMaxRbacRankForMembership(
      supabase,
      actorOrganizationId,
      membershipId
    );
    if (managerId) {
      const mgrRank = await fetchMaxRbacRankForResponsible(supabase, actorOrganizationId, managerId);
      if (mgrRank < focalRbacRank) {
        redirect("/responsibles?error=hierarchy-role-order");
      }
    }
    for (const rid of reportIds) {
      const repRank = await fetchMaxRbacRankForResponsible(supabase, actorOrganizationId, rid);
      if (repRank > focalRbacRank) {
        redirect("/responsibles?error=hierarchy-role-order");
      }
    }

    if (organizationUnitId) {
      const assignResult = await writeResponsibleAssignment(
        supabase,
        actorOrganizationId,
        focalId,
        organizationUnitId,
        assignmentType,
        roleLabelForType
      );
      if (!assignResult.ok) {
        redirect(`/responsibles?error=assign-failed&code=${encodeURIComponent(assignResult.code)}`);
      }

      const focalRank =
        (await fetchMaxAssignmentRankInUnit(
          supabase,
          actorOrganizationId,
          organizationUnitId,
          focalId
        )) ?? rankFromAssignmentType(assignmentType);

      if (managerId) {
        const mgrRank = await fetchMaxAssignmentRankInUnit(
          supabase,
          actorOrganizationId,
          organizationUnitId,
          managerId
        );
        if (mgrRank === null || mgrRank < focalRank) {
          redirect("/responsibles?error=hierarchy-role-order");
        }
      }
      for (const rid of reportIds) {
        const repRank = await fetchMaxAssignmentRankInUnit(
          supabase,
          actorOrganizationId,
          organizationUnitId,
          rid
        );
        if (repRank === null || repRank > focalRank) {
          redirect("/responsibles?error=hierarchy-role-order");
        }
      }
    }

    const mgrRes = await syncResponsibleManagerEdge(supabase, actorOrganizationId, focalId, managerId);
    if (!mgrRes.ok) {
      redirect(`/responsibles?error=bundle-failed&code=${encodeURIComponent(mgrRes.code)}`);
    }

    const repRes = await syncResponsibleReportEdges(supabase, actorOrganizationId, focalId, reportIds);
    if (!repRes.ok) {
      redirect(`/responsibles?error=bundle-failed&code=${encodeURIComponent(repRes.code)}`);
    }

    revalidatePath("/responsibles");
    revalidatePath("/organization");
    revalidatePath("/invitations");
    redirect("/responsibles?success=saved");
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
      .from("organization_memberships")
      .update({ responsible_id: null })
      .eq("organization_id", localContext.organizationId)
      .eq("responsible_id", responsibleId);

    await supabase
      .schema("app")
      .from("responsibles")
      .delete()
      .eq("organization_id", localContext.organizationId)
      .eq("id", responsibleId);

    revalidatePath("/responsibles");
    revalidatePath("/invitations");
    redirect("/responsibles");
  }

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Organisationsstruktur</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Verantwortliche</h1>
        <p className="mt-1 text-sm text-zinc-600">
          
          Verknüpfe Benutzer aus dem Kontingent mit Organisationseinheiten und Reporting-Linien. Stammdaten pflegst
          du unter Benutzerliste und Einladungen.
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

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <article className="brand-card p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Verantwortliche zuordnen</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Person aus dem Benutzerkontingent wählen, optional Organisationseinheit und Rolle im Bereich setzen,
              sowie Manager und direkte Reports (mehrfach) pflegen.
            </p>
            <ResponsibleSetupForm
              canWrite={canWrite}
              action={saveResponsibleSetup}
              memberships={membershipOptions}
              responsibles={responsibles}
              orgUnits={assignableOrgUnits}
              roleOptions={RESPONSIBLE_ROLE_OPTIONS}
              unitAssignments={unitAssignmentsForForm}
              rbacMaxRankByMembershipId={rbacMaxRankByMembershipId}
            />
          </article>
        </div>
        <div className="min-w-0">
          <OrganizationGraphPanel
            organizationId={context.organizationId}
            cycleInstanceId={activeCycle?.id ?? null}
          />
        </div>
      </section>
      {!canWrite ? (
        <p className="brand-surface p-3 text-sm text-zinc-600">
          Diese Rolle hat nur Leserechte für Verantwortliche.
        </p>
      ) : null}

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Verantwortlichenliste</h2>
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[760px] text-sm">
            <div className="grid grid-cols-10 gap-2 border-b border-zinc-200 pb-2 text-left text-zinc-500">
              <p className="col-span-3">Name</p>
              <p className="col-span-3">E-Mail</p>
              <p className="col-span-2">Rolle (Kontingent)</p>
              <p className="col-span-2">Aktionen</p>
            </div>
            <div>
              {responsibles.map((responsible) => (
                <div key={responsible.id} className="border-b border-zinc-100 py-2">
                  <ResponsibleRowEditForm responsible={responsible} canWrite={canWrite} deleteAction={deleteResponsible} />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {(assignmentsByResponsible.get(responsible.id) ?? []).length === 0 ? (
                      <span className="text-xs text-zinc-500">Keine Organisationszuordnung vorhanden.</span>
                    ) : (
                      (assignmentsByResponsible.get(responsible.id) ?? []).map((assignment) => (
                        <ConfirmBeforeSubmitForm
                          key={assignment.id}
                          action={removeResponsibleAssignment}
                          className="inline-flex items-center gap-2"
                          title="Zuordnung entfernen?"
                          description="Die Verknüpfung dieses Verantwortlichen mit der Organisationseinheit wird aufgehoben."
                          confirmLabel="Entfernen"
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
                        </ConfirmBeforeSubmitForm>
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
