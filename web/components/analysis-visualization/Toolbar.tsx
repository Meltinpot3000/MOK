"use client";

import type { VisualizationViewMode } from "@/components/analysis-visualization/types";

type ToolbarProps = {
  viewMode: VisualizationViewMode;
  setViewMode: (mode: VisualizationViewMode) => void;
  showLabels: boolean;
  setShowLabels: (value: boolean) => void;
  showLinks: boolean;
  setShowLinks: (value: boolean) => void;
  showDensity: boolean;
  setShowDensity: (value: boolean) => void;
  showClusterLabels: boolean;
  setShowClusterLabels: (value: boolean) => void;
  showChallengeLayer: boolean;
  setShowChallengeLayer: (value: boolean) => void;
  showDirectionLayer: boolean;
  setShowDirectionLayer: (value: boolean) => void;
  linkScope: "approved" | "draft" | "both";
  setLinkScope: (value: "approved" | "draft" | "both") => void;
};

export function Toolbar({
  viewMode,
  setViewMode,
  showLabels,
  setShowLabels,
  showLinks,
  setShowLinks,
  showDensity,
  setShowDensity,
  showClusterLabels,
  setShowClusterLabels,
  showChallengeLayer,
  setShowChallengeLayer,
  showDirectionLayer,
  setShowDirectionLayer,
  linkScope,
  setLinkScope,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-2">
      <select
        value={viewMode}
        onChange={(event) => setViewMode(event.target.value as VisualizationViewMode)}
        className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs"
      >
        <option value="cluster">Clusteransicht</option>
        <option value="terrain">Strategische Terrainkarte</option>
        <option value="table">Tabellenansicht</option>
      </select>

      <label className="flex items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs">
        <input
          type="checkbox"
          checked={showLabels}
          onChange={(event) => setShowLabels(event.target.checked)}
        />
        Beschriftungen
      </label>
      <label className="flex items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs">
        <input
          type="checkbox"
          checked={showLinks}
          onChange={(event) => setShowLinks(event.target.checked)}
        />
        Verbindungen
      </label>
      <label className="flex items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs">
        <input type="checkbox" checked={showDensity} onChange={(event) => setShowDensity(event.target.checked)} />
        Dichte
      </label>
      <label className="flex items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs">
        <input
          type="checkbox"
          checked={showClusterLabels}
          onChange={(event) => setShowClusterLabels(event.target.checked)}
        />
        Cluster-Beschriftungen
      </label>
      <label className="flex items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs">
        <input
          type="checkbox"
          checked={showChallengeLayer}
          onChange={(event) => setShowChallengeLayer(event.target.checked)}
        />
        Herausforderungsebene
      </label>
      <label className="flex items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs">
        <input
          type="checkbox"
          checked={showDirectionLayer}
          onChange={(event) => setShowDirectionLayer(event.target.checked)}
        />
        
        Stoßrichtungsebene
      </label>
      <select
        value={linkScope}
        onChange={(event) => setLinkScope(event.target.value as "approved" | "draft" | "both")}
        className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs"
      >
        <option value="approved">Nur freigegebene</option>
        <option value="draft">Nur Entwürfe</option>
        <option value="both">Beide</option>
      </select>
    </div>
  );
}
