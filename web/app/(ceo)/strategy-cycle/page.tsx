import { redirect } from "next/navigation";
import {
  approveLinkDraft,
  attachFindingToChallenge,
  createAnalysisEntry,
  deleteAnalysisEntry,
  generateLinkDrafts,
  promoteClusterToStrategicChallenge,
  promoteToStrategicChallenge,
  recomputeClusters,
  recomputeGaps,
  rejectLinkDraft,
  updateAnalysisEntry,
} from "@/app/(ceo)/strategy-cycle/actions";
import { AnalysisVisualizationWorkspace } from "@/components/analysis-visualization/AnalysisVisualizationWorkspace";
import { getTenantBranding } from "@/lib/ceo/queries";
import { getPhase0Context, getPlanningCycles } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import {
  calculateQualityScore,
  getQualityWeightsFromBrandingConfig,
} from "@/lib/strategy-cycle/quality-score";
import { getStrategyCycleWorkspaceData } from "@/lib/strategy-cycle/queries";

type StrategyCycleViewPageProps = {
  searchParams: Promise<{
    tab?: string;
    error?: string;
    success?: string;
    sort?: string;
    min_score?: string;
    quality_band?: string;
  }>;
};

const STRATEGY_CYCLE_TABS = [
  "summary",
  "environment",
  "company",
  "competitor",
  "swot",
  "workshop",
  "other",
] as const;

const ANALYSIS_TYPES = [
  "environment",
  "company",
  "competitor",
  "swot",
  "workshop",
  "other",
] as const;

const SWOT_SUB_TYPES = ["strength", "weakness", "opportunity", "threat"] as const;
const PESTEL_AREA_META: Array<{ key: string; label: string; tintPercent: number }> = [
  { key: "political", label: "Political", tintPercent: 12 },
  { key: "economic", label: "Economic", tintPercent: 20 },
  { key: "social", label: "Social", tintPercent: 28 },
  { key: "technological", label: "Technological", tintPercent: 36 },
  { key: "ecological", label: "Ecological", tintPercent: 44 },
  { key: "legal", label: "Legal", tintPercent: 52 },
];

function getTabTitle(tab: string) {
  switch (tab) {
    case "summary":
      return "Zusammenfassung";
    case "environment":
      return "Umfeldanalyse";
    case "company":
      return "Unternehmensanalyse";
    case "competitor":
      return "Wettbewerbsanalyse";
    case "swot":
      return "SWOT";
    case "workshop":
      return "Workshop Findings";
    default:
      return "Sonstige Analyse";
  }
}

function getStGallenHint(tab: string) {
  if (tab === "summary")
    return "Strategische Gesamtsicht mit Netzwerk und Tabellen-Scan aller Analysepunkte.";
  if (tab === "environment") return "St. Gallen: Umwelt-Sphaeren und Anspruchsgruppen systematisch erfassen.";
  if (tab === "company") return "St. Gallen: interne Faehigkeiten, Ressourcen und Prozesse bewerten.";
  if (tab === "competitor") return "St. Gallen: Wettbewerbsposition und Differenzierungskraefte analysieren.";
  if (tab === "swot") return "St. Gallen: interne/ externe Faktoren als S-W-O-T verdichten.";
  return "Strategische Befunde strukturiert dokumentieren und priorisieren.";
}

function isPestelSubType(value: string | null | undefined) {
  if (!value) return false;
  return PESTEL_AREA_META.some((item) => item.key === value);
}

function getPestelAreaStyle(subType: string | null | undefined) {
  const area = PESTEL_AREA_META.find((item) => item.key === subType);
  if (!area) return null;
  const tint = area.tintPercent;
  return {
    label: area.label,
    style: {
      background: `color-mix(in srgb, var(--brand-primary) ${tint}%, white)`,
      borderColor: `color-mix(in srgb, var(--brand-primary) ${Math.min(tint + 18, 72)}%, white)`,
      color: "color-mix(in srgb, var(--brand-secondary) 78%, #27272a)",
    },
  };
}

function getStatusMessage(error: string | undefined, success: string | undefined) {
  if (error === "missing-title")
    return { type: "error", text: "Bitte einen Titel erfassen." };
  if (error === "invalid-impact")
    return { type: "error", text: "Impact muss zwischen 1 und 5 liegen." };
  if (error === "invalid-uncertainty")
    return { type: "error", text: "Unsicherheits-Score muss zwischen 1 und 5 liegen." };
  if (error === "high-impact-justification")
    return {
      type: "error",
      text: "Bei hohem Impact (4-5) braucht es eine belastbare Begruendung (mind. 40 Zeichen).",
    };
  if (error === "invalid-subtype")
    return { type: "error", text: "Der Sub-Typ passt nicht zum ausgewaehlten Analysebereich." };
  if (error === "not-found")
    return { type: "error", text: "Analyse-Eintrag wurde nicht gefunden oder ist nicht mehr verfuegbar." };
  if (success === "saved")
    return { type: "success", text: "Analyse-Eintrag wurde gespeichert." };
  if (success === "updated")
    return { type: "success", text: "Analyse-Eintrag wurde aktualisiert." };
  if (success === "deleted")
    return { type: "success", text: "Analyse-Eintrag wurde geloescht." };
  if (success === "promoted")
    return { type: "success", text: "Eintrag wurde als Strategic Challenge in die Matrix uebernommen." };
  if (success === "links-generated")
    return { type: "success", text: "Link-Entwuerfe wurden neu generiert." };
  if (success === "link-approved")
    return { type: "success", text: "Link-Entwurf wurde freigegeben." };
  if (success === "link-rejected")
    return { type: "success", text: "Link-Entwurf wurde verworfen." };
  if (success === "clusters-recomputed")
    return { type: "success", text: "Cluster wurden neu berechnet." };
  if (success === "gaps-recomputed")
    return { type: "success", text: "Gap-Analyse wurde neu berechnet." };
  if (success === "cluster-promoted")
    return { type: "success", text: "Cluster wurde als Strategic Challenge uebernommen." };
  if (success === "finding-linked")
    return { type: "success", text: "Finding wurde einer bestehenden Challenge zugeordnet." };
  return null;
}

function getPriorityZone(impact: number | null, uncertainty: number | null) {
  const i = impact ?? 3;
  const u = uncertainty ?? 3;
  if (i >= 4 && u <= 2) return "Sofortiger strategischer Hebel";
  if (i >= 4 && u >= 3) return "Strategische Wette (Unsicherheit managen)";
  if (i <= 2 && u >= 4) return "Beobachten / Monitoring";
  return "Weiter analysieren / priorisieren";
}

function getQualityBand(score: number) {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function getQualityBandLabel(band: string) {
  if (band === "high") return "High Quality";
  if (band === "medium") return "Medium Quality";
  return "Low Quality";
}

function enrichEntriesWithQuality<
  T extends { impact_level: number | null; uncertainty_level: number | null; description: string | null; sub_type: string | null }
>(entries: T[], scoreWeights: ReturnType<typeof getQualityWeightsFromBrandingConfig>) {
  return entries.map((entry) => {
    const qualityScore = calculateQualityScore(
      entry.impact_level,
      entry.uncertainty_level,
      entry.description,
      entry.sub_type,
      scoreWeights
    );
    return {
      ...entry,
      qualityScore,
      qualityBand: getQualityBand(qualityScore),
    };
  });
}

function readTriScores(metadata: unknown) {
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

export default async function StrategyCycleViewPage({ searchParams }: StrategyCycleViewPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedTab = resolvedSearchParams.tab ?? "summary";
  const activeTab = STRATEGY_CYCLE_TABS.includes(requestedTab as (typeof STRATEGY_CYCLE_TABS)[number])
    ? requestedTab
    : "summary";
  const actionTab = ANALYSIS_TYPES.includes(activeTab as (typeof ANALYSIS_TYPES)[number]) ? activeTab : "environment";

  const pageAccess = await getSidebarAccessContext("strategy-cycle");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");
  const canWrite = pageAccess.canWrite;

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  const cycles = await getPlanningCycles(context.organizationId);
  const selectedCycle = cycles[0] ?? null;

  if (!selectedCycle) {
    return (
      <section className="brand-card p-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Strategiezyklus</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Kein Planungszyklus vorhanden. Bitte zuerst einen Zyklus anlegen.
        </p>
      </section>
    );
  }

  const workspace = await getStrategyCycleWorkspaceData(context.organizationId, selectedCycle.id);
  const branding = await getTenantBranding(context.organizationId);
  const scoreWeights = getQualityWeightsFromBrandingConfig(branding?.branding_config ?? null);
  const entries = ANALYSIS_TYPES.includes(activeTab as (typeof ANALYSIS_TYPES)[number])
    ? workspace.grouped[activeTab as keyof typeof workspace.grouped] ?? []
    : [];
  const sort = resolvedSearchParams.sort === "updated_desc" ? "updated_desc" : "score_desc";
  const minScoreRaw = Number(resolvedSearchParams.min_score ?? "0");
  const minScore = Number.isFinite(minScoreRaw) ? Math.max(0, Math.min(100, minScoreRaw)) : 0;
  const qualityBandFilter =
    resolvedSearchParams.quality_band === "high" ||
    resolvedSearchParams.quality_band === "medium" ||
    resolvedSearchParams.quality_band === "low"
      ? resolvedSearchParams.quality_band
      : "all";

  const enrichedEntries = enrichEntriesWithQuality(entries, scoreWeights);
  const enrichedAllEntries = enrichEntriesWithQuality(workspace.entries, scoreWeights);

  const filteredEntries = enrichedEntries
    .filter((entry) => entry.qualityScore >= minScore)
    .filter((entry) => (qualityBandFilter === "all" ? true : entry.qualityBand === qualityBandFilter))
    .sort((a, b) => {
      if (sort === "updated_desc") return b.updated_at.localeCompare(a.updated_at);
      return b.qualityScore - a.qualityScore;
    });

  const statusMessage = getStatusMessage(resolvedSearchParams.error, resolvedSearchParams.success);
  const challengeOptions = (workspace.existingChallenges ?? [])
    .map((challenge) => ({ id: challenge.id, title: challenge.title }))
    .filter((item, index, all) => all.findIndex((x) => x.id === item.id) === index);
  const entryDimensionsRecord = Object.fromEntries(workspace.entryDimensionsByEntryId.entries());
  const entryDirectionIdsRecord = Object.fromEntries(workspace.entryDirectionIdsByEntryId.entries());
  const promotedEntryIds = [...workspace.promotedBySourceId.keys()];

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Strategiephase</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Strategy Cycle Workspace</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Zyklus: {selectedCycle.name} ({selectedCycle.code}) - Analyse nach St.-Gallen-orientierter Logik
          als Input fuer Strategic Challenges.
        </p>
      </header>

      {!canWrite ? (
        <p className="brand-surface p-3 text-sm text-zinc-600">
          Diese Rolle hat Leserechte. Erstellen/Bearbeiten ist deaktiviert.
        </p>
      ) : null}
      {statusMessage ? (
        <p
          className={`rounded-md border p-3 text-sm ${
            statusMessage.type === "error"
              ? "border-red-300 bg-red-50 text-red-800"
              : "border-emerald-300 bg-emerald-50 text-emerald-800"
          }`}
        >
          {statusMessage.text}
        </p>
      ) : null}

      <section className="brand-card p-6">
        <div className="flex flex-wrap gap-2">
          {STRATEGY_CYCLE_TABS.map((tab) => (
            <a
              key={tab}
              href={`/strategy-cycle?tab=${tab}&sort=${sort}&min_score=${minScore}&quality_band=${qualityBandFilter}`}
              className={`rounded-md border px-3 py-1.5 text-xs ${
                activeTab === tab
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {getTabTitle(tab)}
            </a>
          ))}
        </div>
        <p className="mt-3 text-sm text-zinc-600">{getStGallenHint(activeTab)}</p>
        <p className="mt-2 text-xs text-zinc-500">
          Score-Gewichte: Impact {Math.round(scoreWeights.impact * 100)}% | Certainty{" "}
          {Math.round(scoreWeights.certainty * 100)}% | Evidence {Math.round(scoreWeights.evidence * 100)}
          % | Structure {Math.round(scoreWeights.structure * 100)}%
        </p>
      </section>

      {activeTab === "summary" ? (
        <AnalysisVisualizationWorkspace
          entries={enrichedAllEntries}
          approvedLinks={workspace.approvedLinks}
          linkDrafts={workspace.linkDrafts}
          clusters={workspace.clusters}
          clusterMembers={workspace.clusterMembers}
          entryDimensions={entryDimensionsRecord}
          availableDimensions={workspace.availableDimensions}
          promotedEntryIds={promotedEntryIds}
          entryDirectionIdsByEntryId={entryDirectionIdsRecord}
          strategicDirections={workspace.strategicDirections}
          canWrite={canWrite}
        />
      ) : null}

      {activeTab === "summary" ? (
      <section className="brand-card p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-zinc-900">Analysis Netzwerk</h2>
          <form action={generateLinkDrafts}>
            <input type="hidden" name="analysis_type" value={actionTab} />
            <button type="submit" disabled={!canWrite} className="brand-btn px-3 py-1.5 text-xs">
              Link-Entwuerfe generieren
            </button>
          </form>
          <form action={recomputeClusters}>
            <input type="hidden" name="analysis_type" value={actionTab} />
            <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-3 py-1.5 text-xs">
              Cluster neu berechnen
            </button>
          </form>
          <form action={recomputeGaps}>
            <input type="hidden" name="analysis_type" value={actionTab} />
            <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-3 py-1.5 text-xs">
              Gaps neu berechnen
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <article className="brand-surface p-3">
            <h3 className="text-sm font-semibold text-zinc-900">Verbindungs-Entwuerfe</h3>
            <div className="mt-2 space-y-2">
              {(workspace.linkDrafts ?? []).length === 0 ? (
                <p className="text-xs text-zinc-600">Keine offenen Entwuerfe.</p>
              ) : (
                (workspace.linkDrafts ?? []).slice(0, 12).map((draft) => {
                  const tri = readTriScores(draft.metadata);
                  return (
                    <div key={draft.id} className="rounded-md border border-zinc-200 bg-white p-2">
                    <p className="text-xs text-zinc-700">
                      <span className="font-medium">
                        {workspace.entryTitleById.get(draft.source_analysis_item_id) ?? draft.source_analysis_item_id}
                      </span>
                      {" -> "}
                      <span className="font-medium">
                        {workspace.entryTitleById.get(draft.target_analysis_item_id) ?? draft.target_analysis_item_id}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {draft.link_type} | conf {Math.round(Number(draft.confidence ?? 0) * 100)}% | s
                      {draft.strength}
                    </p>
                    {tri ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        Naehe {Math.round(tri.proximityScore * 100)}% | Unterstuetzung{" "}
                        {Math.round(tri.supportScore * 100)}% | Abstossung {Math.round(tri.repulsionScore * 100)}%
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-zinc-500">{draft.comment}</p>
                    <div className="mt-2 flex gap-2">
                      <form action={approveLinkDraft}>
                        <input type="hidden" name="analysis_type" value={actionTab} />
                        <input type="hidden" name="draft_id" value={draft.id} />
                        <button type="submit" disabled={!canWrite} className="brand-btn px-2 py-1 text-xs">
                          Accept
                        </button>
                      </form>
                      <form action={rejectLinkDraft}>
                        <input type="hidden" name="analysis_type" value={actionTab} />
                        <input type="hidden" name="draft_id" value={draft.id} />
                        <button
                          type="submit"
                          disabled={!canWrite}
                          className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                        >
                          Reject
                        </button>
                      </form>
                    </div>
                    </div>
                  );
                })
              )}
            </div>
          </article>

          <article className="brand-surface p-3">
            <h3 className="text-sm font-semibold text-zinc-900">Cluster & Potenziale</h3>
            <div className="mt-2 space-y-2">
              {(workspace.clusters ?? []).length === 0 ? (
                <p className="text-xs text-zinc-600">Noch keine Cluster berechnet.</p>
              ) : (
                (workspace.clusters ?? []).slice(0, 8).map((cluster) => {
                  const members = workspace.clusterMembersByClusterId.get(cluster.id) ?? [];
                  const topMemberTitles = members
                    .slice(0, 4)
                    .map((member) => workspace.entryTitleById.get(member.entry_id) ?? member.entry_id);
                  return (
                    <div key={cluster.id} className="rounded-md border border-zinc-200 bg-white p-2">
                      <p className="text-xs font-semibold text-zinc-900">{cluster.label}</p>
                      <p className="mt-1 text-xs text-zinc-600">{cluster.summary}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Score: {Math.round(Number(cluster.cluster_score ?? 0) * 100)} | Mitglieder: {members.length}
                      </p>
                      {topMemberTitles.length > 0 ? (
                        <p className="mt-1 text-xs text-zinc-500">
                          {topMemberTitles.join(" | ")}
                        </p>
                      ) : null}
                      <form action={promoteClusterToStrategicChallenge} className="mt-2">
                        <input type="hidden" name="analysis_type" value={actionTab} />
                        <input type="hidden" name="cluster_id" value={cluster.id} />
                        <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-2 py-1 text-xs">
                          Als Challenge uebernehmen
                        </button>
                      </form>
                    </div>
                  );
                })
              )}
            </div>
          </article>

          <article className="brand-surface p-3">
            <h3 className="text-sm font-semibold text-zinc-900">Luecken in der Betrachtung</h3>
            <div className="mt-2 space-y-2">
              {(workspace.gapFindings ?? []).length === 0 ? (
                <p className="text-xs text-zinc-600">Keine offenen Gaps gefunden.</p>
              ) : (
                (workspace.gapFindings ?? []).slice(0, 12).map((gap) => (
                  <div key={gap.id} className="rounded-md border border-zinc-200 bg-white p-2">
                    <p className="text-xs font-medium text-zinc-900">
                      {gap.gap_type} | {gap.dimension}
                    </p>
                    <p className="mt-1 text-xs text-zinc-600">Severity: {gap.severity} | Status: {gap.status}</p>
                    <p className="mt-1 text-xs text-zinc-500">{gap.recommendation}</p>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>
      </section>
      ) : null}

      {activeTab !== "summary" ? (
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Analyse-Eintrag erfassen</h2>
          <form action={createAnalysisEntry} className="mt-4 space-y-3">
            <input type="hidden" name="analysis_type" value={activeTab} />
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">Titel / Kernaussage</label>
              <input
                name="title"
                required
                placeholder="Titel / Kernaussage"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <p className="mb-1 block text-xs font-medium text-zinc-700">Sub-Typ</p>
              {activeTab === "environment" ? (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-600">
                    Optional als PESTEL verfeinern (ohne separaten Moduswechsel):
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {PESTEL_AREA_META.map((area) => (
                      <label
                        key={area.key}
                        className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
                        style={{
                          background: `color-mix(in srgb, var(--brand-primary) ${area.tintPercent}%, white)`,
                          borderColor: `color-mix(in srgb, var(--brand-primary) ${Math.min(area.tintPercent + 18, 72)}%, white)`,
                        }}
                      >
                        <input type="radio" name="sub_type" value={area.key} />
                        <span>{area.label}</span>
                      </label>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs">
                    <input type="radio" name="sub_type" value="" defaultChecked />
                    <span>Keine PESTEL-Kategorie</span>
                  </label>
                </div>
              ) : activeTab === "swot" ? (
                <select
                  name="sub_type"
                  required
                  defaultValue="strength"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                >
                  {SWOT_SUB_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name="sub_type"
                  placeholder="Sub-Typ (optional)"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              )}
            </div>
            <textarea
              name="description"
              rows={4}
              placeholder="Beschreibung / Evidenz / Implikation"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">
                Strategischer Impact (1-5)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  name="impact_level"
                  min={1}
                  max={5}
                  step={1}
                  defaultValue={3}
                  className="min-w-0 flex-1 accent-[var(--brand-primary)]"
                />
                <span className="w-10 shrink-0 text-right text-xs font-medium text-zinc-700">3/5</span>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">
                Unsicherheits-Score (1-5)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  name="uncertainty_level"
                  min={1}
                  max={5}
                  step={1}
                  defaultValue={3}
                  className="min-w-0 flex-1 accent-[var(--brand-primary)]"
                />
                <span className="w-10 shrink-0 text-right text-xs font-medium text-zinc-700">3/5</span>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              Qualitätsregel: Bei Impact 4-5 muss die Begruendung mindestens 40 Zeichen haben.
            </p>
            <button type="submit" disabled={!canWrite} className="brand-btn px-4 py-2 text-sm">
              Eintrag speichern
            </button>
          </form>
        </article>

        <article className="brand-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">
              {getTabTitle(activeTab)} - Eintraege ({filteredEntries.length}/{entries.length})
            </h2>
            <a
              href="/strategy-matrix"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700"
            >
              Zur Strategie-Matrix
            </a>
          </div>

          <form className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <input type="hidden" name="tab" value={activeTab} />
            <select
              name="sort"
              defaultValue={sort}
              className="min-w-[260px] flex-1 rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs"
            >
              <option value="score_desc">Sort: Quality Score (absteigend)</option>
              <option value="updated_desc">Sort: Letzte Aktualisierung</option>
            </select>
            <select
              name="quality_band"
              defaultValue={qualityBandFilter}
              className="min-w-[180px] rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs"
            >
              <option value="all">Band: Alle</option>
              <option value="high">Band: High Quality</option>
              <option value="medium">Band: Medium Quality</option>
              <option value="low">Band: Low Quality</option>
            </select>
            <div className="flex min-w-[150px] items-center gap-2">
              <label className="text-xs text-zinc-600">Min Score</label>
              <input
                type="number"
                name="min_score"
                min={0}
                max={100}
                defaultValue={minScore}
                className="w-24 rounded border border-zinc-300 bg-white px-2 py-1.5 text-xs"
              />
            </div>
            <button
              type="submit"
              className="shrink-0 rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700"
            >
              Filter anwenden
            </button>
          </form>

          <div className="mt-4 space-y-3">
            {filteredEntries.length === 0 ? (
              <p className="brand-surface p-3 text-sm text-zinc-600">
                Keine Eintraege fuer die aktuellen Filter.
              </p>
            ) : (
              filteredEntries.map((entry) => {
                const promotedChallengeId = workspace.promotedBySourceId.get(entry.id) ?? null;
                const pestelArea = activeTab === "environment" ? getPestelAreaStyle(entry.sub_type) : null;
                return (
                  <div
                    key={entry.id}
                    id={`entry-${entry.id}`}
                    className="brand-surface p-3"
                    style={pestelArea ? { borderColor: (pestelArea.style as { borderColor: string }).borderColor } : undefined}
                  >
                    <form action={updateAnalysisEntry} className="space-y-2">
                      <input type="hidden" name="analysis_entry_id" value={entry.id} />
                      <input type="hidden" name="analysis_type" value={activeTab} />
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                        <div className="min-w-0 space-y-2">
                          <label className="block min-w-0">
                            <span className="mb-1 block text-xs font-medium text-zinc-600">Titel / Kernaussage</span>
                            <input
                              name="title"
                              defaultValue={entry.title}
                              className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                            />
                          </label>
                          <label className="block min-w-0 overflow-hidden">
                            <span className="mb-1 block text-xs font-medium text-zinc-600">
                              Strategischer Impact
                            </span>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                name="impact_level"
                                min={1}
                                max={5}
                                step={1}
                                defaultValue={entry.impact_level ?? 3}
                                className="min-w-0 flex-1 accent-[var(--brand-primary)]"
                              />
                              <span className="w-10 shrink-0 text-right text-xs font-medium text-zinc-700">
                                {(entry.impact_level ?? 3)}/5
                              </span>
                            </div>
                          </label>
                          <label className="block min-w-0 overflow-hidden">
                            <span className="mb-1 block text-xs font-medium text-zinc-600">
                              Unsicherheits-Score
                            </span>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                name="uncertainty_level"
                                min={1}
                                max={5}
                                step={1}
                                defaultValue={entry.uncertainty_level ?? 3}
                                className="min-w-0 flex-1 accent-[var(--brand-primary)]"
                              />
                              <span className="w-10 shrink-0 text-right text-xs font-medium text-zinc-700">
                                {(entry.uncertainty_level ?? 3)}/5
                              </span>
                            </div>
                          </label>
                        </div>
                        <div className="block min-w-0">
                          <span className="mb-1 block text-xs font-medium text-zinc-600">Sub-Typ</span>
                          {activeTab === "environment" ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-1 gap-2">
                                {PESTEL_AREA_META.map((area) => (
                                  <label
                                    key={area.key}
                                    className="flex min-w-0 items-center gap-2 rounded-md border px-2 py-1.5 text-xs"
                                    style={{
                                      background: `color-mix(in srgb, var(--brand-primary) ${area.tintPercent}%, white)`,
                                      borderColor: `color-mix(in srgb, var(--brand-primary) ${Math.min(area.tintPercent + 18, 72)}%, white)`,
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name="sub_type"
                                      value={area.key}
                                      defaultChecked={entry.sub_type === area.key}
                                    />
                                    <span className="truncate">{area.label}</span>
                                  </label>
                                ))}
                              </div>
                              <label className="flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs">
                                <input
                                  type="radio"
                                  name="sub_type"
                                  value=""
                                  defaultChecked={!isPestelSubType(entry.sub_type)}
                                />
                                <span>Keine PESTEL-Kategorie</span>
                              </label>
                            </div>
                          ) : activeTab === "swot" ? (
                            <select
                              name="sub_type"
                              defaultValue={entry.sub_type ?? "strength"}
                              className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                            >
                              {SWOT_SUB_TYPES.map((item) => (
                                <option key={item} value={item}>
                                  {item}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              name="sub_type"
                              defaultValue={entry.sub_type ?? ""}
                              placeholder="Sub-Typ"
                              className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                            />
                          )}
                        </div>
                      </div>
                      <textarea
                        name="description"
                        rows={3}
                        defaultValue={entry.description ?? ""}
                        className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="submit"
                          disabled={!canWrite}
                          className="brand-btn px-3 py-1.5 text-xs"
                        >
                          Speichern
                        </button>
                        <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                          Quality Score: {entry.qualityScore}
                        </span>
                        <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                          Band: {getQualityBandLabel(entry.qualityBand)}
                        </span>
                        {pestelArea ? (
                          <span
                            className="rounded-md border px-2 py-1 text-xs"
                            style={pestelArea.style}
                          >
                            PESTEL: {pestelArea.label}
                          </span>
                        ) : null}
                        <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                          Zone: {getPriorityZone(entry.impact_level, entry.uncertainty_level)}
                        </span>
                      </div>
                    </form>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <form action={promoteToStrategicChallenge}>
                        <input type="hidden" name="analysis_entry_id" value={entry.id} />
                        <input type="hidden" name="analysis_type" value={activeTab} />
                        <button
                          type="submit"
                          disabled={!canWrite || promotedChallengeId !== null}
                          className="brand-btn-secondary px-3 py-1.5 text-xs"
                        >
                          {promotedChallengeId ? "Bereits als Challenge uebernommen" : "Als Challenge uebernehmen"}
                        </button>
                      </form>
                      <form action={attachFindingToChallenge} className="flex items-center gap-1">
                        <input type="hidden" name="analysis_entry_id" value={entry.id} />
                        <input type="hidden" name="analysis_type" value={activeTab} />
                        <select
                          name="challenge_id"
                          defaultValue=""
                          className="rounded border border-zinc-300 px-2 py-1 text-xs"
                        >
                          <option value="">Challenge zuordnen</option>
                          {challengeOptions.map((challenge) => (
                            <option key={challenge.id} value={challenge.id}>
                              {challenge.title}
                            </option>
                          ))}
                        </select>
                        <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-2 py-1 text-xs">
                          Zuordnen
                        </button>
                      </form>
                      <form action={deleteAnalysisEntry}>
                        <input type="hidden" name="analysis_entry_id" value={entry.id} />
                        <input type="hidden" name="analysis_type" value={activeTab} />
                        <button
                          type="submit"
                          disabled={!canWrite}
                          className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-700"
                        >
                          Loeschen
                        </button>
                      </form>
                      <span className="text-xs text-zinc-500">
                        Aktualisiert: {new Date(entry.updated_at).toLocaleString("de-CH")}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>
      </section>
      ) : null}
    </div>
  );
}
