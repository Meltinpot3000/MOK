"use client";

import { useMemo, useState } from "react";
import {
  TableFilterBar,
  TableFilterSearch,
  TableFilterSelect,
} from "@/components/table/TableFilterBar";
import { matchesTableTitleSearch } from "@/lib/table/filter-utils";
import { formatCreatorLabel } from "@/lib/creator/format";
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
import { EntityPillButton } from "./EntityPillButton";
import { ExpandableTable, pillLinked, pillNeutral } from "./ExpandableTable";
import { ObjectiveAiPanel } from "./ObjectiveAiPanel";

type Objective = {
  id: string;
  title: string;
  description: string | null;
  importance_score: number | null;
  time_horizon: string | null;
  created_by_membership_id?: string | null;
  created_by_source?: string | null;
  ai_objective_score?: number | null;
  ai_clarity_score?: number | null;
  ai_strategic_relevance_score?: number | null;
  ai_feasibility_score?: number | null;
  ai_fit_to_company_score?: number | null;
  ai_external_internal_classification?: string | null;
  ai_short_long_term_classification?: string | null;
  ai_exploit_explore_classification?: string | null;
  ai_issues_json?: unknown;
  ai_improvement_suggestion?: string | null;
  ai_evaluation_status?: string | null;
  ai_evaluated_at?: string | null;
  ai_manual_override?: boolean | null;
  versioning?: StrategyObjectVersioningMeta;
};

type ObjectivesTableProps = {
  objectives: Objective[];
  industries: Array<{ id: string; name: string }>;
  businessModels: Array<{ id: string; name: string }>;
  industryIdsByObjective: Record<string, string[]>;
  businessModelIdsByObjective: Record<string, string[]>;
  creatorDisplayNameByMembershipId?: Record<string, string>;
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
    updateObjectiveInCycle: (formData: FormData) => Promise<void>;
    deleteObjectiveInCycle: (formData: FormData) => Promise<void>;
    linkObjectiveToIndustryInCycle: (formData: FormData) => Promise<void>;
    unlinkObjectiveFromIndustryInCycle: (formData: FormData) => Promise<void>;
    linkObjectiveToBusinessModelInCycle: (formData: FormData) => Promise<void>;
    unlinkObjectiveFromBusinessModelInCycle: (formData: FormData) => Promise<void>;
  };
};

/** Aus der Sentinel✨-Klassifikation (KEINE eigene Berechnung in der Tabelle). */
function formatInternalExternalTendency(value: string | null | undefined): string {
  if (!value?.trim()) return "–";
  const v = value.toLowerCase();
  if (v === "internal") return "Intern";
  if (v === "external") return "Extern";
  if (v === "balanced") return "Ausgewogen";
  return value;
}

function formatExploitExploreTendency(value: string | null | undefined): string {
  if (!value?.trim()) return "–";
  const v = value.toLowerCase();
  if (v === "exploit") return "Exploit";
  if (v === "explore") return "Explore";
  if (v === "balanced") return "Ausgewogen";
  return value;
}

const FORM_LABEL = "text-xs font-medium text-zinc-600";
const FORM_INPUT =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";

function PillSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-md border border-zinc-200 bg-zinc-50/80 p-3">
      <div>
        <p className="text-xs font-medium text-zinc-700">{title}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function ObjectivesTable({
  objectives,
  industries,
  businessModels,
  industryIdsByObjective,
  businessModelIdsByObjective,
  creatorDisplayNameByMembershipId,
  canWrite,
  openDraftByIdentityId = {},
  returnPath = "/strategy-cycle?l1=objectives",
  revisionActions,
  actions,
}: ObjectivesTableProps) {
  const [filterLifecycle, setFilterLifecycle] = useState("");
  const [searchTitle, setSearchTitle] = useState("");

  const lifecycleFilterOptions = useMemo(() => {
    const states = [
      ...new Set(
        objectives
          .map((o) => o.versioning?.identity_lifecycle_state)
          .filter((value): value is NonNullable<typeof value> => Boolean(value))
      ),
    ];
    return states
      .sort((a, b) => a.localeCompare(b, "de"))
      .map((state) => ({
        value: state,
        label: STRATEGY_OBJECT_LIFECYCLE_LABELS_DE[state] ?? state,
      }));
  }, [objectives]);

  const filteredObjectives = useMemo(() => {
    return objectives.filter((o) => {
      if (filterLifecycle && o.versioning?.identity_lifecycle_state !== filterLifecycle) return false;
      if (!matchesTableTitleSearch(o.title, searchTitle)) return false;
      return true;
    });
  }, [objectives, filterLifecycle, searchTitle]);

  const draftExpandedRowIds = useMemo(
    () =>
      filteredObjectives
        .filter((o) => resolveOpenDraftForVersioning(o.versioning, openDraftByIdentityId))
        .map((o) => o.id),
    [filteredObjectives, openDraftByIdentityId]
  );

  const columns = [
    {
      id: "title",
      label: "Titel",
      sortValue: (o: Objective) => o.title,
      render: (o: Objective) => (
        <span className="font-medium text-zinc-900">{o.title}</span>
      ),
    },
    {
      id: "creator",
      label: "Ersteller",
      defaultVisible: true,
      sortValue: (o: Objective) =>
        formatCreatorLabel(
          o.created_by_source,
          o.created_by_membership_id ? creatorDisplayNameByMembershipId?.[o.created_by_membership_id] : undefined
        ),
      render: (o: Objective) =>
        formatCreatorLabel(
          o.created_by_source,
          o.created_by_membership_id ? creatorDisplayNameByMembershipId?.[o.created_by_membership_id] : undefined
        ),
    },
    {
      id: "time_horizon",
      label: "Zeithorizont",
      defaultVisible: true,
      sortValue: (o: Objective) => o.time_horizon ?? null,
      render: (o: Objective) => o.time_horizon ?? "-",
    },
    {
      id: "importance_score",
      label: "Gewicht",
      defaultVisible: true,
      sortValue: (o: Objective) => o.importance_score ?? null,
      render: (o: Objective) => String(o.importance_score ?? "-"),
    },
    {
      id: "versioning_stand",
      label: "Stand",
      defaultVisible: true,
      sortValue: (o: Objective) => {
        const openDraft = resolveOpenDraftForVersioning(o.versioning, openDraftByIdentityId);
        return strategyObjectStandSortValue(o.versioning, openDraft);
      },
      render: (o: Objective) => {
        const openDraft = resolveOpenDraftForVersioning(o.versioning, openDraftByIdentityId);
        return (
          <span className={openDraft ? "text-sky-900" : undefined}>
            {formatStrategyObjectStandLabel(o.versioning, openDraft)}
          </span>
        );
      },
    },
    {
      id: "versioning_signal",
      label: "Lage",
      defaultVisible: true,
      sortValue: (o: Objective) => o.versioning?.latest_operational_signal ?? null,
      render: (o: Objective) => getOperationalSignalLabelDe(o.versioning?.latest_operational_signal),
    },
    {
      id: "versioning_review",
      label: "Review",
      defaultVisible: true,
      sortValue: (o: Objective) => o.versioning?.latest_review_decision ?? null,
      render: (o: Objective) => getReviewDecisionLabelDe(o.versioning?.latest_review_decision),
    },
    {
      id: "ai_objective_score",
      label: "Sentinel✨ Score",
      defaultVisible: true,
      sortValue: (o: Objective) => o.ai_objective_score ?? null,
      render: (o: Objective) => {
        if (o.ai_objective_score == null) return "-";
        const isOutdated = o.ai_evaluation_status === "outdated";
        return (
          <span className={isOutdated ? "text-amber-700" : undefined}>
            {(o.ai_objective_score as number).toFixed(1)} von 5
            {isOutdated ? (
              <span className="ml-1 text-xs font-medium">(veraltet)</span>
            ) : null}
          </span>
        );
      },
    },
    {
      id: "ai_tendency_internal_external",
      label: "Sentinel✨ Tendenz Intern/Extern",
      defaultVisible: true,
      sortValue: (o: Objective) =>
        formatInternalExternalTendency(o.ai_external_internal_classification),
      render: (o: Objective) => formatInternalExternalTendency(o.ai_external_internal_classification),
    },
    {
      id: "ai_tendency_exploit_explore",
      label: "Sentinel✨ Tendenz Exploit/Explore",
      defaultVisible: true,
      sortValue: (o: Objective) =>
        formatExploitExploreTendency(o.ai_exploit_explore_classification),
      render: (o: Objective) => formatExploitExploreTendency(o.ai_exploit_explore_classification),
    },
    {
      id: "ai_evaluation_status",
      label: "Sentinel✨ Status",
      defaultVisible: false,
      sortValue: (o: Objective) => o.ai_evaluation_status ?? "not_run",
      render: (o: Objective) => o.ai_evaluation_status ?? "not_run",
    },
    {
      id: "industries",
      label: "Industrien",
      defaultVisible: true,
      sortValue: (o: Objective) => {
        const ids = industryIdsByObjective[o.id] ?? [];
        const names = industries
          .filter((i) => ids.includes(i.id))
          .map((i) => i.name)
          .sort((a, b) => a.localeCompare(b, "de"));
        return names.join(", ") || null;
      },
      render: (o: Objective) => {
        const ids = industryIdsByObjective[o.id] ?? [];
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
      label: "Geschäftsmodelle",
      defaultVisible: true,
      sortValue: (o: Objective) => {
        const ids = businessModelIdsByObjective[o.id] ?? [];
        const names = businessModels
          .filter((m) => ids.includes(m.id))
          .map((m) => m.name)
          .sort((a, b) => a.localeCompare(b, "de"));
        return names.join(", ") || null;
      },
      render: (o: Objective) => {
        const ids = businessModelIdsByObjective[o.id] ?? [];
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
        {lifecycleFilterOptions.length > 0 ? (
          <TableFilterSelect
            label="Lifecycle"
            value={filterLifecycle}
            onChange={setFilterLifecycle}
            options={lifecycleFilterOptions}
          />
        ) : null}
        <TableFilterSearch value={searchTitle} onChange={setSearchTitle} />
      </TableFilterBar>

      <ExpandableTable<Objective>
      columns={columns}
      rows={filteredObjectives}
      getRowId={(o) => o.id}
      initialExpandedIds={draftExpandedRowIds}
      expandLabel="Details"
      emptyMessage={
        objectives.length === 0
          ? "Keine Ziele vorhanden."
          : "Keine Treffer für die gewählten Filter."
      }
      renderExpandedContent={(objective) => {
        const linkedIndustryIds = new Set(
          industryIdsByObjective[objective.id] ?? []
        );
        const linkedBusinessModelIds = new Set(
          businessModelIdsByObjective[objective.id] ?? []
        );

        const editFormId = `objective-edit-${objective.id}`;
        const definitionLocked = isStrategyObjectDefinitionLocked({
          objectType: "strategic_objective",
          versioning: objective.versioning,
        });
        const openDraft = resolveOpenDraftForVersioning(objective.versioning, openDraftByIdentityId);
        const lifecycleState = objective.versioning?.identity_lifecycle_state ?? null;
        const identityId = objective.versioning?.object_identity_id ?? null;
        const baseRevisionId = objective.versioning?.revision_id ?? objective.id;

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
              entityKey="objective_id"
              entityValue={objective.id}
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
            <div className="space-y-5 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="border-b border-zinc-100 pb-4">
                <h4 className="text-sm font-semibold text-zinc-900">Ziel bearbeiten</h4>
                <p className="mt-1 text-xs text-zinc-500">
                  Stammdaten und Zuordnungen sind Teil der Revision. Änderungen an einer aktiven Fassung
                  laufen über «Neue Revision» und werden mit «Revision übernehmen» aktiv.
                </p>
                <p className="mt-2 text-xs text-zinc-600">
                  Ersteller:{" "}
                  {formatCreatorLabel(
                    objective.created_by_source,
                    objective.created_by_membership_id
                      ? creatorDisplayNameByMembershipId?.[objective.created_by_membership_id]
                      : undefined
                  )}
                </p>
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
                <form id={editFormId} action={actions.updateObjectiveInCycle} className="space-y-4">
                  <input type="hidden" name="objective_id" value={objective.id} />
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Stammdaten
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                      <label className={`${FORM_LABEL} md:col-span-2`}>
                        Titel
                        <input
                          name="title"
                          defaultValue={objective.title}
                          required
                          readOnly={definitionLocked}
                          aria-readonly={definitionLocked}
                          className={definitionFieldInputClass(definitionLocked, FORM_INPUT)}
                        />
                      </label>
                      <label className={FORM_LABEL}>
                        Zeithorizont
                        <input
                          name="time_horizon"
                          defaultValue={objective.time_horizon ?? ""}
                          readOnly={definitionLocked}
                          aria-readonly={definitionLocked}
                          className={definitionFieldInputClass(definitionLocked, FORM_INPUT)}
                        />
                      </label>
                      <label className={FORM_LABEL}>
                        Gewicht (1–5)
                        <input
                          type="number"
                          name="importance_score"
                          defaultValue={objective.importance_score ?? 3}
                          min={1}
                          max={5}
                          readOnly={definitionLocked}
                          aria-readonly={definitionLocked}
                          className={definitionFieldInputClass(definitionLocked, FORM_INPUT)}
                        />
                      </label>
                      <label className={`block ${FORM_LABEL} md:col-span-5`}>
                        Beschreibung
                        <textarea
                          name="description"
                          defaultValue={objective.description ?? ""}
                          rows={3}
                          readOnly={definitionLocked}
                          aria-readonly={definitionLocked}
                          className={`${definitionFieldInputClass(definitionLocked, FORM_INPUT)} min-h-[5.5rem]`}
                        />
                      </label>
                    </div>
                  </div>
                </form>
              ) : null}

              <div className="space-y-3 border-t border-zinc-100 pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Zuordnungen
                </p>
                {assignmentsReadOnly ? (
                  <p className="text-[11px] text-zinc-500">
                    Zuordnungen sind in der aktiven Revision fixiert. Für Änderungen «Neue Revision».
                  </p>
                ) : draftMode ? (
                  <p className="text-[11px] text-sky-800">
                    Zuordnungen des Entwurfs — werden mit «Revision übernehmen» aktiv.
                  </p>
                ) : (
                  <p className="text-[11px] text-zinc-500">
                    Grün = verknüpft. Klick zum Verknüpfen oder Entfernen.
                  </p>
                )}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <PillSection title="Industrien">
                    {industries.map((industry) =>
                      renderAssignmentPill(
                        "industry",
                        industry.id,
                        industry.name,
                        actions.linkObjectiveToIndustryInCycle,
                        actions.unlinkObjectiveFromIndustryInCycle,
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
                        actions.linkObjectiveToBusinessModelInCycle,
                        actions.unlinkObjectiveFromBusinessModelInCycle,
                        "business_model_id",
                        linkedBusinessModelIds.has(model.id),
                        draftBusinessModelIds.has(model.id)
                      )
                    )}
                  </PillSection>
                </div>
              </div>

              {showUpdateButton ? (
                <div className="border-t border-zinc-100 pt-4">
                  <button
                    type="submit"
                    form={editFormId}
                    disabled={!canWrite}
                    className="brand-btn px-4 py-2 text-sm"
                  >
                    Ziel aktualisieren
                  </button>
                </div>
              ) : null}

              {revisionActions ? (
                <div className="border-t border-zinc-100 pt-4">
                  <StrategyObjectActionBar
                    objectType="strategic_objective"
                    objectId={objective.id}
                    identityId={identityId}
                    lifecycleState={lifecycleState}
                    baseRevisionId={baseRevisionId}
                    hasOpenDraft={Boolean(openDraft)}
                    canWrite={canWrite}
                    returnPath={returnPath}
                    objectNoun="Ziel"
                    deleteAction={actions.deleteObjectiveInCycle}
                    deleteIdField="objective_id"
                    lifecycleAction={revisionActions.setStrategyObjectLifecycle}
                    proposeAction={revisionActions.proposeStrategyObjectDraft}
                  />
                </div>
              ) : null}
            </div>

            <ObjectiveAiPanel objective={objective} />
          </div>
        );
      }}
    />
    </div>
  );
}
