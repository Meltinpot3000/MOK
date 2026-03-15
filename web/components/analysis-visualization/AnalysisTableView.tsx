"use client";

import type { VisualizationNode } from "@/components/analysis-visualization/types";

type AnalysisTableViewProps = {
  nodes: VisualizationNode[];
  onSelectNode: (id: string) => void;
};

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
  if (impact >= 4 && uncertainty >= 4) return "Prioritaet A";
  if (impact >= 4 || uncertainty >= 4) return "Beobachten";
  return "Backlog";
}

export function AnalysisTableView({ nodes, onSelectNode }: AnalysisTableViewProps) {
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
      <table className="min-w-full text-xs">
        <thead className="bg-zinc-50 text-zinc-700">
          <tr className="border-b border-zinc-200 text-left">
            <th className="px-2 py-2">Analyse-Typ</th>
            <th className="px-2 py-2">Sub-Typ</th>
            <th className="px-2 py-2">Titel</th>
            <th className="px-2 py-2">Impact</th>
            <th className="px-2 py-2">Unsicherheit</th>
            <th className="px-2 py-2">Quality</th>
            <th className="px-2 py-2">Priority Zone</th>
            <th className="px-2 py-2">Challenge</th>
            <th className="px-2 py-2">Directions</th>
          </tr>
        </thead>
        <tbody>
          {nodes.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-2 py-3 text-zinc-600">
                Keine Analysepunkte fuer die aktiven Filter.
              </td>
            </tr>
          ) : (
            nodes.map((node) => (
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
    </div>
  );
}
