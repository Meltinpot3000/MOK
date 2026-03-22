"use client";

import { SortableColumnHeaderButton } from "@/components/table/SortableTableHeader";
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
  if (status === "green") return "Gruen";
  if (status === "yellow") return "Gelb";
  if (status === "red") return "Rot";
  return "Unklar";
}

function getObjectiveStatusLabel(status: string | null): string {
  if (status === "active") return "active";
  if (status === "at_risk") return "at_risk";
  if (status === "completed") return "completed";
  if (status === "archived") return "archived";
  return "draft";
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
          Matrix-first Sicht auf die Korrelation von Objectives, Herausforderungen und Stossrichtungen.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="brand-surface rounded-md p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Gut korrelierte Objectives</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{summary.goodObjectivePercent}%</p>
          </div>
          <div className="brand-surface rounded-md p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Schwache Korrelationen (Top 5)</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{summary.weakCells.length}</p>
          </div>
          <div className="brand-surface rounded-md p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Offene Konflikte (Auto vs Override)</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{summary.conflictCount}</p>
          </div>
        </div>
        {summary.weakCells.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Top 5 schwache Korrelationen</p>
            {summary.weakCells.map((cell) => (
              <button
                key={cell.key}
                type="button"
                onClick={() => setSelectedCellKey(cell.key)}
                className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm ${getCellTone(cell.status)}`}
              >
                <span className="text-zinc-800">
                  {cell.challengeTitle}
                  {" -> "}
                  {cell.objectiveTitle}
                </span>
                <span className="font-semibold text-zinc-900">
                  {cell.score} ({getStatusLabel(cell.status)})
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </article>

      <article className="brand-card p-6">
        <h3 className="text-base font-semibold text-zinc-900">Korrelationen: Herausforderungen x Objectives</h3>
        <p className="mt-1 text-xs text-zinc-600">
          Klick auf eine Matrix-Zelle oeffnet die verknuepften Stossrichtungen mit Auto-Status und optionalem Override.
        </p>
        {summary.objectives.length === 0 || summary.challenges.length === 0 ? (
          <p className="mt-4 brand-surface p-3 text-sm text-zinc-600">
            Fuer diese Ansicht werden mindestens ein Objective und eine strategische Herausforderung benoetigt.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse">
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
                          Status: {getObjectiveStatusLabel(objective.status)}
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
                            <div className="mt-1 text-zinc-500">{cell.directionCount} Stossrichtungen</div>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="brand-card p-6">
          <h3 className="text-base font-semibold text-zinc-900">Detailpanel zur Matrix-Zelle</h3>
          {!selectedCell ? (
            <p className="mt-3 text-sm text-zinc-600">Noch keine Korrelation auswaehlbar.</p>
          ) : (
            <div className="mt-4 space-y-3">
              <div className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${getStatusBadge(selectedCell.status)}`}>
                {getStatusLabel(selectedCell.status)}
              </div>
              <p className="text-sm text-zinc-700">
                <span className="font-semibold">Herausforderung:</span> {selectedCell.challengeTitle}
              </p>
              <p className="text-sm text-zinc-700">
                <span className="font-semibold">Objective:</span> {selectedCell.objectiveTitle}
              </p>
              {selectedCell.directions.length === 0 ? (
                <p className="brand-surface rounded-md p-3 text-sm text-zinc-600">
                  Keine direkte Direction-Verknuepfung fuer dieses Paar vorhanden.
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
                          placeholder="Begruendung fuer manuelles Override"
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

        <div className="brand-card p-6">
          <h3 className="text-base font-semibold text-zinc-900">Interaktive Netzwerkansicht (fokussiert)</h3>
          <p className="mt-1 text-xs text-zinc-600">
            Visualisiert fuer die ausgewaehlte Matrix-Zelle den Zusammenhang Objective ↔ Stossrichtung ↔ Herausforderung.
          </p>
          {!selectedCell ? (
            <p className="mt-3 text-sm text-zinc-600">Keine Auswahl vorhanden.</p>
          ) : (
            <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <svg viewBox="0 0 760 260" className="h-[260px] w-full">
                <rect x="20" y="100" width="220" height="60" rx="10" className="fill-white stroke-zinc-300" />
                <text x="130" y="125" textAnchor="middle" className="fill-zinc-700 text-[12px] font-semibold">
                  Objective
                </text>
                <text x="130" y="145" textAnchor="middle" className="fill-zinc-600 text-[11px]">
                  {selectedCell.objectiveTitle}
                </text>

                <rect x="520" y="100" width="220" height="60" rx="10" className="fill-white stroke-zinc-300" />
                <text x="630" y="125" textAnchor="middle" className="fill-zinc-700 text-[12px] font-semibold">
                  Herausforderung
                </text>
                <text x="630" y="145" textAnchor="middle" className="fill-zinc-600 text-[11px]">
                  {selectedCell.challengeTitle}
                </text>

                {selectedCell.directions.slice(0, 3).map((direction, index) => {
                  const y = 30 + index * 78;
                  return (
                    <g key={direction.directionId}>
                      <line x1="240" y1="130" x2="360" y2={y + 30} className="stroke-zinc-400" strokeWidth="1.5" />
                      <line x1="400" y1={y + 30} x2="520" y2="130" className="stroke-zinc-400" strokeWidth="1.5" />
                      <rect
                        x="360"
                        y={y}
                        width="40"
                        height="60"
                        rx="8"
                        className={direction.effectiveStatus === "green" ? "fill-emerald-100 stroke-emerald-300" : direction.effectiveStatus === "yellow" ? "fill-amber-100 stroke-amber-300" : direction.effectiveStatus === "red" ? "fill-red-100 stroke-red-300" : "fill-zinc-100 stroke-zinc-300"}
                      />
                      <text x="380" y={y + 26} textAnchor="middle" className="fill-zinc-700 text-[10px] font-semibold">
                        D{index + 1}
                      </text>
                      <text x="380" y={y + 41} textAnchor="middle" className="fill-zinc-600 text-[10px]">
                        {direction.autoScore}
                      </text>
                    </g>
                  );
                })}
              </svg>
              {selectedCell.directions.length > 0 ? (
                <div className="mt-2 space-y-1 text-xs text-zinc-600">
                  {selectedCell.directions.slice(0, 3).map((direction, index) => (
                    <p key={direction.directionId}>
                      D{index + 1}: {direction.directionTitle} ({getStatusLabel(direction.effectiveStatus)})
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-zinc-600">Keine verknuepfte Stossrichtung vorhanden.</p>
              )}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
