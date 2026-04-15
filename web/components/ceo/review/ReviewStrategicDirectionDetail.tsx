import { deriveInitiativeHealth } from "@/lib/review/initiative-health";
import { isActiveExecutionInitiativeStatus } from "@/lib/review/initiative-review-fields";
import type { ReviewAttentionItem } from "@/lib/review/review-attention-rules";
import type { ReviewCycleAnnualTargetBrief } from "@/lib/review/review-cycle-data";
import type { ReviewCycleInitiativeInput, StrategicDirectionReviewSummary } from "@/lib/review/review-cycle-view-model";
import { ReviewAttentionRequired } from "./ReviewAttentionRequired";
import { ReviewUpdatePanel } from "./ReviewUpdatePanel";
import {
  directionStatusLabelDe,
  formatDateDe,
  healthBadgeClass,
  healthLabelDe,
} from "./review-ui";

type ReviewStrategicDirectionDetailProps = {
  directionId: string;
  summary: StrategicDirectionReviewSummary;
  initiativeRows: ReviewCycleInitiativeInput[];
  annualTargets: ReviewCycleAnnualTargetBrief[];
  attentionForDirection: ReviewAttentionItem[];
  ownerSelectOptions: Array<{ id: string; label: string }>;
  canWrite: boolean;
};

export function ReviewStrategicDirectionDetail({
  directionId,
  summary,
  initiativeRows,
  annualTargets,
  attentionForDirection,
  ownerSelectOptions,
  canWrite,
}: ReviewStrategicDirectionDetailProps) {
  const assignedActive = initiativeRows.filter(
    (i) =>
      i.directionId === directionId &&
      (i.resolvedDirectionSource === "program" || i.resolvedDirectionSource === "annual_target") &&
      isActiveExecutionInitiativeStatus(i.status)
  );

  return (
    <div className="space-y-4 border-t border-zinc-200 pt-4">
      <p className="text-sm text-zinc-600">
        
        Status Stoßrichtung:{" "}
        <span className="font-medium text-zinc-800">{directionStatusLabelDe(summary.status)}</span>
        {" · "}Priorität: {summary.priority}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-xs uppercase text-zinc-500">Fortschritt (gewichtet)</p>
          <p className="text-lg font-semibold text-zinc-900">
            {summary.directionProgress !== null ? `${summary.directionProgress}%` : "k. A."}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-zinc-500">Lagebild (Initiativen)</p>
          <span
            className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${healthBadgeClass(summary.executionHealthStatus)}`}
          >
            {healthLabelDe(summary.executionHealthStatus)}
          </span>
        </div>
        <div>
          <p className="text-xs uppercase text-zinc-500">Letztes Review</p>
          <p className="text-sm text-zinc-800">{formatDateDe(summary.lastReviewUpdateAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-zinc-500">Aktiv / kritisch</p>
          <p className="text-sm text-zinc-800">
            {summary.activeInitiativeCount} / {summary.criticalInitiativeCount}
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-900">Aktive Umsetzung</h3>
        {assignedActive.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-600">Keine aktiven Initiativen zugeordnet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {assignedActive.map((i) => {
              const h = deriveInitiativeHealth(i);
              return (
                <li key={i.id} className="brand-surface flex flex-wrap items-center gap-2 rounded-md p-2 text-sm">
                  <span className="font-medium text-zinc-900">{i.title}</span>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${healthBadgeClass(h)}`}>
                    {healthLabelDe(h)}
                  </span>
                  <span className="text-zinc-600">
                    {i.progress_percent}% · Gew. {i.weight}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-900">Jahresziele (Kontext)</h3>
        {annualTargets.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-600">Keine Jahresziele in diesem Zyklus.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-zinc-700">
            {annualTargets.map((t) => (
              <li key={t.id}>
                {t.title}{" "}
                <span className="text-zinc-500">({Math.round(t.progress_percent)}%)</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {attentionForDirection.length > 0 ? (
        <ReviewAttentionRequired items={attentionForDirection} showHeading />
      ) : null}

      <div>
        <h3 className="text-sm font-semibold text-zinc-900">Review aktualisieren</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Blocker und Kommentare je Initiative — kompakt im gleichen Formular.
        </p>
        <div className="mt-3 space-y-4">
          {assignedActive.map((i) => (
            <ReviewUpdatePanel
              key={i.id}
              initiative={i}
              canWrite={canWrite}
              ownerSelectOptions={ownerSelectOptions}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
