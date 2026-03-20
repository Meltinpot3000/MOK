import type {
  ReviewDashboardData,
  ReviewObjective,
  ReviewDirection,
  ReviewProgram,
  ReviewInitiative,
} from "@/lib/review/queries";

type ReviewDashboardProps = {
  data: ReviewDashboardData;
  cycleName: string;
  canWrite: boolean;
};

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    on_track: "bg-emerald-100 text-emerald-800",
    at_risk: "bg-amber-100 text-amber-800",
    off_track: "bg-red-100 text-red-800",
  };
  const labels: Record<string, string> = {
    on_track: "On Track",
    at_risk: "At Risk",
    off_track: "Off Track",
  };
  const s = styles[status] ?? "bg-zinc-100 text-zinc-700";
  const l = labels[status] ?? status;
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${s}`}>{l}</span>;
}

function trendBadge(trend: string) {
  const icons: Record<string, string> = {
    up: "↑",
    down: "↓",
    stable: "→",
  };
  return <span className="text-xs text-zinc-500">{icons[trend] ?? trend}</span>;
}

export function ReviewDashboard({ data, cycleName, canWrite }: ReviewDashboardProps) {
  const { objectives, directions, programs, initiatives, summary } = data;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="brand-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">On Track</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">{summary.onTrack}</p>
          <p className="mt-1 text-xs text-zinc-500">Objectives, Directions, Programme, Initiativen</p>
        </article>
        <article className="brand-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">At Risk</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">{summary.atRisk}</p>
          <p className="mt-1 text-xs text-zinc-500">Benötigen Aufmerksamkeit</p>
        </article>
        <article className="brand-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Off Track</p>
          <p className="mt-2 text-2xl font-semibold text-red-700">{summary.offTrack}</p>
          <p className="mt-1 text-xs text-zinc-500">Intervention erforderlich</p>
        </article>
      </section>

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Objectives</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Health abgeleitet aus Key Results. Override für manuelle Anpassung.
        </p>
        <ul className="mt-4 space-y-3">
          {objectives.length === 0 ? (
            <li className="brand-surface p-3 text-sm text-zinc-500">Keine Objectives im Zyklus.</li>
          ) : (
            objectives.map((obj) => (
              <li key={obj.id} className="brand-surface space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-900">{obj.title}</span>
                  {statusBadge(obj.healthStatus)}
                  {trendBadge(obj.trend)}
                  {obj.isOverride ? (
                    <span className="text-xs text-zinc-500">(Override)</span>
                  ) : null}
                </div>
                <p className="text-xs text-zinc-600">
                  Score: {Math.round(obj.healthScore)}% | Key Results: {obj.keyResults.length}
                </p>
                {obj.keyResults.length > 0 ? (
                  <ul className="mt-2 space-y-1 pl-4 text-sm">
                    {obj.keyResults.map((kr) => (
                      <li key={kr.id} className="flex items-center gap-2">
                        <span className="text-zinc-700">{kr.title}</span>
                        {statusBadge(kr.reviewStatus)}
                        <span className="text-xs text-zinc-500">{Math.round(kr.progress)}%</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {obj.reviewComment ? (
                  <p className="mt-2 text-sm italic text-zinc-600">{obj.reviewComment}</p>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Strategische Stossrichtungen</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Performance aus Objective Health und Program Health.
        </p>
        <ul className="mt-4 space-y-3">
          {directions.length === 0 ? (
            <li className="brand-surface p-3 text-sm text-zinc-500">Keine Stossrichtungen.</li>
          ) : (
            directions.map((d) => (
              <li key={d.id} className="brand-surface flex flex-wrap items-center gap-2 p-3">
                <span className="font-medium text-zinc-900">{d.title}</span>
                {statusBadge(d.performanceStatus)}
                <span className="text-xs text-zinc-500">
                  {d.objectiveCount} Objectives, {d.programCount} Programme
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Programme</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Health aggregiert aus Initiativen (Execution Confidence).
        </p>
        <ul className="mt-4 space-y-3">
          {programs.length === 0 ? (
            <li className="brand-surface p-3 text-sm text-zinc-500">Keine Programme.</li>
          ) : (
            programs.map((p) => (
              <li key={p.id} className="brand-surface flex flex-wrap items-center gap-2 p-3">
                <span className="font-medium text-zinc-900">{p.title}</span>
                {statusBadge(p.healthStatus)}
                <span className="text-xs text-zinc-500">{p.initiativeCount} Initiativen</span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Initiativen</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Execution Confidence – nicht strategischer Erfolg.
        </p>
        <ul className="mt-4 space-y-3">
          {initiatives.length === 0 ? (
            <li className="brand-surface p-3 text-sm text-zinc-500">Keine Initiativen.</li>
          ) : (
            initiatives.map((i) => (
              <li key={i.id} className="brand-surface flex flex-wrap items-center gap-2 p-3">
                <span className="font-medium text-zinc-900">{i.title}</span>
                {statusBadge(i.healthStatus)}
                <span className="text-xs text-zinc-500">Status: {i.status}</span>
                {i.reviewComment ? (
                  <p className="mt-1 w-full text-sm italic text-zinc-600">{i.reviewComment}</p>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
