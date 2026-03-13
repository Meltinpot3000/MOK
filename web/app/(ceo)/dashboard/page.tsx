import Link from "next/link";
import { redirect } from "next/navigation";
import { KpiCards } from "@/components/ceo/KpiCards";
import {
  getAuthenticatedUserId,
  getCeoAccessContext,
  getCeoDashboardData,
} from "@/lib/ceo/queries";

export default async function CeoDashboardPage() {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    redirect("/login");
  }

  const access = await getCeoAccessContext(userId);

  if (!access) {
    redirect("/no-access");
  }

  const data = await getCeoDashboardData(access.organizationId);

  if (!data.selectedCycle) {
    return (
      <section className="rounded-xl border border-dashed border-zinc-300 bg-white p-8">
        <h2 className="text-xl font-semibold text-zinc-900">Keine Planungszyklen gefunden</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Bitte zuerst einen Zyklus in der Mittelfristplanung anlegen.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          CEO Dashboard
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          {data.selectedCycle.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Zykluscode: {data.selectedCycle.code} | Status: {data.selectedCycle.status}
        </p>
        <Link
          href={`/dashboard/cycles/${data.selectedCycle.id}`}
          className="mt-4 inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Zum Zyklus-Drilldown
        </Link>
      </header>

      <KpiCards items={data.kpis} />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <article className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Strategische Gesamtziele</h2>
          <ul className="mt-4 space-y-3">
            {data.strategicGoals.map((goal) => (
              <li key={goal.id} className="rounded-md border border-zinc-100 bg-zinc-50 p-3">
                <p className="font-medium text-zinc-900">{goal.title}</p>
                <p className="mt-1 text-xs text-zinc-600">
                  Status: {goal.status} {goal.priority ? `| Priorität: ${goal.priority}` : ""}
                </p>
              </li>
            ))}
          </ul>
          {data.strategicGoals.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">Keine strategischen Ziele im gewählten Zyklus.</p>
          ) : null}
        </article>

        <article className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Abgeleitete Funktionsziele</h2>
          <ul className="mt-4 space-y-3">
            {data.functionalStrategies.map((strategy) => (
              <li key={strategy.id} className="rounded-md border border-zinc-100 bg-zinc-50 p-3">
                <p className="font-medium text-zinc-900">{strategy.title}</p>
                <p className="mt-1 text-xs text-zinc-600">
                  Funktion: {strategy.function_name} | Status: {strategy.status}
                </p>
              </li>
            ))}
          </ul>
          {data.functionalStrategies.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              Keine abgeleiteten Funktionsziele im gewählten Zyklus.
            </p>
          ) : null}
        </article>
      </section>
    </div>
  );
}
