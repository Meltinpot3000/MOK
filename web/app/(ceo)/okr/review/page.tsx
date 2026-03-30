import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActivePlanningCycle, getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { getOkrCycleContext } from "@/lib/okr/okr-cycle-context";
import { updatesRecordForObjectiveViews } from "@/lib/okr/serialize-updates-for-views";
import {
  listOkrReviewSessionsForCycle,
  listOkrReviewSessionTasks,
} from "@/lib/okr/review-sessions";
import { getOkrReviewSessionCheckInTracking } from "@/lib/okr/review-session-tracking";
import { getPermissionCodesForMembership } from "@/lib/rbac/permission-codes";
import { OkrCycleCarousel } from "@/components/ceo/okr/OkrCycleCarousel";
import { OkrReviewSessionWorkspace } from "@/components/ceo/okr/OkrReviewSessionWorkspace";
import { ReviewHeaderTrigger } from "@/components/ceo/strategy-review/ReviewHeaderTrigger";
import { fetchReviewTriggerState } from "@/lib/strategy-review/queries";
import type { ReviewTriggerState } from "@/lib/strategy-review/types";

type PageProps = {
  searchParams: Promise<{ okrCycle?: string; session?: string }>;
};

export default async function OkrReviewPage({ searchParams }: PageProps) {
  const pageAccess = await getSidebarAccessContext("okr-workspace");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  const cycle = await getActivePlanningCycle(context.organizationId);
  if (!cycle) {
    return (
      <section className="brand-card space-y-2 p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">OKR-Zyklus</p>
        <h1 className="text-xl font-semibold text-zinc-900">OKR-Review</h1>
        <p className="text-sm text-zinc-600">Kein aktiver Planungszyklus.</p>
      </section>
    );
  }

  const params = await searchParams;
  const okrCycleParam = params.okrCycle?.trim() || null;
  const sessionParam = params.session?.trim() || null;
  const ctx = await getOkrCycleContext(context.organizationId, cycle.id, okrCycleParam);
  const selected = ctx.workspace.okrCycles.find((c) => c.id === ctx.workspace.selectedOkrCycleId);

  const permCodes = await getPermissionCodesForMembership(context.membershipId);
  const canManageSessions = permCodes.has("okr.review.session.manage");
  const canAssignFacilitator = permCodes.has("okr.review.facilitator.assign");

  let sessions = [] as Awaited<ReturnType<typeof listOkrReviewSessionsForCycle>>;
  if (ctx.workspace.selectedOkrCycleId) {
    sessions = await listOkrReviewSessionsForCycle(
      context.organizationId,
      cycle.id,
      ctx.workspace.selectedOkrCycleId
    );
  }

  const selectedSessionId =
    sessionParam && sessions.some((s) => s.id === sessionParam) ? sessionParam : null;

  const selectedSession =
    selectedSessionId != null ? sessions.find((s) => s.id === selectedSessionId) ?? null : null;

  const updatesByKrId = updatesRecordForObjectiveViews(
    ctx.objectiveViews,
    ctx.updatesByKeyResultId
  );

  let sessionCheckInTracking: Awaited<ReturnType<typeof getOkrReviewSessionCheckInTracking>> | null =
    null;
  let sessionTasks: Awaited<ReturnType<typeof listOkrReviewSessionTasks>> = [];

  const activeOkrCycleId = ctx.workspace.selectedOkrCycleId;
  if (selectedSession && activeOkrCycleId && selectedSession.status === "scheduled") {
    /** Kein scheduled_at: das ist oft der zukünftige Meeting-Termin und schließt frühere Check-ins fälschlich aus. */
    const baselineRaw =
      selectedSession.check_in_tracking_baseline_at?.trim() ||
      selectedSession.updated_at ||
      selectedSession.created_at ||
      null;
    sessionCheckInTracking = await getOkrReviewSessionCheckInTracking({
      organizationId: context.organizationId,
      cycleInstanceId: cycle.id,
      okrCycleId: activeOkrCycleId,
      baselineAt: baselineRaw,
    });
  }

  if (
    selectedSession &&
    (selectedSession.status === "in_progress" || selectedSession.status === "completed")
  ) {
    sessionTasks = await listOkrReviewSessionTasks(selectedSession.id);
  }

  const searchParamsObj: Record<string, string> = {};
  if (okrCycleParam) searchParamsObj.okrCycle = okrCycleParam;
  const searchQuery = new URLSearchParams(searchParamsObj).toString();

  let trigger: ReviewTriggerState | null = null;
  if (pageAccess.canWrite) {
    const supabase = await createSupabaseServerClient();
    await supabase.schema("app").rpc("ensure_strategy_review", { p_cycle_instance_id: cycle.id });
    trigger = await fetchReviewTriggerState(cycle.id);
  }

  return (
    <section className="space-y-4">
      <header className="brand-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">OKR-Zyklus</p>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900">OKR-Review-Workspace</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Review-Sessions pro OKR-Zeitraum: Planung, Meeting-Artefakte und Abschluss — getrennt vom Tracking.
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              <a className="text-zinc-700 underline hover:text-zinc-900" href={`/okr/strategy-review?instance=${cycle.id}`}>
                Strategy Review Procedure (geführter Prozess)
              </a>
            </p>
          </div>
          {trigger ? <ReviewHeaderTrigger cycleInstanceId={cycle.id} trigger={trigger} /> : null}
        </div>
      </header>

      {ctx.workspace.okrCycles.length > 0 ? (
        <OkrCycleCarousel cycles={ctx.workspace.okrCycles} selectedId={ctx.workspace.selectedOkrCycleId} />
      ) : null}

      {!ctx.workspace.selectedOkrCycleId ? (
        <p className="brand-card p-6 text-sm text-zinc-600">Kein OKR-Zeitraum gewählt.</p>
      ) : (
        <OkrReviewSessionWorkspace
          cycleInstanceId={cycle.id}
          okrCycleId={ctx.workspace.selectedOkrCycleId}
          okrCycleLabel={selected?.name ?? "—"}
          searchQuery={searchQuery}
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          responsibles={ctx.workspace.responsibles}
          currentMembershipId={context.membershipId}
          canManageSessions={canManageSessions}
          canAssignFacilitator={canAssignFacilitator}
          kpis={ctx.kpis}
          objectiveViews={ctx.objectiveViews}
          updatesByKrId={updatesByKrId}
          sessionCheckInTracking={sessionCheckInTracking}
          sessionTasks={sessionTasks}
        />
      )}
    </section>
  );
}