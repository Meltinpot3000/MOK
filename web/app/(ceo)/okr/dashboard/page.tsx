import Link from "next/link";
import { redirect } from "next/navigation";
import { getActivePlanningCycle, getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { getOkrCycleContext } from "@/lib/okr/okr-cycle-context";
import { updatesRecordForObjectiveViews } from "@/lib/okr/serialize-updates-for-views";
import { OkrDashboardClient } from "@/components/ceo/okr/OkrDashboardClient";
import { OkrAreaNav } from "@/components/ceo/okr/OkrAreaNav";
import { OkrCycleCarousel } from "@/components/ceo/okr/OkrCycleCarousel";

function pageHeader() {
  return (
    <article className="brand-card p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">OKR-Zyklus</p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Übersicht</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Gesamtblick auf aktuelle, vergangene und zukünftige OKR-Zyklen
      </p>
    </article>
  );
}

type PageProps = {
  searchParams: Promise<{ okrCycle?: string }>;
};

export default async function OkrDashboardPage({ searchParams }: PageProps) {
  const pageAccess = await getSidebarAccessContext("okr-workspace");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  const cycle = await getActivePlanningCycle(context.organizationId);
  if (!cycle) {
    return (
      <section className="space-y-4">
        {pageHeader()}
        <OkrAreaNav />
        <div className="brand-card p-6">
          <p className="text-sm text-zinc-600">Kein aktiver Planungszyklus.</p>
        </div>
      </section>
    );
  }

  const params = await searchParams;
  const ctx = await getOkrCycleContext(context.organizationId, cycle.id, params.okrCycle?.trim() || null);
  const { workspace, objectiveViews, kpis } = ctx;
  const selectedCycle = workspace.okrCycles.find((c) => c.id === workspace.selectedOkrCycleId);

  const cycleStrip =
    workspace.okrCycles.length > 0 ? (
      <OkrCycleCarousel cycles={workspace.okrCycles} selectedId={workspace.selectedOkrCycleId} />
    ) : null;

  if (!workspace.selectedOkrCycleId) {
    return (
      <section className="space-y-4">
        {pageHeader()}
        <OkrAreaNav />
        {cycleStrip}
        <div className="brand-card space-y-2 p-6">
          <p className="text-sm text-zinc-600">Kein OKR-Zeitraum verfügbar oder auswählbar.</p>
          <Link href="/okr/planning" className="text-sm text-zinc-800 underline">
            Zur Planung
          </Link>
        </div>
      </section>
    );
  }

  if (objectiveViews.length === 0) {
    return (
      <section className="space-y-4">
        {pageHeader()}
        <OkrAreaNav />
        {cycleStrip}
        <div className="brand-card p-6 text-sm text-zinc-600">
          <p>Keine OKR-Objectives in diesem Zeitraum.</p>
          <p className="mt-1 text-xs text-zinc-500">
            Zeitraum: {selectedCycle?.name ?? workspace.selectedOkrCycleId}
          </p>
          <Link href="/okr/planning" className="mt-3 inline-block text-zinc-800 underline">
            In der Planung anlegen
          </Link>
        </div>
      </section>
    );
  }

  const updatesByKeyResultId = updatesRecordForObjectiveViews(objectiveViews, ctx.updatesByKeyResultId);

  return (
    <div className="space-y-4">
      {pageHeader()}
      <OkrAreaNav />
      {cycleStrip}

      <OkrDashboardClient
        kpis={kpis}
        objectiveViews={objectiveViews}
        okrCycleId={workspace.selectedOkrCycleId}
        selectedOkrCycleLabel={selectedCycle?.name ?? workspace.selectedOkrCycleId}
        updatesByKeyResultId={updatesByKeyResultId}
      />
    </div>
  );
}
