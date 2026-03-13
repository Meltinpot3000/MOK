import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgUnits, getPhase0Context, getResponsibles } from "@/lib/phase0/queries";

export default async function ResponsiblesPage() {
  const context = await getPhase0Context();
  if (!context) {
    redirect("/no-access");
  }

  const [responsibles, orgUnits] = await Promise.all([
    getResponsibles(context.organizationId),
    getOrgUnits(context.organizationId),
  ]);

  async function createResponsible(formData: FormData) {
    "use server";
    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");

    const fullName = String(formData.get("full_name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const roleTitle = String(formData.get("role_title") ?? "").trim();

    const supabase = await createSupabaseServerClient();
    await supabase.schema("app").from("responsibles").insert({
      organization_id: localContext.organizationId,
      full_name: fullName,
      email: email.length > 0 ? email.toLowerCase() : null,
      role_title: roleTitle.length > 0 ? roleTitle : null,
      membership_id: localContext.membershipId,
    });

    revalidatePath("/responsibles");
    redirect("/responsibles");
  }

  async function assignResponsible(formData: FormData) {
    "use server";
    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");

    const responsibleId = String(formData.get("responsible_id"));
    const orgUnitId = String(formData.get("org_unit_id"));
    const assignmentType = String(formData.get("assignment_type"));

    const supabase = await createSupabaseServerClient();
    await supabase.schema("app").from("responsible_assignments").insert({
      organization_id: localContext.organizationId,
      responsible_id: responsibleId,
      org_unit_id: orgUnitId,
      assignment_type: assignmentType,
    });

    revalidatePath("/responsibles");
    redirect("/responsibles");
  }

  async function createReportingLine(formData: FormData) {
    "use server";
    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");

    const managerId = String(formData.get("manager_responsible_id"));
    const reportId = String(formData.get("report_responsible_id"));

    const supabase = await createSupabaseServerClient();
    await supabase.schema("app").from("responsible_hierarchy").insert({
      organization_id: localContext.organizationId,
      manager_responsible_id: managerId,
      report_responsible_id: reportId,
    });

    revalidatePath("/responsibles");
    redirect("/responsibles");
  }

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Phase 0 Fundament</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Verantwortliche</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Verantwortliche verwalten, Bereichen zuordnen und hierarchisch strukturieren.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Verantwortliche anlegen</h2>
        <form action={createResponsible} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            name="full_name"
            required
            placeholder="Name"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            name="email"
            placeholder="E-Mail"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            name="role_title"
            placeholder="Rollenbezeichnung"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 md:col-span-3"
          >
            Verantwortliche speichern
          </button>
        </form>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <article className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
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
            <select name="org_unit_id" required className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm">
              <option value="">Bereich/Team auswählen</option>
              {orgUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} - {unit.name}
                </option>
              ))}
            </select>
            <select
              name="assignment_type"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="owner">owner</option>
              <option value="support">support</option>
              <option value="stakeholder">stakeholder</option>
            </select>
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Zuordnung speichern
            </button>
          </form>
        </article>

        <article className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
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
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Hierarchie speichern
            </button>
          </form>
        </article>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Verantwortlichenliste</h2>
        <ul className="mt-4 space-y-2">
          {responsibles.map((responsible) => (
            <li key={responsible.id} className="rounded-md border border-zinc-100 bg-zinc-50 p-3 text-sm">
              <p className="font-medium text-zinc-900">{responsible.full_name}</p>
              <p className="text-zinc-600">
                {responsible.role_title ?? "ohne Rolle"} {responsible.email ? `| ${responsible.email}` : ""}
              </p>
            </li>
          ))}
        </ul>
        {responsibles.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Noch keine Verantwortlichen vorhanden.</p>
        ) : null}
      </section>
    </div>
  );
}
