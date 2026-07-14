"use client";

import type { ImpactPathEdge, ImpactPathGraph, ImpactPathNode } from "@/lib/strategy-cycle/impact-path-graph";
import { impactPathEdgeMeaningDe } from "@/lib/strategy-cycle/impact-path-graph";
import {
  IMPACT_PATH_COLUMN_LABEL,
  statusBadgeClass,
  statusLabelDe,
} from "@/components/ceo/strategy-cycle/impact-path/impact-path-ui";

const IMPACT_PATH_RETURN = "/strategy-cycle?l1=strategic-directions&l2=summary";

type ImpactPathDetailPanelProps = {
  canWrite: boolean;
  graph: ImpactPathGraph;
  selectedNode: ImpactPathNode | null;
  selectedEdge: ImpactPathEdge | null;
  onSelectEdge: (edgeId: string) => void;
  isMutationPending?: boolean;
  onAcceptSuggestion: (event: React.FormEvent<HTMLFormElement>) => void;
  onRejectSuggestion: (event: React.FormEvent<HTMLFormElement>) => void;
  onDeferSuggestion: (event: React.FormEvent<HTMLFormElement>) => void;
  onDeleteLink: (event: React.FormEvent<HTMLFormElement>) => void;
  onSaveOverride?: (event: React.FormEvent<HTMLFormElement>) => void;
  onClearOverride?: (event: React.FormEvent<HTMLFormElement>) => void;
};

function nodeById(graph: ImpactPathGraph, id: string): ImpactPathNode | undefined {
  return graph.nodes.find((n) => n.id === id);
}

function ImpactPathObjectTextBlock({
  kind,
  title,
  description,
}: {
  kind: ImpactPathNode["kind"];
  title: string;
  description?: string | null;
}) {
  const trimmed = description?.trim() ?? "";
  return (
    <section className="rounded-md border border-zinc-200 bg-zinc-50/80 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {IMPACT_PATH_COLUMN_LABEL[kind]}
      </p>
      <dl className="mt-3 space-y-3 text-sm">
        <div>
          <dt className="text-xs text-zinc-500">Titel</dt>
          <dd className="mt-0.5 font-medium leading-snug text-zinc-900">{title}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Beschreibung</dt>
          <dd className="mt-0.5 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed text-zinc-700">
            {trimmed ? (
              trimmed
            ) : (
              <span className="italic text-zinc-500">Keine Beschreibung hinterlegt.</span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function ImpactPathDetailPanel({
  canWrite,
  graph,
  selectedNode,
  selectedEdge,
  onSelectEdge,
  isMutationPending = false,
  onAcceptSuggestion,
  onRejectSuggestion,
  onDeferSuggestion,
  onDeleteLink,
  onSaveOverride,
  onClearOverride,
}: ImpactPathDetailPanelProps) {
  if (!selectedNode && !selectedEdge) {
    return (
      <div className="brand-card p-5">
        <h3 className="text-base font-semibold text-zinc-900">Detailpanel</h3>
        <p className="mt-2 text-sm text-zinc-600">
          Klicken Sie auf ein Objekt oder eine Verbindungslinie, um Details und Aktionen zu sehen.
        </p>
      </div>
    );
  }

  if (selectedEdge) {
    const source = nodeById(graph, selectedEdge.sourceId);
    const target = nodeById(graph, selectedEdge.targetId);
    const isSuggested = selectedEdge.state === "suggested";

    return (
      <div className="brand-card space-y-4 p-5">
        <div>
          <h3 className="text-base font-semibold text-zinc-900">
            {isSuggested ? "Vorgeschlagene Verbindung" : "Bestehende Verbindung"}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">{impactPathEdgeMeaningDe(selectedEdge.kind)}</p>
        </div>

        <div className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${statusBadgeClass(selectedEdge.status)}`}>
          {statusLabelDe(selectedEdge.status)} · {selectedEdge.score} Pkt.
        </div>

        <dl className="space-y-3 text-sm text-zinc-700">
          <div>
            <dt className="text-xs text-zinc-500">Quelle</dt>
            <dd className="font-medium text-zinc-900">{source?.title ?? selectedEdge.sourceId}</dd>
            {source?.description?.trim() ? (
              <dd className="mt-1 text-xs leading-relaxed text-zinc-600">{source.description.trim()}</dd>
            ) : null}
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Ziel</dt>
            <dd className="font-medium text-zinc-900">{target?.title ?? selectedEdge.targetId}</dd>
            {target?.description?.trim() ? (
              <dd className="mt-1 text-xs leading-relaxed text-zinc-600">{target.description.trim()}</dd>
            ) : null}
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Begründung</dt>
            <dd>{selectedEdge.explanationDe}</dd>
          </div>
          {selectedEdge.reviewNote ? (
            <div>
              <dt className="text-xs text-zinc-500">Review-Notiz</dt>
              <dd>{selectedEdge.reviewNote}</dd>
            </div>
          ) : null}
        </dl>

        {isSuggested ? (
          <div className="space-y-2">
            <form onSubmit={onAcceptSuggestion} className="space-y-2">
              <input type="hidden" name="edge_kind" value={selectedEdge.kind} />
              <input type="hidden" name="source_id" value={selectedEdge.sourceId} />
              <input type="hidden" name="target_id" value={selectedEdge.targetId} />
              <input type="hidden" name="suggestion_score" value={String(selectedEdge.score)} />
              <input type="hidden" name="return_to" value={IMPACT_PATH_RETURN} />
              <label className="text-xs text-zinc-600">
                Kommentar
                <textarea
                  name="note"
                  rows={2}
                  disabled={!canWrite || isMutationPending}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm disabled:opacity-60"
                  placeholder="Optional: Begründung für Review-Entscheidung"
                />
              </label>
              <button
                type="submit"
                disabled={!canWrite || isMutationPending}
                className="brand-btn px-3 py-1.5 text-xs disabled:opacity-60"
              >
                Verbindung hinzufügen
              </button>
            </form>
            <form onSubmit={onRejectSuggestion} className="inline">
              <input type="hidden" name="edge_kind" value={selectedEdge.kind} />
              <input type="hidden" name="source_id" value={selectedEdge.sourceId} />
              <input type="hidden" name="target_id" value={selectedEdge.targetId} />
              <input type="hidden" name="suggestion_score" value={String(selectedEdge.score)} />
              <input type="hidden" name="return_to" value={IMPACT_PATH_RETURN} />
              <button
                type="submit"
                disabled={!canWrite || isMutationPending}
                className="brand-btn-secondary px-3 py-1.5 text-xs disabled:opacity-60"
              >
                Vorschlag ablehnen
              </button>
            </form>
            <form onSubmit={onDeferSuggestion} className="inline">
              <input type="hidden" name="edge_kind" value={selectedEdge.kind} />
              <input type="hidden" name="source_id" value={selectedEdge.sourceId} />
              <input type="hidden" name="target_id" value={selectedEdge.targetId} />
              <input type="hidden" name="suggestion_score" value={String(selectedEdge.score)} />
              <input type="hidden" name="return_to" value={IMPACT_PATH_RETURN} />
              <button
                type="submit"
                disabled={!canWrite || isMutationPending}
                className="brand-btn-secondary px-3 py-1.5 text-xs disabled:opacity-60"
              >
                Später prüfen
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-3">
            <form onSubmit={onDeleteLink} className="flex flex-wrap gap-2">
              <input type="hidden" name="edge_kind" value={selectedEdge.kind} />
              <input type="hidden" name="source_id" value={selectedEdge.sourceId} />
              <input type="hidden" name="target_id" value={selectedEdge.targetId} />
              <input type="hidden" name="return_to" value={IMPACT_PATH_RETURN} />
              <button
                type="submit"
                disabled={!canWrite || isMutationPending}
                className="brand-btn-secondary px-3 py-1.5 text-xs disabled:opacity-60"
              >
                Verbindung löschen
              </button>
            </form>

            {selectedEdge.hasOverride &&
            selectedEdge.correlationDirectionId &&
            onSaveOverride &&
            onClearOverride ? (
              <div className="rounded-md border border-violet-200 bg-violet-50 p-3 text-xs">
                <p className="font-medium text-violet-900">Override (Auto vs. manuell)</p>
                <p className="mt-1 text-violet-800">
                  Effektiv: {statusLabelDe(selectedEdge.effectiveStatus ?? selectedEdge.status)}
                </p>
                <form onSubmit={onSaveOverride} className="mt-2 space-y-2">
                  <input type="hidden" name="challenge_id" value={selectedEdge.sourceId} />
                  <input type="hidden" name="objective_id" value={selectedEdge.targetId} />
                  <input
                    type="hidden"
                    name="strategic_direction_id"
                    value={selectedEdge.correlationDirectionId}
                  />
                  <input type="hidden" name="return_to" value={IMPACT_PATH_RETURN} />
                  <select
                    name="status"
                    defaultValue={selectedEdge.effectiveStatus ?? "unknown"}
                    disabled={!canWrite || isMutationPending}
                    className="w-full rounded-md border border-zinc-300 px-2 py-1 text-sm"
                  >
                    <option value="green">green</option>
                    <option value="yellow">yellow</option>
                    <option value="red">red</option>
                    <option value="unknown">unknown</option>
                  </select>
                  <button type="submit" disabled={!canWrite || isMutationPending} className="brand-btn px-2 py-1 text-xs">
                    Override speichern
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  if (!selectedNode) return null;

  const incoming = graph.edges.filter((e) => e.targetId === selectedNode.id);
  const outgoing = graph.edges.filter((e) => e.sourceId === selectedNode.id);
  const suggested = [...incoming, ...outgoing].filter((e) => e.state === "suggested");

  return (
    <div className="brand-card space-y-4 p-5">
      <ImpactPathObjectTextBlock
        kind={selectedNode.kind}
        title={selectedNode.title}
        description={selectedNode.description}
      />

      {selectedNode.isAnalysable === false ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <p className="font-semibold">
            {selectedNode.analysabilityLabelDe ?? "Nicht analysefähig"}
          </p>
          {selectedNode.analysabilityHintDe ? (
            <p className="mt-1">{selectedNode.analysabilityHintDe}</p>
          ) : null}
          <p className="mt-1 text-amber-900">
            Passungsvorschläge und Schwäche-Analysen werden für dieses Objekt ausgesetzt, bis die
            Beschreibung ausreichend ist.
          </p>
        </div>
      ) : null}

      {selectedNode.lifecycleLabel ? (
        <p className="text-xs text-zinc-500">Lifecycle: {selectedNode.lifecycleLabel}</p>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Eingehend</p>
        {incoming.length === 0 ? (
          <p className="text-sm text-zinc-500">Keine eingehenden Verbindungen.</p>
        ) : (
          incoming.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onSelectEdge(e.id)}
              className="flex w-full items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-left text-sm hover:bg-zinc-50"
            >
              <span>{nodeById(graph, e.sourceId)?.title ?? e.sourceId}</span>
              <span className="font-semibold">{e.score}</span>
            </button>
          ))
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Ausgehend</p>
        {outgoing.length === 0 ? (
          <p className="text-sm text-zinc-500">Keine ausgehenden Verbindungen.</p>
        ) : (
          outgoing.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onSelectEdge(e.id)}
              className="flex w-full items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-left text-sm hover:bg-zinc-50"
            >
              <span>{nodeById(graph, e.targetId)?.title ?? e.targetId}</span>
              <span className="font-semibold">{e.score}</span>
            </button>
          ))
        )}
      </div>

      {suggested.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Vorgeschlagene Verbindungen
          </p>
          {suggested.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onSelectEdge(e.id)}
              className="w-full rounded-md border border-dashed border-indigo-300 bg-indigo-50/50 px-3 py-2 text-left text-sm hover:bg-indigo-50"
            >
              {e.state === "suggested" ? "Vorschlag" : "Verbindung"} · {e.score} Pkt.
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
