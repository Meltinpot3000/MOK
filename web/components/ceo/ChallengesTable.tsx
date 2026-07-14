"use client";

import { useMemo, useState } from "react";
import {
  TableFilterBar,
  TableFilterSearch,
  TableFilterSelect,
} from "@/components/table/TableFilterBar";
import { matchesTableTitleSearch } from "@/lib/table/filter-utils";
import type { DescriptionQualityViewModel } from "@/lib/strategy-cycle/description-quality-view";
import type { DescriptionQualityFilterValue } from "@/lib/strategy-cycle/description-quality-view";
import { DescriptionQualityBadge } from "@/components/ceo/strategy-objects/DescriptionQualityBadge";
import { DescriptionQualityHintBox } from "@/components/ceo/strategy-objects/DescriptionQualityHintBox";
import {
  DESCRIPTION_QUALITY_FILTER_OPTIONS,
  filterRowsByDescriptionQuality,
  mergeExpandedRowIds,
  resolveInitialDescriptionQualityFilter,
  useDescriptionQualityTableFocus,
} from "@/components/ceo/strategy-objects/description-quality-table-utils";
import {
  definitionFieldInputClass,
  getOperationalSignalLabelDe,
  getReviewDecisionLabelDe,
  formatStrategyObjectStandLabel,
  readAssignmentIds,
  resolveOpenDraftForVersioning,
  strategyObjectStandSortValue,
  isStrategyObjectDefinitionLocked,
  type StrategyObjectVersioningMeta,
} from "@/lib/strategy-objects";
import { StrategyObjectDraftPanel } from "@/components/ceo/strategy-objects/StrategyObjectDraftPanel";
import { StrategyObjectRevisionFooter } from "@/components/ceo/strategy-objects/StrategyObjectRevisionFooter";
import type { StrategyObjectRevisionRow } from "@/lib/strategy-objects";
import { EntityPillButton } from "./EntityPillButton";
import { ExpandableTable, pillLinked, pillNeutral } from "./ExpandableTable";

type Challenge = {
  id: string;
  title: string;
  description: string | null;
  impact_score: number | null;
  urgency_score: number | null;
  scope_score: number | null;
  root_cause_score: number | null;
  challenge_score: number | null;
  relevance_level: number | null;
  risk_level: number | null;
  versioning?: StrategyObjectVersioningMeta;
};

type AnalysisEntryOption = {
  id: string;
  title: string;
  analysis_type: string;
};

type ChallengesTableProps = {
  challenges: Challenge[];
  industries: Array<{ id: string; name: string }>;
  businessModels: Array<{ id: string; name: string }>;
  industryIdsByChallenge: Record<string, string[]>;
  businessModelIdsByChallenge: Record<string, string[]>;
  analysisEntries: AnalysisEntryOption[];
  analysisEntryIdsByChallenge: Record<string, string[]>;
  /** Welcher Analyse-Eintrag ist bereits einer Herausforderung zugeordnet (pro Zyklus höchstens eine). */
  challengeIdByAnalysisEntryId: Record<string, string>;
  directionCountByChallengeId: Record<string, number>;
  canWrite: boolean;
  openDraftByIdentityId?: Record<string, StrategyObjectRevisionRow>;
  returnPath?: string;
  descriptionQualityById?: Record<string, DescriptionQualityViewModel>;
  initialQualityFilter?: DescriptionQualityFilterValue;
  focusObjectId?: string | null;
  descriptionQualityReview?: boolean;
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
    updateStrategicChallengeAssessment: (formData: FormData) => Promise<void>;
    deleteStrategicChallengeInCycle: (formData: FormData) => Promise<void>;
    linkStrategicChallengeToIndustryInCycle: (formData: FormData) => Promise<void>;
    unlinkStrategicChallengeFromIndustryInCycle: (
      formData: FormData
    ) => Promise<void>;
    linkStrategicChallengeToBusinessModelInCycle: (
      formData: FormData
    ) => Promise<void>;
    unlinkStrategicChallengeFromBusinessModelInCycle: (
      formData: FormData
    ) => Promise<void>;
    linkStrategicChallengeToAnalysisEntryInCycle: (formData: FormData) => Promise<void>;
    unlinkStrategicChallengeFromAnalysisEntryInCycle: (formData: FormData) => Promise<void>;
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

function shortEntryTitle(title: string, max = 40) {
  const t = title.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function ChallengesTable({
  challenges,
  industries,
  businessModels,
  industryIdsByChallenge,
  businessModelIdsByChallenge,
  analysisEntries,
  analysisEntryIdsByChallenge,
  challengeIdByAnalysisEntryId,
  directionCountByChallengeId,
  canWrite,
  openDraftByIdentityId = {},
  returnPath = "/strategy-cycle?l1=strategic-directions&l2=challenges",
  descriptionQualityById,
  initialQualityFilter,
  focusObjectId = null,
  descriptionQualityReview = false,
  revisionActions,
  actions,
}: ChallengesTableProps) {
  const [filterIndustryId, setFilterIndustryId] = useState("");
  const [filterBusinessModelId, setFilterBusinessModelId] = useState("");
  const [searchTitle, setSearchTitle] = useState("");
  const [filterDescriptionQuality, setFilterDescriptionQuality] = useState(
    () => resolveInitialDescriptionQualityFilter(initialQualityFilter, descriptionQualityReview)
  );

  useDescriptionQualityTableFocus(focusObjectId, "challenge-");

  const industryFilterOptions = useMemo(
    () =>
      [...industries]
        .sort((a, b) => a.name.localeCompare(b.name, "de"))
        .map((i) => ({ value: i.id, label: i.name })),
    [industries]
  );

  const businessModelFilterOptions = useMemo(
    () =>
      [...businessModels]
        .sort((a, b) => a.name.localeCompare(b.name, "de"))
        .map((m) => ({ value: m.id, label: m.name })),
    [businessModels]
  );

  const filteredChallenges = useMemo(() => {
    const byDimensions = challenges.filter((c) => {
      if (!matchesTableTitleSearch(c.title, searchTitle)) return false;
      if (filterIndustryId) {
        const ids = industryIdsByChallenge[c.id] ?? [];
        if (!ids.includes(filterIndustryId)) return false;
      }
      if (filterBusinessModelId) {
        const ids = businessModelIdsByChallenge[c.id] ?? [];
        if (!ids.includes(filterBusinessModelId)) return false;
      }
      return true;
    });
    return filterRowsByDescriptionQuality(
      byDimensions,
      descriptionQualityById,
      filterDescriptionQuality
    );
  }, [
    challenges,
    searchTitle,
    filterIndustryId,
    filterBusinessModelId,
    industryIdsByChallenge,
    businessModelIdsByChallenge,
    descriptionQualityById,
    filterDescriptionQuality,
  ]);

  const draftExpandedRowIds = useMemo(
    () =>
      filteredChallenges
        .filter((c) => resolveOpenDraftForVersioning(c.versioning, openDraftByIdentityId))
        .map((c) => c.id),
    [filteredChallenges, openDraftByIdentityId]
  );

  const expandedRowIds = useMemo(
    () =>
      mergeExpandedRowIds(
        draftExpandedRowIds,
        focusObjectId ? [focusObjectId] : undefined
      ),
    [draftExpandedRowIds, focusObjectId]
  );

  const columns = [
    {
      id: "title",
      label: "Titel",
      sortValue: (c: Challenge) => c.title,
      render: (c: Challenge) => (
        <span className="font-medium text-zinc-900">{c.title}</span>
      ),
    },
    {
      id: "challenge_score",
      label: "Herausforderungs-Score",
      defaultVisible: true,
      sortValue: (c: Challenge) =>
        c.challenge_score != null ? Number(c.challenge_score) : null,
      render: (c: Challenge) =>
        c.challenge_score != null
          ? Number(c.challenge_score).toFixed(2)
          : "-",
    },
    {
      id: "versioning_stand",
      label: "Stand",
      defaultVisible: true,
      sortValue: (c: Challenge) => {
        const openDraft = resolveOpenDraftForVersioning(c.versioning, openDraftByIdentityId);
        return strategyObjectStandSortValue(c.versioning, openDraft);
      },
      render: (c: Challenge) => {
        const openDraft = resolveOpenDraftForVersioning(c.versioning, openDraftByIdentityId);
        return (
          <span className={openDraft ? "text-sky-900" : undefined}>
            {formatStrategyObjectStandLabel(c.versioning, openDraft)}
          </span>
        );
      },
    },
    {
      id: "versioning_signal",
      label: "Lage",
      defaultVisible: true,
      sortValue: (c: Challenge) => c.versioning?.latest_operational_signal ?? null,
      render: (c: Challenge) => getOperationalSignalLabelDe(c.versioning?.latest_operational_signal),
    },
    {
      id: "versioning_review",
      label: "Review",
      defaultVisible: true,
      sortValue: (c: Challenge) => c.versioning?.latest_review_decision ?? null,
      render: (c: Challenge) => getReviewDecisionLabelDe(c.versioning?.latest_review_decision),
    },
    {
      id: "description_quality",
      label: "Beschreibung / Prüfqualität",
      defaultVisible: true,
      sortValue: (c: Challenge) =>
        descriptionQualityById?.[c.id]?.sortRank ?? 99,
      render: (c: Challenge) => {
        const quality = descriptionQualityById?.[c.id];
        if (!quality) return <span className="text-zinc-400">Keine Daten</span>;
        return <DescriptionQualityBadge status={quality.displayStatus} />;
      },
    },
    {
      id: "directions",
      label: "Verkn\u00FCpfte Sto\u00DFrichtungen",
      defaultVisible: true,
      sortValue: (c: Challenge) => directionCountByChallengeId[c.id] ?? 0,
      render: (c: Challenge) =>
        directionCountByChallengeId[c.id] ?? 0,
    },
    {
      id: "impact",
      label: "Auswirkung",
      defaultVisible: false,
      sortValue: (c: Challenge) => c.impact_score ?? null,
      render: (c: Challenge) => String(c.impact_score ?? "-"),
    },
    {
      id: "urgency",
      label: "Dringlichkeit",
      defaultVisible: false,
      sortValue: (c: Challenge) => c.urgency_score ?? null,
      render: (c: Challenge) => String(c.urgency_score ?? "-"),
    },
    {
      id: "industries",
      label: "Industrien",
      defaultVisible: true,
      sortValue: (c: Challenge) => {
        const ids = industryIdsByChallenge[c.id] ?? [];
        const names = industries
          .filter((i) => ids.includes(i.id))
          .map((i) => i.name)
          .sort((a, b) => a.localeCompare(b, "de"));
        return names.join(", ") || null;
      },
      render: (c: Challenge) => {
        const ids = industryIdsByChallenge[c.id] ?? [];
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
      sortValue: (c: Challenge) => {
        const ids = businessModelIdsByChallenge[c.id] ?? [];
        const names = businessModels
          .filter((m) => ids.includes(m.id))
          .map((m) => m.name)
          .sort((a, b) => a.localeCompare(b, "de"));
        return names.join(", ") || null;
      },
      render: (c: Challenge) => {
        const ids = businessModelIdsByChallenge[c.id] ?? [];
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
          label="Beschreibung / Prüfqualität"
          value={filterDescriptionQuality}
          onChange={setFilterDescriptionQuality}
          className="min-w-[160px] flex-1"
          options={DESCRIPTION_QUALITY_FILTER_OPTIONS}
        />
        <TableFilterSelect
          label="Industrie"
          value={filterIndustryId}
          onChange={setFilterIndustryId}
          className="min-w-[140px] flex-1"
          options={industryFilterOptions}
        />
        <TableFilterSelect
          label="Geschäftsmodell"
          value={filterBusinessModelId}
          onChange={setFilterBusinessModelId}
          className="min-w-[140px] flex-1"
          options={businessModelFilterOptions}
        />
        <TableFilterSearch value={searchTitle} onChange={setSearchTitle} />
      </TableFilterBar>

      <ExpandableTable<Challenge>
      columns={columns}
      rows={filteredChallenges}
      getRowId={(c) => c.id}
      rowIdPrefix="challenge-"
      selectedRowId={focusObjectId}
      initialExpandedIds={expandedRowIds}
      expandLabel="Details"
      emptyMessage={
        challenges.length === 0
          ? "Keine strategischen Herausforderungen vorhanden."
          : "Keine Treffer für die gewählten Filter."
      }
      renderExpandedContent={(challenge) => {
        const linkedIndustryIds = new Set(
          industryIdsByChallenge[challenge.id] ?? []
        );
        const linkedBusinessModelIds = new Set(
          businessModelIdsByChallenge[challenge.id] ?? []
        );
        const linkedAnalysisEntryIds = new Set(analysisEntryIdsByChallenge[challenge.id] ?? []);
        const definitionLocked = isStrategyObjectDefinitionLocked({
          objectType: "strategic_challenge",
          versioning: challenge.versioning,
        });
        const openDraft = resolveOpenDraftForVersioning(challenge.versioning, openDraftByIdentityId);
        const lifecycleState = challenge.versioning?.identity_lifecycle_state ?? null;
        const identityId = challenge.versioning?.object_identity_id ?? null;
        const baseRevisionId = challenge.versioning?.revision_id ?? challenge.id;

        const draftMode = Boolean(openDraft && revisionActions);
        const assignmentsReadOnly = !draftMode && definitionLocked;
        const draftIndustryIds = new Set(
          openDraft ? readAssignmentIds(openDraft.definition_payload, "industry") : []
        );
        const draftBusinessModelIds = new Set(
          openDraft ? readAssignmentIds(openDraft.definition_payload, "business_model") : []
        );
        const draftAnalysisEntryIds = new Set(
          openDraft ? readAssignmentIds(openDraft.definition_payload, "analysis_entry") : []
        );
        const draftFormId = `strategy-challenge-draft-${challenge.id}`;
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
              entityKey="strategic_challenge_id"
              entityValue={challenge.id}
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
            {descriptionQualityById?.[challenge.id] ? (
              <DescriptionQualityHintBox quality={descriptionQualityById[challenge.id]} />
            ) : null}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                Verknüpfte Stoßrichtungen:{" "}
                {directionCountByChallengeId[challenge.id] ?? 0}
              </span>
              <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                Herausforderungs-Score:{" "}
                {Number(challenge.challenge_score ?? 0).toFixed(2)}
              </span>
            </div>

            {openDraft && revisionActions ? (
              <StrategyObjectDraftPanel
                draft={openDraft}
                returnPath={returnPath}
                canWrite={canWrite}
                draftFormId={draftFormId}
                actions={revisionActions}
                externalActions
              />
            ) : null}

            {!openDraft ? (
              <form
                action={actions.updateStrategicChallengeAssessment}
                className="space-y-3"
              >
                <input
                  type="hidden"
                  name="strategic_challenge_id"
                  value={challenge.id}
                />
                <label className="block text-xs text-zinc-600">
                  Titel
                  <input
                    name="title"
                    defaultValue={challenge.title}
                    required
                    readOnly={definitionLocked}
                    aria-readonly={definitionLocked}
                    className={definitionFieldInputClass(
                      definitionLocked,
                      "mt-1 block w-full max-w-2xl rounded border border-zinc-300 px-2 py-1.5 text-sm"
                    )}
                  />
                </label>
                <label className="block text-xs text-zinc-600">
                  Beschreibung
                  <textarea
                    name="description"
                    defaultValue={challenge.description ?? ""}
                    rows={4}
                    readOnly={definitionLocked}
                    aria-readonly={definitionLocked}
                    className={definitionFieldInputClass(
                      definitionLocked,
                      "mt-1 block w-full max-w-2xl rounded border border-zinc-300 px-2 py-1.5 text-xs"
                    )}
                  />
                </label>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-xs text-zinc-600">
                    Auswirkung (1–5)
                    <input
                      type="number"
                      name="impact_score"
                      defaultValue={challenge.impact_score ?? 3}
                      min={1}
                      max={5}
                      readOnly={definitionLocked}
                      aria-readonly={definitionLocked}
                      className={definitionFieldInputClass(
                        definitionLocked,
                        "ml-2 w-16 rounded border border-zinc-300 px-2 py-1 text-xs"
                      )}
                    />
                  </label>
                  <label className="text-xs text-zinc-600">
                    Dringlichkeit (1–5)
                    <input
                      type="number"
                      name="urgency_score"
                      defaultValue={challenge.urgency_score ?? 3}
                      min={1}
                      max={5}
                      readOnly={definitionLocked}
                      aria-readonly={definitionLocked}
                      className={definitionFieldInputClass(
                        definitionLocked,
                        "ml-2 w-16 rounded border border-zinc-300 px-2 py-1 text-xs"
                      )}
                    />
                  </label>
                  <label className="text-xs text-zinc-600">
                    Umfang (1–5)
                    <input
                      type="number"
                      name="scope_score"
                      defaultValue={challenge.scope_score ?? 3}
                      min={1}
                      max={5}
                      readOnly={definitionLocked}
                      aria-readonly={definitionLocked}
                      className={definitionFieldInputClass(
                        definitionLocked,
                        "ml-2 w-16 rounded border border-zinc-300 px-2 py-1 text-xs"
                      )}
                    />
                  </label>
                  <label className="text-xs text-zinc-600">
                    Steuerbarkeit (1–5)
                    <input
                      type="number"
                      name="root_cause_score"
                      defaultValue={challenge.root_cause_score ?? 3}
                      min={1}
                      max={5}
                      readOnly={definitionLocked}
                      aria-readonly={definitionLocked}
                      className={definitionFieldInputClass(
                        definitionLocked,
                        "ml-2 w-16 rounded border border-zinc-300 px-2 py-1 text-xs"
                      )}
                    />
                  </label>
                  {showUpdateButton ? (
                    <button
                      type="submit"
                      disabled={!canWrite}
                      className="brand-btn px-3 py-1.5 text-xs"
                    >
                      Bewertung speichern
                    </button>
                  ) : null}
                </div>
              </form>
            ) : null}

            <div className="space-y-2">
              {assignmentsReadOnly ? (
                <p className="text-[11px] text-zinc-500">
                  Zuordnungen sind in der aktiven Revision fixiert. Für Änderungen «Neue Revision».
                </p>
              ) : draftMode ? (
                <p className="text-[11px] text-sky-800">
                  Zuordnungen des Entwurfs — werden mit «Revision übernehmen» aktiv.
                </p>
              ) : null}

              <PillSection
                title={
                  assignmentsReadOnly
                    ? "Analyse-Einträge (in Revision fixiert)"
                    : draftMode
                      ? "Analyse-Einträge (Entwurf)"
                      : "Analyse-Einträge"
                }
              >
                {analysisEntries.map((entry) => {
                  const isLinkedLive = linkedAnalysisEntryIds.has(entry.id);
                  const isLinkedDraft = draftAnalysisEntryIds.has(entry.id);
                  const ownerId = challengeIdByAnalysisEntryId[entry.id];
                  const stealHint =
                    !draftMode &&
                    !isLinkedLive &&
                    ownerId &&
                    ownerId !== challenge.id
                      ? "Andere Herausforderung zugeordnet — Klick übernimmt die Verknüpfung hierher."
                      : `${entry.title} (${entry.analysis_type})`;

                  if (draftMode && openDraft && revisionActions) {
                    return (
                      <EntityPillButton
                        key={entry.id}
                        entityKey="revision_id"
                        entityValue={openDraft.id}
                        extraFields={{
                          assignment_kind: "analysis_entry",
                          assignment_id: entry.id,
                          return_path: returnPath,
                        }}
                        isLinked={isLinkedDraft}
                        linkAction={revisionActions.linkStrategyObjectDraftAssignment}
                        unlinkAction={revisionActions.unlinkStrategyObjectDraftAssignment}
                        canWrite={canWrite}
                        title={`${entry.title} (${entry.analysis_type})`}
                        linkedClassName={pillLinked()}
                        unlinkedClassName={pillNeutral()}
                      >
                        {shortEntryTitle(entry.title)} ({entry.analysis_type})
                      </EntityPillButton>
                    );
                  }

                  return (
                    <EntityPillButton
                      key={entry.id}
                      entityKey="strategic_challenge_id"
                      entityValue={challenge.id}
                      extraFields={{ analysis_entry_id: entry.id }}
                      isLinked={isLinkedLive}
                      linkAction={actions.linkStrategicChallengeToAnalysisEntryInCycle}
                      unlinkAction={actions.unlinkStrategicChallengeFromAnalysisEntryInCycle}
                      canWrite={canWrite && !assignmentsReadOnly}
                      title={stealHint}
                      linkedClassName={pillLinked()}
                      unlinkedClassName={pillNeutral()}
                    >
                      {shortEntryTitle(entry.title)} ({entry.analysis_type})
                    </EntityPillButton>
                  );
                })}
              </PillSection>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <PillSection title="Industrien">
                  {industries.map((industry) =>
                    renderAssignmentPill(
                      "industry",
                      industry.id,
                      industry.name,
                      actions.linkStrategicChallengeToIndustryInCycle,
                      actions.unlinkStrategicChallengeFromIndustryInCycle,
                      "industry_id",
                      linkedIndustryIds.has(industry.id),
                      draftIndustryIds.has(industry.id)
                    )
                  )}
                </PillSection>

                <PillSection title="Geschäftsmodelle">
                  {businessModels.map((model) =>
                    renderAssignmentPill(
                      "business_model",
                      model.id,
                      model.name,
                      actions.linkStrategicChallengeToBusinessModelInCycle,
                      actions.unlinkStrategicChallengeFromBusinessModelInCycle,
                      "business_model_id",
                      linkedBusinessModelIds.has(model.id),
                      draftBusinessModelIds.has(model.id)
                    )
                  )}
                </PillSection>
              </div>
            </div>

            {revisionActions ? (
              <StrategyObjectRevisionFooter
                openDraft={openDraft ?? null}
                draftFormId={draftFormId}
                canWrite={canWrite}
                returnPath={returnPath}
                revisionActions={revisionActions}
                actionBarProps={{
                  objectType: "strategic_challenge",
                  objectId: challenge.id,
                  identityId,
                  lifecycleState,
                  baseRevisionId,
                  hasOpenDraft: Boolean(openDraft),
                  canWrite,
                  returnPath,
                  objectNoun: "Herausforderung",
                  deleteAction: actions.deleteStrategicChallengeInCycle,
                  deleteIdField: "strategic_challenge_id",
                  lifecycleAction: revisionActions.setStrategyObjectLifecycle,
                  proposeAction: revisionActions.proposeStrategyObjectDraft,
                }}
              />
            ) : null}
          </div>
        );
      }}
    />
    </div>
  );
}
