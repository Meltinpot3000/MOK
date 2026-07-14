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

type ImpactPathMatrixAuditProps = {
  canWrite: boolean;
  summary: CorrelationSummaryResult;
  isMutationPending?: boolean;
  onSaveOverride: (event: React.FormEvent<HTMLFormElement>) => void;
  onClearOverride: (event: React.FormEvent<HTMLFormElement>) => void;
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
  if (status === "green") return "Grün";
  if (status === "yellow") return "Gelb";
  if (status === "red") return "Rot";
  return "Unklar";
}

/** Audit-Ansicht: historische Passungsmatrix (nur via ?audit_matrix=1). */
export function ImpactPathMatrixAudit({
  canWrite,
  summary,
  isMutationPending = false,
  onSaveOverride,
  onClearOverride,
}: ImpactPathMatrixAuditProps) {
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
      return [...summary.challenges].sort((a, b) => a.title.localeCompare(b.title, "de") * mul);
    }
    const oid = matrixSort.objectiveId;
    const mul = matrixSort.dir === "asc" ? 1 : -1;
    return [...summary.challenges].sort((a, b) => {
      const sa = cellByPair.get(`${a.id}:${oid}`)?.score ?? null;
      const sb = cellByPair.get(`${b.id}:${oid}`)?.score ?? null;
      return compareSortKeys(sa, sb) * mul;
    });
  }, [summary.challenges, matrixSort, cellByPair]);

  return (
    <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
      <p className="text-sm text-amber-900">
        <span className="font-semibold">Audit-Modus.</span> Historische Passungsmatrix Herausforderung × Ziel —
        nicht Teil des Standard-Wirkpfad-Workflows.
      </p>

      <article className="brand-card p-6">
        <h3 className="text-base font-semibold text-zinc-900">Passungsmatrix (Audit)</h3>
        {summary.objectives.length === 0 || summary.challenges.length === 0 ? (
          <p className="mt-4 brand-surface p-3 text-sm text-zinc-600">
            Für diese Ansicht werden mindestens ein Ziel und eine Herausforderung benötigt.
          </p>
        ) : (
          <TableHorizontalScroll className="mt-4">
            <table className="w-max min-w-full border-collapse">
              <thead>
                <tr>
                  <th className="border border-zinc-200 bg-zinc-50 px-2 py-2 text-left text-xs font-semibold text-zinc-700">
                    <SortableColumnHeaderButton
                      label="Herausforderung"
                      sortDirection={matrixSort?.kind === "challenge_title" ? matrixSort.dir : null}
                      onRequestSort={() => {
                        setMatrixSort((prev) =>
                          prev?.kind === "challenge_title"
                            ? { kind: "challenge_title", dir: prev.dir === "asc" ? "desc" : "asc" }
                            : { kind: "challenge_title", dir: "asc" }
                        );
                      }}
                      buttonClassName="font-semibold text-zinc-700"
                    />
                  </th>
                  {summary.objectives.map((objective) => (
                    <th
                      key={objective.id}
                      className="border border-zinc-200 bg-zinc-50 px-2 py-2 text-left text-xs font-semibold text-zinc-700"
                    >
                      {objective.title}
                    </th>
                  ))}
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
                              isSelected ? "border-zinc-900 ring-1 ring-zinc-900" : getCellTone(cell.status)
                            }`}
                          >
                            <div className="font-semibold text-zinc-900">{cell.score}</div>
                            <div className="mt-1 text-zinc-600">{getStatusLabel(cell.status)}</div>
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

      {selectedCell ? (
        <article className="brand-card grid min-w-0 grid-cols-1 gap-4 p-6 xl:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold text-zinc-900">Zell-Detail (Audit)</h4>
            <p className="mt-2 text-sm text-zinc-700">
              {selectedCell.challengeTitle} → {selectedCell.objectiveTitle}
            </p>
            {selectedCell.directions.map((direction) => (
              <div key={direction.directionId} className="mt-3 rounded-md border border-zinc-200 p-3">
                <p className="text-sm font-medium">{direction.directionTitle}</p>
                <form onSubmit={onSaveOverride} className="mt-2 space-y-2">
                  <input type="hidden" name="challenge_id" value={selectedCell.challengeId} />
                  <input type="hidden" name="objective_id" value={selectedCell.objectiveId} />
                  <input type="hidden" name="strategic_direction_id" value={direction.directionId} />
                  <input type="hidden" name="return_to" value="/strategy-cycle?l1=strategic-directions&l2=summary&audit_matrix=1" />
                  <select
                    name="status"
                    defaultValue={direction.effectiveStatus}
                    disabled={!canWrite || isMutationPending}
                    className="w-full rounded-md border border-zinc-300 px-2 py-1 text-sm"
                  >
                    <option value="green">green</option>
                    <option value="yellow">yellow</option>
                    <option value="red">red</option>
                    <option value="unknown">unknown</option>
                  </select>
                  <button type="submit" disabled={!canWrite} className="brand-btn px-2 py-1 text-xs">
                    Override speichern
                  </button>
                </form>
                <form onSubmit={onClearOverride} className="mt-2">
                  <input type="hidden" name="challenge_id" value={selectedCell.challengeId} />
                  <input type="hidden" name="objective_id" value={selectedCell.objectiveId} />
                  <input type="hidden" name="strategic_direction_id" value={direction.directionId} />
                  <input type="hidden" name="return_to" value="/strategy-cycle?l1=strategic-directions&l2=summary&audit_matrix=1" />
                  <button
                    type="submit"
                    disabled={!canWrite || !direction.hasOverride}
                    className="brand-btn-secondary px-2 py-1 text-xs"
                  >
                    Override entfernen
                  </button>
                </form>
              </div>
            ))}
          </div>
          <FocusedCorrelationNetwork
            cell={selectedCell}
            getStatusLabel={getStatusLabel}
            getStatusBadge={getStatusBadge}
          />
        </article>
      ) : null}
    </div>
  );
}
