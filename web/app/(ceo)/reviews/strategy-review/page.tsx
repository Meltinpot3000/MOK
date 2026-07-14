import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPhase0Context } from "@/lib/phase0/queries";
import { resolveAnnualPlanningCycle } from "@/lib/strategy-cycle/pick-strategy-planning-cycle";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import {
  fetchReviewTriggerState,
  fetchStrategyReviewFeedbackEntries,
  fetchStrategyReviewMemberOptions,
  fetchStrategyReviewParticipants,
  fetchStrategyReviewRow,
  resolveStrategyReviewChainHubs,
  fetchStrategyObjectivesForParentStrategyCycle,
  fetchStrategyReviewExecutionCoverage,
} from "@/lib/strategy-review/queries";
import { evaluateStrategyReviewProcedureStartGate } from "@/lib/strategy-review/procedure-start-gate";
import { extractPreReadChallenges } from "@/lib/strategy-review/pre-read-chain";
import { getPermissionCodesForMembership } from "@/lib/rbac/permission-codes";
import { StrategyReviewProcedureShell } from "@/components/ceo/strategy-review/StrategyReviewProcedureShell";
import { getAuthUserSidebarIdentity } from "@/lib/ceo/queries";
import { isStrategyReviewDevToolsAllowed } from "@/lib/strategy-review/dev-tools-access";
import Link from "next/link";

type PageProps = {
  searchParams: Promise<{ instance?: string; focus?: string; review?: string }>;
};

export default async function ReviewsStrategyReviewPage({ searchParams }: PageProps) {
  const reviewsAccess = await getSidebarAccessContext("reviews");
  let pageAccess = reviewsAccess;
  if (reviewsAccess.state !== "ok") {
    const okrAccess = await getSidebarAccessContext("okr-workspace");
    if (okrAccess.state === "ok") pageAccess = okrAccess;
  }

  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");

  const params = await searchParams;
  const preferredId = params.instance?.trim() || null;
  const cycle = await resolveAnnualPlanningCycle(context.organizationId, {
    preferredCycleId: preferredId,
  });
  if (!cycle) {
    return (
      <section className="space-y-4">
        <div className="brand-card p-6">
          <h1 className="text-xl font-semibold text-zinc-900">Strategie-Review</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Kein Reviewzyklus (L2) gefunden. Bitte unter Planungszyklen prüfen.
          </p>
          <Link href="/planning-cycles" className="mt-3 inline-block text-sm underline">
            Zu den Planungszyklen
          </Link>
        </div>
      </section>
    );
  }

  const supabase = await createSupabaseServerClient();
  if (pageAccess.canWrite) {
    await supabase.schema("app").rpc("ensure_strategy_review", { p_cycle_instance_id: cycle.id });
  }

  const review = await fetchStrategyReviewRow(context.organizationId, cycle.id);
  const feedbackRows = review ? await fetchStrategyReviewFeedbackEntries(review.id) : [];
  const participants = review ? await fetchStrategyReviewParticipants(review.id) : [];
  const memberOptions = await fetchStrategyReviewMemberOptions(context.organizationId);
  const chainHubs =
    review &&
    (review.procedure_status === "pre_read_open" ||
      review.procedure_status === "ready_for_review" ||
      review.procedure_status === "review_in_progress" ||
      review.procedure_status === "decision_captured" ||
      review.procedure_status === "released")
      ? await resolveStrategyReviewChainHubs(
          context.organizationId,
          cycle.id,
          review.pre_read_payload
        )
      : [];
  const strategyCycleObjectives =
    review &&
    (review.procedure_status === "pre_read_open" ||
      review.procedure_status === "ready_for_review" ||
      review.procedure_status === "review_in_progress" ||
      review.procedure_status === "decision_captured" ||
      review.procedure_status === "released")
      ? await fetchStrategyObjectivesForParentStrategyCycle(context.organizationId, cycle.id)
      : [];
  const strategyCycleChallenges =
    review &&
    (review.procedure_status === "pre_read_open" ||
      review.procedure_status === "ready_for_review" ||
      review.procedure_status === "review_in_progress" ||
      review.procedure_status === "decision_captured" ||
      review.procedure_status === "released")
      ? extractPreReadChallenges(review.pre_read_payload)
      : [];
  const executionCoverage =
    review &&
    (review.procedure_status === "pre_read_open" ||
      review.procedure_status === "ready_for_review" ||
      review.procedure_status === "review_in_progress" ||
      review.procedure_status === "decision_captured" ||
      review.procedure_status === "released")
      ? await fetchStrategyReviewExecutionCoverage(
          context.organizationId,
          cycle.id,
          review.pre_read_payload
        )
      : null;
  const trigger = await fetchReviewTriggerState(cycle.id);
  const permissionCodes = await getPermissionCodesForMembership(context.membershipId);
  const canModerate = permissionCodes.has("strategy_review.moderate");
  const canAssignLead = permissionCodes.has("strategy_review.lead_assign");
  const { email: viewerEmail } = await getAuthUserSidebarIdentity();
  const showDevTools = isStrategyReviewDevToolsAllowed(viewerEmail);
  const procedureStartGate = evaluateStrategyReviewProcedureStartGate({
    membershipId: context.membershipId,
    leadMembershipIds: participants
      .filter((p) => p.review_role === "lead")
      .map((p) => p.membership_id),
    canModerate,
    daysToEnd: trigger?.days_to_end ?? null,
    leadTimeDays: review?.review_lead_time_days ?? 90,
  });

  return (
    <section className="space-y-4">
      <article className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Reviewzyklus</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Strategie-Review</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Formelles Strategie-Review: Ankündigung, Vorab-Unterlagen, Stakeholder-Feedback, Meeting und
          Freigabe. Vorlaufzeit: {review?.review_lead_time_days ?? 90} Tage vor Periodenende.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Zyklus: {cycle.name} ({cycle.start_date} – {cycle.end_date})
          {trigger?.days_to_end != null ? ` · noch ${trigger.days_to_end} Tage` : ""}
        </p>
        <p className="mt-2 text-xs">
          <Link href="/reviews?tab=lagebild" className="underline text-zinc-700 hover:text-zinc-900">
            ← Zurück zum Lagebild
          </Link>
        </p>
      </article>
      <StrategyReviewProcedureShell
        cycleInstanceId={cycle.id}
        cycleLabel={cycle.name}
        cycleStart={cycle.start_date}
        cycleEnd={cycle.end_date}
        review={review}
        membershipId={context.membershipId}
        canWrite={pageAccess.canWrite}
        canModerate={canModerate}
        canAssignLead={canAssignLead}
        procedureStartGate={procedureStartGate}
        hidePageHeader
        showDevTools={showDevTools}
        participants={participants}
        memberOptions={memberOptions}
        chainHubs={chainHubs}
        strategyCycleObjectives={strategyCycleObjectives}
        strategyCycleChallenges={strategyCycleChallenges}
        executionCoverage={executionCoverage}
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
