import Link from "next/link";
import { redirect } from "next/navigation";
import { KpiCards } from "@/components/ceo/KpiCards";
import { CyclePulseOverview } from "@/components/ceo/CyclePulseOverview";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import {
  getAuthenticatedUserId,
  getCeoAccessContext,
  getCeoDashboardData,
} from "@/lib/ceo/queries";

export default async function CeoDashboardPage() {
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

  const cycleMainName =
    data.selectedCycle.cycle_scheme_name?.trim() ||
    data.selectedCycle.name
      .replace(/\s*-\s*L\d+\b.*$/i, "")
      .replace(/\s*\(L\d+\).*$/i, "")
      .replace(/\s*-\s*\d{3}(?:-\d{3})+$/i, "")
      .trim();

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Dashboard
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          {cycleMainName || data.selectedCycle.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Behalte den aktiven Zyklus im Blick und springe von hier direkt in die Detailanalyse.
        </p>
        <Link
          href={`/dashboard/cycles/${data.selectedCycle.id}`}
          className="brand-btn mt-4 inline-flex px-4 py-2 text-sm"
        >
          Zur Zyklus-Detailansicht
        </Link>
      </header>

      <CyclePulseOverview cycles={data.cycles} nowIso={new Date().toISOString()} />

      <KpiCards items={data.kpis} />

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
            <p className="mt-4 text-sm text-zinc-500">Keine strategischen Ziele im gewählten Zyklus.</p>
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
            <p className="mt-4 text-sm text-zinc-500">
              Keine abgeleiteten Funktionsziele im gewählten Zyklus.
            </p>
          ) : null}
        </article>
      </section>
    </div>
  );
}
