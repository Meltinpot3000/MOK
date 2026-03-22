import type { ReviewAttentionItem } from "@/lib/review/review-attention-rules";
import type { ReviewCycleAnnualTargetBrief } from "@/lib/review/review-cycle-data";
import type { ReviewCycleInitiativeInput, StrategicDirectionReviewSummary } from "@/lib/review/review-cycle-view-model";
import { ReviewStrategicDirectionDetail } from "./ReviewStrategicDirectionDetail";
import {
  directionStatusLabelDe,
  formatDateDe,
  healthBadgeClass,
  healthLabelDe,
} from "./review-ui";

type ReviewStrategicDirectionListProps = {
  summaries: StrategicDirectionReviewSummary[];
  initiativeRows: ReviewCycleInitiativeInput[];
  annualTargetsByDirectionId: Record<string, ReviewCycleAnnualTargetBrief[]>;
  attentionItems: ReviewAttentionItem[];
  canWrite: boolean;
};

export function ReviewStrategicDirectionList({
  summaries,
  initiativeRows,
  annualTargetsByDirectionId,
  attentionItems,
  canWrite,
}: ReviewStrategicDirectionListProps) {
  return (
    <section className="brand-card p-6">
      <h2 className="text-lg font-semibold text-zinc-900">Stossrichtungen</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Fortschritt und Risiko aus aktiven Initiativen — ohne OKR-Mix in der Kennzahl.
      </p>
      <div className="mt-4 space-y-2">
        {summaries.length === 0 ? (
          <p className="text-sm text-zinc-600">Keine Stossrichtungen im Zyklus.</p>
        ) : (
          summaries.map((s) => {
            const targets = annualTargetsByDirectionId[s.directionId] ?? [];
            const att = attentionItems.filter((a) => a.directionId === s.directionId);
            return (
              <details key={s.directionId} className="brand-surface group rounded-md border border-zinc-200">
                <summary className="cursor-pointer list-none p-4 [&::-webkit-details-marker]:hidden">
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-zinc-900">{s.title}</p>
                      <p className="text-xs text-zinc-500">
                        {directionStatusLabelDe(s.status)} · Prioritaet {s.priority}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <span>
                        Fortschritt:{" "}
                        <strong>{s.directionProgress !== null ? `${s.directionProgress}%` : "k. A."}</strong>
                      </span>
                      <span>
                        Aktiv: <strong>{s.activeInitiativeCount}</strong>
                      </span>
                      <span>
                        Kritisch: <strong>{s.criticalInitiativeCount}</strong>
                      </span>
                      <span>
                        Review: <strong>{formatDateDe(s.lastReviewUpdateAt)}</strong>
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${healthBadgeClass(s.executionHealthStatus)}`}
                      >
                        {healthLabelDe(s.executionHealthStatus)}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500 group-open:hidden">Klicken fuer Details und Review.</p>
                </summary>
                <div className="px-4 pb-4">
                  <ReviewStrategicDirectionDetail
                    directionId={s.directionId}
                    summary={s}
                    initiativeRows={initiativeRows}
                    annualTargets={targets}
                    attentionForDirection={att}
                    canWrite={canWrite}
                  />
                </div>
              </details>
            );
          })
        )}
      </div>
    </section>
  );
}
