"use client";

import { SortableTableHeader } from "@/components/table/SortableTableHeader";
import { TableHorizontalScroll } from "@/components/table/TableHorizontalScroll";
import type { VisualizationNode } from "@/components/analysis-visualization/types";
import { compareSortKeys } from "@/lib/table/compare-sort-keys";
import { useMemo, useState } from "react";

type AnalysisTableViewProps = {
  nodes: VisualizationNode[];
  onSelectNode: (id: string) => void;
};

type SortCol =
  | "analysisType"
  | "subType"
  | "label"
  | "impact"
  | "uncertainty"
  | "qualityScore"
  | "zone"
  | "challengeMapped"
  | "directionCount";

function getAnalysisTypeLabel(type: string) {
  switch (type) {
    case "environment":
      return "Umfeld";
    case "company":
      return "Unternehmen";
    case "competitor":
      return "Wettbewerb";
    case "swot":
      return "SWOT";
    case "workshop":
      return "Workshop";
    default:
      return "Sonstige";
  }
}

function getPriorityZone(impact: number, uncertainty: number) {
  if (impact >= 4 && uncertainty >= 4) return "Priorit\u00E4t A";
  if (impact >= 4 || uncertainty >= 4) return "Beobachten";
  return "R\u00FCckstand";
}

function sortValueFor(node: VisualizationNode, col: SortCol) {
  switch (col) {
    case "analysisType":
      return getAnalysisTypeLabel(node.analysisType);
    case "subType":
      return node.subType ?? null;
    case "label":
      return node.label;
    case "impact":
      return node.impact;
    case "uncertainty":
      return node.uncertainty;
    case "qualityScore":
      return node.qualityScore;
    case "zone":
      return getPriorityZone(node.impact, node.uncertainty);
    case "challengeMapped":
      return node.challengeMapped ? 1 : 0;
    case "directionCount":
      return node.directionCount ?? 0;
    default:
      return null;
  }
}

export function AnalysisTableView({ nodes, onSelectNode }: AnalysisTableViewProps) {
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const requestSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const sortedNodes = useMemo(() => {
    if (!sortCol) return nodes;
    const mul = sortDir === "asc" ? 1 : -1;
    return [...nodes].sort(
      (a, b) => compareSortKeys(sortValueFor(a, sortCol), sortValueFor(b, sortCol)) * mul
    );
  }, [nodes, sortCol, sortDir]);

  const th = (col: SortCol, label: string, className = "px-2 py-2") => (
    <SortableTableHeader
      label={label}
      sortDirection={sortCol === col ? sortDir : null}
      onRequestSort={() => requestSort(col)}
      className={`${className} text-zinc-700`}
      buttonClassName="font-medium text-zinc-700 hover:bg-zinc-200/60 rounded px-0.5 -mx-0.5"
    />
  );

  return (
    <TableHorizontalScroll className="rounded-md bg-white">
      <table className="w-max min-w-full text-xs">
        <thead className="bg-zinc-50 text-zinc-700">
          <tr className="border-b border-zinc-200 text-left">
            {th("analysisType", "Analyse-Typ")}
            {th("subType", "Sub-Typ")}
            {th("label", "Titel")}
            {th("impact", "Wirkung")}
            {th("uncertainty", "Unsicherheit")}
            {th("qualityScore", "Qualitaet")}
            {th("zone", "Priorit\u00E4tszone")}
            {th("challengeMapped", "Herausforderung")}
            {th("directionCount", "Sto\u00DFrichtungen")}
          </tr>
        </thead>
        <tbody>
          {nodes.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-2 py-3 text-zinc-600">
                
                Keine Analysepunkte für die aktiven Filter.
              </td>
            </tr>
          ) : (
            sortedNodes.map((node) => (
              <tr
                key={node.id}
                className="cursor-pointer border-b border-zinc-100 align-top hover:bg-zinc-50"
                onClick={() => onSelectNode(node.id)}
              >
                <td className="px-2 py-2">{getAnalysisTypeLabel(node.analysisType)}</td>
                <td className="px-2 py-2">{node.subType ?? "-"}</td>
                <td className="px-2 py-2">{node.label}</td>
                <td className="px-2 py-2">{node.impact}/5</td>
                <td className="px-2 py-2">{node.uncertainty}/5</td>
                <td className="px-2 py-2">{node.qualityScore}</td>
                <td className="px-2 py-2">{getPriorityZone(node.impact, node.uncertainty)}</td>
                <td className="px-2 py-2">{node.challengeMapped ? "ja" : "offen"}</td>
                <td className="px-2 py-2">{node.directionCount ?? 0}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </TableHorizontalScroll>
  );
}
