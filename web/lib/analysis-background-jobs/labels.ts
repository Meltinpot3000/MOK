const JOB_TYPE_LABELS: Record<string, string> = {
  quality_backfill: "Qualitäts-Backfill",
  graph_layout_recompute: "Grafik-Layout",
  entry_embedding_backfill: "Embedding-Backfill",
  objective_evaluation_backfill: "Objective-Evaluation",
  link_draft_generation: "Link-Entwürfe",
  cluster_recompute: "Cluster-Neuberechnung",
  gaps_recompute: "Lücken-Neuberechnung",
};

export function getJobTypeLabel(jobType: string): string {
  return JOB_TYPE_LABELS[jobType] ?? jobType;
}
