import { notFound, redirect } from "next/navigation";
import { KpiCards } from "@/components/ceo/KpiCards";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import {
  getAuthenticatedUserId,
  getCeoAccessContext,
  getCeoDashboardData,
} from "@/lib/ceo/queries";

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

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    redirect("/login");
  }

  const access = await getCeoAccessContext(userId);

  if (!access) {
    redirect("/no-access");
  }

  const { cycleId } = await params;
  const data = await getCeoDashboardData(access.organizationId, cycleId);

  if (!data.selectedCycle) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Zyklus-Detail</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">{data.selectedCycle.name}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {data.selectedCycle.start_date} bis {data.selectedCycle.end_date} | Status:{" "}
          {data.selectedCycle.status}
        </p>
      </header>

      <KpiCards items={data.kpis} />

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">OKR Dashboard</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <article className="brand-surface p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
              Objectives
            </h3>
            <ul className="mt-3 space-y-3">
              {data.objectives.map((objective) => (
                <li key={objective.id}>
                  <p className="font-medium text-zinc-900">{objective.title}</p>
                  <p className="text-xs text-zinc-600">
                    Status: {objective.status} | Fortschritt: {Math.round(objective.progress_percent)}%
                  </p>
                </li>
              ))}
            </ul>
            {data.objectives.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">Keine Objectives im Zyklus.</p>
            ) : null}
          </article>

          <article className="brand-surface p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
              Key Results
            </h3>
            <ul className="mt-3 space-y-3">
              {data.keyResults.map((keyResult) => (
                <li key={keyResult.id}>
                  <p className="font-medium text-zinc-900">{keyResult.title}</p>
                  <p className="text-xs text-zinc-600">Status: {keyResult.status}</p>
                </li>
              ))}
            </ul>
            {data.keyResults.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">Keine Key Results im Zyklus.</p>
            ) : null}
          </article>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Strategische Gesamtziele</h2>
          <ul className="mt-4 space-y-3">
            {data.strategicGoals.map((goal) => (
              <li key={goal.id} className="brand-surface p-3">
                <p className="font-medium text-zinc-900">{goal.title}</p>
                <p className="mt-1 text-xs text-zinc-600">
                  Status: {goal.status} {goal.priority ? `| Priorität: ${goal.priority}` : ""}
                </p>
              </li>
            ))}
          </ul>
          {data.strategicGoals.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">Keine strategischen Ziele im Zyklus.</p>
          ) : null}
        </article>

        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Abgeleitete Funktionsziele</h2>
          <ul className="mt-4 space-y-3">
            {data.functionalStrategies.map((strategy) => (
              <li key={strategy.id} className="brand-surface p-3">
                <p className="font-medium text-zinc-900">{strategy.title}</p>
                <p className="mt-1 text-xs text-zinc-600">
                  Funktion: {strategy.function_name} | Status: {strategy.status}
                </p>
              </li>
            ))}
          </ul>
          {data.functionalStrategies.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              Keine abgeleiteten Funktionsziele im Zyklus.
            </p>
          ) : null}
        </article>
      </section>
    </div>
  );
}
