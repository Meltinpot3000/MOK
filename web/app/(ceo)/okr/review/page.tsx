import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActivePlanningCycle, getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { getOkrCycleContext } from "@/lib/okr/okr-cycle-context";
import { OkrCycleCarousel } from "@/components/ceo/okr/OkrCycleCarousel";
import { OkrReviewWorkspace } from "@/components/ceo/okr/OkrReviewWorkspace";
import { ReviewHeaderTrigger } from "@/components/ceo/strategy-review/ReviewHeaderTrigger";
import { fetchReviewTriggerState } from "@/lib/strategy-review/queries";
import type { ReviewTriggerState } from "@/lib/strategy-review/types";

type PageProps = {
  searchParams: Promise<{ okrCycle?: string }>;
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
  const ctx = await getOkrCycleContext(context.organizationId, cycle.id, params.okrCycle?.trim() || null);
  const selected = ctx.workspace.okrCycles.find((c) => c.id === ctx.workspace.selectedOkrCycleId);

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
            <h1 className="mt-2 text-2xl font-semibold text-zinc-900">OKR-Review</h1>
            <p className="mt-1 text-sm text-zinc-600">
              Ein Eintrag pro OKR-Zeitraum (quarterly_review). Zeitraum wählst du direkt unter diesem Header.
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

      <OkrReviewWorkspace
        cycleInstanceId={cycle.id}
        okrCycleId={ctx.workspace.selectedOkrCycleId}
        okrCycleLabel={selected?.name ?? "—"}
        canWrite={pageAccess.canWrite}
        objectives={ctx.workspace.okrObjectives}
        initial={
          ctx.okrReview
            ? {
                summary: ctx.okrReview.summary,
                successes: ctx.okrReview.successes,
                problems: ctx.okrReview.problems,
                lessons_learned: ctx.okrReview.lessons_learned,
                next_actions: ctx.okrReview.next_actions,
              }
            : null
        }
      />
    </section>
  );
}
