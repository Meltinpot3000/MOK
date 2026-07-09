"use client";

import { FocusedCorrelationNetwork } from "@/components/ceo/FocusedCorrelationNetwork";
import { SortableColumnHeaderButton } from "@/components/table/SortableTableHeader";
import { TableHorizontalScroll } from "@/components/table/TableHorizontalScroll";
import type { CorrelationCell, CorrelationStatus, CorrelationSummaryResult } from "@/lib/strategy-cycle/correlation";
import { compareSortKeys } from "@/lib/table/compare-sort-keys";
import { useMemo, useState } from "react";

type MatrixSort =
  | { kind: "challenge_title"; dir: "asc" | "desc" }
  | { kind: "objective_score"; objectiveId: string; dir: "asc" | "desc" };

type StrategicDesignSummaryProps = {
  canWrite: boolean;
  summary: CorrelationSummaryResult;
  onSaveOverride: (formData: FormData) => void | Promise<void>;
  onClearOverride: (formData: FormData) => void | Promise<void>;
};

function getStatusBadge(status: CorrelationStatus): string {
  if (status === "green") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (status === "yellow") return "border-amber-300 bg-amber-50 text-amber-800";
  if (status === "red") return "border-red-300 bg-red-50 text-red-800";
  return "border-zinc-300 bg-zinc-100 text-zinc-700";
}

function getCellTone(status: CorrelationStatus): string {
  if (status === "green") return "border-emerald-200 bg-emerald-50 hover:bg-emerald-100";
  if (status === "yellow") return "border-amber-200 bg-amber-50 hover:bg-amber-100";
  if (status === "red") return "border-red-200 bg-red-50 hover:bg-red-100";
  return "border-zinc-200 bg-white hover:bg-zinc-50";
}

function getStatusLabel(status: CorrelationStatus): string {
  if (status === "green") return "Gr\u00FCn";
  if (status === "yellow") return "Gelb";
  if (status === "red") return "Rot";
  return "Unklar";
}

function getObjectiveLifecycleLabel(objective: CorrelationSummaryResult["objectives"][number]): string {
  return objective.lifecycleLabel || "—";
}

type CorrelationListItem = {
  key: string;
  cellKey: string;
  label: string;
  score: number;
  status: CorrelationStatus;
};

function CorrelationListSection({
  title,
  emptyText,
  items,
  onSelectCell,
  getCellTone,
  getStatusLabel,
}: {
  title: string;
  emptyText: string;
  items: CorrelationListItem[];
  onSelectCell: (cellKey: string) => void;
  getCellTone: (status: CorrelationStatus) => string;
  getStatusLabel: (status: CorrelationStatus) => string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      {items.length === 0 ? (
        <p className="brand-surface rounded-md p-3 text-sm text-zinc-600">{emptyText}</p>
      ) : (
        items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelectCell(item.cellKey)}
            className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm ${getCellTone(item.status)}`}
          >
            <span className="min-w-0 break-words text-zinc-800">{item.label}</span>
            <span className="shrink-0 font-semibold text-zinc-900">
              {item.score} ({getStatusLabel(item.status)})
            </span>
          </button>
        ))
      )}
    </div>
  );
}

function ConflictListSection({
  title,
  emptyText,
  conflicts,
  onSelectCell,
  getStatusLabel,
  getStatusBadge,
}: {
  title: string;
  emptyText: string;
  conflicts: CorrelationSummaryResult["conflictCells"];
  onSelectCell: (cellKey: string) => void;
  getStatusLabel: (status: CorrelationStatus) => string;
  getStatusBadge: (status: CorrelationStatus) => string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      {conflicts.length === 0 ? (
        <p className="brand-surface rounded-md p-3 text-sm text-zinc-600">{emptyText}</p>
      ) : (
        conflicts.map((conflict) => (
          <button
            key={conflict.key}
            type="button"
            onClick={() => onSelectCell(conflict.cellKey)}
            className="w-full rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-left text-sm transition hover:bg-violet-100"
          >
            <p className="break-words text-zinc-800">
              {conflict.challengeTitle}
              {" → "}
              {conflict.objectiveTitle}
            </p>
            <p className="mt-1 break-words text-xs text-zinc-600">
              Stoßrichtung: {conflict.directionTitle}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              <span className={`rounded-full border px-2 py-0.5 ${getStatusBadge(conflict.autoStatus)}`}>
                Auto: {getStatusLabel(conflict.autoStatus)} ({conflict.autoScore})
              </span>
              <span className="text-zinc-500" aria-hidden>
                →
              </span>
              <span className={`rounded-full border px-2 py-0.5 ${getStatusBadge(conflict.effectiveStatus)}`}>
                Override: {getStatusLabel(conflict.effectiveStatus)}
              </span>
            </div>
            {conflict.overrideNote ? (
              <p className="mt-1.5 text-[11px] text-zinc-500">{conflict.overrideNote}</p>
            ) : null}
          </button>
        ))
      )}
    </div>
  );
}

export function StrategicDesignSummary({
  canWrite,
  summary,
  onSaveOverride,
  onClearOverride,
}: StrategicDesignSummaryProps) {
  const [matrixSort, setMatrixSort] = useState<MatrixSort | null>(null);
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(summary.cells[0]?.key ?? null);
  const selectedCell = useMemo(
    () => summary.cells.find((cell) => cell.key === selectedCellKey) ?? summary.cells[0] ?? null,
    [selectedCellKey, summary.cells]
  );

  const cellByPair = useMemo(() => {
    const map = new Map<string, CorrelationCell>();
    for (const cell of summary.cells) {
      map.set(`${cell.challengeId}:${cell.objectiveId}`, cell);
    }
    return map;
  }, [summary.cells]);

  const sortedChallenges = useMemo(() => {
    if (!matrixSort) return summary.challenges;
    if (matrixSort.kind === "challenge_title") {
      const mul = matrixSort.dir === "asc" ? 1 : -1;
      return [...summary.challenges].sort(
        (a, b) => a.title.localeCompare(b.title, "de") * mul
      );
    }
    const oid = matrixSort.objectiveId;
    const mul = matrixSort.dir === "asc" ? 1 : -1;
    return [...summary.challenges].sort((a, b) => {
      const sa = cellByPair.get(`${a.id}:${oid}`)?.score ?? null;
      const sb = cellByPair.get(`${b.id}:${oid}`)?.score ?? null;
      return compareSortKeys(sa, sb) * mul;
    });
  }, [summary.challenges, matrixSort, cellByPair]);

  const challengeTitleAriaSort =
    matrixSort?.kind === "challenge_title"
      ? matrixSort.dir === "asc"
        ? "ascending"
        : "descending"
      : "none";

  return (
    <div className="space-y-4">
      <article className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Zusammenfassung Strategisches Design</h2>
        <p className="mt-1 text-sm text-zinc-600">
          
          Matrix-first Sicht auf die Korrelation von Zielen, Herausforderungen und Stoßrichtungen.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="brand-surface rounded-md p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Gut korrelierte Ziele</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{summary.goodObjectivePercent}%</p>
          </div>
          <div className="brand-surface rounded-md p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Ø Score höchste Korrelationen</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">
              {summary.topStrongAvgScore}
              <span className="ml-1 text-sm font-medium text-zinc-500">Pkt.</span>
            </p>
          </div>
          <div className="brand-surface rounded-md p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Offene Konflikte (Auto vs Override)</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{summary.conflictPercent}%</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <CorrelationListSection
            title="Top 5 höchste Korrelationen"
            emptyText="Keine grünen Korrelationen vorhanden."
            items={summary.strongCells.map((cell) => ({
              key: cell.key,
              cellKey: cell.key,
              label: `${cell.challengeTitle} → ${cell.objectiveTitle}`,
              score: cell.score,
              status: cell.status,
            }))}
            onSelectCell={setSelectedCellKey}
            getCellTone={getCellTone}
            getStatusLabel={getStatusLabel}
          />
          <CorrelationListSection
            title="Top 5 niedrigste Korrelationen"
            emptyText="Keine schwachen Korrelationen vorhanden."
            items={summary.weakCells.map((cell) => ({
              key: cell.key,
              cellKey: cell.key,
              label: `${cell.challengeTitle} → ${cell.objectiveTitle}`,
              score: cell.score,
              status: cell.status,
            }))}
            onSelectCell={setSelectedCellKey}
            getCellTone={getCellTone}
            getStatusLabel={getStatusLabel}
          />
          <ConflictListSection
            title="Konflikte (Auto vs. Override)"
            emptyText="Keine offenen Konflikte zwischen Auto-Status und Override."
            conflicts={summary.conflictCells}
            onSelectCell={setSelectedCellKey}
            getStatusLabel={getStatusLabel}
            getStatusBadge={getStatusBadge}
          />
        </div>
      </article>

      <article className="brand-card p-6">
        <h3 className="text-base font-semibold text-zinc-900">Korrelationen: Herausforderungen × Ziele</h3>
        <p className="mt-1 text-xs text-zinc-600">
          
          Klick auf eine Matrix-Zelle oeffnet die verknüpften Stoßrichtungen mit Auto-Status und optionalem Override.
        </p>
        {summary.objectives.length === 0 || summary.challenges.length === 0 ? (
          <p className="mt-4 brand-surface p-3 text-sm text-zinc-600">
            
            Für diese Ansicht werden mindestens ein Ziel und eine strategische Herausforderung benoetigt.
          </p>
        ) : (
          <TableHorizontalScroll className="mt-4">
            <table className="w-max min-w-full border-collapse">
              <thead>
                <tr>
                  <th
                    aria-sort={challengeTitleAriaSort}
                    className="border border-zinc-200 bg-zinc-50 px-2 py-2 text-left text-xs font-semibold text-zinc-700"
                  >
                    <SortableColumnHeaderButton
                      label="Herausforderung"
                      sortDirection={
                        matrixSort?.kind === "challenge_title" ? matrixSort.dir : null
                      }
                      onRequestSort={() => {
                        setMatrixSort((prev) => {
                          if (prev?.kind === "challenge_title") {
                            return {
                              kind: "challenge_title",
                              dir: prev.dir === "asc" ? "desc" : "asc",
                            };
                          }
                          return { kind: "challenge_title", dir: "asc" };
                        });
                      }}
                      buttonClassName="font-semibold text-zinc-700 hover:bg-zinc-200/50 rounded px-0.5 -mx-0.5"
                    />
                  </th>
                  {summary.objectives.map((objective) => {
                    const objAriaSort =
                      matrixSort?.kind === "objective_score" &&
                      matrixSort.objectiveId === objective.id
                        ? matrixSort.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none";
                    return (
                      <th
                        key={objective.id}
                        aria-sort={objAriaSort}
                        className="border border-zinc-200 bg-zinc-50 px-2 py-2 text-left text-xs font-semibold text-zinc-700"
                      >
                        <SortableColumnHeaderButton
                          label={objective.title}
                          sortDirection={
                            matrixSort?.kind === "objective_score" &&
                            matrixSort.objectiveId === objective.id
                              ? matrixSort.dir
                              : null
                          }
                          onRequestSort={() => {
                            setMatrixSort((prev) => {
                              if (
                                prev?.kind === "objective_score" &&
                                prev.objectiveId === objective.id
                              ) {
                                return {
                                  kind: "objective_score",
                                  objectiveId: objective.id,
                                  dir: prev.dir === "asc" ? "desc" : "asc",
                                };
                              }
                              return {
                                kind: "objective_score",
                                objectiveId: objective.id,
                                dir: "asc",
                              };
                            });
                          }}
                          buttonClassName="font-semibold text-zinc-700 hover:bg-zinc-200/50 rounded px-0.5 -mx-0.5"
                        />
                        <div className="mt-1 text-[11px] font-normal text-zinc-500">
                          Lifecycle: {getObjectiveLifecycleLabel(objective)}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedChallenges.map((challenge) => (
                  <tr key={challenge.id}>
                    <td className="border border-zinc-200 bg-zinc-50 px-2 py-2 text-xs font-medium text-zinc-700">
                      {challenge.title}
                    </td>
                    {summary.objectives.map((objective) => {
                      const cell = cellByPair.get(`${challenge.id}:${objective.id}`);
                      if (!cell) {
                        return (
                          <td key={objective.id} className="border border-zinc-200 px-2 py-2 text-xs text-zinc-500">
                            -
                          </td>
                        );
                      }
                      const isSelected = selectedCell?.key === cell.key;
                      return (
                        <td key={objective.id} className="border border-zinc-200 p-2 align-top">
                          <button
                            type="button"
                            onClick={() => setSelectedCellKey(cell.key)}
                            className={`w-full rounded-md border px-2 py-2 text-left text-xs transition ${
                              isSelected
                                ? "border-zinc-900 ring-1 ring-zinc-900"
                                : getCellTone(cell.status)
                            }`}
                          >
                            <div className="font-semibold text-zinc-900">{cell.score}</div>
                            <div className="mt-1 text-zinc-600">{getStatusLabel(cell.status)}</div>
                            <div className="mt-1 text-zinc-500">{cell.directionCount}  Stoßrichtungen</div>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableHorizontalScroll>
        )}
      </article>

      <article className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="brand-card min-w-0 p-6">
          <h3 className="text-base font-semibold text-zinc-900">Detailpanel zur Matrix-Zelle</h3>
          {!selectedCell ? (
            <p className="mt-3 text-sm text-zinc-600">Noch keine Korrelation auswählbar.</p>
          ) : (
            <div className="mt-4 space-y-3">
              <div className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${getStatusBadge(selectedCell.status)}`}>
                {getStatusLabel(selectedCell.status)}
              </div>
              <p className="text-sm text-zinc-700">
                <span className="font-semibold">Herausforderung:</span> {selectedCell.challengeTitle}
              </p>
              <p className="text-sm text-zinc-700">
                <span className="font-semibold">Ziel:</span> {selectedCell.objectiveTitle}
              </p>
              {selectedCell.directions.length === 0 ? (
                <p className="brand-surface rounded-md p-3 text-sm text-zinc-600">
                  
                  Keine direkte Direction-Verknüpfung für dieses Paar vorhanden.
                </p>
              ) : (
                selectedCell.directions.map((direction) => (
                  <div key={direction.directionId} className="rounded-md border border-zinc-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-zinc-900">{direction.directionTitle}</p>
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${getStatusBadge(direction.effectiveStatus)}`}>
                        {getStatusLabel(direction.effectiveStatus)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-600">
                      Auto-Score: {direction.autoScore} ({getStatusLabel(direction.autoStatus)})
                    </p>
                    <form action={onSaveOverride} className="mt-3 space-y-2">
                      <input type="hidden" name="challenge_id" value={selectedCell.challengeId} />
                      <input type="hidden" name="objective_id" value={selectedCell.objectiveId} />
                      <input type="hidden" name="strategic_direction_id" value={direction.directionId} />
                      <input type="hidden" name="return_to" value="/strategy-cycle?l1=strategic-directions&l2=summary" />
                      <label className="text-xs text-zinc-600">
                        Override Status
                        <select
                          name="status"
                          defaultValue={direction.effectiveStatus}
                          disabled={!canWrite}
                          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="green">green</option>
                          <option value="yellow">yellow</option>
                          <option value="red">red</option>
                          <option value="unknown">unknown</option>
                        </select>
                      </label>
                      <label className="text-xs text-zinc-600">
                        Notiz
                        <textarea
                          name="note"
                          defaultValue={direction.overrideNote ?? ""}
                          rows={2}
                          disabled={!canWrite}
                          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                          placeholder="Begr\u00FCndung f\u00FCr manuelles Override"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          disabled={!canWrite}
                          className="brand-btn px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Override speichern
                        </button>
                      </div>
                    </form>
                    <form action={onClearOverride} className="mt-2">
                      <input type="hidden" name="challenge_id" value={selectedCell.challengeId} />
                      <input type="hidden" name="objective_id" value={selectedCell.objectiveId} />
                      <input type="hidden" name="strategic_direction_id" value={direction.directionId} />
                      <input type="hidden" name="return_to" value="/strategy-cycle?l1=strategic-directions&l2=summary" />
                      <button
                        type="submit"
                        disabled={!canWrite || !direction.hasOverride}
                        className="brand-btn-secondary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Override entfernen
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="brand-card min-w-0 overflow-hidden p-6">
          <h3 className="text-base font-semibold text-zinc-900">Interaktive Netzwerkansicht (fokussiert)</h3>
          <p className="mt-1 text-xs text-zinc-600">
            
            Visualisiert für die ausgewählte Matrix-Zelle den Zusammenhang Ziel ↔ Stoßrichtung ↔ Herausforderung.
          </p>
          {!selectedCell ? (
            <p className="mt-3 text-sm text-zinc-600">Keine Auswahl vorhanden.</p>
          ) : (
            <div className="mt-4 min-w-0">
              <FocusedCorrelationNetwork
                cell={selectedCell}
                getStatusLabel={getStatusLabel}
                getStatusBadge={getStatusBadge}
              />
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
