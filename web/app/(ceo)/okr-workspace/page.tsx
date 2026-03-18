import { redirect } from "next/navigation";
import { getActivePlanningCycle, getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { getStrategyCycleWorkspaceData } from "@/lib/strategy-cycle/queries";

export default async function OkrWorkspacePage() {
  const pageAccess = await getSidebarAccessContext("okr-workspace");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  const cycle = await getActivePlanningCycle(context.organizationId);
  if (!cycle) {
    return (
      <section className="brand-card p-6">
        <h1 className="text-xl font-semibold text-zinc-900">OKR Arbeitsbereich</h1>
        <p className="mt-2 text-sm text-zinc-600">Kein aktiver Zyklus vorhanden.</p>
      </section>
    );
  }
  const workspace = await getStrategyCycleWorkspaceData(context.organizationId, cycle.id);

  return (
    <section className="space-y-4">
      <article className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Execution View</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">OKR Arbeitsbereich</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Programme, Initiativen und OKR-Verknuepfungen im aktiven Zyklus.
        </p>
      </article>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Programme</h2>
          <div className="mt-3 space-y-2">
            {(workspace.programs ?? []).length === 0 ? (
              <p className="text-sm text-zinc-600">Keine Programme im aktiven Zyklus.</p>
            ) : (
              (workspace.programs ?? []).map((program) => (
                <div key={program.id} className="brand-surface p-3">
                  <p className="text-sm font-semibold text-zinc-900">{program.title}</p>
                  {program.description ? <p className="mt-1 text-xs text-zinc-600">{program.description}</p> : null}
                </div>
              ))
            )}
          </div>
        </article>
        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Initiativen</h2>
          <div className="mt-3 space-y-2">
            {(workspace.initiatives ?? []).length === 0 ? (
              <p className="text-sm text-zinc-600">Keine Initiativen im aktiven Zyklus.</p>
            ) : (
              (workspace.initiatives ?? []).map((initiative) => (
                <div key={initiative.id} className="brand-surface p-3">
                  <p className="text-sm font-semibold text-zinc-900">{initiative.title}</p>
                  <p className="mt-1 text-xs text-zinc-600">Status: {initiative.status}</p>
                  {Array.isArray(initiative.linked_okrs) && initiative.linked_okrs.length > 0 ? (
                    <p className="mt-1 text-xs text-zinc-600">OKRs: {initiative.linked_okrs.join(", ")}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
