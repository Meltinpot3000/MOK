import Link from "next/link";
import type { ReviewAttentionItem } from "@/lib/review/review-attention-rules";
import type { ReviewCycleKpis } from "@/lib/review/review-cycle-view-model";
import type { StrategicDirectionReviewSummary } from "@/lib/review/review-cycle-view-model";
import { isActiveExecutionInitiativeStatus } from "@/lib/review/initiative-review-fields";
import type { ReviewCycleInitiativeInput } from "@/lib/review/review-cycle-view-model";
import { ReviewAttentionRequired } from "./ReviewAttentionRequired";
import {
  formatDateDe,
  healthBadgeClass,
  healthLabelDe,
  initiativeStatusLabelDe,
} from "./review-ui";

type ReviewCycleOverviewProps = {
  kpis: ReviewCycleKpis;
  directionSummaries: StrategicDirectionReviewSummary[];
  initiativeRows: ReviewCycleInitiativeInput[];
  attentionPreview: ReviewAttentionItem[];
};

export function ReviewCycleOverview({
  kpis,
  directionSummaries,
  initiativeRows,
  attentionPreview,
}: ReviewCycleOverviewProps) {
  const activeExec = initiativeRows.filter((i) => isActiveExecutionInitiativeStatus(i.status));
  const snapshotDirections = [...directionSummaries]
    .sort((a, b) => Number(a.priority) - Number(b.priority))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Management-Uebersicht</h2>
        <p className="mt-1 text-sm text-zinc-600">
          
          KPIs und Kurzprofile — Details in den Reitern Stoßrichtungen, Handlungsbedarf und Initiativen.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="brand-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Aktive Stoßrichtungen</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">{kpis.activeDirectionsCount}</p>
          <p className="mt-1 text-xs text-zinc-500">status „aktiv“ im Zyklus</p>
        </article>
        <article className="brand-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Auf Kurs (Richtungen)</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">{kpis.directionsOnTrackCount}</p>
          <p className="mt-1 text-xs text-zinc-500">Lagebild nur aus Initiativen</p>
        </article>
        <article className="brand-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Kritische Umsetzung</p>
          <p className="mt-2 text-2xl font-semibold text-amber-800">{kpis.criticalExecutionCount}</p>
          <p className="mt-1 text-xs text-zinc-500">aktive Initiativen auffällig/kritisch</p>
        </article>
        <article className="brand-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Überfällige Termine</p>
          <p className="mt-2 text-2xl font-semibold text-red-800">{kpis.overdueDeadlinesCount}</p>
          <p className="mt-1 text-xs text-zinc-500">Initiativen + Key Results (Fälligkeit)</p>
        </article>
      </section>

      <section className="brand-card p-6">
        <h3 className="text-base font-semibold text-zinc-900">Stoßrichtungen — Snapshot</h3>
        <div className="mt-4 space-y-2">
          {snapshotDirections.length === 0 ? (
            <p className="text-sm text-zinc-600">Keine Daten.</p>
          ) : (
            snapshotDirections.map((s) => (
              <div
                key={s.directionId}
                className="brand-surface flex flex-wrap items-center justify-between gap-2 rounded-md p-3 text-sm"
              >
                <div>
                  <p className="font-medium text-zinc-900">{s.title}</p>
                  <p className="text-xs text-zinc-500">
                    Fortschritt: {s.directionProgress !== null ? `${s.directionProgress}%` : "k. A."} · aktiv{" "}
                    {s.activeInitiativeCount} · kritisch {s.criticalInitiativeCount} · Review{" "}
                    {formatDateDe(s.lastReviewUpdateAt)}
                  </p>
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${healthBadgeClass(s.executionHealthStatus)}`}
                >
                  {healthLabelDe(s.executionHealthStatus)}
                </span>
              </div>
            ))
          )}
        </div>
        <p className="mt-3 text-sm">
          <Link href="/reviews?tab=directions" className="text-zinc-900 underline">
            
            Alle Stoßrichtungen
          </Link>
        </p>
      </section>

      <section className="brand-card p-6">
        <h3 className="text-base font-semibold text-zinc-900">Aktive Umsetzung</h3>
        <p className="mt-1 text-sm text-zinc-600">
          {activeExec.length} Initiativen in Geplant / Aktiv / Auffaellig.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {activeExec.slice(0, 8).map((i) => (
            <li key={i.id} className="brand-surface rounded-md p-2">
              <span className="font-medium text-zinc-900">{i.title}</span>
              <span className="ml-2 text-zinc-600">
                {initiativeStatusLabelDe(i.status)} · {i.progress_percent}% · Gew. {i.weight}
              </span>
            </li>
          ))}
        </ul>
        {activeExec.length > 8 ? (
          <p className="mt-2 text-sm">
            <Link href="/reviews?tab=initiatives" className="underline">
              Alle Initiativen filtern und bearbeiten
            </Link>
          </p>
        ) : null}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-zinc-900">Handlungsbedarf — Vorschau</h3>
          <Link href="/reviews?tab=attention" className="text-sm text-zinc-900 underline">
            
            Vollständige Liste
          </Link>
        </div>
        <ReviewAttentionRequired items={attentionPreview} maxItems={5} showHeading={false} />
      </section>
    </div>
  );
}
