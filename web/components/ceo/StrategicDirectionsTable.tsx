"use client";

import type { ContributionLevel } from "@/lib/strategy-cycle/coverage-level";
import { COVERAGE_LEVEL_META } from "@/lib/strategy-cycle/coverage-level";
import {
  STRATEGIC_DIRECTION_STATUSES,
  STRATEGIC_DIRECTION_STATUS_LABELS_DE,
  normalizeStrategicDirectionStatus,
} from "@/lib/strategy-cycle/strategic-direction-lifecycle";
import {
  addressedLinkCountToneClass,
  MATRIX_TABLE_LINK_PILLS_MAX,
} from "@/lib/strategy-cycle/matrix-link-count-tone";
import { isObjectiveEligibleForDirectionLink } from "@/lib/strategy-cycle/objective-direction-link-eligibility";
import { CoverageStrengthPillButton } from "./CoverageStrengthPillButton";
import { EntityPillButton } from "./EntityPillButton";
import { ExpandableTable, pillLinked, pillNeutral } from "./ExpandableTable";

type Direction = {
  id: string;
  title: string;
  description: string | null;
  priority: number | string | null;
  status: string | null;
  grouping: string | null;
  relevance_level: number | null;
  risk_level: number | null;
  strategic_value_score: number | null;
  capability_fit_score: number | null;
  feasibility_score: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type StrategicDirectionsTableProps = {
  directions: Direction[];
  challenges: Array<{ id: string; title: string }>;
  objectives: Array<{ id: string; title: string; status: string | null }>;
  industries: Array<{ id: string; name: string }>;
  businessModels: Array<{ id: string; name: string }>;
  programsByDirectionId: Record<string, Array<{ id: string; title: string }>>;
  challengeIdsByDirection: Record<string, string[]>;
  challengeCoverageByDirection: Record<string, Record<string, ContributionLevel>>;
  objectiveIdsByDirection: Record<string, string[]>;
  objectiveCoverageByDirection: Record<string, Record<string, ContributionLevel>>;
  industryIdsByDirection: Record<string, string[]>;
  businessModelIdsByDirection: Record<string, string[]>;
  directionCoverageById: Record<string, { linked: number; total: number; percent: number }>;
  canWrite: boolean;
  actions: {
    updateStrategicDirectionAssessment: (formData: FormData) => Promise<void>;
    deleteStrategicDirectionInCycle: (formData: FormData) => Promise<void>;
    linkDirectionToChallengePredecessor: (formData: FormData) => Promise<void>;
    unlinkDirectionChallengePredecessor: (formData: FormData) => Promise<void>;
    linkDirectionToObjectiveInCycle: (formData: FormData) => Promise<void>;
    unlinkDirectionFromObjectiveInCycle: (formData: FormData) => Promise<void>;
    linkStrategicDirectionToIndustryInCycle: (formData: FormData) => Promise<void>;
    unlinkStrategicDirectionFromIndustryInCycle: (formData: FormData) => Promise<void>;
    linkStrategicDirectionToBusinessModelInCycle: (formData: FormData) => Promise<void>;
    unlinkStrategicDirectionFromBusinessModelInCycle: (formData: FormData) => Promise<void>;
  };
};

function PillSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-zinc-600">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function StrategicDirectionsTable({
  directions,
  challenges,
  objectives,
  industries,
  businessModels,
  programsByDirectionId,
  challengeIdsByDirection,
  challengeCoverageByDirection,
  objectiveIdsByDirection,
  objectiveCoverageByDirection,
  industryIdsByDirection,
  businessModelIdsByDirection,
  directionCoverageById,
  canWrite,
  actions,
}: StrategicDirectionsTableProps) {
  const columns = [
    {
      id: "title",
      label: "Titel",
      sortValue: (d: Direction) =>
        `${normalizeStrategicDirectionStatus(d.status)} ${d.title}`,
      render: (d: Direction) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-zinc-900">{d.title}</div>
          <div className="text-xs text-zinc-500">
            {STRATEGIC_DIRECTION_STATUS_LABELS_DE[normalizeStrategicDirectionStatus(d.status)]}
          </div>
        </div>
      ),
    },
    {
      id: "priority",
      label: "Prioritaet (Score)",
      defaultVisible: true,
      sortValue: (d: Direction) =>
        d.priority != null && d.priority !== "" ? Number(d.priority) : null,
      render: (d: Direction) =>
        d.priority != null && d.priority !== "" ? Number(d.priority).toFixed(2) : "-",
    },
    {
      id: "grouping",
      label: "Gruppierung",
      defaultVisible: false,
      sortValue: (d: Direction) => d.grouping ?? null,
      render: (d: Direction) => d.grouping ?? "-",
    },
    {
      id: "coverage",
      label: "Abdeckung",
      defaultVisible: false,
      sortValue: (d: Direction) => directionCoverageById[d.id]?.percent ?? null,
      render: (d: Direction) => {
        const cov = directionCoverageById[d.id];
        if (!cov) return "-";
        return `${cov.percent}% (${cov.linked}/${cov.total})`;
      },
    },
    {
      id: "strategic_value",
      label: "Strategischer Wert",
      defaultVisible: false,
      sortValue: (d: Direction) => d.strategic_value_score ?? null,
      render: (d: Direction) => String(d.strategic_value_score ?? "-"),
    },
    {
      id: "capability_fit",
      label: "Passung Kompetenzen",
      defaultVisible: false,
      sortValue: (d: Direction) => d.capability_fit_score ?? null,
      render: (d: Direction) => String(d.capability_fit_score ?? "-"),
    },
    {
      id: "feasibility",
      label: "Machbarkeit",
      defaultVisible: false,
      sortValue: (d: Direction) => d.feasibility_score ?? null,
      render: (d: Direction) => String(d.feasibility_score ?? "-"),
    },
    {
      id: "risk",
      label: "Risiko",
      defaultVisible: false,
      sortValue: (d: Direction) => d.risk_level ?? null,
      render: (d: Direction) => String(d.risk_level ?? "-"),
    },
    {
      id: "challenges",
      label: "Herausforderungen",
      defaultVisible: true,
      sortValue: (d: Direction) => (challengeIdsByDirection[d.id] ?? []).length,
      render: (d: Direction) => {
        const ids = challengeIdsByDirection[d.id] ?? [];
        const linked = challenges.filter((c) => ids.includes(c.id));
        if (linked.length === 0) return <span className="text-zinc-400">-</span>;
        const n = linked.length;
        const total = challenges.length;
        return (
          <div className="space-y-1">
            <div
              className={`text-[10px] font-semibold tabular-nums ${addressedLinkCountToneClass(n)}`}
              title="Anzahl verknuepfter Herausforderungen vs. alle im Zyklus (Farbe wie Strategie-Matrix)"
            >
              HF {n}/{total}
            </div>
            <div className="flex flex-wrap gap-1">
              {linked.slice(0, MATRIX_TABLE_LINK_PILLS_MAX).map((c) => {
                const level = challengeCoverageByDirection[d.id]?.[c.id];
                return (
                  <span
                    key={c.id}
                    className={`${pillLinked()} inline-flex max-w-[168px] items-center gap-0.5`}
                    title={c.title}
                  >
                    <span className="min-w-0 truncate">{c.title}</span>
                    {level ? (
                      <span className="shrink-0" title={COVERAGE_LEVEL_META[level].labelDe}>
                        {COVERAGE_LEVEL_META[level].emoji}
                      </span>
                    ) : null}
                  </span>
                );
              })}
              {n > MATRIX_TABLE_LINK_PILLS_MAX ? (
                <span className={pillLinked()}>+{n - MATRIX_TABLE_LINK_PILLS_MAX}</span>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      id: "objectives",
      label: "Objectives",
      defaultVisible: true,
      sortValue: (d: Direction) => (objectiveIdsByDirection[d.id] ?? []).length,
      render: (d: Direction) => {
        const ids = objectiveIdsByDirection[d.id] ?? [];
        const linked = objectives.filter((o) => ids.includes(o.id));
        if (linked.length === 0) return <span className="text-zinc-400">-</span>;
        const n = linked.length;
        const total = objectives.length;
        return (
          <div className="space-y-1">
            <div
              className={`text-[10px] font-semibold tabular-nums ${addressedLinkCountToneClass(n)}`}
              title="Anzahl verknuepfter Ziele vs. alle Objectives im Zyklus (Farbe wie Strategie-Matrix)"
            >
              Obj {n}/{total}
            </div>
            <div className="flex flex-wrap gap-1">
              {linked.slice(0, MATRIX_TABLE_LINK_PILLS_MAX).map((o) => {
                const level = objectiveCoverageByDirection[d.id]?.[o.id];
                return (
                  <span
                    key={o.id}
                    className={`${pillLinked()} inline-flex max-w-[168px] items-center gap-0.5`}
                    title={o.title}
                  >
                    <span className="min-w-0 truncate">{o.title}</span>
                    {level ? (
                      <span className="shrink-0" title={COVERAGE_LEVEL_META[level].labelDe}>
                        {COVERAGE_LEVEL_META[level].emoji}
                      </span>
                    ) : null}
                  </span>
                );
              })}
              {n > MATRIX_TABLE_LINK_PILLS_MAX ? (
                <span className={pillLinked()}>+{n - MATRIX_TABLE_LINK_PILLS_MAX}</span>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      id: "industries",
      label: "Industrien",
      defaultVisible: true,
      sortValue: (d: Direction) => {
        const ids = industryIdsByDirection[d.id] ?? [];
        const names = industries
          .filter((i) => ids.includes(i.id))
          .map((i) => i.name)
          .sort((a, b) => a.localeCompare(b, "de"));
        return names.join(", ") || null;
      },
      render: (d: Direction) => {
        const ids = industryIdsByDirection[d.id] ?? [];
        const linked = industries.filter((i) => ids.includes(i.id));
        if (linked.length === 0) return <span className="text-zinc-400">-</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {linked.slice(0, 2).map((i) => (
              <span key={i.id} className={pillLinked()} title={i.name}>
                {i.name}
              </span>
            ))}
            {linked.length > 2 && (
              <span className={pillLinked()}>+{linked.length - 2}</span>
            )}
          </div>
        );
      },
    },
    {
      id: "business_models",
      label: "Geschaeftsmodelle",
      defaultVisible: true,
      sortValue: (d: Direction) => {
        const ids = businessModelIdsByDirection[d.id] ?? [];
        const names = businessModels
          .filter((m) => ids.includes(m.id))
          .map((m) => m.name)
          .sort((a, b) => a.localeCompare(b, "de"));
        return names.join(", ") || null;
      },
      render: (d: Direction) => {
        const ids = businessModelIdsByDirection[d.id] ?? [];
        const linked = businessModels.filter((m) => ids.includes(m.id));
        if (linked.length === 0) return <span className="text-zinc-400">-</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {linked.slice(0, 2).map((m) => (
              <span key={m.id} className={pillLinked()} title={m.name}>
                {m.name}
              </span>
            ))}
            {linked.length > 2 && (
              <span className={pillLinked()}>+{linked.length - 2}</span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <ExpandableTable<Direction>
      columns={columns}
      rows={directions}
      getRowId={(d) => d.id}
      expandLabel="Details"
      emptyMessage="Keine strategischen Stossrichtungen vorhanden."
      renderExpandedContent={(direction) => {
        const linkedChallengeIds = new Set(
          challengeIdsByDirection[direction.id] ?? []
        );
        const linkedObjectiveIds = new Set(
          objectiveIdsByDirection[direction.id] ?? []
        );
        const linkedIndustryIds = new Set(
          industryIdsByDirection[direction.id] ?? []
        );
        const linkedBusinessModelIds = new Set(
          businessModelIdsByDirection[direction.id] ?? []
        );
        const coverage =
          directionCoverageById[direction.id] ?? {
            linked: 0,
            total: challenges.length,
            percent: 0,
          };

        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                Abdeckung {coverage.percent}% ({coverage.linked}/
                {coverage.total || 0})
              </span>
              <span className="rounded-md border border-sky-300 bg-sky-50 px-2 py-1 text-xs text-sky-900">
                Prioritaet (Score):{" "}
                {direction.priority != null && direction.priority !== ""
                  ? Number(direction.priority).toFixed(2)
                  : "—"}
              </span>
              <form action={actions.deleteStrategicDirectionInCycle} className="inline">
                <input
                  type="hidden"
                  name="strategic_direction_id"
                  value={direction.id}
                />
                <button
                  type="submit"
                  disabled={!canWrite}
                  className="rounded border border-red-300 bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                >
                  Loeschen
                </button>
              </form>
            </div>

            <form
              action={actions.updateStrategicDirectionAssessment}
              className="grid grid-cols-1 gap-2 md:grid-cols-5"
            >
              <input
                type="hidden"
                name="strategic_direction_id"
                value={direction.id}
              />
              <label className="text-xs text-zinc-600 md:col-span-2">
                Titel
                <input
                  name="title"
                  defaultValue={direction.title}
                  required
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-zinc-600">
                Strategischer Wert
                <input
                  type="number"
                  name="strategic_value_score"
                  defaultValue={direction.strategic_value_score ?? 3}
                  min={1}
                  max={5}
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-zinc-600">
                Passung Kompetenzen
                <input
                  type="number"
                  name="capability_fit_score"
                  defaultValue={direction.capability_fit_score ?? 3}
                  min={1}
                  max={5}
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-zinc-600">
                Machbarkeit
                <input
                  type="number"
                  name="feasibility_score"
                  defaultValue={direction.feasibility_score ?? 3}
                  min={1}
                  max={5}
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-zinc-600">
                Risiko
                <input
                  type="number"
                  name="risk_score"
                  defaultValue={direction.risk_level ?? 3}
                  min={1}
                  max={5}
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-zinc-600">
                Status
                <select
                  name="status"
                  defaultValue={normalizeStrategicDirectionStatus(direction.status)}
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                >
                  {STRATEGIC_DIRECTION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STRATEGIC_DIRECTION_STATUS_LABELS_DE[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-zinc-600 md:col-span-5">
                Beschreibung
                <textarea
                  name="description"
                  defaultValue={direction.description ?? ""}
                  rows={3}
                  className="mt-1 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                />
              </label>
              <p className="text-[11px] text-zinc-500 md:col-span-5">
                Prioritaet (1–5) und Stossrichtungs-Score werden beim Speichern aus den vier Bewertungen berechnet.
              </p>
              <div className="md:col-span-5">
                <button
                  type="submit"
                  disabled={!canWrite}
                  className="brand-btn px-3 py-1.5 text-xs"
                >
                  Stossrichtung aktualisieren
                </button>
              </div>
            </form>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PillSection title="Herausforderungen (Vorgaenger)">
                {challenges.map((challenge) => {
                  const isLinked = linkedChallengeIds.has(challenge.id);
                  const level = challengeCoverageByDirection[direction.id]?.[challenge.id] ?? null;
                  return (
                    <CoverageStrengthPillButton
                      key={challenge.id}
                      entityKey="strategic_direction_id"
                      entityValue={direction.id}
                      extraFields={{ strategic_challenge_id: challenge.id }}
                      isLinked={isLinked}
                      contributionLevel={isLinked ? level ?? "medium" : null}
                      linkAction={actions.linkDirectionToChallengePredecessor}
                      unlinkAction={actions.unlinkDirectionChallengePredecessor}
                      canWrite={canWrite}
                      title={challenge.title}
                      linkedClassName={pillLinked()}
                      unlinkedClassName={pillNeutral()}
                    >
                      {challenge.title}
                    </CoverageStrengthPillButton>
                  );
                })}
              </PillSection>

              <PillSection title="Ziele (Objectives)">
                {objectives.map((objective) => {
                  const isLinked = linkedObjectiveIds.has(objective.id);
                  const level = objectiveCoverageByDirection[direction.id]?.[objective.id] ?? null;
                  const linkOk = isObjectiveEligibleForDirectionLink(objective.status);
                  return (
                    <CoverageStrengthPillButton
                      key={objective.id}
                      entityKey="strategic_direction_id"
                      entityValue={direction.id}
                      extraFields={{ objective_id: objective.id }}
                      isLinked={isLinked}
                      contributionLevel={isLinked ? level ?? "medium" : null}
                      linkAction={actions.linkDirectionToObjectiveInCycle}
                      unlinkAction={actions.unlinkDirectionFromObjectiveInCycle}
                      canWrite={canWrite}
                      linkSelectionDisabled={!linkOk}
                      title={
                        linkOk
                          ? objective.title
                          : `${objective.title} — Verknuepfen nur bei Status aktiv oder auffaellig (at_risk)`
                      }
                      linkedClassName={pillLinked()}
                      unlinkedClassName={pillNeutral()}
                    >
                      {objective.title}
                    </CoverageStrengthPillButton>
                  );
                })}
              </PillSection>

              <PillSection title="Industrien">
                {industries.map((industry) => {
                  const isLinked = linkedIndustryIds.has(industry.id);
                  return (
                    <EntityPillButton
                      key={industry.id}
                      entityKey="strategic_direction_id"
                      entityValue={direction.id}
                      extraFields={{ industry_id: industry.id }}
                      isLinked={isLinked}
                      linkAction={actions.linkStrategicDirectionToIndustryInCycle}
                      unlinkAction={actions.unlinkStrategicDirectionFromIndustryInCycle}
                      canWrite={canWrite}
                      title={industry.name}
                      linkedClassName={pillLinked()}
                      unlinkedClassName={pillNeutral()}
                    >
                      {industry.name}
                    </EntityPillButton>
                  );
                })}
              </PillSection>

              <PillSection title="Geschaeftsmodelle">
                {businessModels.map((model) => {
                  const isLinked = linkedBusinessModelIds.has(model.id);
                  return (
                    <EntityPillButton
                      key={model.id}
                      entityKey="strategic_direction_id"
                      entityValue={direction.id}
                      extraFields={{ business_model_id: model.id }}
                      isLinked={isLinked}
                      linkAction={actions.linkStrategicDirectionToBusinessModelInCycle}
                      unlinkAction={actions.unlinkStrategicDirectionFromBusinessModelInCycle}
                      canWrite={canWrite}
                      title={model.name}
                      linkedClassName={pillLinked()}
                      unlinkedClassName={pillNeutral()}
                    >
                      {model.name}
                    </EntityPillButton>
                  );
                })}
              </PillSection>
            </div>

            {(programsByDirectionId[direction.id] ?? []).length > 0 && (
              <PillSection title="Programme">
                {(programsByDirectionId[direction.id] ?? []).map((program) => (
                  <span key={program.id} className={pillLinked()}>
                    {program.title}
                  </span>
                ))}
              </PillSection>
            )}
          </div>
        );
      }}
    />
  );
}
