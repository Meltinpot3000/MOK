import type { AnalysisEntry } from "@/lib/strategy-cycle/queries";

/** Gleiche Schwellen wie in `strategy-cycle/page.tsx` (`deriveQualityBand`). */
export function deriveQualityBandFromScore(score: number): "high" | "medium" | "low" {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function bandForEntry(entry: Pick<AnalysisEntry, "quality_score" | "quality_band">): "high" | "medium" | "low" {
  if (entry.quality_band === "high" || entry.quality_band === "medium" || entry.quality_band === "low") {
    return entry.quality_band;
  }
  const score =
    typeof entry.quality_score === "number" && Number.isFinite(entry.quality_score) ? entry.quality_score : 0;
  return deriveQualityBandFromScore(score);
}

export type ChallengeEntrySource = {
  source_analysis_entry_id?: string | null;
};

export type AnalysisEntryOverviewStats = {
  total: number;
  qualityHigh: number;
  qualityMedium: number;
  qualityLow: number;
  /** Eindeutige Analyse-Einträge, die in eine strategische Herausforderung einfließen (direkt oder über übernommenen Cluster). */
  inChallengesUnique: number;
  /** Nur Analyse, noch in keiner Herausforderung (weder direkt noch über übernommenen Cluster). */
  onlyAnalysis: number;
  /** Einträge, die direkt als `source_analysis_entry_id` einer Herausforderung vorkommen. */
  directEntryCount: number;
  /** Einträge nur über Mitgliederchaft in einem bereits übernommenen Cluster (ohne direkte Quelle). */
  clusterOnlyEntryCount: number;
  /** Schnittmenge: direkt und zugleich in einem übernommenen Cluster. */
  bothDirectAndClusterCount: number;
  /** Direkte Quelle, aber nicht in einem übernommenen Cluster. */
  directOnlyEntryCount: number;
};

/**
 * Aggregiert Kennzahlen für die Übersichtskachel „Analyse-Einträge“.
 * Herausforderungen: Eintrag zählt, wenn (a) direkt referenziert oder (b) Mitglied eines Clusters in `promotedClusterIds`.
 */
export function buildAnalysisEntryOverviewStats(
  entries: AnalysisEntry[],
  challenges: ChallengeEntrySource[],
  promotedClusterIds: Set<string>,
  clusterMembersByClusterId: Map<string, Array<{ entry_id: string }>>
): AnalysisEntryOverviewStats {
  const total = entries.length;
  let qualityHigh = 0;
  let qualityMedium = 0;
  let qualityLow = 0;
  for (const entry of entries) {
    const b = bandForEntry(entry);
    if (b === "high") qualityHigh += 1;
    else if (b === "medium") qualityMedium += 1;
    else qualityLow += 1;
  }

  const directSet = new Set<string>();
  for (const ch of challenges) {
    const sid = ch.source_analysis_entry_id;
    if (sid && String(sid).trim() !== "") directSet.add(String(sid));
  }

  const clusterSet = new Set<string>();
  for (const clusterId of promotedClusterIds) {
    const members = clusterMembersByClusterId.get(clusterId) ?? [];
    for (const m of members) {
      if (m.entry_id) clusterSet.add(String(m.entry_id));
    }
  }

  let bothDirectAndClusterCount = 0;
  for (const id of directSet) {
    if (clusterSet.has(id)) bothDirectAndClusterCount += 1;
  }

  const inChallengeSet = new Set<string>([...directSet, ...clusterSet]);
  const inChallengesUnique = entries.filter((e) => inChallengeSet.has(e.id)).length;
  const onlyAnalysis = entries.filter((e) => !inChallengeSet.has(e.id)).length;

  let clusterOnlyEntryCount = 0;
  for (const id of clusterSet) {
    if (!directSet.has(id)) clusterOnlyEntryCount += 1;
  }

  const directOnlyEntryCount = directSet.size - bothDirectAndClusterCount;

  return {
    total,
    qualityHigh,
    qualityMedium,
    qualityLow,
    inChallengesUnique,
    onlyAnalysis: Math.max(0, onlyAnalysis),
    directEntryCount: directSet.size,
    clusterOnlyEntryCount,
    bothDirectAndClusterCount,
    directOnlyEntryCount,
  };
}
