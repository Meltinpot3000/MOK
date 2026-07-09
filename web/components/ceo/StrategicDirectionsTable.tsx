"use client";

import { useMemo, useState } from "react";
import {
  TableFilterBar,
  TableFilterSearch,
  TableFilterSelect,
} from "@/components/table/TableFilterBar";
import type { ContributionLevel } from "@/lib/strategy-cycle/coverage-level";
import { matchesTableTitleSearch } from "@/lib/table/filter-utils";
import {
  definitionFieldInputClass,
  isStrategyObjectDefinitionLocked,
  getOperationalSignalLabelDe,
  getReviewDecisionLabelDe,
  formatStrategyObjectStandLabel,
  readAssignmentIds,
  resolveOpenDraftForVersioning,
  strategyObjectStandSortValue,
  STRATEGY_OBJECT_LIFECYCLE_LABELS_DE,
  type StrategyObjectVersioningMeta,
} from "@/lib/strategy-objects";
import { StrategyObjectDraftPanel } from "@/components/ceo/strategy-objects/StrategyObjectDraftPanel";
import { StrategyObjectActionBar } from "@/components/ceo/strategy-objects/StrategyObjectActionBar";
import type { StrategyObjectRevisionRow } from "@/lib/strategy-objects";
import { COVERAGE_LEVEL_META } from "@/lib/strategy-cycle/coverage-level";
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
  grouping: string | null;
  relevance_level: number | null;
  risk_level: number | null;
  strategic_value_score: number | null;
  capability_fit_score: number | null;
  feasibility_score: number | null;
  created_at: string | null;
  updated_at: string | null;
  versioning?: StrategyObjectVersioningMeta;
};

type StrategicDirectionsTableProps = {
  directions: Direction[];
  challenges: Array<{ id: string; title: string }>;
  objectives: Array<{ id: string; title: string; versioning?: StrategyObjectVersioningMeta }>;
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
  openDraftByIdentityId?: Record<string, StrategyObjectRevisionRow>;
  returnPath?: string;
  revisionActions?: {
    proposeStrategyObjectDraft: (formData: FormData) => Promise<void>;
    updateStrategyObjectDraft: (formData: FormData) => Promise<void>;
    promoteStrategyObjectRevision: (formData: FormData) => Promise<void>;
    rejectStrategyObjectRevision: (formData: FormData) => Promise<void>;
    linkStrategyObjectDraftAssignment: (formData: FormData) => Promise<void>;
    unlinkStrategyObjectDraftAssignment: (formData: FormData) => Promise<void>;
    setStrategyObjectLifecycle: (formData: FormData) => Promise<void>;
  };
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
  openDraftByIdentityId = {},
  returnPath = "/strategy-cycle?l1=strategic-directions&l2=design",
  revisionActions,
  actions,
}: StrategicDirectionsTableProps) {
  const [filterLifecycle, setFilterLifecycle] = useState("");
  const [searchTitle, setSearchTitle] = useState("");

  const lifecycleFilterOptions = useMemo(() => {
    const states = [
      ...new Set(
        directions
          .map((d) => d.versioning?.identity_lifecycle_state)
          .filter((value): value is NonNullable<typeof value> => Boolean(value))
      ),
    ];
    return states.map((state) => ({
      value: state,
      label: STRATEGY_OBJECT_LIFECYCLE_LABELS_DE[state] ?? state,
    }));
  }, [directions]);

  const filteredDirections = useMemo(() => {
    return directions.filter((d) => {
      if (filterLifecycle && d.versioning?.identity_lifecycle_state !== filterLifecycle) {
        return false;
      }
      if (!matchesTableTitleSearch(d.title, searchTitle)) return false;
      return true;
    });
  }, [directions, filterLifecycle, searchTitle]);

  const draftExpandedRowIds = useMemo(
    () =>
      filteredDirections
        .filter((d) => resolveOpenDraftForVersioning(d.versioning, openDraftByIdentityId))
        .map((d) => d.id),
    [filteredDirections, openDraftByIdentityId]
  );

  const columns = [
    {
      id: "title",
      label: "Titel",
      sortValue: (d: Direction) => d.title,
      render: (d: Direction) => (
        <span className="truncate font-medium text-zinc-900">{d.title}</span>
      ),
    },
    {
      id: "priority",
      label: "Priorit\u00E4t (Score)",
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
      id: "versioning_stand",
      label: "Stand",
      defaultVisible: true,
      sortValue: (d: Direction) => {
        const openDraft = resolveOpenDraftForVersioning(d.versioning, openDraftByIdentityId);
        return strategyObjectStandSortValue(d.versioning, openDraft);
      },
      render: (d: Direction) => {
        const openDraft = resolveOpenDraftForVersioning(d.versioning, openDraftByIdentityId);
        return (
          <span className={openDraft ? "text-sky-900" : undefined}>
            {formatStrategyObjectStandLabel(d.versioning, openDraft)}
          </span>
        );
      },
    },
    {
      id: "versioning_signal",
      label: "Lage",
      defaultVisible: true,
      sortValue: (d: Direction) => d.versioning?.latest_operational_signal ?? null,
      render: (d: Direction) => getOperationalSignalLabelDe(d.versioning?.latest_operational_signal),
    },
    {
      id: "versioning_review",
      label: "Review",
      defaultVisible: true,
      sortValue: (d: Direction) => d.versioning?.latest_review_decision ?? null,
      render: (d: Direction) => getReviewDecisionLabelDe(d.versioning?.latest_review_decision),
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
              title="Anzahl verkn\u00FCpfter Herausforderungen vs. alle im Zyklus (Farbe wie Strategie-Matrix)"
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
      label: "Ziele",
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
              title="Anzahl verkn\u00FCpfter Ziele vs. alle Ziele im Zyklus (Farbe wie Strategie-Matrix)"
            >
              Ziele {n}/{total}
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
      label: "Gesch\u00E4ftsmodelle",
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
    <div className="w-full min-w-0 max-w-full space-y-3">
      <TableFilterBar>
        <TableFilterSelect
          label="Lifecycle"
          value={filterLifecycle}
          onChange={setFilterLifecycle}
          options={lifecycleFilterOptions}
        />
        <TableFilterSearch value={searchTitle} onChange={setSearchTitle} />
      </TableFilterBar>

      <ExpandableTable<Direction>
      columns={columns}
      rows={filteredDirections}
      getRowId={(d) => d.id}
      initialExpandedIds={draftExpandedRowIds}
      expandLabel="Details"
      emptyMessage={
        directions.length === 0
          ? "Keine strategischen Sto\u00DFrichtungen vorhanden."
          : "Keine Treffer für die gewählten Filter."
      }
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
        const definitionLocked = isStrategyObjectDefinitionLocked({
          objectType: "strategic_direction",
          versioning: direction.versioning,
        });
        const openDraft = resolveOpenDraftForVersioning(direction.versioning, openDraftByIdentityId);
        const lifecycleState = direction.versioning?.identity_lifecycle_state ?? null;
        const identityId = direction.versioning?.object_identity_id ?? null;
        const baseRevisionId = direction.versioning?.revision_id ?? direction.id;

        const draftMode = Boolean(openDraft && revisionActions);
        const assignmentsReadOnly = !draftMode && definitionLocked;
        const draftIndustryIds = new Set(
          openDraft ? readAssignmentIds(openDraft.definition_payload, "industry") : []
        );
        const draftBusinessModelIds = new Set(
          openDraft ? readAssignmentIds(openDraft.definition_payload, "business_model") : []
        );
        const showUpdateButton = !definitionLocked && !openDraft;

        const renderAssignmentPill = (
          kind: "industry" | "business_model",
          id: string,
          label: string,
          liveLinkAction: (fd: FormData) => Promise<void>,
          liveUnlinkAction: (fd: FormData) => Promise<void>,
          liveIdField: string,
          liveIsLinked: boolean,
          draftIsLinked: boolean
        ) => {
          if (draftMode && openDraft && revisionActions) {
            return (
              <EntityPillButton
                key={id}
                entityKey="revision_id"
                entityValue={openDraft.id}
                extraFields={{ assignment_kind: kind, assignment_id: id, return_path: returnPath }}
                isLinked={draftIsLinked}
                linkAction={revisionActions.linkStrategyObjectDraftAssignment}
                unlinkAction={revisionActions.unlinkStrategyObjectDraftAssignment}
                canWrite={canWrite}
                title={label}
                linkedClassName={pillLinked()}
                unlinkedClassName={pillNeutral()}
              >
                {label}
              </EntityPillButton>
            );
          }
          return (
            <EntityPillButton
              key={id}
              entityKey="strategic_direction_id"
              entityValue={direction.id}
              extraFields={{ [liveIdField]: id }}
              isLinked={liveIsLinked}
              linkAction={liveLinkAction}
              unlinkAction={liveUnlinkAction}
              canWrite={canWrite && !assignmentsReadOnly}
              title={label}
              linkedClassName={pillLinked()}
              unlinkedClassName={pillNeutral()}
            >
              {label}
            </EntityPillButton>
          );
        };

        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                Abdeckung {coverage.percent}% ({coverage.linked}/
                {coverage.total || 0})
              </span>
              <span className="rounded-md border border-sky-300 bg-sky-50 px-2 py-1 text-xs text-sky-900">
                Priorität (Score):{" "}
                {direction.priority != null && direction.priority !== ""
                  ? Number(direction.priority).toFixed(2)
                  : "—"}
              </span>
            </div>

            {openDraft && revisionActions ? (
              <StrategyObjectDraftPanel
                draft={openDraft}
                returnPath={returnPath}
                canWrite={canWrite}
                actions={revisionActions}
              />
            ) : null}

            {!openDraft ? (
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
                    readOnly={definitionLocked}
                    aria-readonly={definitionLocked}
                    className={definitionFieldInputClass(
                      definitionLocked,
                      "mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                    )}
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
                    readOnly={definitionLocked}
                    aria-readonly={definitionLocked}
                    className={definitionFieldInputClass(
                      definitionLocked,
                      "mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                    )}
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
                    readOnly={definitionLocked}
                    aria-readonly={definitionLocked}
                    className={definitionFieldInputClass(
                      definitionLocked,
                      "mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                    )}
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
                    readOnly={definitionLocked}
                    aria-readonly={definitionLocked}
                    className={definitionFieldInputClass(
                      definitionLocked,
                      "mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                    )}
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
                    readOnly={definitionLocked}
                    aria-readonly={definitionLocked}
                    className={definitionFieldInputClass(
                      definitionLocked,
                      "mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                    )}
                  />
                </label>
                <label className="block text-xs text-zinc-600 md:col-span-5">
                  Beschreibung
                  <textarea
                    name="description"
                    defaultValue={direction.description ?? ""}
                    rows={3}
                    readOnly={definitionLocked}
                    aria-readonly={definitionLocked}
                    className={definitionFieldInputClass(
                      definitionLocked,
                      "mt-1 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                    )}
                  />
                </label>
                <p className="text-[11px] text-zinc-500 md:col-span-5">
                  Priorität (1–5) und Stoßrichtungs-Score werden beim Speichern aus den vier Bewertungen berechnet.
                </p>
                {showUpdateButton ? (
                  <div className="md:col-span-5">
                    <button
                      type="submit"
                      disabled={!canWrite}
                      className="brand-btn px-3 py-1.5 text-xs"
                    >
                      Stoßrichtung aktualisieren
                    </button>
                  </div>
                ) : null}
              </form>
            ) : null}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PillSection title="Herausforderungen (Vorg\u00E4nger)">
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

              <PillSection title="Strategische Ziele">
                {objectives.map((objective) => {
                  const isLinked = linkedObjectiveIds.has(objective.id);
                  const level = objectiveCoverageByDirection[direction.id]?.[objective.id] ?? null;
                  const linkOk = isObjectiveEligibleForDirectionLink(objective.versioning);
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

              <PillSection
                title={
                  assignmentsReadOnly
                    ? "Industrien (in Revision fixiert)"
                    : draftMode
                    ? "Industrien (Entwurf)"
                    : "Industrien"
                }
              >
                {industries.map((industry) =>
                  renderAssignmentPill(
                    "industry",
                    industry.id,
                    industry.name,
                    actions.linkStrategicDirectionToIndustryInCycle,
                    actions.unlinkStrategicDirectionFromIndustryInCycle,
                    "industry_id",
                    linkedIndustryIds.has(industry.id),
                    draftIndustryIds.has(industry.id)
                  )
                )}
              </PillSection>

              <PillSection
                title={
                  assignmentsReadOnly
                    ? "Geschäftsmodelle (in Revision fixiert)"
                    : draftMode
                    ? "Geschäftsmodelle (Entwurf)"
                    : "Geschäftsmodelle"
                }
              >
                {businessModels.map((model) =>
                  renderAssignmentPill(
                    "business_model",
                    model.id,
                    model.name,
                    actions.linkStrategicDirectionToBusinessModelInCycle,
                    actions.unlinkStrategicDirectionFromBusinessModelInCycle,
                    "business_model_id",
                    linkedBusinessModelIds.has(model.id),
                    draftBusinessModelIds.has(model.id)
                  )
                )}
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

            {revisionActions ? (
              <StrategyObjectActionBar
                objectType="strategic_direction"
                objectId={direction.id}
                identityId={identityId}
                lifecycleState={lifecycleState}
                baseRevisionId={baseRevisionId}
                hasOpenDraft={Boolean(openDraft)}
                canWrite={canWrite}
                returnPath={returnPath}
                objectNoun="Stoßrichtung"
                deleteAction={actions.deleteStrategicDirectionInCycle}
                deleteIdField="strategic_direction_id"
                lifecycleAction={revisionActions.setStrategyObjectLifecycle}
                proposeAction={revisionActions.proposeStrategyObjectDraft}
              />
            ) : null}
          </div>
        );
      }}
    />
    </div>
  );
}
