"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { TableHorizontalScroll } from "@/components/table/TableHorizontalScroll";
import type { OverviewDrillTable } from "@/lib/strategy-cycle/overview-drill-tables";

type DrillThroughModalProps = {
  open: boolean;
  title: string;
  drillTable?: OverviewDrillTable;
  emptyText?: string;
  href?: string;
  hrefLabel?: string;
  onClose: () => void;
  onBack?: () => void;
  backLabel?: string;
  titleId?: string;
  /** Ersetzt die Standard-Tabelle (z. B. Status-Hub). */
  children?: ReactNode;
};

export function DrillThroughModal({
  open,
  title,
  drillTable,
  emptyText = "Keine Einträge.",
  href,
  hrefLabel,
  onClose,
  onBack,
  backLabel = "Zurück",
  titleId = "drill-through-title",
  children,
}: DrillThroughModalProps) {
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  const rows = drillTable?.rows ?? [];
  const columns = drillTable?.columns ?? [];
  const showTable = Boolean(drillTable) && !children;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto overscroll-none bg-black/40 p-3 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className="max-h-[min(90vh,720px)] w-full max-w-4xl overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-zinc-100 bg-gradient-to-r from-zinc-50 to-indigo-50/40 px-4 py-3">
          <div className="min-w-0">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="mb-1 text-[11px] font-medium text-indigo-700 hover:underline"
              >
                ← {backLabel}
              </button>
            ) : null}
            <h2 id={titleId} className="text-sm font-semibold text-zinc-900">
              {title}
            </h2>
            {showTable ? (
              <p className="mt-0.5 text-[11px] text-zinc-600">
                {rows.length === 1 ? "1 Eintrag" : `${rows.length} Einträge`}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200/60"
          >
            Schließen
          </button>
        </div>

        <div className="max-h-[min(62vh,520px)] overflow-y-auto px-4 py-4">
          {children ? (
            children
          ) : showTable && rows.length === 0 ? (
            <p className="text-sm text-zinc-500">{emptyText}</p>
          ) : showTable ? (
            <TableHorizontalScroll bordered={false}>
              <table className="w-max min-w-full border-collapse text-xs">
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col.id}
                        className="border border-zinc-200 bg-zinc-50 px-2 py-2 text-left font-semibold text-zinc-700"
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-zinc-50/80">
                      {columns.map((col) => (
                        <td
                          key={col.id}
                          className={`border border-zinc-200 px-2 py-2 text-zinc-800 ${
                            col.id === "title" ? "min-w-[10rem] max-w-[18rem] font-medium" : "whitespace-nowrap"
                          }`}
                        >
                          {col.id === "title" && row.href ? (
                            <Link
                              href={row.href}
                              className="line-clamp-2 text-indigo-800 underline underline-offset-2 hover:text-indigo-950"
                              onClick={onClose}
                            >
                              {row.cells[col.id] ?? "—"}
                            </Link>
                          ) : (
                            <span className={col.id === "title" ? "line-clamp-2" : undefined}>
                              {row.cells[col.id] ?? "—"}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableHorizontalScroll>
          ) : (
            <p className="text-sm text-zinc-500">{emptyText}</p>
          )}
        </div>

        {href && hrefLabel ? (
          <div className="border-t border-zinc-100 px-4 py-3">
            <Link
              href={href}
              className="text-sm font-medium text-indigo-700 hover:underline"
              onClick={onClose}
            >
              {hrefLabel} →
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
