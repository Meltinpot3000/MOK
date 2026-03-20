import Link from "next/link";
import { redirect } from "next/navigation";
import {
  linkAnnualTargetToBusinessModel,
  linkAnnualTargetToIndustry,
  linkAnnualTargetToOperatingModel,
} from "@/app/(ceo)/strategy-dimensions/actions";
import { getActivePlanningCycle, getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import {
  getBusinessModels,
  getDimensionLinks,
  getIndustries,
  getOperatingModels,
} from "@/lib/strategy-dimensions/queries";
import { getReviewDashboardData } from "@/lib/review/queries";
import { ReviewDashboard } from "@/components/ceo/ReviewDashboard";

type ReviewsPageProps = {
  searchParams: Promise<{ tab?: string; error?: string; success?: string }>;
};

function getStatus(error?: string, success?: string) {
  if (error === "missing-link") return { type: "error", text: "Bitte gueltige Verknuepfung auswaehlen." };
  if (success === "linked") return { type: "success", text: "Dimension wurde erfolgreich verknuepft." };
  return null;
}

export default async function ReviewsPage({ searchParams }: ReviewsPageProps) {
  const pageAccess = await getSidebarAccessContext("reviews");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");
  const canWrite = pageAccess.canWrite;
  const params = await searchParams;
  const tabParam = params.tab ?? "dashboard";
  const activeTab =
    tabParam === "annual-targets"
      ? "annual-targets"
      : tabParam === "overview"
        ? "overview"
        : "dashboard";
  const status = getStatus(params.error, params.success);

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  const cycle = await getActivePlanningCycle(context.organizationId);
  if (!cycle) redirect("/planning-cycles");

  const [industries, businessModels, operatingModels, links, reviewData] = await Promise.all([
    getIndustries(context.organizationId, cycle.id),
    getBusinessModels(context.organizationId, cycle.id),
    getOperatingModels(context.organizationId, cycle.id),
    getDimensionLinks(context.organizationId, cycle.id),
    getReviewDashboardData(context.organizationId, cycle.id),
  ]);

  const industryIdsByTarget = new Map<string, string[]>();
  for (const row of links.annualTargetIndustries) {
    const current = industryIdsByTarget.get(row.annual_target_id) ?? [];
    current.push(row.industry_id);
    industryIdsByTarget.set(row.annual_target_id, current);
  }
  const businessModelIdsByTarget = new Map<string, string[]>();
  for (const row of links.annualTargetBusinessModels) {
    const current = businessModelIdsByTarget.get(row.annual_target_id) ?? [];
    current.push(row.business_model_id);
    businessModelIdsByTarget.set(row.annual_target_id, current);
  }
  const operatingModelIdsByTarget = new Map<string, string[]>();
  for (const row of links.annualTargetOperatingModels) {
    const current = operatingModelIdsByTarget.get(row.annual_target_id) ?? [];
    current.push(row.operating_model_id);
    operatingModelIdsByTarget.set(row.annual_target_id, current);
  }

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Reviewzyklus</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Reviewzyklus</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Strukturierte Reviews, Retrospektiven und Zielabgleich als Grundlage fuer den naechsten Zyklus.
        </p>
      </header>

      <div className="brand-card flex flex-wrap gap-2 p-3">
        <Link
          href="/reviews"
          className={`rounded-md px-3 py-1.5 text-sm ${
            activeTab === "dashboard" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
          }`}
        >
          Dashboard
        </Link>
        <Link
          href="/reviews?tab=overview"
          className={`rounded-md px-3 py-1.5 text-sm ${
            activeTab === "overview" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
          }`}
        >
          Uebersicht
        </Link>
        <Link
          href="/reviews?tab=annual-targets"
          className={`rounded-md px-3 py-1.5 text-sm ${
            activeTab === "annual-targets" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
          }`}
        >
          Jahresziele
        </Link>
      </div>

      {activeTab === "dashboard" ? (
        <ReviewDashboard data={reviewData} cycleName={cycle.name} canWrite={canWrite} />
      ) : activeTab === "overview" ? (
        <section className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Uebersicht</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Hier werden Retrospektiven, Lessons Learned und Verbesserungsmassnahmen fuer den laufenden Reviewzyklus gebuendelt.
          </p>
        </section>
      ) : (
        <>
          {status ? (
            <p className={`rounded-md border p-3 text-sm ${status.type === "error" ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
              {status.text}
            </p>
          ) : null}

          <section className="brand-card p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Jahresziele</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Verbinde Jahresziele direkt mit den drei CITADEL Kern-Dimensionen.
            </p>
            <div className="mt-4 space-y-3">
              {links.annualTargets.length === 0 ? (
                <p className="brand-surface p-3 text-sm text-zinc-600">
                  Noch keine Jahresziele vorhanden.
                </p>
              ) : (
                links.annualTargets.map((target) => {
                  const industryIds = new Set(industryIdsByTarget.get(target.id) ?? []);
                  const businessModelIds = new Set(businessModelIdsByTarget.get(target.id) ?? []);
                  const operatingModelIds = new Set(operatingModelIdsByTarget.get(target.id) ?? []);
                  const linkedIndustries = industries.filter((item) => industryIds.has(item.id));
                  const linkedBusinessModels = businessModels.filter((item) => businessModelIds.has(item.id));
                  const linkedOperatingModels = operatingModels.filter((item) => operatingModelIds.has(item.id));

                  return (
                    <div key={target.id} className="brand-surface space-y-2 p-3">
                      <p className="text-sm font-semibold text-zinc-900">{target.title}</p>
                      <p className="text-xs text-zinc-600">
                        Industrien: {linkedIndustries.map((x) => x.name).join(", ") || "-"}
                      </p>
                      <p className="text-xs text-zinc-600">
                        Geschaeftsmodelle: {linkedBusinessModels.map((x) => `${x.name} (v${x.version_no})`).join(", ") || "-"}
                      </p>
                      <p className="text-xs text-zinc-600">
                        Betriebsmodelle: {linkedOperatingModels.map((x) => `${x.name} (v${x.version_no})`).join(", ") || "-"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <form action={linkAnnualTargetToIndustry} className="flex gap-2">
                          <input type="hidden" name="annual_target_id" value={target.id} />
                          <select name="industry_id" defaultValue="" className="min-w-[200px] rounded-md border border-zinc-300 px-2 py-1.5 text-xs">
                            <option value="">Industrie verknuepfen</option>
                            {industries.map((industry) => (
                              <option key={industry.id} value={industry.id}>{industry.name}</option>
                            ))}
                          </select>
                          <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-2 py-1.5 text-xs">Verknuepfen</button>
                        </form>
                        <form action={linkAnnualTargetToBusinessModel} className="flex gap-2">
                          <input type="hidden" name="annual_target_id" value={target.id} />
                          <select name="business_model_id" defaultValue="" className="min-w-[220px] rounded-md border border-zinc-300 px-2 py-1.5 text-xs">
                            <option value="">Geschaeftsmodell verknuepfen</option>
                            {businessModels.map((model) => (
                              <option key={model.id} value={model.id}>{model.name} (v{model.version_no})</option>
                            ))}
                          </select>
                          <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-2 py-1.5 text-xs">Verknuepfen</button>
                        </form>
                        <form action={linkAnnualTargetToOperatingModel} className="flex gap-2">
                          <input type="hidden" name="annual_target_id" value={target.id} />
                          <select name="operating_model_id" defaultValue="" className="min-w-[220px] rounded-md border border-zinc-300 px-2 py-1.5 text-xs">
                            <option value="">Betriebsmodell verknuepfen</option>
                            {operatingModels.map((model) => (
                              <option key={model.id} value={model.id}>{model.name} (v{model.version_no})</option>
                            ))}
                          </select>
                          <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-2 py-1.5 text-xs">Verknuepfen</button>
                        </form>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
