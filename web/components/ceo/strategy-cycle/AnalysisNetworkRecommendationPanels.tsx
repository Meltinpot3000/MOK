"use client";

type TriScores = {
  proximityScore: number;
  supportScore: number;
  repulsionScore: number;
};

type ChallengeCandidateRow = {
  id: string;
  title: string;
  priority: number | string;
  source_type: string;
  description?: string | null;
};

type ClusterPanelRow = {
  id: string;
  label: string;
  summary?: string | null;
  cluster_score?: number | null;
  topMemberTitles: string[];
  memberCount: number;
};

type LinkDraftRow = {
  id: string;
  source_analysis_item_id: string;
  target_analysis_item_id: string;
  link_type: string;
  strength: number;
  confidence: number;
  comment: string | null;
  metadata?: Record<string, unknown> | null;
};

type GapFindingRow = {
  id: string;
  gap_type: string;
  dimension: string;
  severity: string | number;
  status: string;
  recommendation: string;
};

type ServerAction = (formData: FormData) => Promise<void>;

type AnalysisNetworkRecommendationPanelsProps = {
  recommendedChallengeTotal: number;
  draftChallengeCandidates: ChallengeCandidateRow[];
  clusterPanels: ClusterPanelRow[];
  linkDraftsCount: number;
  linkDrafts: LinkDraftRow[];
  gapFindingsCount: number;
  gapFindings: GapFindingRow[];
  entryTitleById: Record<string, string>;
  canWrite: boolean;
  actionTab: string;
  promoteChallengeCandidate: ServerAction;
  dismissChallengeCandidate: ServerAction;
  promoteClusterToStrategicChallenge: ServerAction;
  approveLinkDraft: ServerAction;
  rejectLinkDraft: ServerAction;
};

function readTriScores(metadata: unknown): TriScores | null {
  if (!metadata || typeof metadata !== "object") return null;
  const tri = (metadata as Record<string, unknown>).triScores;
  if (!tri || typeof tri !== "object") return null;
  const row = tri as Record<string, unknown>;
  const proximityScore = Number(row.proximityScore ?? 0);
  const supportScore = Number(row.supportScore ?? 0);
  const repulsionScore = Number(row.repulsionScore ?? 0);
  if (!Number.isFinite(proximityScore) || !Number.isFinite(supportScore) || !Number.isFinite(repulsionScore)) {
    return null;
  }
  return {
    proximityScore: Math.max(0, Math.min(1, proximityScore)),
    supportScore: Math.max(0, Math.min(1, supportScore)),
    repulsionScore: Math.max(0, Math.min(1, repulsionScore)),
  };
}

export function AnalysisNetworkRecommendationPanels({
  recommendedChallengeTotal,
  draftChallengeCandidates,
  clusterPanels,
  linkDraftsCount,
  linkDrafts,
  gapFindingsCount,
  gapFindings,
  entryTitleById,
  canWrite,
  actionTab,
  promoteChallengeCandidate,
  dismissChallengeCandidate,
  promoteClusterToStrategicChallenge,
  approveLinkDraft,
  rejectLinkDraft,
}: AnalysisNetworkRecommendationPanelsProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">Empfohlene Herausforderungen</h3>
        <p className="mt-1 text-xs text-zinc-600">
          Herausforderungs-Vorschläge (Kandidaten und Cluster), Verbindungs-Entwürfe und Lücken — jeweils
          aufklappbar. Die Zahl in Klammern ist die Anzahl der Einträge in dieser Liste.
        </p>
      </div>

      <details className="brand-surface group rounded-lg border border-zinc-200">
        <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold text-zinc-900 [&::-webkit-details-marker]:hidden">
          <span className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-zinc-900 underline-offset-2 group-open:decoration-zinc-400">
              Herausforderungs-Vorschläge
            </span>
            <span className="text-xs font-normal text-zinc-500">({recommendedChallengeTotal})</span>
          </span>
        </summary>
        <div className="space-y-2 border-t border-zinc-200 p-3">
          {recommendedChallengeTotal === 0 ? (
            <p className="text-xs text-zinc-600">
              Keine offenen Vorschläge. Führe «Cluster neu berechnen» oder «Lücken neu berechnen» aus.
            </p>
          ) : (
            <>
              {draftChallengeCandidates.map((candidate) => (
                <div key={candidate.id} className="space-y-2 rounded-md border border-zinc-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-900">{candidate.title}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                        Priorität {candidate.priority}
                      </span>
                      <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                        Quelle {candidate.source_type}
                      </span>
                    </div>
                  </div>
                  {candidate.description ? (
                    <p className="text-sm text-zinc-600">{candidate.description}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={promoteChallengeCandidate}>
                      <input type="hidden" name="candidate_id" value={candidate.id} />
                      <button type="submit" disabled={!canWrite} className="brand-btn px-3 py-1.5 text-xs">
                        Als Herausforderung übernehmen
                      </button>
                    </form>
                    <form action={dismissChallengeCandidate}>
                      <input type="hidden" name="candidate_id" value={candidate.id} />
                      <button
                        type="submit"
                        disabled={!canWrite}
                        className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700"
                      >
                        Ausblenden
                      </button>
                    </form>
                  </div>
                </div>
              ))}
              {clusterPanels.map((cluster) => (
                <div key={`cluster-${cluster.id}`} className="space-y-2 rounded-md border border-zinc-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-900">{cluster.label}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                        Score {Math.round(Number(cluster.cluster_score ?? 0) * 100)}
                      </span>
                      <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                        Quelle Cluster
                      </span>
                      <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                        {cluster.memberCount} Mitglieder
                      </span>
                    </div>
                  </div>
                  {cluster.summary ? <p className="text-sm text-zinc-600">{cluster.summary}</p> : null}
                  {cluster.topMemberTitles.length > 0 ? (
                    <p className="text-xs text-zinc-500">{cluster.topMemberTitles.join(" · ")}</p>
                  ) : null}
                  <form action={promoteClusterToStrategicChallenge}>
                    <input type="hidden" name="analysis_type" value={actionTab} />
                    <input type="hidden" name="cluster_id" value={cluster.id} />
                    <button type="submit" disabled={!canWrite} className="brand-btn px-3 py-1.5 text-xs">
                      Als Herausforderung übernehmen
                    </button>
                  </form>
                </div>
              ))}
            </>
          )}
        </div>
      </details>

      <details className="brand-surface group rounded-lg border border-zinc-200">
        <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold text-zinc-900 [&::-webkit-details-marker]:hidden">
          <span className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-zinc-900 underline-offset-2 group-open:decoration-zinc-400">
              Verbindungs-Entwürfe
            </span>
            <span className="text-xs font-normal text-zinc-500">({linkDraftsCount})</span>
          </span>
        </summary>
        <div className="space-y-2 border-t border-zinc-200 p-3">
          {linkDraftsCount === 0 ? (
            <p className="text-xs text-zinc-600">Keine offenen Entwürfe.</p>
          ) : (
            linkDrafts.slice(0, 12).map((draft) => {
              const tri = readTriScores(draft.metadata);
              return (
                <div key={draft.id} className="rounded-md border border-zinc-200 bg-white p-2">
                  <p className="text-xs text-zinc-700">
                    <span className="font-medium">
                      {entryTitleById[draft.source_analysis_item_id] ?? draft.source_analysis_item_id}
                    </span>
                    {" -> "}
                    <span className="font-medium">
                      {entryTitleById[draft.target_analysis_item_id] ?? draft.target_analysis_item_id}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {draft.link_type} | conf {Math.round(Number(draft.confidence ?? 0) * 100)}% | s
                    {draft.strength}
                  </p>
                  {tri ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      Nähe {Math.round(tri.proximityScore * 100)}% | Unterstützung{" "}
                      {Math.round(tri.supportScore * 100)}% | Abstossung {Math.round(tri.repulsionScore * 100)}%
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-zinc-500">{draft.comment}</p>
                  <div className="mt-2 flex gap-2">
                    <form action={approveLinkDraft}>
                      <input type="hidden" name="analysis_type" value={actionTab} />
                      <input type="hidden" name="draft_id" value={draft.id} />
                      <button type="submit" disabled={!canWrite} className="brand-btn px-3 py-1.5 text-xs">
                        Annehmen
                      </button>
                    </form>
                    <form action={rejectLinkDraft}>
                      <input type="hidden" name="analysis_type" value={actionTab} />
                      <input type="hidden" name="draft_id" value={draft.id} />
                      <button type="submit" disabled={!canWrite} className="brand-btn px-3 py-1.5 text-xs">
                        Ablehnen
                      </button>
                    </form>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </details>

      <details className="brand-surface group rounded-lg border border-zinc-200">
        <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold text-zinc-900 [&::-webkit-details-marker]:hidden">
          <span className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-zinc-900 underline-offset-2 group-open:decoration-zinc-400">
              Lücken in der Betrachtung
            </span>
            <span className="text-xs font-normal text-zinc-500">({gapFindingsCount})</span>
          </span>
        </summary>
        <div className="space-y-2 border-t border-zinc-200 p-3">
          {gapFindingsCount === 0 ? (
            <p className="text-xs text-zinc-600">Keine offenen Lücken gefunden.</p>
          ) : (
            gapFindings.slice(0, 12).map((gap) => (
              <div key={gap.id} className="rounded-md border border-zinc-200 bg-white p-2">
                <p className="text-xs font-medium text-zinc-900">
                  {gap.gap_type} | {gap.dimension}
                </p>
                <p className="mt-1 text-xs text-zinc-600">
                  Priorität: {gap.severity} | Status: {gap.status}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{gap.recommendation}</p>
              </div>
            ))
          )}
        </div>
      </details>
    </div>
  );
}
