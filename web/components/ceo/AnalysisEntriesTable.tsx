"use client";

import { useMemo, useState } from "react";
import {
  TableFilterBar,
  TableFilterSearch,
  TableFilterSelect,
} from "@/components/table/TableFilterBar";
import { ConfirmBeforeSubmitForm } from "@/components/ui/ConfirmBeforeSubmitForm";
import { matchesTableTitleSearch } from "@/lib/table/filter-utils";
import { ExpandableTable } from "./ExpandableTable";
import { LiveRangeInput } from "./LiveRangeInput";
import { AiWaitOverlay } from "./AiWaitOverlay";

const PESTEL_AREA_META: Array<{ key: string; label: string; tintPercent: number }> = [
  { key: "political", label: "Political", tintPercent: 12 },
  { key: "economic", label: "Economic", tintPercent: 20 },
  { key: "social", label: "Social", tintPercent: 28 },
  { key: "technological", label: "Technological", tintPercent: 36 },
  { key: "ecological", label: "Ecological", tintPercent: 44 },
  { key: "legal", label: "Legal", tintPercent: 52 },
];

const SWOT_SUB_TYPES = ["strength", "weakness", "opportunity", "threat"] as const;

function isPestelSubType(value: string | null | undefined): boolean {
  return PESTEL_AREA_META.some((item) => item.key === value);
}

function getPestelAreaStyle(subType: string | null | undefined) {
  const area = PESTEL_AREA_META.find((item) => item.key === subType);
  if (!area) return null;
  const tint = area.tintPercent;
  return {
    label: area.label,
    style: {
      borderColor: `color-mix(in srgb, var(--brand-primary) ${Math.min(tint + 18, 72)}%, white)`,
      background: `color-mix(in srgb, var(--brand-primary) ${tint}%, white)`,
    },
  };
}

function getPriorityZone(impact: number | null, uncertainty: number | null) {
  const i = impact ?? 3;
  const u = uncertainty ?? 3;
  if (i >= 4 && u <= 2) return "Sofortiger strategischer Hebel";
  if (i >= 4 && u >= 3) return "Strategische Wette (Unsicherheit managen)";
  if (i <= 2 && u >= 4) return "Beobachten / Monitoring";
  return "Weiter analysieren / priorisieren";
}

function getQualityBandLabel(band: string) {
  if (band === "high") return "Hohe Qualitaet";
  if (band === "medium") return "Mittlere Qualitaet";
  return "Niedrige Qualitaet";
}

export type AnalysisEntryRow = {
  id: string;
  title: string;
  sub_type: string | null;
  description: string | null;
  impact_level: number | null;
  uncertainty_level: number | null;
  quality_score: number | null;
  quality_band: "high" | "medium" | "low" | null;
  quality_source: "llm" | "rule" | null;
  updated_at: string;
  analysis_type: string;
};

type ChallengeOption = {
  id: string;
  title: string;
  sourceAnalysisEntryId: string | null;
};

type AnalysisEntriesTableProps = {
  entries: AnalysisEntryRow[];
  analysisType: string;
  canWrite: boolean;
  promotedBySourceId: Map<string, string>;
  directionCountByEntryId: Record<string, number>;
  challengeOptions: ChallengeOption[];
  updateAnalysisEntry: (formData: FormData) => Promise<void>;
  deleteAnalysisEntry: (formData: FormData) => Promise<void>;
  promoteToStrategicChallenge: (formData: FormData) => Promise<void>;
  attachFindingToChallenge: (formData: FormData) => Promise<void>;
};

export function AnalysisEntriesTable({
  entries,
  analysisType,
  canWrite,
  promotedBySourceId,
  directionCountByEntryId,
  challengeOptions,
  updateAnalysisEntry,
  deleteAnalysisEntry,
  promoteToStrategicChallenge,
  attachFindingToChallenge,
}: AnalysisEntriesTableProps) {
  const [searchTitle, setSearchTitle] = useState("");
  const [filterPromotion, setFilterPromotion] = useState("");

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (!matchesTableTitleSearch(e.title, searchTitle)) return false;
      if (filterPromotion === "linked" && !promotedBySourceId.has(e.id)) return false;
      if (filterPromotion === "open" && promotedBySourceId.has(e.id)) return false;
      return true;
    });
  }, [entries, searchTitle, filterPromotion, promotedBySourceId]);

  const columns = [
    {
      id: "title",
      label: "Titel",
      sortValue: (e: AnalysisEntryRow) => e.title,
      render: (e: AnalysisEntryRow) => (
        <span className="font-medium text-zinc-900">{e.title}</span>
      ),
    },
    {
      id: "sub_type",
      label: "Sub-Typ",
      defaultVisible: true,
      sortValue: (e: AnalysisEntryRow) => e.sub_type ?? null,
      render: (e: AnalysisEntryRow) => e.sub_type ?? "-",
    },
    {
      id: "impact",
      label: "Wirkung",
      defaultVisible: true,
      sortValue: (e: AnalysisEntryRow) => e.impact_level ?? null,
      render: (e: AnalysisEntryRow) => `${e.impact_level ?? "-"}/5`,
    },
    {
      id: "uncertainty",
      label: "Unsicherheit",
      defaultVisible: true,
      sortValue: (e: AnalysisEntryRow) => e.uncertainty_level ?? null,
      render: (e: AnalysisEntryRow) => `${e.uncertainty_level ?? "-"}/5`,
    },
    {
      id: "quality",
      label: "Qualitaet",
      defaultVisible: true,
      sortValue: (e: AnalysisEntryRow) => e.quality_score ?? null,
      render: (e: AnalysisEntryRow) => String(e.quality_score ?? "-"),
    },
    {
      id: "zone",
      label: "Priorit\u00E4tszone",
      defaultVisible: false,
      sortValue: (e: AnalysisEntryRow) =>
        getPriorityZone(e.impact_level, e.uncertainty_level),
      render: (e: AnalysisEntryRow) =>
        getPriorityZone(e.impact_level, e.uncertainty_level),
    },
    {
      id: "challenge",
      label: "Herausforderung",
      defaultVisible: true,
      sortValue: (e: AnalysisEntryRow) => (promotedBySourceId.has(e.id) ? 1 : 0),
      render: (e: AnalysisEntryRow) =>
        promotedBySourceId.has(e.id) ? "ja" : "offen",
    },
    {
      id: "directions",
      label: "Sto\u00DFrichtungen",
      defaultVisible: true,
      sortValue: (e: AnalysisEntryRow) => directionCountByEntryId[e.id] ?? 0,
      render: (e: AnalysisEntryRow) => directionCountByEntryId[e.id] ?? 0,
    },
  ];

  return (
    <div className="space-y-3">
      <TableFilterBar>
        <TableFilterSelect
          label="Herausforderung"
          value={filterPromotion}
          onChange={setFilterPromotion}
          options={[
            { value: "linked", label: "Verknüpft" },
            { value: "open", label: "Offen" },
          ]}
        />
        <TableFilterSearch value={searchTitle} onChange={setSearchTitle} />
      </TableFilterBar>

      <ExpandableTable<AnalysisEntryRow>
      columns={columns}
      rows={filteredEntries}
      getRowId={(e) => e.id}
      expandLabel="Details"
      rowIdPrefix="entry-"
      emptyMessage={
        entries.length === 0
          ? "Keine Eintr\u00E4ge f\u00FCr die aktuellen Filter."
          : "Keine Treffer für die gewählten Filter."
      }
      renderExpandedContent={(entry) => {
        const promotedChallengeId = promotedBySourceId.get(entry.id) ?? null;
        const pestelArea =
          analysisType === "environment" ? getPestelAreaStyle(entry.sub_type) : null;
        const updatedAtLabel = String(entry.updated_at ?? "")
          .replace("T", " ")
          .replace("Z", "")
          .slice(0, 16);

        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-zinc-900">
                {entry.title}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                  
                  Qualitätswert: {entry.quality_score}
                </span>
                <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                  Quelle: {entry.quality_source === "llm" ? "LLM" : "Rule-Fallback"}
                </span>
                <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                  Band: {getQualityBandLabel(entry.quality_band ?? "")}
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
                  Zone:{" "}
                  {getPriorityZone(entry.impact_level, entry.uncertainty_level)}
                </span>
                {entry.quality_score === 0 ? (
                  <span className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-700">
                    Kein strategischer Nutzen erkannt - erscheint nicht im Graph
                  </span>
                ) : null}
              </div>
            </div>

            <form action={updateAnalysisEntry} className="space-y-2">
              <input type="hidden" name="analysis_entry_id" value={entry.id} />
              <input type="hidden" name="analysis_type" value={analysisType} />
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
                <div className="min-w-0 space-y-2">
                  <label className="block min-w-0">
                    <span className="mb-1 block text-xs font-medium text-zinc-600">
                      Titel / Kernaussage
                    </span>
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
                    <LiveRangeInput
                      name="impact_level"
                      defaultValue={entry.impact_level ?? 3}
                    />
                  </label>
                  <label className="block min-w-0 overflow-hidden">
                    <span className="mb-1 block text-xs font-medium text-zinc-600">
                      Unsicherheits-Score
                    </span>
                    <LiveRangeInput
                      name="uncertainty_level"
                      defaultValue={entry.uncertainty_level ?? 3}
                    />
                  </label>
                </div>
                <div className="block min-w-0">
                  <span className="mb-1 block text-xs font-medium text-zinc-600">
                    Sub-Typ
                  </span>
                  {analysisType === "environment" ? (
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
                  ) : analysisType === "swot" ? (
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
                <AiWaitOverlay
                  title="AI Agent berechnet Qualitaet"
                  description="Wir rechnen den Qualit\u00E4tswert neu und speichern ihn persistent."
                />
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <form action={promoteToStrategicChallenge}>
                <input type="hidden" name="analysis_entry_id" value={entry.id} />
                <input type="hidden" name="analysis_type" value={analysisType} />
                <button
                  type="submit"
                  disabled={!canWrite || promotedChallengeId !== null}
                  className="brand-btn px-3 py-1.5 text-xs"
                >
                  {promotedChallengeId
                    ? "Bereits als Herausforderung \u00FCbernommen"
                    : "Als Herausforderung \u00FCbernehmen"}
                </button>
              </form>
              <ConfirmBeforeSubmitForm
                action={deleteAnalysisEntry}
                title="Analyse-Eintrag löschen?"
                description="Der Eintrag wird dauerhaft entfernt."
                confirmLabel="Löschen"
              >
                <input type="hidden" name="analysis_entry_id" value={entry.id} />
                <input type="hidden" name="analysis_type" value={analysisType} />
                <button
                  type="submit"
                  disabled={!canWrite}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-700"
                >
                  Loeschen
                </button>
              </ConfirmBeforeSubmitForm>
              <span className="text-xs text-zinc-500">
                Aktualisiert: {updatedAtLabel || "-"}
              </span>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-zinc-600">
                Bestehender Herausforderung zuordnen
              </p>
              <div className="flex flex-wrap gap-2">
                {challengeOptions.length === 0 ? (
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-500">
                    
                    Keine Herausforderungen verfügbar
                  </span>
                ) : (
                  challengeOptions.map((challenge) => {
                    const isCurrent = challenge.sourceAnalysisEntryId === entry.id;
                    return (
                      <form
                        key={`${entry.id}-${challenge.id}`}
                        action={attachFindingToChallenge}
                      >
                        <input
                          type="hidden"
                          name="analysis_entry_id"
                          value={entry.id}
                        />
                        <input
                          type="hidden"
                          name="analysis_type"
                          value={analysisType}
                        />
                        <input
                          type="hidden"
                          name="challenge_id"
                          value={challenge.id}
                        />
                        <button
                          type="submit"
                          disabled={!canWrite}
                          className={`rounded-full border px-3 py-1 text-xs ${
                            isCurrent
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                          }`}
                        >
                          {challenge.title}
                        </button>
                      </form>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        );
      }}
    />
    </div>
  );
}
