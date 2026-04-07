import Link from "next/link";
import { redirect } from "next/navigation";
import { KpiCards } from "@/components/ceo/KpiCards";
import { CyclePulseOverview } from "@/components/ceo/CyclePulseOverview";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { getAuthenticatedUserId, getCeoDashboardData } from "@/lib/ceo/queries";
import { getStrategyCycleWorkspaceData } from "@/lib/strategy-cycle/queries";

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

  const access = pageAccess.access;
  const data = await getCeoDashboardData(access.organizationId);

  if (!data.selectedCycle) {
    return (
      <div className="space-y-4">
        <article className="brand-card p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Strategiezyklus</p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-600">Übersicht über den aktiven Planungszyklus</p>
        </article>
        <div className="brand-card p-6">
          <p className="text-sm font-medium text-zinc-900">Keine Planungszyklen gefunden</p>
          <p className="mt-2 text-sm text-zinc-600">
            Bitte zuerst einen Zyklus in der Mittelfristplanung anlegen.
          </p>
        </div>
      </div>
    );
  }

  const cycleMainName =
    data.selectedCycle.cycle_scheme_name?.trim() ||
    data.selectedCycle.name
      .replace(/\s*-\s*L\d+\b.*$/i, "")
      .replace(/\s*\(L\d+\).*$/i, "")
      .replace(/\s*-\s*\d{3}(?:-\d{3})+$/i, "")
      .trim();
  const strategyWorkspace = await getStrategyCycleWorkspaceData(
    access.organizationId,
    data.selectedCycle.id,
    data.selectedCycle.legacy_planning_cycle_id ?? undefined
  );
  const topChallenges = [...(strategyWorkspace.challenges ?? [])]
    .sort((a, b) => Number(b.challenge_score ?? 0) - Number(a.challenge_score ?? 0))
    .slice(0, 5);
  const topDirections = [...(strategyWorkspace.strategicDirections ?? [])]
    .sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0))
    .slice(0, 5);
  const linkedChallengeIds = new Set((strategyWorkspace.challengeDirectionLinks ?? []).map((link) => link.strategic_challenge_id));
  const uncoveredChallenges = (strategyWorkspace.challenges ?? []).filter((challenge) => !linkedChallengeIds.has(challenge.id));

  return (
    <div className="space-y-4">
      <article className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Strategiezyklus</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          {cycleMainName || data.selectedCycle.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Behalte den aktiven Zyklus im Blick und springe von hier direkt in die Detailanalyse.
        </p>
        <Link
          href={`/dashboard/cycles/${data.selectedCycle.id}`}
          className="mt-4 inline-block text-sm font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
        >
          Zur Zyklus-Detailansicht →
        </Link>
      </article>

      <div className="space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
          <div className="min-h-0 flex-1">
            <CyclePulseOverview
              cycles={data.cycles}
              nowIso={new Date().toISOString()}
              fillHeight
            />
          </div>
          <aside
            className="flex h-full min-h-0 shrink-0 flex-col xl:w-72 2xl:w-80"
            aria-label="Kennzahlen zum Zyklus"
          >
            <section className="brand-card flex h-full min-h-0 flex-col overflow-hidden p-6">
              <div
                className="shrink-0 rounded-xl p-5 text-white"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, var(--brand-accent) 0%, color-mix(in srgb, var(--brand-accent) 72%, white) 100%)",
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
                  Leitkennzahlen
                </p>
                <h2 className="mt-2 text-xl font-semibold">Zyklus im Überblick</h2>
              </div>
              <div className="mt-6 flex min-h-0 flex-1 flex-col brand-surface rounded-xl p-4">
                <KpiCards items={data.kpis} layout="aside" />
              </div>
            </section>
          </aside>
        </div>

        <section className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <article className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <div className="border-b border-zinc-100 px-3 py-2 sm:px-4 sm:py-3">
              <h2 className="text-sm font-semibold text-zinc-900">Top 5 Challenges</h2>
              <p className="text-[11px] text-zinc-500">Nach Challenge-Score sortiert</p>
            </div>
            <ul className="space-y-1.5 p-2 sm:p-3">
              {topChallenges.map((challenge) => (
                <li
                  key={challenge.id}
                  className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-2.5 py-1.5"
                >
                  <p className="text-sm font-medium text-zinc-900">{challenge.title}</p>
                  <p className="text-xs text-zinc-600">Score {Number(challenge.challenge_score ?? 0).toFixed(2)}</p>
                </li>
              ))}
            </ul>
          </article>
          <article className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <div className="border-b border-zinc-100 px-3 py-2 sm:px-4 sm:py-3">
              <h2 className="text-sm font-semibold text-zinc-900">Top 5 Directions</h2>
              <p className="text-[11px] text-zinc-500">Nach Priorität sortiert</p>
            </div>
            <ul className="space-y-1.5 p-2 sm:p-3">
              {topDirections.map((direction) => (
                <li
                  key={direction.id}
                  className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-2.5 py-1.5"
                >
                  <p className="text-sm font-medium text-zinc-900">{direction.title}</p>
                  <p className="text-xs text-zinc-600">Priorität {Number(direction.priority ?? 0).toFixed(2)}</p>
                </li>
              ))}
            </ul>
          </article>
          <article className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <div className="border-b border-zinc-100 px-3 py-2 sm:px-4 sm:py-3">
              <h2 className="text-sm font-semibold text-zinc-900">Unadressierte Challenges</h2>
              <p className="text-[11px] text-zinc-500">Ohne Stoßrichtungs-Verknüpfung</p>
            </div>
            <ul className="space-y-1.5 p-2 sm:p-3">
              {uncoveredChallenges.length === 0 ? (
                <li className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-2.5 py-1.5 text-sm text-emerald-800">
                  Alle Challenges sind adressiert.
                </li>
              ) : (
                uncoveredChallenges.slice(0, 5).map((challenge) => (
                  <li
                    key={challenge.id}
                    className="rounded-lg border border-zinc-100 bg-zinc-50/60 px-2.5 py-1.5 text-sm text-zinc-800"
                  >
                    {challenge.title}
                  </li>
                ))
              )}
            </ul>
          </article>
        </section>
      </div>
    </div>
  );
}
