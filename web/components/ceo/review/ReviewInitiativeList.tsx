"use client";

import { SortableTableHeader } from "@/components/table/SortableTableHeader";
import { compareSortKeys } from "@/lib/table/compare-sort-keys";
import { deriveInitiativeHealth } from "@/lib/review/initiative-health";
import type { ReviewStatus } from "@/lib/review/key-result-progress";
import type { ReviewCycleInitiativeInput } from "@/lib/review/review-cycle-view-model";
import { Fragment, useMemo, useState } from "react";
import { ReviewUpdatePanel } from "./ReviewUpdatePanel";
import {
  directionSourceLabelDe,
  formatDateDe,
  healthBadgeClass,
  healthLabelDe,
  initiativeStatusLabelDe,
} from "./review-ui";

const HEALTH_ORDER: Record<ReviewStatus, number> = {
  off_track: 0,
  at_risk: 1,
  on_track: 2,
};

type ReviewTableSortCol =
  | "title"
  | "direction"
  | "owner"
  | "status"
  | "weight"
  | "progress"
  | "due"
  | "health"
  | "review"
  | "source";

function directionSortLabel(
  row: ReviewCycleInitiativeInput,
  directionNameById: Record<string, string>
): string {
  if (
    row.directionId &&
    (row.resolvedDirectionSource === "program" || row.resolvedDirectionSource === "annual_target")
  ) {
    return directionNameById[row.directionId] ?? row.directionId;
  }
  return directionSourceLabelDe(row.resolvedDirectionSource);
}

type ReviewInitiativeListProps = {
  initiativeRows: ReviewCycleInitiativeInput[];
  directionNameById: Record<string, string>;
  canWrite: boolean;
};

export function ReviewInitiativeList({
  initiativeRows,
  directionNameById,
  canWrite,
}: ReviewInitiativeListProps) {
  const [directionFilter, setDirectionFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [ownerFilter, setOwnerFilter] = useState<string>("");
  const [programFilter, setProgramFilter] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<ReviewTableSortCol | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const directionOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const row of initiativeRows) {
      if (row.directionId) ids.add(row.directionId);
    }
    return [...ids].sort((a, b) =>
      (directionNameById[a] ?? a).localeCompare(directionNameById[b] ?? b, "de")
    );
  }, [initiativeRows, directionNameById]);

  const ownerOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of initiativeRows) {
      if (row.owner_membership_id && row.owner_display_name) {
        m.set(row.owner_membership_id, row.owner_display_name);
      }
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "de"));
  }, [initiativeRows]);

  const programOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of initiativeRows) {
      if (row.program_id && row.program_title) m.set(row.program_id, row.program_title);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "de"));
  }, [initiativeRows]);

  const filtered = useMemo(() => {
    return initiativeRows.filter((row) => {
      if (directionFilter && row.directionId !== directionFilter) return false;
      if (statusFilter && row.status !== statusFilter) return false;
      if (ownerFilter && row.owner_membership_id !== ownerFilter) return false;
      if (programFilter && row.program_id !== programFilter) return false;
      return true;
    });
  }, [initiativeRows, directionFilter, statusFilter, ownerFilter, programFilter]);

  const requestSort = (col: ReviewTableSortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const sortedFiltered = useMemo(() => {
    if (!sortCol) return filtered;
    const mul = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let va: string | number | null = null;
      let vb: string | number | null = null;
      switch (sortCol) {
        case "title":
          va = a.title;
          vb = b.title;
          break;
        case "direction":
          va = directionSortLabel(a, directionNameById);
          vb = directionSortLabel(b, directionNameById);
          break;
        case "owner":
          va = a.owner_display_name ?? "";
          vb = b.owner_display_name ?? "";
          break;
        case "status":
          va = a.status;
          vb = b.status;
          break;
        case "weight":
          va = a.weight;
          vb = b.weight;
          break;
        case "progress":
          va = a.progress_percent;
          vb = b.progress_percent;
          break;
        case "due":
          va = a.end_date ?? null;
          vb = b.end_date ?? null;
          break;
        case "health":
          va = HEALTH_ORDER[deriveInitiativeHealth(a)];
          vb = HEALTH_ORDER[deriveInitiativeHealth(b)];
          break;
        case "review":
          va = a.last_review_update_at ?? null;
          vb = b.last_review_update_at ?? null;
          break;
        case "source":
          va = a.resolvedDirectionSource;
          vb = b.resolvedDirectionSource;
          break;
        default:
          break;
      }
      return compareSortKeys(va, vb) * mul;
    });
  }, [filtered, sortCol, sortDir, directionNameById]);

  return (
    <section className="brand-card p-6">
      <h2 className="text-lg font-semibold text-zinc-900">Initiativen</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Operative Liste mit Gewichtung, Fortschritt und Review-Aktualitaet.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-zinc-600">
          Stossrichtung
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="">Alle</option>
            {directionOptions.map((id) => (
              <option key={id} value={id}>
                {directionNameById[id] ?? id}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-600">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="">Alle</option>
            {["draft", "planned", "active", "at_risk", "on_hold", "completed", "archived"].map((s) => (
              <option key={s} value={s}>
                {initiativeStatusLabelDe(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-600">
          Owner
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="">Alle</option>
            {ownerOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-600">
          Programm
          <select
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="">Alle</option>
            {programOptions.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[900px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
              <SortableTableHeader
                label="Titel"
                sortDirection={sortCol === "title" ? sortDir : null}
                onRequestSort={() => requestSort("title")}
                className="py-2 pr-3"
                buttonClassName="uppercase text-zinc-500 hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
              />
              <SortableTableHeader
                label="Stossrichtung"
                sortDirection={sortCol === "direction" ? sortDir : null}
                onRequestSort={() => requestSort("direction")}
                className="py-2 pr-3"
                buttonClassName="uppercase text-zinc-500 hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
              />
              <SortableTableHeader
                label="Owner"
                sortDirection={sortCol === "owner" ? sortDir : null}
                onRequestSort={() => requestSort("owner")}
                className="py-2 pr-3"
                buttonClassName="uppercase text-zinc-500 hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
              />
              <SortableTableHeader
                label="Status"
                sortDirection={sortCol === "status" ? sortDir : null}
                onRequestSort={() => requestSort("status")}
                className="py-2 pr-3"
                buttonClassName="uppercase text-zinc-500 hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
              />
              <SortableTableHeader
                label="Gew."
                sortDirection={sortCol === "weight" ? sortDir : null}
                onRequestSort={() => requestSort("weight")}
                className="py-2 pr-3"
                buttonClassName="uppercase text-zinc-500 hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
              />
              <SortableTableHeader
                label="Fortschritt"
                sortDirection={sortCol === "progress" ? sortDir : null}
                onRequestSort={() => requestSort("progress")}
                className="py-2 pr-3"
                buttonClassName="uppercase text-zinc-500 hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
              />
              <SortableTableHeader
                label="Fälligkeit"
                sortDirection={sortCol === "due" ? sortDir : null}
                onRequestSort={() => requestSort("due")}
                className="py-2 pr-3"
                buttonClassName="uppercase text-zinc-500 hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
              />
              <SortableTableHeader
                label="Risiko"
                sortDirection={sortCol === "health" ? sortDir : null}
                onRequestSort={() => requestSort("health")}
                className="py-2 pr-3"
                buttonClassName="uppercase text-zinc-500 hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
              />
              <SortableTableHeader
                label="Review"
                sortDirection={sortCol === "review" ? sortDir : null}
                onRequestSort={() => requestSort("review")}
                className="py-2 pr-3"
                buttonClassName="uppercase text-zinc-500 hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
              />
              <SortableTableHeader
                label="Herkunft"
                sortDirection={sortCol === "source" ? sortDir : null}
                onRequestSort={() => requestSort("source")}
                className="py-2"
                buttonClassName="uppercase text-zinc-500 hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
              />
            </tr>
          </thead>
          <tbody>
            {sortedFiltered.map((row) => {
              const h = deriveInitiativeHealth(row);
              const dirLabel = directionSortLabel(row, directionNameById);
              return (
                <Fragment key={row.id}>
                  <tr className="border-b border-zinc-100">
                    <td className="py-2 pr-3 font-medium text-zinc-900">
                      <button
                        type="button"
                        onClick={() => setExpandedId((x) => (x === row.id ? null : row.id))}
                        className="text-left hover:underline"
                      >
                        {row.title}
                      </button>
                    </td>
                    <td className="py-2 pr-3 text-zinc-700">{dirLabel}</td>
                    <td className="py-2 pr-3 text-zinc-700">{row.owner_display_name ?? "—"}</td>
                    <td className="py-2 pr-3">{initiativeStatusLabelDe(row.status)}</td>
                    <td className="py-2 pr-3">{row.weight}</td>
                    <td className="py-2 pr-3">{row.progress_percent}%</td>
                    <td className="py-2 pr-3">{formatDateDe(row.end_date)}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${healthBadgeClass(h)}`}>
                        {healthLabelDe(h)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-zinc-600">{formatDateDe(row.last_review_update_at)}</td>
                    <td className="py-2 text-xs text-zinc-500" title={row.resolvedDirectionSource}>
                      {directionSourceLabelDe(row.resolvedDirectionSource)}
                    </td>
                  </tr>
                  {expandedId === row.id ? (
                    <tr className="bg-zinc-50">
                      <td colSpan={10} className="p-4">
                        <ReviewUpdatePanel initiative={row} canWrite={canWrite} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">Keine Initiativen fuer die gewaehlten Filter.</p>
      ) : null}
    </section>
  );
}
