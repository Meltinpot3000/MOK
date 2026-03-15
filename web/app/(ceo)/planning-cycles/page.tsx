import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPhase0Context, getPlanningCycles } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";

export default async function PlanningCyclesPage() {
  const pageAccess = await getSidebarAccessContext("planning-cycles");
  if (pageAccess.state === "unauthenticated") {
    redirect("/login");
  }
  if (pageAccess.state === "forbidden") {
    redirect("/no-access");
  }

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  const canWrite = pageAccess.canWrite;
  const cycles = await getPlanningCycles(context.organizationId);

  async function createCycle(formData: FormData) {
    "use server";
    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("planning-cycles");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");

    const supabase = await createSupabaseServerClient();
    await supabase.schema("app").from("planning_cycles").insert({
      organization_id: localContext.organizationId,
      code: String(formData.get("code") ?? "").trim(),
      name: String(formData.get("name") ?? "").trim(),
      start_date: String(formData.get("start_date")),
      end_date: String(formData.get("end_date")),
      status: "draft",
      rolling_window_months: Number(formData.get("rolling_window_months") ?? 18),
      created_by_membership_id: localContext.membershipId,
    });

    revalidatePath("/planning-cycles");
    redirect("/planning-cycles");
  }

  async function cloneCycle(formData: FormData) {
    "use server";
    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("planning-cycles");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");

    const supabase = await createSupabaseServerClient();
    await supabase.rpc("clone_planning_cycle_full_snapshot", {
      p_organization_id: localContext.organizationId,
      p_source_cycle_id: String(formData.get("source_cycle_id")),
      p_new_code: String(formData.get("new_code") ?? "").trim(),
      p_new_name: String(formData.get("new_name") ?? "").trim(),
      p_start_date: String(formData.get("new_start_date")),
      p_end_date: String(formData.get("new_end_date")),
      p_actor_membership_id: localContext.membershipId,
    });

    revalidatePath("/planning-cycles");
    revalidatePath("/dashboard");
    redirect("/planning-cycles");
  }

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Phase 0 Fundament</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Strategiezyklus-Management</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Neue Planungszyklen erstellen oder bestehende Zyklen als Full Snapshot in neue Zyklen überführen.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Neuen Zyklus anlegen</h2>
          <form action={createCycle} className="mt-4 space-y-3">
            <input
              name="code"
              required
              placeholder="Code (z. B. CY2027)"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              name="name"
              required
              placeholder="Name (z. B. Planning Cycle 2027)"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                name="start_date"
                required
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <input
                type="date"
                name="end_date"
                required
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <input
              type="number"
              name="rolling_window_months"
              defaultValue={18}
              min={3}
              max={60}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={!canWrite}
              className="brand-btn px-4 py-2 text-sm"
            >
              Zyklus erstellen
            </button>
          </form>
        </article>

        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Bestehenden Zyklus überführen</h2>
          <form action={cloneCycle} className="mt-4 space-y-3">
            <select
              name="source_cycle_id"
              required
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Quellzyklus auswählen</option>
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.code} - {cycle.name}
                </option>
              ))}
            </select>
            <input
              name="new_code"
              required
              placeholder="Neuer Zykluscode"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              name="new_name"
              required
              placeholder="Neuer Zyklusname"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                name="new_start_date"
                required
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <input
                type="date"
                name="new_end_date"
                required
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={!canWrite}
              className="brand-btn px-4 py-2 text-sm"
            >
              Full Snapshot Clone ausführen
            </button>
          </form>
        </article>
      </section>
      {!canWrite ? (
        <p className="brand-surface p-3 text-sm text-zinc-600">
          Diese Rolle hat nur Leserechte für Planungszyklen.
        </p>
      ) : null}

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Planungszyklen</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500">
                <th className="py-2">Code</th>
                <th className="py-2">Name</th>
                <th className="py-2">Zeitraum</th>
                <th className="py-2">Status</th>
                <th className="py-2">Herkunft</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((cycle) => (
                <tr key={cycle.id} className="border-b border-zinc-100">
                  <td className="py-2">{cycle.code}</td>
                  <td className="py-2">{cycle.name}</td>
                  <td className="py-2">
                    {cycle.start_date} bis {cycle.end_date}
                  </td>
                  <td className="py-2">{cycle.status}</td>
                  <td className="py-2">
                    {cycle.source_cycle_id ? `Clone (${cycle.clone_type ?? "snapshot"})` : "Neu"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
