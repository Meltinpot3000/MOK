import Link from "next/link";
import { redirect } from "next/navigation";
import { getActivePlanningCycle, getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { getOkrCycleContext } from "@/lib/okr/okr-cycle-context";
import { OkrKpiBar } from "@/components/ceo/okr/OkrKpiBar";
import { OkrKeyResultsTable } from "@/components/ceo/okr/OkrKeyResultsTable";
import { OkrProgressBar } from "@/components/ceo/okr/OkrProgressBar";
import { OkrStatusBadge } from "@/components/ceo/okr/OkrStatusBadge";
import { OkrWarningBadge } from "@/components/ceo/okr/OkrWarningBadge";

type PageProps = {
  searchParams: Promise<{ okrCycle?: string }>;
};

function formatDeDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

export default async function OkrDashboardPage({ searchParams }: PageProps) {
  const pageAccess = await getSidebarAccessContext("okr-workspace");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  const cycle = await getActivePlanningCycle(context.organizationId);
  if (!cycle) {
    return (
      <section className="brand-card p-6">
        <h1 className="text-xl font-semibold text-zinc-900">OKR-Dashboard</h1>
        <p className="mt-2 text-sm text-zinc-600">Kein aktiver Planungszyklus.</p>
      </section>
    );
  }

  const params = await searchParams;
  const ctx = await getOkrCycleContext(context.organizationId, cycle.id, params.okrCycle?.trim() || null);
  const { workspace, objectiveViews, kpis } = ctx;
  const selectedCycle = workspace.okrCycles.find((c) => c.id === workspace.selectedOkrCycleId);

  if (!workspace.selectedOkrCycleId) {
    return (
      <section className="brand-card space-y-2 p-6">
        <h1 className="text-xl font-semibold text-zinc-900">OKR-Dashboard</h1>
        <p className="text-sm text-zinc-600">Kein OKR-Zeitraum verfügbar oder auswählbar.</p>
        <Link href="/okr/planning" className="text-sm text-zinc-800 underline">
          zur Planung
        </Link>
      </section>
    );
  }

  if (objectiveViews.length === 0) {
    return (
      <section className="space-y-4">
        <header className="brand-card p-6">
          <h1 className="text-2xl font-semibold text-zinc-900">OKR-Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Zeitraum: {selectedCycle?.name ?? workspace.selectedOkrCycleId} · Zyklus {cycle.name}
          </p>
        </header>
        <div className="brand-card p-6 text-sm text-zinc-600">
          <p>Keine OKR-Objectives in diesem Zeitraum.</p>
          <Link href="/okr/planning" className="mt-2 inline-block text-zinc-800 underline">
            In der Planung anlegen
          </Link>
        </div>
      </section>
    );
  }

  const alignmentRows = objectiveViews.filter((ov) => ov.warnings.length > 0);

  return (
    <div className="space-y-4">
      <header className="brand-card p-6">
        <h1 className="text-2xl font-semibold text-zinc-900">OKR-Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Zeitraum: {selectedCycle?.name ?? ""} · Strategiezyklus: {cycle.name}
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          OKR-Objective-Fortschritt = MVP-Durchschnitt der KR-Progress (keine finale Governance-Logik).
        </p>
      </header>

      <OkrKpiBar kpis={kpis} />

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {objectiveViews.map((ov) => (
          <Link
            key={ov.objective.id}
            href={`/okr/tracking?objective=${ov.objective.id}`}
            className="brand-card block p-4 transition-shadow hover:shadow-md"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-900">{ov.objective.title}</h2>
              <OkrStatusBadge status={ov.rollupStatus} />
            </div>
            <p className="mt-1 text-xs text-zinc-600">
              Owner: {ov.objective.ownerDisplayName ?? "—"} · {ov.objective.keyResults.length} KR · Letzte Aktivität:{" "}
              {formatDeDate(ov.lastActivityAt)}
            </p>
            <div className="mt-2">
              <OkrProgressBar value={ov.rollupProgressPercent} />
            </div>
            {ov.warnings.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {ov.warnings.map((w) => (
                  <OkrWarningBadge key={w} kind={w} />
                ))}
              </div>
            ) : null}
          </Link>
        ))}
      </section>

      <section className="brand-card overflow-x-auto p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Key Results</h2>
        <OkrKeyResultsTable objectiveViews={objectiveViews} />
      </section>

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Alignment / Warnungen</h2>
        {alignmentRows.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">Keine zentralen Warnungen für OKR-Objectives.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {alignmentRows.map((ov) => (
              <li key={ov.objective.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
                <span className="font-medium text-zinc-900">{ov.objective.title}</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {ov.warnings.map((w) => (
                    <OkrWarningBadge key={w} kind={w} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        {kpis.initiativesWithoutKr > 0 ? (
          <p className="mt-4 text-sm text-amber-800">
            {kpis.initiativesWithoutKr} Initiative(n) ohne Key-Result-Verknüpfung (siehe Planung).
          </p>
        ) : null}
      </section>
    </div>
  );
}
