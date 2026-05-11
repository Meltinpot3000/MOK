/**
 * Einheitliche Diagnose fuer Composite-Pipelines (Phase 13 / analysisOps).
 * Semantik je nach pipelineVariant; fehlende Stufen = null wenn nicht anwendbar.
 */
export type CompositePipelineDiagnostics = {
  pipelineVariant: string;
  rawTotal: number | null;
  afterScopeFilter: number | null;
  afterStatusOrTypeFilter: number | null;
  afterJoinFilter: number | null;
  finalTotal: number | null;
  checkedMembershipIds?: string[];
  /** z. B. cycle_instance_id, okr_cycle_id, organization_id */
  checkedScopeIds?: string[];
  retrievalStatusReason: string;
};

export function summarizeCounts(prefix: string, diag: CompositePipelineDiagnostics): string {
  return `${prefix}: raw=${diag.rawTotal ?? "n/a"} scope=${diag.afterScopeFilter ?? "n/a"} status/type=${diag.afterStatusOrTypeFilter ?? "n/a"} join=${diag.afterJoinFilter ?? "n/a"} final=${diag.finalTotal ?? "n/a"} scopes=[${(diag.checkedScopeIds ?? []).join(",")}] memberships=[${(diag.checkedMembershipIds ?? []).join(",")}] reason=${diag.retrievalStatusReason}`;
}
