"use client";

import { SortableTableHeader } from "@/components/table/SortableTableHeader";
import { TableHorizontalScroll } from "@/components/table/TableHorizontalScroll";
import type { OkrObjectiveView } from "@/lib/okr/okr-cycle-view-model";
import { compareSortKeys } from "@/lib/table/compare-sort-keys";
import type { ComponentProps } from "react";
import { useMemo, useState } from "react";
import { OkrProgressBar } from "./OkrProgressBar";
import { OkrStatusBadge } from "./OkrStatusBadge";

type SortCol =
  | "objective"
  | "kr"
  | "owner"
  | "status"
  | "progress"
  | "confidence"
  | "trend";

type FlatRow = {
  objectiveTitle: string;
  krTitle: string;
  owner: string | null;
  progress: number;
  confidence: string | null;
  trend: string;
  keyResultId: string;
  reviewStatus: ComponentProps<typeof OkrStatusBadge>["status"];
};

type Props = {
  objectiveViews: OkrObjectiveView[];
};

export function OkrKeyResultsTable({ objectiveViews }: Props) {
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const flatRows = useMemo((): FlatRow[] => {
    return objectiveViews.flatMap((ov) =>
      ov.keyResults.map((kv) => ({
        objectiveTitle: ov.objective.title,
        krTitle: kv.keyResult.title,
        owner: kv.effectiveOwnerDisplayName ?? null,
        progress: kv.progress,
        confidence: kv.confidenceLevel != null ? String(kv.confidenceLevel) : null,
        trend: kv.trend,
        keyResultId: kv.keyResult.id,
        reviewStatus: kv.reviewStatus,
      }))
    );
  }, [objectiveViews]);

  const requestSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortCol) return flatRows;
    const mul = sortDir === "asc" ? 1 : -1;
    return [...flatRows].sort((a, b) => {
      let va: string | number | null = null;
      let vb: string | number | null = null;
      switch (sortCol) {
        case "objective":
          va = a.objectiveTitle;
          vb = b.objectiveTitle;
          break;
        case "kr":
          va = a.krTitle;
          vb = b.krTitle;
          break;
        case "owner":
          va = a.owner ?? "";
          vb = b.owner ?? "";
          break;
        case "status":
          va = a.reviewStatus;
          vb = b.reviewStatus;
          break;
        case "progress":
          va = a.progress;
          vb = b.progress;
          break;
        case "confidence":
          va = a.confidence;
          vb = b.confidence;
          break;
        case "trend":
          va = a.trend;
          vb = b.trend;
          break;
        default:
          break;
      }
      return compareSortKeys(va, vb) * mul;
    });
  }, [flatRows, sortCol, sortDir]);

  const th = (col: SortCol, label: string, className: string) => (
    <SortableTableHeader
      label={label}
      sortDirection={sortCol === col ? sortDir : null}
      onRequestSort={() => requestSort(col)}
      className={className}
      buttonClassName="text-zinc-500 hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
    />
  );

  return (
    <TableHorizontalScroll className="mt-3">
      <table className="w-max min-w-[640px] border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-zinc-200 text-xs text-zinc-500">
          {th("objective", "OKR-Objective", "py-2 pr-2")}
          {th("kr", "Key Result", "py-2 pr-2")}
          {th("owner", "Owner", "py-2 pr-2")}
          {th("status", "Status", "py-2 pr-2")}
          {th("progress", "Progress", "py-2 pr-2")}
          {th("confidence", "Confidence", "py-2 pr-2")}
          {th("trend", "Trend", "py-2")}
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((row) => (
          <tr key={row.keyResultId} className="border-b border-zinc-100">
            <td className="py-2 pr-2 text-xs text-zinc-700">{row.objectiveTitle}</td>
            <td className="py-2 pr-2 font-medium text-zinc-900">{row.krTitle}</td>
            <td className="py-2 pr-2 text-xs">{row.owner ?? "—"}</td>
            <td className="py-2 pr-2">
              <OkrStatusBadge status={row.reviewStatus} />
            </td>
            <td className="py-2 pr-2">
              <div className="max-w-[120px]">
                <OkrProgressBar value={row.progress} />
              </div>
            </td>
            <td className="py-2 pr-2 text-xs">{row.confidence ?? "—"}</td>
            <td className="py-2 text-xs">{row.trend}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </TableHorizontalScroll>
  );
}
