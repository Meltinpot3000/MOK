import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveAnnualPlanningCycle } from "@/lib/strategy-cycle/pick-strategy-planning-cycle";
import { getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { getReviewCycleData } from "@/lib/review/queries";
import { buildReviewOwnerSelectOptions } from "@/lib/review/review-owner-options";
import { ReviewInitiativeList } from "@/components/ceo/review/ReviewInitiativeList";
import { ReviewLagebildOverview } from "@/components/ceo/review/ReviewLagebildOverview";
import { ReviewExecutionNetworkSection } from "@/components/ceo/review/execution-network/ReviewExecutionNetworkSection";
import { ChangeRunNachpflegeBanner } from "@/components/ceo/review/ChangeRunNachpflegeBanner";
import { fetchChangeRunMigrationIssues } from "@/lib/change-run/migration-issues";
import { fetchReviewTriggerState, fetchStrategyReviewRow } from "@/lib/strategy-review/queries";
import type { ReviewCyclePulseModel } from "@/lib/review/review-cycle-pulse";

type ReviewsPageProps = {
  searchParams: Promise<{ tab?: string; error?: string; success?: string }>;
};

function getLinkStatus(error?: string, success?: string) {
  if (error === "missing-link") return { type: "error" as const, text: "Bitte gültige Verknüpfung auswählen." };
  if (success === "linked") return { type: "success" as const, text: "Dimension wurde erfolgreich verknüpft." };
  return null;
}

const VALID_TABS = ["lagebild", "netzwerk", "initiativen"] as const;
type ReviewTab = (typeof VALID_TABS)[number];

function parseTab(raw: string | undefined): ReviewTab {
  if (raw && (VALID_TABS as readonly string[]).includes(raw)) return raw as ReviewTab;
  if (raw === "overview" || raw === "annual-targets") return "lagebild";
  if (raw === "directions" || raw === "attention") return "netzwerk";
  if (raw === "initiatives") return "initiativen";
  return "lagebild";
}

export default async function ReviewsPage({ searchParams }: ReviewsPageProps) {
  const pageAccess = await getSidebarAccessContext("reviews");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");
  const canWrite = pageAccess.canWrite;

  const params = await searchParams;
  const activeTab = parseTab(params.tab);
  const linkStatus = getLinkStatus(params.error, params.success);

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  const cycle = await resolveAnnualPlanningCycle(context.organizationId);
  if (!cycle) redirect("/planning-cycles");

  const supabase = await createSupabaseServerClient();
  if (canWrite) {
    await supabase.schema("app").rpc("ensure_strategy_review", { p_cycle_instance_id: cycle.id });
  }

  const [cycleData, changeRunIssues, trigger, strategyReview] = await Promise.all([
    getReviewCycleData(context.organizationId, cycle.id),
    fetchChangeRunMigrationIssues(context.organizationId, cycle.id),
    fetchReviewTriggerState(cycle.id),
    fetchStrategyReviewRow(context.organizationId, cycle.id),
  ]);

  const leadTimeDays = strategyReview?.review_lead_time_days ?? 90;
  const daysToEnd = trigger?.days_to_end ?? null;
  const inLeadWindow =
    daysToEnd != null ? daysToEnd <= leadTimeDays : Boolean(trigger?.visible);

  const cyclePulse: ReviewCyclePulseModel = {
    cycleInstanceId: cycle.id,
    cycleLabel: cycle.name,
    cycleStart: cycle.start_date,
    cycleEnd: cycle.end_date,
    timeProgressPercent: cycleData.timeProgressPercent,
    contentProgressPercent: cycleData.lagebild.weightedContentProgress,
    deltaPp: cycleData.deltaPp,
    leadTimeDays,
    daysToEnd,
    inLeadWindow,
    procedureStatus: strategyReview?.procedure_status ?? trigger?.procedure_status ?? null,
    readinessStatus: strategyReview?.readiness_status ?? trigger?.readiness_status ?? null,
    reviewId: strategyReview?.id ?? trigger?.review_id ?? null,
    trigger,
  };

  const directionNameById = Object.fromEntries(
    cycleData.directions.map((d) => [d.id, d.title])
  );
  const reviewOwnerSelectOptions = buildReviewOwnerSelectOptions(
    cycleData.ownerOptions,
    cycleData.initiativeRows
  );

  const tabClass = (tab: ReviewTab) =>
    `rounded-md px-3 py-1.5 text-sm ${
      activeTab === tab ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
    }`;

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Reviewzyklus</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Reviewzyklus</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Hier prüfen Sie zyklisch, ob die Unternehmensstrategie greift: Fortschritt der Umsetzung,
          Abweichungen vom Plan und wo Steuerung oder Nachjustierung nötig ist.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Zyklus: {cycle.name} ({cycle.start_date} – {cycle.end_date})
        </p>
      </header>

      {linkStatus ? (
        <p
          className={`rounded-md border p-3 text-sm ${
            linkStatus.type === "error"
              ? "border-red-300 bg-red-50 text-red-800"
              : "border-emerald-300 bg-emerald-50 text-emerald-800"
          }`}
        >
          {linkStatus.text}
        </p>
      ) : null}

      <ChangeRunNachpflegeBanner issues={changeRunIssues} />

      <div className="brand-card flex flex-wrap gap-2 p-3">
        <Link href="/reviews?tab=lagebild" className={tabClass("lagebild")}>
          Lagebild
        </Link>
        <Link href="/reviews?tab=netzwerk" className={tabClass("netzwerk")}>
          Umsetzungsnetzwerk
        </Link>
        <Link href="/reviews?tab=initiativen" className={tabClass("initiativen")}>
          Initiativen
        </Link>
      </div>

      {!canWrite ? (
        <p className="brand-surface p-3 text-sm text-zinc-600">
          Leserechte: Bearbeitungsfunktionen sind deaktiviert.
        </p>
      ) : null}

      {activeTab === "lagebild" ? (
        <ReviewLagebildOverview
          lagebild={cycleData.lagebild}
          managementInterpretation={cycleData.managementInterpretation}
          attentionItems={cycleData.attentionItems}
          drillTables={cycleData.lagebildDrillTables}
          counts={{
            directions: cycleData.directions.filter((d) => d.status === "active").length,
            programs: cycleData.programs.length,
            initiatives: cycleData.initiativeRows.length,
            annualTargets: cycleData.annualTargets.length,
          }}
          cyclePulse={cyclePulse}
        />
      ) : null}

      {activeTab === "netzwerk" ? (
        <ReviewExecutionNetworkSection
          cycleData={cycleData}
          ownerSelectOptions={reviewOwnerSelectOptions}
          canWrite={canWrite}
        />
      ) : null}

      {activeTab === "initiativen" ? (
        <ReviewInitiativeList
          initiativeRows={cycleData.initiativeRows}
          directionNameById={directionNameById}
          attentionItems={cycleData.attentionItems}
          programs={cycleData.programs}
          annualTargetsByDirectionId={cycleData.annualTargetsByDirectionId}
          ownerSelectOptions={reviewOwnerSelectOptions}
          cycleData={cycleData}
          cycleInstanceId={cycleData.cycleInstanceId}
          canWrite={canWrite}
        />
      ) : null}
    </div>
  );
}
