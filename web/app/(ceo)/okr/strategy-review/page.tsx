import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActivePlanningCycle, getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import {
  fetchStrategyReviewFeedbackEntries,
  fetchStrategyReviewRow,
} from "@/lib/strategy-review/queries";
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
      <section className="brand-card p-6">
        <h1 className="text-xl font-semibold text-zinc-900">Strategy Review</h1>
        <p className="mt-2 text-sm text-zinc-600">Keine passende Zyklus-Instanz.</p>
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
      <StrategyReviewProcedureShell
        cycleInstanceId={cycle.id}
        cycleLabel={cycle.name}
        cycleStart={cycle.start_date}
        cycleEnd={cycle.end_date}
        review={review}
        membershipId={context.membershipId}
        canWrite={pageAccess.canWrite}
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
