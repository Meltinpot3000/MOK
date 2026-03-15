"use client";

import { useEffect, useMemo, useState } from "react";
import { AnalysisTableView } from "@/components/analysis-visualization/AnalysisTableView";
import { DetailPanel } from "@/components/analysis-visualization/DetailPanel";
import { FilterPanel } from "@/components/analysis-visualization/FilterPanel";
import { GraphCanvas2D } from "@/components/analysis-visualization/GraphCanvas2D";
import { GraphCanvas3D } from "@/components/analysis-visualization/GraphCanvas3D";
import { TerrainMap2D } from "@/components/analysis-visualization/TerrainMap2D";
import { Toolbar } from "@/components/analysis-visualization/Toolbar";
import type {
  PositionedNode,
  VisualizationEdge,
  VisualizationNode,
  VisualizationViewMode,
} from "@/components/analysis-visualization/types";

type AnalysisVisualizationWorkspaceProps = {
  entries: Array<{
    id: string;
    analysis_type: string;
    sub_type: string | null;
    title: string;
    description: string | null;
    impact_level: number | null;
    uncertainty_level: number | null;
    qualityScore: number;
  }>;
  approvedLinks: Array<{
    id: string;
    source_analysis_item_id: string;
    target_analysis_item_id: string;
    link_type: string;
    strength: number;
    confidence: number;
    comment: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    metadata?: Record<string, unknown> | null;
  }>;
  linkDrafts: Array<{
    id: string;
    source_analysis_item_id: string;
    target_analysis_item_id: string;
    link_type: string;
    strength: number;
    confidence: number;
    comment: string | null;
    metadata?: Record<string, unknown> | null;
  }>;
  clusters: Array<{ id: string; label: string; cluster_score: number }>;
  clusterMembers: Array<{ cluster_id: string; entry_id: string }>;
  entryDimensions: Record<
    string,
    {
      industries: Array<{ id: string; name: string }>;
      businessModels: Array<{ id: string; name: string }>;
      operatingModels: Array<{ id: string; name: string }>;
    }
  >;
  availableDimensions: {
    industries: Array<{ id: string; name: string }>;
    businessModels: Array<{ id: string; name: string }>;
    operatingModels: Array<{ id: string; name: string }>;
  };
  promotedEntryIds: string[];
  entryDirectionIdsByEntryId: Record<string, string[]>;
  strategicDirections: Array<{ id: string; title: string }>;
  canWrite: boolean;
};

function hashToUnit(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return ((hash >>> 0) % 1000) / 1000;
}

function bucketX(analysisType: string): number {
  switch (analysisType) {
    case "environment":
      return -230;
    case "competitor":
      return -110;
    case "company":
      return 40;
    case "swot":
      return 160;
    case "workshop":
      return 260;
    default:
      return 0;
  }
}

function normalizeHistory(raw: unknown): VisualizationEdge["history"] {
  if (!Array.isArray(raw)) return [];
  const parsed: NonNullable<VisualizationEdge["history"]> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const prev = (row.previous as Record<string, unknown> | undefined) ?? {};
    const next = (row.next as Record<string, unknown> | undefined) ?? {};
    parsed.push({
      at: String(row.at ?? ""),
      byMembershipId: row.by_membership_id == null ? null : String(row.by_membership_id),
      previous: {
        linkType: String(prev.link_type ?? prev.linkType ?? "related_to"),
        strength: Number(prev.strength ?? 3),
        comment: prev.comment == null ? null : String(prev.comment),
      },
      next: {
        linkType: String(next.link_type ?? next.linkType ?? "related_to"),
        strength: Number(next.strength ?? 3),
        comment: next.comment == null ? null : String(next.comment),
      },
    });
  }
  return parsed;
}

function normalizeTriScores(raw: unknown): VisualizationEdge["triScores"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as Record<string, unknown>;
  const proximityScore = Number(row.proximityScore ?? 0);
  const supportScore = Number(row.supportScore ?? 0);
  const repulsionScore = Number(row.repulsionScore ?? 0);
  if (!Number.isFinite(proximityScore) || !Number.isFinite(supportScore) || !Number.isFinite(repulsionScore)) {
    return undefined;
  }
  return {
    proximityScore: Math.max(0, Math.min(1, proximityScore)),
    supportScore: Math.max(0, Math.min(1, supportScore)),
    repulsionScore: Math.max(0, Math.min(1, repulsionScore)),
  };
}

function fallbackTriScoresFromEdge(edge: VisualizationEdge): NonNullable<VisualizationEdge["triScores"]> {
  if (edge.triScores) return edge.triScores;
  const proximityBase = Math.max(0, Math.min(1, edge.confidence));
  let supportScore = 0.3;
  let repulsionScore = 0.2;
  if (edge.linkType === "supports" || edge.linkType === "amplifies") supportScore = 0.7;
  if (edge.linkType === "contradicts") repulsionScore = 0.75;
  if (edge.linkType === "duplicates") supportScore = 0.8;
  return {
    proximityScore: proximityBase,
    supportScore: Math.max(0, Math.min(1, supportScore)),
    repulsionScore: Math.max(0, Math.min(1, repulsionScore)),
  };
}

function buildForceLayout(nodes: VisualizationNode[], edges: VisualizationEdge[]): PositionedNode[] {
  const positioned = nodes.map((node) => ({
    ...node,
    x: bucketX(node.analysisType) + (hashToUnit(node.id) - 0.5) * 120,
    y: (3 - node.impact) * 80 + (hashToUnit(`${node.id}-y`) - 0.5) * 160,
    z: 0,
  }));
  const idxById = new Map(positioned.map((node, idx) => [node.id, idx]));
  const linkPairs = edges
    .map((edge) => {
      const a = idxById.get(edge.source);
      const b = idxById.get(edge.target);
      if (a === undefined || b === undefined) return null;
      return { a, b, strength: edge.strength };
    })
    .filter((item): item is { a: number; b: number; strength: number } => Boolean(item));

  const area = 1100 * 640;
  const k = Math.sqrt(area / Math.max(positioned.length, 1));
  for (let iter = 0; iter < 110; iter += 1) {
    const dx = new Array(positioned.length).fill(0);
    const dy = new Array(positioned.length).fill(0);

    for (let i = 0; i < positioned.length; i += 1) {
      for (let j = i + 1; j < positioned.length; j += 1) {
        const vx = positioned[i].x - positioned[j].x;
        const vy = positioned[i].y - positioned[j].y;
        const dist = Math.max(1, Math.hypot(vx, vy));
        const force = (k * k) / dist;
        const ux = vx / dist;
        const uy = vy / dist;
        dx[i] += ux * force;
        dy[i] += uy * force;
        dx[j] -= ux * force;
        dy[j] -= uy * force;
      }
    }

    for (const pair of linkPairs) {
      const source = positioned[pair.a];
      const target = positioned[pair.b];
      const vx = source.x - target.x;
      const vy = source.y - target.y;
      const dist = Math.max(1, Math.hypot(vx, vy));
      const desired = 120 - pair.strength * 10;
      const force = ((dist - desired) * 0.13);
      const ux = vx / dist;
      const uy = vy / dist;
      dx[pair.a] -= ux * force;
      dy[pair.a] -= uy * force;
      dx[pair.b] += ux * force;
      dy[pair.b] += uy * force;
    }

    for (let i = 0; i < positioned.length; i += 1) {
      positioned[i].x = Math.max(-480, Math.min(480, positioned[i].x + dx[i] * 0.012));
      positioned[i].y = Math.max(-290, Math.min(290, positioned[i].y + dy[i] * 0.012));
    }
  }

  return positioned;
}

function buildClusterLayout(nodes: VisualizationNode[]): PositionedNode[] {
  const clusterBuckets = new Map<string, VisualizationNode[]>();
  for (const node of nodes) {
    const key = node.clusterId ?? "isolated";
    const list = clusterBuckets.get(key) ?? [];
    list.push(node);
    clusterBuckets.set(key, list);
  }
  const keys = [...clusterBuckets.keys()];
  return nodes.map((node) => {
    const key = node.clusterId ?? "isolated";
    const clusterIdx = keys.indexOf(key);
    const clusterCenterX = -350 + (clusterIdx % 4) * 230;
    const clusterCenterY = -170 + Math.floor(clusterIdx / 4) * 180;
    const localSeed = hashToUnit(node.id);
    return {
      ...node,
      x: clusterCenterX + (localSeed - 0.5) * 90,
      y: clusterCenterY + (hashToUnit(`${node.id}-c`) - 0.5) * 90,
      z: 0,
    };
  });
}

function buildTerrainLayout(nodes: VisualizationNode[]): PositionedNode[] {
  return nodes.map((node) => {
    const externalWeight =
      node.analysisType === "environment" || node.analysisType === "competitor"
        ? 1
        : node.analysisType === "other"
          ? 0.15
          : -1;
    const strategicWeight = ((node.impact - 3) * 0.72 + (node.uncertainty - 3) * 0.38);
    return {
      ...node,
      x: externalWeight * 220 + (hashToUnit(node.id) - 0.5) * 170,
      y: -(strategicWeight * 70) + (hashToUnit(`${node.id}-terrain-y`) - 0.5) * 90,
      z: 0,
    };
  });
}

export function AnalysisVisualizationWorkspace({
  entries,
  approvedLinks,
  linkDrafts,
  clusters,
  clusterMembers,
  entryDimensions,
  availableDimensions,
  promotedEntryIds,
  entryDirectionIdsByEntryId,
  strategicDirections,
  canWrite,
}: AnalysisVisualizationWorkspaceProps) {
  const [viewMode, setViewMode] = useState<VisualizationViewMode>("constellation");
  const [showLabels, setShowLabels] = useState(true);
  const [showLinks, setShowLinks] = useState(true);
  const [is3D, setIs3D] = useState(false);
  const [showDensity, setShowDensity] = useState(true);
  const [showClusterLabels, setShowClusterLabels] = useState(true);
  const [showChallengeLayer, setShowChallengeLayer] = useState(true);
  const [showDirectionLayer, setShowDirectionLayer] = useState(true);
  const [linkScope, setLinkScope] = useState<"approved" | "draft" | "both">("both");
  const [analysisTypeFilter, setAnalysisTypeFilter] = useState("all");
  const [minImpact, setMinImpact] = useState(1);
  const [minConfidence, setMinConfidence] = useState(25);
  const [minProximity, setMinProximity] = useState(0);
  const [minSupport, setMinSupport] = useState(0);
  const [minRepulsion, setMinRepulsion] = useState(0);
  const [linkTypeFilter, setLinkTypeFilter] = useState("all");
  const [selectedIndustryIds, setSelectedIndustryIds] = useState<string[]>([]);
  const [selectedBusinessModelIds, setSelectedBusinessModelIds] = useState<string[]>([]);
  const [selectedOperatingModelIds, setSelectedOperatingModelIds] = useState<string[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [overlayAnchor, setOverlayAnchor] = useState<{ x: number; y: number } | null>(null);
  const [undoCandidate, setUndoCandidate] = useState<VisualizationEdge | null>(null);

  const clusterIdByEntryId = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of clusterMembers) {
      map.set(member.entry_id, member.cluster_id);
    }
    return map;
  }, [clusterMembers]);
  const clusterLabelById = useMemo(
    () => new Map(clusters.map((cluster) => [cluster.id, cluster.label])),
    [clusters]
  );

  const graphNodes = useMemo<VisualizationNode[]>(
    () =>
      entries.map((entry) => {
        const dimensions = entryDimensions[entry.id] ?? {
          industries: [],
          businessModels: [],
          operatingModels: [],
        };
        const clusterId = clusterIdByEntryId.get(entry.id) ?? null;
        return {
          id: entry.id,
          label: entry.title,
          analysisType: entry.analysis_type,
          subType: entry.sub_type,
          impact: entry.impact_level ?? 3,
          uncertainty: entry.uncertainty_level ?? 3,
          qualityScore: entry.qualityScore,
          description: entry.description,
          industries: dimensions.industries,
          businessModels: dimensions.businessModels,
          operatingModels: dimensions.operatingModels,
          clusterId,
          clusterLabel: clusterId ? clusterLabelById.get(clusterId) ?? null : null,
          directionCount: (entryDirectionIdsByEntryId[entry.id] ?? []).length,
          challengeMapped: promotedEntryIds.includes(entry.id),
        };
      }),
    [entries, entryDimensions, clusterIdByEntryId, clusterLabelById, entryDirectionIdsByEntryId, promotedEntryIds]
  );

  const graphEdges = useMemo<VisualizationEdge[]>(() => {
    const mappedApproved = approvedLinks.map((link) => ({
        id: link.id,
        source: link.source_analysis_item_id,
        target: link.target_analysis_item_id,
        linkType: link.link_type,
        strength: link.strength,
        confidence: Number(link.confidence ?? 0),
        comment: link.comment,
        triScores:
          link.metadata && typeof link.metadata === "object"
            ? normalizeTriScores((link.metadata as Record<string, unknown>).triScores)
            : undefined,
        createdAt: link.created_at ?? null,
        updatedAt: link.updated_at ?? null,
        history:
          link.metadata && typeof link.metadata === "object"
            ? normalizeHistory((link.metadata as Record<string, unknown>).change_log)
            : [],
        isDraft: false,
      }));
    const mappedDrafts = linkDrafts.map((link) => ({
      id: `draft-${link.id}`,
      source: link.source_analysis_item_id,
      target: link.target_analysis_item_id,
      linkType: link.link_type,
      strength: link.strength,
      confidence: Number(link.confidence ?? 0),
      comment: link.comment,
      triScores:
        link.metadata && typeof link.metadata === "object"
          ? normalizeTriScores((link.metadata as Record<string, unknown>).triScores)
          : undefined,
      createdAt: null,
      updatedAt: null,
      history: [],
      isDraft: true,
    }));
    if (linkScope === "approved") return mappedApproved;
    if (linkScope === "draft") return mappedDrafts;
    return [...mappedApproved, ...mappedDrafts];
  }, [approvedLinks, linkDrafts, linkScope]);
  const [liveEdges, setLiveEdges] = useState<VisualizationEdge[]>(graphEdges);
  useEffect(() => {
    setLiveEdges(graphEdges);
  }, [graphEdges]);

  const filteredNodeIds = useMemo(() => {
    const passIndustry = (node: VisualizationNode) =>
      selectedIndustryIds.length === 0 ||
      node.industries.some((industry) => selectedIndustryIds.includes(industry.id));
    const passBusinessModel = (node: VisualizationNode) =>
      selectedBusinessModelIds.length === 0 ||
      node.businessModels.some((model) => selectedBusinessModelIds.includes(model.id));
    const passOperatingModel = (node: VisualizationNode) =>
      selectedOperatingModelIds.length === 0 ||
      node.operatingModels.some((model) => selectedOperatingModelIds.includes(model.id));
    const ids = graphNodes
      .filter((node) => (analysisTypeFilter === "all" ? true : node.analysisType === analysisTypeFilter))
      .filter((node) => node.impact >= minImpact)
      .filter(passIndustry)
      .filter(passBusinessModel)
      .filter(passOperatingModel)
      .map((node) => node.id);
    return new Set(ids);
  }, [
    analysisTypeFilter,
    graphNodes,
    minImpact,
    selectedIndustryIds,
    selectedBusinessModelIds,
    selectedOperatingModelIds,
  ]);

  const filteredEdges = useMemo(
    () =>
      liveEdges
        .filter((edge) => filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target))
        .filter((edge) => edge.confidence * 100 >= minConfidence)
        .filter((edge) => fallbackTriScoresFromEdge(edge).proximityScore * 100 >= minProximity)
        .filter((edge) => fallbackTriScoresFromEdge(edge).supportScore * 100 >= minSupport)
        .filter((edge) => fallbackTriScoresFromEdge(edge).repulsionScore * 100 >= minRepulsion)
        .filter((edge) => (linkTypeFilter === "all" ? true : edge.linkType === linkTypeFilter)),
    [filteredNodeIds, liveEdges, minConfidence, minProximity, minSupport, minRepulsion, linkTypeFilter]
  );
  const filteredNodes = useMemo(
    () => graphNodes.filter((node) => filteredNodeIds.has(node.id)),
    [graphNodes, filteredNodeIds]
  );

  const positionedNodes = useMemo<PositionedNode[]>(() => {
    const base =
      viewMode === "cluster"
        ? buildClusterLayout(filteredNodes)
        : viewMode === "terrain"
          ? buildTerrainLayout(filteredNodes)
          : buildForceLayout(filteredNodes, filteredEdges);
    return base.map((node) => {
      const internalExternal =
        node.analysisType === "company" || node.analysisType === "swot" ? -120 : 120;
      const horizon =
        node.analysisType === "environment" || node.analysisType === "competitor" ? 90 : -70;
      return {
        ...node,
        z: horizon + internalExternal * 0.25 + (hashToUnit(`${node.id}-z`) - 0.5) * 80,
      };
    });
  }, [filteredNodes, filteredEdges, viewMode]);

  const selectedNode = useMemo(
    () => positionedNodes.find((node) => node.id === selectedNodeId) ?? null,
    [positionedNodes, selectedNodeId]
  );
  const selectedEdge = useMemo(
    () => filteredEdges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [filteredEdges, selectedEdgeId]
  );
  const incomingEdgeCount = selectedNode
    ? filteredEdges.filter((edge) => edge.target === selectedNode.id).length
    : 0;
  const outgoingEdgeCount = selectedNode
    ? filteredEdges.filter((edge) => edge.source === selectedNode.id).length
    : 0;
  const challengeMapped = selectedNode ? promotedEntryIds.includes(selectedNode.id) : false;

  function handleSelectNode(id: string, anchor: { x: number; y: number }) {
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
    setOverlayAnchor(anchor);
  }

  function handleSelectEdge(id: string, anchor: { x: number; y: number }) {
    setSelectedEdgeId(id);
    setSelectedNodeId(null);
    setOverlayAnchor(anchor);
  }

  function handleSelectNodeFromTable(id: string) {
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
    setOverlayAnchor(null);
  }

  async function updateEdge(payload: { id: string; linkType: string; strength: number; comment: string }) {
    if (payload.id.startsWith("draft-")) {
      throw new Error("draft_edge_not_editable_here");
    }
    const response = await fetch(`/api/analysis-item-link/${payload.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error("update_failed");
    }
    const data = (await response.json()) as {
      edge: {
        id: string;
        linkType: string;
        strength: number;
        comment: string | null;
        triScores?: unknown;
        createdAt?: string | null;
        updatedAt?: string | null;
        history?: unknown[];
      };
    };
    setLiveEdges((prev) =>
      prev.map((edge) =>
        edge.id === data.edge.id
          ? {
              ...edge,
              linkType: data.edge.linkType,
              strength: data.edge.strength,
              comment: data.edge.comment,
              triScores: normalizeTriScores(data.edge.triScores) ?? edge.triScores,
              createdAt: data.edge.createdAt ?? edge.createdAt ?? null,
              updatedAt: data.edge.updatedAt ?? edge.updatedAt ?? null,
              history: Array.isArray(data.edge.history)
                ? (data.edge.history as VisualizationEdge["history"])
                : edge.history ?? [],
            }
          : edge
      )
    );
  }

  async function deleteEdge(edge: VisualizationEdge) {
    if (edge.isDraft) {
      throw new Error("draft_edge_not_deletable_here");
    }
    const response = await fetch(`/api/analysis-item-link/${edge.id}`, { method: "DELETE" });
    if (!response.ok) {
      throw new Error("delete_failed");
    }
    setLiveEdges((prev) => prev.filter((item) => item.id !== edge.id));
    if (selectedEdgeId === edge.id) setSelectedEdgeId(null);
    setUndoCandidate(edge);
    window.setTimeout(() => {
      setUndoCandidate((current) => (current?.id === edge.id ? null : current));
    }, 10000);
  }

  async function restoreEdge() {
    if (!undoCandidate) return;
    const response = await fetch("/api/analysis-item-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceAnalysisItemId: undoCandidate.source,
        targetAnalysisItemId: undoCandidate.target,
        linkType: undoCandidate.linkType,
        strength: undoCandidate.strength,
        confidence: undoCandidate.confidence,
        comment: undoCandidate.comment,
        triScores: undoCandidate.triScores ?? null,
      }),
    });
    if (!response.ok) {
      throw new Error("restore_failed");
    }
    const data = (await response.json()) as {
      edge: {
        id: string;
        source: string;
        target: string;
        linkType: string;
        strength: number;
        confidence: number;
        comment: string | null;
        triScores?: unknown;
        createdAt?: string | null;
        updatedAt?: string | null;
        history?: unknown[];
      };
    };
    setLiveEdges((prev) => [
      ...prev.filter((edge) => edge.id !== data.edge.id),
      {
        id: data.edge.id,
        source: data.edge.source,
        target: data.edge.target,
        linkType: data.edge.linkType,
        strength: data.edge.strength,
        confidence: data.edge.confidence,
        comment: data.edge.comment,
        triScores: normalizeTriScores(data.edge.triScores),
        createdAt: data.edge.createdAt ?? null,
        updatedAt: data.edge.updatedAt ?? null,
        history: Array.isArray(data.edge.history)
          ? (data.edge.history as VisualizationEdge["history"])
          : [],
      },
    ]);
    setUndoCandidate(null);
  }

  return (
    <section className="brand-card p-6">
      <h2 className="text-lg font-semibold text-zinc-900">Analysis Visualization</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Explorative Netzwerkansicht mit Cluster-, Einfluss- und optionalem 3D-Explore-Modus.
      </p>
      <div className="mt-3">
        <Toolbar
          viewMode={viewMode}
          setViewMode={setViewMode}
          showLabels={showLabels}
          setShowLabels={setShowLabels}
          showLinks={showLinks}
          setShowLinks={setShowLinks}
          is3D={is3D}
          setIs3D={setIs3D}
          showDensity={showDensity}
          setShowDensity={setShowDensity}
          showClusterLabels={showClusterLabels}
          setShowClusterLabels={setShowClusterLabels}
          showChallengeLayer={showChallengeLayer}
          setShowChallengeLayer={setShowChallengeLayer}
          showDirectionLayer={showDirectionLayer}
          setShowDirectionLayer={setShowDirectionLayer}
          linkScope={linkScope}
          setLinkScope={setLinkScope}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
        <span className="font-medium text-zinc-700">Legende:</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-sky-500" />Umfeld</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-violet-500" />Unternehmen</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Wettbewerb</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />SWOT</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />Workshop</span>
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-slate-500" />Sonstige</span>
        <span className="ml-2 rounded border border-zinc-300 bg-white px-2 py-0.5">
          Verbindungen sichtbar: {filteredEdges.length}
        </span>
        <span className="rounded border border-zinc-300 bg-white px-2 py-0.5">
          Scope: {linkScope === "approved" ? "freigegeben" : linkScope === "draft" ? "draft" : "beide"}
        </span>
      </div>
      {undoCandidate ? (
        <div className="mt-3 flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span>Verbindung geloescht: {undoCandidate.linkType}</span>
          <button
            type="button"
            onClick={() => {
              void restoreEdge();
            }}
            className="rounded border border-amber-400 bg-white px-2 py-1 text-xs"
          >
            Undo
          </button>
        </div>
      ) : null}
      <div className="mt-4 space-y-3">
        <FilterPanel
          analysisTypeFilter={analysisTypeFilter}
          setAnalysisTypeFilter={setAnalysisTypeFilter}
          minImpact={minImpact}
          setMinImpact={setMinImpact}
          minConfidence={minConfidence}
          setMinConfidence={setMinConfidence}
          minProximity={minProximity}
          setMinProximity={setMinProximity}
          minSupport={minSupport}
          setMinSupport={setMinSupport}
          minRepulsion={minRepulsion}
          setMinRepulsion={setMinRepulsion}
          linkTypeFilter={linkTypeFilter}
          setLinkTypeFilter={setLinkTypeFilter}
          selectedIndustryIds={selectedIndustryIds}
          setSelectedIndustryIds={setSelectedIndustryIds}
          selectedBusinessModelIds={selectedBusinessModelIds}
          setSelectedBusinessModelIds={setSelectedBusinessModelIds}
          selectedOperatingModelIds={selectedOperatingModelIds}
          setSelectedOperatingModelIds={setSelectedOperatingModelIds}
          industries={availableDimensions.industries}
          businessModels={availableDimensions.businessModels}
          operatingModels={availableDimensions.operatingModels}
        />

        <div className="-mx-6 relative">
          {viewMode === "table" ? (
            <div className="px-6">
              <AnalysisTableView nodes={filteredNodes} onSelectNode={handleSelectNodeFromTable} />
            </div>
          ) : viewMode === "terrain" ? (
            <TerrainMap2D
              nodes={positionedNodes}
              edges={filteredEdges}
              showLabels={showLabels}
              showLinks={showLinks}
              showDensity={showDensity}
              showClusterLabels={showClusterLabels}
              showChallengeLayer={showChallengeLayer}
              showDirectionLayer={showDirectionLayer}
              selectedNodeId={selectedNodeId}
              selectedEdgeId={selectedEdgeId}
              setSelectedNodeId={setSelectedNodeId}
              setSelectedEdgeId={setSelectedEdgeId}
              onSelectNode={handleSelectNode}
              onSelectEdge={handleSelectEdge}
            />
          ) : is3D ? (
            <GraphCanvas3D
              nodes={positionedNodes}
              edges={filteredEdges}
              showLabels={showLabels}
              showLinks={showLinks}
              selectedNodeId={selectedNodeId}
              selectedEdgeId={selectedEdgeId}
              setSelectedNodeId={setSelectedNodeId}
              setSelectedEdgeId={setSelectedEdgeId}
              onSelectNode={handleSelectNode}
              onSelectEdge={handleSelectEdge}
            />
          ) : (
            <GraphCanvas2D
              nodes={positionedNodes}
              edges={filteredEdges}
              viewMode={viewMode}
              showLabels={showLabels}
              showLinks={showLinks}
              selectedNodeId={selectedNodeId}
              selectedEdgeId={selectedEdgeId}
              setSelectedNodeId={setSelectedNodeId}
              setSelectedEdgeId={setSelectedEdgeId}
              onSelectNode={handleSelectNode}
              onSelectEdge={handleSelectEdge}
            />
          )}
          {(selectedNode || selectedEdge) && overlayAnchor && viewMode !== "table" ? (
            <div
              className="pointer-events-none absolute z-20"
              style={{
                left: Math.max(8, overlayAnchor.x + 12),
                top: Math.max(8, overlayAnchor.y + 12),
              }}
            >
              <div className="pointer-events-auto">
                <DetailPanel
                  mode="overlay"
                  onClose={() => {
                    setSelectedNodeId(null);
                    setSelectedEdgeId(null);
                    setOverlayAnchor(null);
                  }}
                  selectedNode={selectedNode}
                  selectedEdge={selectedEdge}
                  incomingEdgeCount={incomingEdgeCount}
                  outgoingEdgeCount={outgoingEdgeCount}
                  challengeMapped={challengeMapped}
                  canWrite={canWrite}
                  onUpdateEdge={updateEdge}
                  onDeleteEdge={deleteEdge}
                />
              </div>
            </div>
          ) : null}
        </div>
        {viewMode === "table" && selectedNode ? (
          <div className="px-6">
            <DetailPanel
              mode="panel"
              selectedNode={selectedNode}
              selectedEdge={null}
              incomingEdgeCount={incomingEdgeCount}
              outgoingEdgeCount={outgoingEdgeCount}
              challengeMapped={challengeMapped}
              canWrite={canWrite}
              onUpdateEdge={updateEdge}
              onDeleteEdge={deleteEdge}
            />
          </div>
        ) : null}
      </div>
      {viewMode === "terrain" ? (
        <p className="mt-3 text-xs text-zinc-500">
          Terrain Layers aktiv: Raw Items, Cluster/Bridges, Challenge-Ringe und Direction-Marker ({strategicDirections.length} Directions im Zyklus).
        </p>
      ) : null}
    </section>
  );
}
