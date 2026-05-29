import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActivePlanningCycle, getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import {
  fetchStrategyReviewFeedbackEntries,
  fetchStrategyReviewRow,
} from "@/lib/strategy-review/queries";
import { OkrAreaNavWithCounts } from "@/components/ceo/okr/OkrAreaNavWithCounts";
import { StrategyReviewProcedureShell } from "@/components/ceo/strategy-review/StrategyReviewProcedureShell";

type PageProps = {
  searchParams: Promise<{ instance?: string; focus?: string }>;
};

export default async function StrategyReviewProcedurePage({ searchParams }: PageProps) {
  const pageAccess = await getSidebarAccessContext("okr-workspace");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");

  const params = await searchParams;
  const preferredId = params.instance?.trim() || null;
  const cycle = await getActivePlanningCycle(context.organizationId, preferredId);
  if (!cycle) {
    return (
      <section className="space-y-4">
        <div className="brand-card p-6">
          <h1 className="text-xl font-semibold text-zinc-900">Strategy Review</h1>
          <p className="mt-2 text-sm text-zinc-600">Keine passende Zyklus-Instanz.</p>
        </div>
        <OkrAreaNavWithCounts />
      </section>
    );
  }

  const supabase = await createSupabaseServerClient();
  if (pageAccess.canWrite) {
    await supabase.schema("app").rpc("ensure_strategy_review", { p_cycle_instance_id: cycle.id });
  }

  const review = await fetchStrategyReviewRow(context.organizationId, cycle.id);
  const feedbackRows = review ? await fetchStrategyReviewFeedbackEntries(review.id) : [];

  return (
    <section className="space-y-4">
      <article className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">OKR-Zyklus</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Strategy Review</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Geführter Ablauf mit Ankündigung, Pre-Read, Meeting und Release.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Planungszyklus: {cycle.name} ({cycle.start_date} – {cycle.end_date})
        </p>
      </article>
      <OkrAreaNavWithCounts />
      <StrategyReviewProcedureShell
        cycleInstanceId={cycle.id}
        cycleLabel={cycle.name}
        cycleStart={cycle.start_date}
        cycleEnd={cycle.end_date}
        review={review}
        membershipId={context.membershipId}
        canWrite={pageAccess.canWrite}
        hidePageHeader
        feedbackRows={
          feedbackRows as Array<{
            id: string;
            subject_type: string;
            subject_id: string;
            actor_id: string;
            rating: string | null;
            comment: string | null;
            created_at: string;
          }>
        }
      />
    </section>
  );
}
