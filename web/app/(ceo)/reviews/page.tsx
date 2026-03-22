import Link from "next/link";
import { redirect } from "next/navigation";
import { getActivePlanningCycle, getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { getReviewCycleData, getReviewDashboardData } from "@/lib/review/queries";
import { ReviewDashboard } from "@/components/ceo/ReviewDashboard";
import { ReviewAttentionRequired } from "@/components/ceo/review/ReviewAttentionRequired";
import { ReviewCycleOverview } from "@/components/ceo/review/ReviewCycleOverview";
import { ReviewInitiativeList } from "@/components/ceo/review/ReviewInitiativeList";
import { ReviewStrategicDirectionList } from "@/components/ceo/review/ReviewStrategicDirectionList";

type ReviewsPageProps = {
  searchParams: Promise<{ tab?: string; error?: string; success?: string }>;
};

function getLinkStatus(error?: string, success?: string) {
  if (error === "missing-link") return { type: "error" as const, text: "Bitte gueltige Verknuepfung auswaehlen." };
  if (success === "linked") return { type: "success" as const, text: "Dimension wurde erfolgreich verknuepft." };
  return null;
}

const VALID_TABS = ["overview", "directions", "attention", "initiatives", "dashboard"] as const;
type ReviewTab = (typeof VALID_TABS)[number];

function parseTab(raw: string | undefined): ReviewTab {
  if (raw && (VALID_TABS as readonly string[]).includes(raw)) return raw as ReviewTab;
  if (raw === "annual-targets") return "overview";
  return "overview";
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
  const cycle = await getActivePlanningCycle(context.organizationId);
  if (!cycle) redirect("/planning-cycles");

  const [cycleData, dashboardData] = await Promise.all([
    getReviewCycleData(context.organizationId, cycle.id),
    activeTab === "dashboard"
      ? getReviewDashboardData(context.organizationId, cycle.id)
      : Promise.resolve(null),
  ]);

  const directionNameById = Object.fromEntries(
    cycleData.directions.map((d) => [d.id, d.title])
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
          Fuehrungsnahe Lage: Stossrichtungen, Handlungsbedarf und Initiativen — mit gewichtetem Fortschritt aus der
          Umsetzung.
        </p>
        <p className="mt-1 text-xs text-zinc-500">Zyklus: {cycle.name}</p>
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

      <div className="brand-card flex flex-wrap gap-2 p-3">
        <Link href="/reviews?tab=overview" className={tabClass("overview")}>
          Uebersicht
        </Link>
        <Link href="/reviews?tab=directions" className={tabClass("directions")}>
          Stossrichtungen
        </Link>
        <Link href="/reviews?tab=attention" className={tabClass("attention")}>
          Handlungsbedarf
        </Link>
        <Link href="/reviews?tab=initiatives" className={tabClass("initiatives")}>
          Initiativen
        </Link>
        <Link href="/reviews?tab=dashboard" className={tabClass("dashboard")}>
          OKR-Uebersicht (Legacy)
        </Link>
      </div>

      {!canWrite ? (
        <p className="brand-surface p-3 text-sm text-zinc-600">
          Leserechte: Bearbeitungsfunktionen sind deaktiviert.
        </p>
      ) : null}

      {activeTab === "overview" ? (
        <ReviewCycleOverview
          kpis={cycleData.kpis}
          directionSummaries={cycleData.directionSummaries}
          initiativeRows={cycleData.initiativeRows}
          attentionPreview={cycleData.attentionItems}
        />
      ) : null}

      {activeTab === "directions" ? (
        <ReviewStrategicDirectionList
          summaries={cycleData.directionSummaries}
          initiativeRows={cycleData.initiativeRows}
          annualTargetsByDirectionId={cycleData.annualTargetsByDirectionId}
          attentionItems={cycleData.attentionItems}
          canWrite={canWrite}
        />
      ) : null}

      {activeTab === "attention" ? (
        <ReviewAttentionRequired items={cycleData.attentionItems} />
      ) : null}

      {activeTab === "initiatives" ? (
        <ReviewInitiativeList
          initiativeRows={cycleData.initiativeRows}
          directionNameById={directionNameById}
          canWrite={canWrite}
        />
      ) : null}

      {activeTab === "dashboard" && dashboardData ? (
        <ReviewDashboard data={dashboardData} cycleName={cycle.name} canWrite={canWrite} />
      ) : null}
    </div>
  );
}
