import { redirect } from "next/navigation";
import { getActivePlanningCycle, getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { getOkrCycleContext } from "@/lib/okr/okr-cycle-context";
import { OkrReviewWorkspace } from "@/components/ceo/okr/OkrReviewWorkspace";

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
      <section className="brand-card p-6">
        <h1 className="text-xl font-semibold text-zinc-900">OKR-Review</h1>
        <p className="mt-2 text-sm text-zinc-600">Kein aktiver Planungszyklus.</p>
      </section>
    );
  }

  const params = await searchParams;
  const ctx = await getOkrCycleContext(context.organizationId, cycle.id, params.okrCycle?.trim() || null);
  const selected = ctx.workspace.okrCycles.find((c) => c.id === ctx.workspace.selectedOkrCycleId);

  return (
    <section className="space-y-4">
      <header className="brand-card p-6">
        <h1 className="text-2xl font-semibold text-zinc-900">OKR-Review</h1>
        <p className="mt-1 text-sm text-zinc-600">Ein Eintrag pro Zeitraum (quarterly_review) — Zyklus {cycle.name}</p>
      </header>

      <OkrReviewWorkspace
        cycleInstanceId={cycle.id}
        okrCycleId={ctx.workspace.selectedOkrCycleId}
        okrCycleLabel={selected ? `${selected.name} (${selected.start_date} – ${selected.end_date})` : "—"}
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
