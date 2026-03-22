"use client";

import { SortableTableHeader } from "@/components/table/SortableTableHeader";
import {
  compareSortKeys,
  type SortPrimitive,
} from "@/lib/table/compare-sort-keys";
import { Fragment, useEffect, useMemo, useState } from "react";

export type ColumnDef<T> = {
  id: string;
  label: string;
  defaultVisible?: boolean;
  render: (row: T) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  /** Wenn gesetzt, ist die Spalte per Kopfzeile sortierbar. */
  sortValue?: (row: T) => SortPrimitive;
};

type ExpandableTableProps<T> = {
  columns: ColumnDef<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  renderExpandedContent: (row: T) => React.ReactNode;
  emptyMessage?: string;
  expandLabel?: string;
  /** Prefix for row id attribute (e.g. "entry-" for #entry-xxx anchors) */
  rowIdPrefix?: string;
  /** Zeile waehlen (Klick auf Datenzeile; +/- bleibt nur Aufklappen). */
  selectedRowId?: string | null;
  onDataRowClick?: (row: T) => void;
};

const PILL_BASE =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition";
/** Nicht verknuepft / zum Verknuepfen klickbar */
const PILL_NEUTRAL =
  "border-zinc-400 bg-zinc-100 text-zinc-800 shadow-sm hover:bg-zinc-200";
/** Verknuepft / hervorgehoben */
const PILL_LINKED =
  "border-emerald-400 bg-emerald-50 text-emerald-900 hover:bg-emerald-100";
/** Entfernen-Button */
const PILL_UNLINK =
  "border-red-300 bg-red-50 text-red-800 hover:bg-red-100";

export function pillNeutral(extra = "") {
  return `${PILL_BASE} ${PILL_NEUTRAL} ${extra}`.trim();
}

export function pillLinked(extra = "") {
  return `${PILL_BASE} ${PILL_LINKED} ${extra}`.trim();
}

export function pillUnlinkButton(extra = "") {
  return `${PILL_BASE} ${PILL_UNLINK} ${extra}`.trim();
}

export function ExpandableTable<T>({
  columns,
  rows,
  getRowId,
  renderExpandedContent,
  emptyMessage = "Keine Eintraege vorhanden.",
  expandLabel = "Details",
  rowIdPrefix,
  selectedRowId = null,
  onDataRowClick,
}: ExpandableTableProps<T>) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sortColumnId, setSortColumnId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    const s = new Set<string>();
    columns.forEach((c) => {
      if (c.defaultVisible !== false) s.add(c.id);
    });
    return s;
  });
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleColumn = (id: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleCols = columns.filter((c) => visibleColumns.has(c.id));

  useEffect(() => {
    if (sortColumnId && !visibleColumns.has(sortColumnId)) {
      setSortColumnId(null);
    }
  }, [sortColumnId, visibleColumns]);

  const sortedRows = useMemo(() => {
    if (!sortColumnId) return rows;
    const col = columns.find((c) => c.id === sortColumnId);
    if (!col?.sortValue) return rows;
    const mul = sortDir === "asc" ? 1 : -1;
    return [...rows].sort(
      (a, b) => compareSortKeys(col.sortValue!(a), col.sortValue!(b)) * mul
    );
  }, [rows, sortColumnId, sortDir, columns]);

  const requestSort = (columnId: string) => {
    const col = columns.find((c) => c.id === columnId);
    if (!col?.sortValue) return;
    if (sortColumnId === columnId) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumnId(columnId);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowColumnPicker((v) => !v)}
          className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
          title="Spalten ein-/ausblenden"
        >
          Spalten
        </button>
      </div>
      {showColumnPicker && (
        <div className="flex flex-wrap gap-2 rounded border border-zinc-200 bg-zinc-50 p-2">
          {columns.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={visibleColumns.has(c.id)}
                onChange={() => toggleColumn(c.id)}
                className="rounded border-zinc-300"
              />
              {c.label}
            </label>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-zinc-200">
          <thead>
            <tr className="bg-zinc-50">
              <th className="w-10 border border-zinc-200 px-2 py-2 text-left text-xs font-semibold text-zinc-700" />
              {visibleCols.map((col) =>
                col.sortValue ? (
                  <SortableTableHeader
                    key={col.id}
                    label={col.label}
                    sortDirection={
                      sortColumnId === col.id ? sortDir : null
                    }
                    onRequestSort={() => requestSort(col.id)}
                    className={`border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 ${col.headerClassName ?? ""}`}
                    buttonClassName="font-semibold text-zinc-700 hover:bg-zinc-100/80 rounded px-0.5 -mx-0.5"
                  />
                ) : (
                  <th
                    key={col.id}
                    className={`border border-zinc-200 px-3 py-2 text-left text-xs font-semibold text-zinc-700 ${col.headerClassName ?? ""}`}
                  >
                    {col.label}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleCols.length + 1}
                  className="border border-zinc-200 px-3 py-4 text-center text-sm text-zinc-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => {
                const id = getRowId(row);
                const isExpanded = expandedIds.has(id);
                const isSelected = selectedRowId != null && selectedRowId === id;
                return (
                  <Fragment key={id}>
                    <tr
                      key={id}
                      id={rowIdPrefix ? `${rowIdPrefix}${id}` : undefined}
                      onClick={() => onDataRowClick?.(row)}
                      className={`border-b border-zinc-200 ${
                        isSelected
                          ? "bg-sky-50/80 hover:bg-sky-50/90"
                          : "bg-white hover:bg-zinc-50/50"
                      } ${onDataRowClick ? "cursor-pointer" : ""}`}
                    >
                      <td className="border border-zinc-200 px-2 py-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(id);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"
                          title={isExpanded ? "Zuklappen" : expandLabel}
                        >
                          {isExpanded ? "−" : "+"}
                        </button>
                      </td>
                      {visibleCols.map((col) => (
                        <td
                          key={col.id}
                          className={`border border-zinc-200 px-3 py-2 text-xs text-zinc-800 ${col.cellClassName ?? ""}`}
                        >
                          {col.render(row)}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td
                          colSpan={visibleCols.length + 1}
                          className="border border-zinc-200 bg-zinc-50/50 p-4"
                        >
                          {renderExpandedContent(row)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
