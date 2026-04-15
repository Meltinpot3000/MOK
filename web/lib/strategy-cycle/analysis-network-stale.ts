import type { AnalysisEntry } from "@/lib/strategy-cycle/queries";

function ms(iso: string | null | undefined): number | null {
  if (iso == null || iso === "") return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function maxMs(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return null;
  return Math.max(...nums);
}

export type AnalysisNetworkStaleFlags = {
  /** Quality-Backfill sinnvoll: Eintrag geändert seit letzter Quality-Berechnung oder noch nie berechnet. */
  staleQualityBackfill: boolean;
  /** Graph-Layout neu: Eintrag/Kante neuer als letztes Layout oder Layout fehlt. */
  staleGraphLayout: boolean;
  /** Link-Entwürfe: gleiche Eingabebasis wie Layout (Knoten + Kanten). */
  staleLinkDraftGeneration: boolean;
  /** Cluster: Embeddings veraltet oder fehlgeschlagen. */
  staleClusterRecompute: boolean;
  /** Lücken: Einträge neuer als letzte Lücken-Berechnung oder noch keine Lücken. */
  staleGapsRecompute: boolean;
};

/**
 * Heuristiken für «Aktion nötig» ohne separaten Invalidierungs-Store:
 * Quality/Layout nutzen Zeitstempel auf Einträgen; Layout zusätzlich Link-Zeiten;
 * Cluster nutzt Embedding-Zeiten; Lücken vergleichen max(entry.updated_at) mit neuestem Gap-Eintrag.
 */
export function computeAnalysisNetworkStaleFlags(params: {
  entries: AnalysisEntry[];
  approvedLinks: Array<{ updated_at?: string | null }>;
  linkDrafts: Array<{ created_at?: string | null }>;
  gapFindings: Array<{ created_at: string }>;
}): AnalysisNetworkStaleFlags {
  const { entries, approvedLinks, linkDrafts, gapFindings } = params;

  let staleQualityBackfill = false;
  let staleGraphLayoutEntries = false;
  let staleCluster = false;

  for (const e of entries) {
    const u = ms(e.updated_at);
    const qc = ms(e.quality_calculated_at);
    if (qc == null || (u != null && u > qc)) {
      staleQualityBackfill = true;
    }

    const gl = ms(e.graph_layout_calculated_at);
    if (gl == null || (u != null && u > gl)) {
      staleGraphLayoutEntries = true;
    }

    const emb = ms(e.semantic_embedding_calculated_at);
    const embBad =
      e.semantic_embedding_status === "failed" ||
      e.semantic_embedding_status === "pending" ||
      e.semantic_embedding_status == null;
    if (embBad || emb == null || (u != null && u > emb)) {
      staleCluster = true;
    }
  }

  const linkTimes: number[] = [];
  for (const l of approvedLinks) {
    const t = ms(l.updated_at);
    if (t != null) linkTimes.push(t);
  }
  for (const d of linkDrafts) {
    const t = ms(d.created_at);
    if (t != null) linkTimes.push(t);
  }
  const maxLinkT = linkTimes.length ? Math.max(...linkTimes) : null;

  const layoutTimes = entries.map((e) => ms(e.graph_layout_calculated_at)).filter((x): x is number => x != null);
  const maxLayoutT = layoutTimes.length ? Math.max(...layoutTimes) : null;

  const staleGraphLayoutLinks =
    maxLinkT != null && maxLayoutT != null
      ? maxLinkT > maxLayoutT
      : maxLinkT != null && maxLayoutT == null && entries.length > 0;

  const staleGraphLayout =
    staleGraphLayoutEntries || staleGraphLayoutLinks || (entries.length > 0 && maxLayoutT == null);

  const maxEntryU = maxMs(entries.map((e) => ms(e.updated_at)));
  const maxGapCreated = maxMs(gapFindings.map((g) => ms(g.created_at)));

  const staleGapsRecompute =
    entries.length > 0 &&
    (gapFindings.length === 0 ||
      (maxEntryU != null && maxGapCreated != null && maxEntryU > maxGapCreated));

  return {
    staleQualityBackfill,
    staleGraphLayout,
    staleLinkDraftGeneration: staleGraphLayout,
    staleClusterRecompute: staleCluster,
    staleGapsRecompute,
  };
}
