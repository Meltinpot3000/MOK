import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getActivePlanningCycle, getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { getOkrCycleContext } from "@/lib/okr/okr-cycle-context";
import { OkrTrackingView } from "@/components/ceo/okr/OkrTrackingView";

type PageProps = {
  searchParams: Promise<{ okrCycle?: string }>;
};

export default async function OkrTrackingPage({ searchParams }: PageProps) {
  const pageAccess = await getSidebarAccessContext("okr-workspace");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  const cycle = await getActivePlanningCycle(context.organizationId);
  if (!cycle) {
    return (
      <section className="brand-card p-6">
        <h1 className="text-xl font-semibold text-zinc-900">OKR-Tracking</h1>
        <p className="mt-2 text-sm text-zinc-600">Kein aktiver Planungszyklus.</p>
      </section>
    );
  }

  const params = await searchParams;
  const ctx = await getOkrCycleContext(context.organizationId, cycle.id, params.okrCycle?.trim() || null);
  const selectedCycleId = ctx.workspace.selectedOkrCycleId;
  const okrCycleEndDate =
    selectedCycleId != null
      ? (ctx.workspace.okrCycles.find((c) => c.id === selectedCycleId)?.end_date ?? null)
      : null;

  return (
    <section className="space-y-4">
      <header className="brand-card p-6">
        <h1 className="text-2xl font-semibold text-zinc-900">OKR-Tracking</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Check-ins, Filter und Detailansicht — Zyklus {cycle.name}
        </p>
      </header>

      {!pageAccess.canWrite ? (
        <p className="brand-surface p-3 text-sm text-zinc-600">Lesemodus: keine Check-ins oder KR-Edits.</p>
      ) : null}

      <Suspense fallback={<p className="text-sm text-zinc-600">Tracking wird geladen…</p>}>
        <OkrTrackingView
          cycleInstanceId={cycle.id}
          okrCycleId={ctx.workspace.selectedOkrCycleId}
          okrCycleEndDate={okrCycleEndDate}
          canWrite={pageAccess.canWrite}
          objectiveViews={ctx.objectiveViews}
        />
      </Suspense>
    </section>
  );
}
