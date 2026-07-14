"use client";

import Link from "next/link";
import type { ReviewCycleData } from "@/lib/review/review-cycle-data";
import type { ExecutionNetworkNode } from "@/lib/review/execution-network-graph";
import type { EnrichedStrategicDirectionReviewSummary } from "@/lib/review/review-direction-status";
import { deriveInitiativeHealth } from "@/lib/review/initiative-health";
import { isActiveExecutionInitiativeStatus } from "@/lib/review/initiative-review-fields";
import { ReviewUpdatePanel } from "../ReviewUpdatePanel";
import { ReviewAttentionRequired } from "../ReviewAttentionRequired";
import {
  directionReviewStatusBadgeClass,
  directionReviewStatusLabelDe,
  formatDateDe,
  healthBadgeClass,
  healthLabelDe,
} from "../review-ui";
import { primaryCoverageTypeLabelDe } from "@/lib/review/review-direction-status";

type ExecutionNetworkDetailPanelProps = {
  selectedNode: ExecutionNetworkNode | null;
  cycleData: ReviewCycleData;
  ownerSelectOptions: Array<{ id: string; label: string }>;
  canWrite: boolean;
  onReviewUpdate: () => void;
  onOpenMeasureDialog: (context: {
    directionId: string;
    initiativeId?: string;
    programId?: string;
    annualTargetId?: string;
    signalType?: string;
  }) => void;
  onOpenImpulseDialog: (context: {
    directionId: string;
    objectType: string;
    objectId: string;
  }) => void;
};

function findDirectionSummary(
  directionId: string,
  summaries: EnrichedStrategicDirectionReviewSummary[]
): EnrichedStrategicDirectionReviewSummary | undefined {
  return summaries.find((s) => s.directionId === directionId);
}

export function ExecutionNetworkDetailPanel({
  selectedNode,
  cycleData,
  ownerSelectOptions,
  canWrite,
  onOpenMeasureDialog,
  onOpenImpulseDialog,
}: ExecutionNetworkDetailPanelProps) {
  if (!selectedNode) {
    return (
      <aside className="brand-card sticky top-4 h-fit p-4">
        <p className="text-sm text-zinc-600">
          Wählen Sie eine Stoßrichtung, Initiative oder ein Signal im Netzwerk.
        </p>
      </aside>
    );
  }

  if (selectedNode.kind === "initiative" && selectedNode.initiativeId) {
    const initiative = cycleData.initiativeRows.find((i) => i.id === selectedNode.initiativeId);
    if (!initiative) {
      return (
        <aside className="brand-card sticky top-4 p-4">
          <p className="text-sm text-zinc-600">Initiative nicht gefunden.</p>
        </aside>
      );
    }
    return (
      <aside className="brand-card sticky top-4 max-h-[calc(100vh-8rem)] overflow-y-auto p-4">
        <h3 className="text-base font-semibold text-zinc-900">{initiative.title}</h3>
        <p className="mt-1 text-xs text-zinc-500">Initiative — Review pflegen</p>
        <div className="mt-3">
          <ReviewUpdatePanel
            initiative={initiative}
            canWrite={canWrite}
            ownerSelectOptions={ownerSelectOptions}
            reviewCommentRows={6}
          />
        </div>
        {canWrite ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white"
              onClick={() =>
                onOpenMeasureDialog({
                  directionId: initiative.directionId ?? "",
                  initiativeId: initiative.id,
                  programId: initiative.program_id ?? undefined,
                })
              }
            >
              Maßnahme anlegen
            </button>
          </div>
        ) : null}
      </aside>
    );
  }

  if (selectedNode.kind === "signal") {
    return (
      <aside className="brand-card sticky top-4 p-4">
        <h3 className="text-base font-semibold text-zinc-900">{selectedNode.title}</h3>
        <p className="mt-1 text-sm text-zinc-600">{selectedNode.subtitle}</p>
        {selectedNode.directionId && canWrite ? (
          <button
            type="button"
            className="mt-4 rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white"
            onClick={() =>
              onOpenMeasureDialog({
                directionId: selectedNode.directionId!,
                initiativeId: selectedNode.initiativeId,
                signalType: selectedNode.signalIssueType,
              })
            }
          >
            Maßnahme anlegen
          </button>
        ) : null}
      </aside>
    );
  }

  if (selectedNode.kind === "feedback") {
    return (
      <aside className="brand-card sticky top-4 p-4">
        <h3 className="text-base font-semibold text-zinc-900">Strategie-Impuls</h3>
        <p className="mt-1 text-sm text-zinc-600">{selectedNode.title}</p>
        <Link
          href={`/strategy-cycle?l1=strategic-directions${selectedNode.directionId ? `&focus=${selectedNode.directionId}` : ""}`}
          className="mt-3 inline-block text-sm underline"
        >
          Im Strategiezyklus öffnen
        </Link>
      </aside>
    );
  }

  const directionId = selectedNode.directionId ?? selectedNode.id.replace(/^dir:/, "");
  const summary = findDirectionSummary(directionId, cycleData.enrichedSummaries);
  if (!summary) {
    return (
      <aside className="brand-card sticky top-4 p-4">
        <p className="text-sm text-zinc-600">Stoßrichtung nicht gefunden.</p>
      </aside>
    );
  }

  const assignedInitiatives = cycleData.initiativeRows.filter(
    (i) =>
      i.directionId === directionId &&
      (i.resolvedDirectionSource === "program" || i.resolvedDirectionSource === "legacy_annual_target")
  );
  const activeInitiatives = assignedInitiatives.filter((i) =>
    isActiveExecutionInitiativeStatus(i.status)
  );
  const criticalInitiatives = activeInitiatives.filter((i) => {
    const h = deriveInitiativeHealth(i);
    return h === "off_track" || h === "at_risk";
  });
  const directionAttention = cycleData.attentionItems.filter(
    (a) => a.directionId === directionId
  );
  const programs = cycleData.programs.filter((p) => p.strategic_direction_id === directionId);
  const annualTargets = cycleData.annualTargetsByDirectionId[directionId] ?? [];
  const challenges = cycleData.challengesByDirectionId[directionId] ?? [];
  const objectives = cycleData.objectivesByDirectionId[directionId] ?? [];

  return (
    <aside className="brand-card sticky top-4 max-h-[calc(100vh-8rem)] space-y-4 overflow-y-auto p-4">
      <div>
        <h3 className="text-lg font-semibold text-zinc-900">{summary.title}</h3>
        <p className="text-xs text-zinc-500">Priorität {summary.priority}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${directionReviewStatusBadgeClass(summary.reviewStatus)}`}
          >
            {directionReviewStatusLabelDe(summary.reviewStatus)}
          </span>
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
            {primaryCoverageTypeLabelDe(summary.coverage)}
          </span>
          {summary.statusHintDe ? (
            <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
              {summary.statusHintDe}
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs uppercase text-zinc-500">Fortschritt</p>
          <p className="font-semibold">
            {summary.directionProgress !== null ? `${summary.directionProgress}%` : "k. A."}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-zinc-500">Zeitfortschritt</p>
          <p className="font-semibold">{cycleData.timeProgressPercent}%</p>
        </div>
        <div>
          <p className="text-xs uppercase text-zinc-500">Delta</p>
          <p className="font-semibold">
            {cycleData.deltaPp !== null ? `${cycleData.deltaPp} PP` : "k. A."}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-zinc-500">Letztes Review</p>
          <p className="font-semibold">{formatDateDe(summary.lastReviewUpdateAt)}</p>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-zinc-900">Programme</h4>
        {programs.length === 0 ? (
          <p className="text-sm text-zinc-600">Keine Programme.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm">
            {programs.map((p) => (
              <li key={p.id}>
                <span className="font-medium">{p.title}</span>
                <span className="ml-1 text-xs text-teal-700">PIP</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-zinc-900">Run-Jahresziele</h4>
        {annualTargets.filter((t) => !t.strategy_program_id).length === 0 ? (
          <p className="text-sm text-zinc-600">Keine Run-Jahresziele.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm text-zinc-700">
            {annualTargets
              .filter((t) => !t.strategy_program_id)
              .map((t) => (
                <li key={t.id}>
                  {t.title}{" "}
                  <span className="text-zinc-500">({Math.round(t.progress_percent)}%)</span>
                </li>
              ))}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-zinc-900">Change-Jahresziele</h4>
        {annualTargets.filter((t) => Boolean(t.strategy_program_id)).length === 0 ? (
          <p className="text-sm text-zinc-600">Keine Change-Jahresziele.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm text-zinc-700">
            {annualTargets
              .filter((t) => Boolean(t.strategy_program_id))
              .map((t) => {
                const programTitle =
                  programs.find((p) => p.id === t.strategy_program_id)?.title ?? "Programm";
                return (
                  <li key={t.id}>
                    {t.title}{" "}
                    <span className="text-zinc-500">
                      ({Math.round(t.progress_percent)}% · {programTitle})
                    </span>
                  </li>
                );
              })}
          </ul>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-zinc-900">Aktive Initiativen</h4>
        {activeInitiatives.length === 0 ? (
          <p className="text-sm text-zinc-600">Keine aktive Umsetzung.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {activeInitiatives.map((i) => {
              const h = deriveInitiativeHealth(i);
              return (
                <li key={i.id} className="flex items-center gap-2 text-sm">
                  <span>{i.title}</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${healthBadgeClass(h)}`}>
                    {healthLabelDe(h)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {criticalInitiatives.length > 0 ? (
        <div>
          <h4 className="text-sm font-semibold text-red-800">Kritische Initiativen</h4>
          <ul className="mt-1 space-y-1 text-sm">
            {criticalInitiatives.map((i) => (
              <li key={i.id}>{i.title}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {directionAttention.length > 0 ? (
        <ReviewAttentionRequired items={directionAttention} showHeading />
      ) : null}

      <div className="border-t border-zinc-200 pt-3">
        <h4 className="text-xs font-semibold uppercase text-zinc-500">Strategischer Kontext</h4>
        {challenges.length > 0 ? (
          <p className="mt-1 text-sm text-zinc-700">
            Herausforderungen: {challenges.map((c) => c.title).join(", ")}
          </p>
        ) : null}
        {objectives.length > 0 ? (
          <p className="mt-1 text-sm text-zinc-700">
            Ziele: {objectives.map((o) => o.title).join(", ")}
          </p>
        ) : null}
        {challenges.length === 0 && objectives.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-600">Kein Kontext verknüpft.</p>
        ) : null}
      </div>

      {canWrite ? (
        <div className="flex flex-col gap-2 border-t border-zinc-200 pt-3">
          <p className="text-xs font-semibold uppercase text-zinc-500">Aktionen</p>
          <button
            type="button"
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white"
            onClick={() => onOpenMeasureDialog({ directionId })}
          >
            Maßnahme anlegen
          </button>
          <details className="text-sm">
            <summary className="cursor-pointer text-zinc-600">Strategie-Impuls anlegen (sekundär)</summary>
            <button
              type="button"
              className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              onClick={() =>
                onOpenImpulseDialog({
                  directionId,
                  objectType: "strategic_direction",
                  objectId: directionId,
                })
              }
            >
              Impuls für Stoßrichtung
            </button>
          </details>
          <Link
            href={`/strategy-cycle?l1=strategic-directions&focus=${directionId}`}
            className="text-center text-sm underline"
          >
            Im Strategiezyklus öffnen
          </Link>
        </div>
      ) : null}
    </aside>
  );
}
