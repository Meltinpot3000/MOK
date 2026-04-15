import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getActivePlanningCycle, getPhase0Context } from "@/lib/phase0/queries";
import { getOkrWorkspaceEffectiveCanWrite, getSidebarAccessContext } from "@/lib/rbac/page-access";
import { getOkrCycleContext } from "@/lib/okr/okr-cycle-context";
import { updatesRecordForObjectiveViews } from "@/lib/okr/serialize-updates-for-views";
import { OkrAreaNav } from "@/components/ceo/okr/OkrAreaNav";
import { OkrCycleCarousel } from "@/components/ceo/okr/OkrCycleCarousel";
import { OkrTrackingView } from "@/components/ceo/okr/OkrTrackingView";
import {
  buildKeyResultUpdateFlagsForTracking,
  filterObjectiveViewsForTrackingRead,
  loadTrackingBulkContext,
} from "@/lib/okr/okr-tracking-filter";

type PageProps = {
  searchParams: Promise<{ okrCycle?: string }>;
};

export default async function OkrTrackingPage({ searchParams }: PageProps) {
  const pageAccess = await getSidebarAccessContext("okr-workspace");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");

  const canWriteOkrArea = await getOkrWorkspaceEffectiveCanWrite(pageAccess);

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  const cycle = await getActivePlanningCycle(context.organizationId);
  if (!cycle) {
    return (
      <section className="space-y-4">
        <div className="brand-card space-y-2 p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">OKR-Zyklus</p>
          <h1 className="text-xl font-semibold text-zinc-900">OKR-Tracking</h1>
          <p className="text-sm text-zinc-600">Kein aktiver Planungszyklus.</p>
        </div>
        <OkrAreaNav />
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

  const myMembershipId = context.membershipId;
  const inCycleObjectiveViews = ctx.objectiveViews;
  const trackingBulk = await loadTrackingBulkContext(myMembershipId, inCycleObjectiveViews);
  const objectiveViews = filterObjectiveViewsForTrackingRead(inCycleObjectiveViews, trackingBulk);
  const keyResultCanUpdateById = buildKeyResultUpdateFlagsForTracking(objectiveViews, trackingBulk);

  const updatesByKeyResultId = updatesRecordForObjectiveViews(objectiveViews, ctx.updatesByKeyResultId);

  return (
    <section className="space-y-4">
      <article className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">OKR-Zyklus</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">OKR-Tracking</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Tracke deine OKR-Fortschritte und füge wichtige Updates hinzu.
        </p>
        <p className="mt-2 text-xs text-zinc-500">Planungszyklus: {cycle.name}</p>
      </article>

      <OkrAreaNav />

      {!pageAccess.canWrite ? (
        <p className="brand-surface p-3 text-sm text-zinc-600">Lesemodus: keine Check-ins oder KR-Edits.</p>
      ) : null}

      <Suspense fallback={<p className="text-sm text-zinc-600">Tracking wird geladen…</p>}>
        <OkrTrackingView
          cycleInstanceId={cycle.id}
          okrCycleId={ctx.workspace.selectedOkrCycleId}
          okrCycleEndDate={okrCycleEndDate}
          canWriteArea={canWriteOkrArea}
          currentMembershipId={context.membershipId}
          inCycleObjectiveCount={inCycleObjectiveViews.length}
          objectiveViews={objectiveViews}
          updatesByKeyResultId={updatesByKeyResultId}
          keyResultCanUpdateById={keyResultCanUpdateById}
        />
      </Suspense>
    </section>
  );
}
