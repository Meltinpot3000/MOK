import type { AnalysisEntryRecord } from "@/lib/analysis-network/types";

export type ApprovedLinkRecord = {
  source_analysis_item_id: string;
  target_analysis_item_id: string;
  confidence: number;
  strength: number;
};

export type ComputedCluster = {
  label: string;
  summary: string;
  score: number;
  memberEntryIds: string[];
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pickClusterLabel(entries: AnalysisEntryRecord[]): string {
  const tokens = entries
    .flatMap((entry) => entry.title.toLowerCase().split(/\s+/))
    .map((token) => token.replace(/[^a-z0-9äöüß-]/gi, ""))
    .filter((token) => token.length >= 4);
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!top) return "Strategischer Cluster";
  return `Cluster ${top}`;
}

export function computeClusters(
  entries: AnalysisEntryRecord[],
  approvedLinks: ApprovedLinkRecord[]
): ComputedCluster[] {
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const adjacency = new Map<string, Set<string>>();
  for (const entry of entries) {
    adjacency.set(entry.id, new Set());
  }
  for (const link of approvedLinks) {
    adjacency.get(link.source_analysis_item_id)?.add(link.target_analysis_item_id);
    adjacency.get(link.target_analysis_item_id)?.add(link.source_analysis_item_id);
  }

  const visited = new Set<string>();
  const clusters: ComputedCluster[] = [];

  for (const entry of entries) {
    if (visited.has(entry.id)) continue;
    const queue = [entry.id];
    const component: string[] = [];
    visited.add(entry.id);
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      for (const next of adjacency.get(current) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }

    if (component.length < 2) continue;
    const componentEntries = component
      .map((id) => entryById.get(id))
      .filter((item): item is AnalysisEntryRecord => Boolean(item));
    const avgImpact =
      componentEntries.reduce((sum, item) => sum + (item.impact_level ?? 3), 0) /
      Math.max(componentEntries.length, 1);
    const avgUncertainty =
      componentEntries.reduce((sum, item) => sum + (item.uncertainty_level ?? 3), 0) /
      Math.max(componentEntries.length, 1);
    const linksInCluster = approvedLinks.filter(
      (link) =>
        component.includes(link.source_analysis_item_id) &&
        component.includes(link.target_analysis_item_id)
    );
    const avgConfidence =
      linksInCluster.reduce((sum, link) => sum + Number(link.confidence ?? 0.5), 0) /
      Math.max(linksInCluster.length, 1);

    const score = clamp(
      (avgImpact / 5) * 0.45 +
        ((6 - avgUncertainty) / 5) * 0.15 +
        clamp(component.length / 8, 0, 1) * 0.2 +
        avgConfidence * 0.2,
      0,
      1
    );

    clusters.push({
      label: pickClusterLabel(componentEntries),
      summary: `${componentEntries.length} Findings, ${(avgImpact).toFixed(1)} Impact, ${(avgConfidence * 100).toFixed(0)}% Link-Confidence`,
      score: Number(score.toFixed(4)),
      memberEntryIds: component,
    });
  }

  return clusters.sort((a, b) => b.score - a.score);
}
