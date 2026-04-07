import { notFound, redirect } from "next/navigation";
import { KpiCards } from "@/components/ceo/KpiCards";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { getCeoDashboardData } from "@/lib/ceo/queries";

type CycleDetailPageProps = {
  params: Promise<{
    cycleId: string;
  }>;
};

export default async function CycleDetailPage({ params }: CycleDetailPageProps) {
  const pageAccess = await getSidebarAccessContext("dashboard");
  if (pageAccess.state === "unauthenticated") {
    redirect("/login");
  }
  if (pageAccess.state === "forbidden") {
    redirect("/no-access");
  }

  const access = pageAccess.access;

  const { cycleId } = await params;
  const data = await getCeoDashboardData(access.organizationId, cycleId);

  if (!data.selectedCycle) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <article className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Strategiezyklus</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">{data.selectedCycle.name}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Analysiere den ausgewählten Zyklus im Detail und verfolge Ziele, Fortschritt und Risiken.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          {data.selectedCycle.start_date} bis {data.selectedCycle.end_date} · Status: {data.selectedCycle.status}
        </p>
      </article>

      <div className="space-y-5">
        <KpiCards items={data.kpis} />

        <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-100 px-3 py-2 sm:px-4 sm:py-3">
            <h2 className="text-sm font-semibold text-zinc-900">OKR Überblick</h2>
            <p className="text-[11px] text-zinc-500">Objectives und Key Results in diesem Zyklus</p>
          </div>
          <div className="grid grid-cols-1 gap-3 p-2 sm:gap-4 sm:p-3 lg:grid-cols-2">
            <article className="rounded-lg border border-zinc-100 bg-zinc-50/40 p-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Objectives</h3>
              <ul className="mt-2 space-y-1.5">
                {data.objectives.map((objective) => (
                  <li
                    key={objective.id}
                    className="rounded-lg border border-zinc-100 bg-white px-2.5 py-1.5"
                  >
                    <p className="text-sm font-medium text-zinc-900">{objective.title}</p>
                    <p className="text-xs text-zinc-600">
                      Status: {objective.status} · Fortschritt: {Math.round(objective.progress_percent)}%
                    </p>
                  </li>
                ))}
              </ul>
              {data.objectives.length === 0 ? (
                <p className="mt-2 text-xs text-zinc-500">Keine Objectives im Zyklus.</p>
              ) : null}
            </article>

            <article className="rounded-lg border border-zinc-100 bg-zinc-50/40 p-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Key Results</h3>
              <ul className="mt-2 space-y-1.5">
                {data.keyResults.map((keyResult) => (
                  <li
                    key={keyResult.id}
                    className="rounded-lg border border-zinc-100 bg-white px-2.5 py-1.5"
                  >
                    <p className="text-sm font-medium text-zinc-900">{keyResult.title}</p>
                    <p className="text-xs text-zinc-600">Status: {keyResult.status}</p>
                  </li>
                ))}
              </ul>
              {data.keyResults.length === 0 ? (
                <p className="mt-2 text-xs text-zinc-500">Keine Key Results im Zyklus.</p>
              ) : null}
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}
