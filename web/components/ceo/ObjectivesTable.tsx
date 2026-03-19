"use client";

import { EntityPillButton } from "./EntityPillButton";
import { ExpandableTable, pillLinked, pillNeutral } from "./ExpandableTable";
import { ObjectiveAiPanel } from "./ObjectiveAiPanel";

type Objective = {
  id: string;
  title: string;
  description: string | null;
  importance_score: number | null;
  time_horizon: string | null;
  status: string | null;
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
};

type ObjectivesTableProps = {
  objectives: Objective[];
  industries: Array<{ id: string; name: string }>;
  businessModels: Array<{ id: string; name: string }>;
  industryIdsByObjective: Record<string, string[]>;
  businessModelIdsByObjective: Record<string, string[]>;
  canWrite: boolean;
  actions: {
    updateObjectiveInCycle: (formData: FormData) => Promise<void>;
    deleteObjectiveInCycle: (formData: FormData) => Promise<void>;
    linkObjectiveToIndustryInCycle: (formData: FormData) => Promise<void>;
    unlinkObjectiveFromIndustryInCycle: (formData: FormData) => Promise<void>;
    linkObjectiveToBusinessModelInCycle: (formData: FormData) => Promise<void>;
    unlinkObjectiveFromBusinessModelInCycle: (formData: FormData) => Promise<void>;
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

export function ObjectivesTable({
  objectives,
  industries,
  businessModels,
  industryIdsByObjective,
  businessModelIdsByObjective,
  canWrite,
  actions,
}: ObjectivesTableProps) {
  const columns = [
    {
      id: "title",
      label: "Titel",
      render: (o: Objective) => (
        <span className="font-medium text-zinc-900">{o.title}</span>
      ),
    },
    {
      id: "time_horizon",
      label: "Zeithorizont",
      defaultVisible: true,
      render: (o: Objective) => o.time_horizon ?? "-",
    },
    {
      id: "importance_score",
      label: "Importance",
      defaultVisible: true,
      render: (o: Objective) => String(o.importance_score ?? "-"),
    },
    {
      id: "status",
      label: "Status",
      defaultVisible: true,
      render: (o: Objective) => o.status ?? "-",
    },
    {
      id: "ai_objective_score",
      label: "Sentinel Score",
      defaultVisible: true,
      render: (o: Objective) =>
        o.ai_objective_score != null ? (o.ai_objective_score as number).toFixed(1) : "-",
    },
    {
      id: "ai_evaluation_status",
      label: "Sentinel Status",
      defaultVisible: true,
      render: (o: Objective) => o.ai_evaluation_status ?? "not_run",
    },
    {
      id: "industries",
      label: "Industrien",
      defaultVisible: true,
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
      label: "Geschaeftsmodelle",
      defaultVisible: true,
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
    <ExpandableTable<Objective>
      columns={columns}
      rows={objectives}
      getRowId={(o) => o.id}
      expandLabel="Details"
      emptyMessage="Keine Objectives vorhanden."
      renderExpandedContent={(objective) => {
        const linkedIndustryIds = new Set(
          industryIdsByObjective[objective.id] ?? []
        );
        const linkedBusinessModelIds = new Set(
          businessModelIdsByObjective[objective.id] ?? []
        );

        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-zinc-900">
                {objective.title}
              </span>
              <form action={actions.deleteObjectiveInCycle} className="inline">
                <input
                  type="hidden"
                  name="objective_id"
                  value={objective.id}
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
            {objective.description ? (
              <p className="text-xs text-zinc-600">{objective.description}</p>
            ) : null}

            <form
              action={actions.updateObjectiveInCycle}
              className="grid grid-cols-1 gap-2 md:grid-cols-5"
            >
              <input type="hidden" name="objective_id" value={objective.id} />
              <label className="text-xs text-zinc-600 md:col-span-2">
                Titel
                <input
                  name="title"
                  defaultValue={objective.title}
                  required
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-zinc-600">
                Zeithorizont
                <input
                  name="time_horizon"
                  defaultValue={objective.time_horizon ?? ""}
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-zinc-600">
                Importance (1-5)
                <input
                  type="number"
                  name="importance_score"
                  defaultValue={objective.importance_score ?? 3}
                  min={1}
                  max={5}
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-zinc-600">
                Status
                <select
                  name="status"
                  defaultValue={objective.status ?? "draft"}
                  className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                >
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="at_risk">at_risk</option>
                  <option value="completed">completed</option>
                  <option value="archived">archived</option>
                </select>
              </label>
              <label className="block text-xs text-zinc-600 md:col-span-4">
                Beschreibung
                <textarea
                  name="description"
                  defaultValue={objective.description ?? ""}
                  rows={3}
                  className="mt-1 block w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                />
              </label>
              <div className="md:col-span-5">
                <button
                  type="submit"
                  disabled={!canWrite}
                  className="brand-btn px-3 py-1.5 text-xs"
                >
                  Objective aktualisieren
                </button>
              </div>
            </form>

            <ObjectiveAiPanel objective={objective} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PillSection title="Industrien">
                {industries.map((industry) => {
                  const isLinked = linkedIndustryIds.has(industry.id);
                  return (
                    <EntityPillButton
                      key={industry.id}
                      entityKey="objective_id"
                      entityValue={objective.id}
                      extraFields={{ industry_id: industry.id }}
                      isLinked={isLinked}
                      linkAction={actions.linkObjectiveToIndustryInCycle}
                      unlinkAction={actions.unlinkObjectiveFromIndustryInCycle}
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
                      entityKey="objective_id"
                      entityValue={objective.id}
                      extraFields={{ business_model_id: model.id }}
                      isLinked={isLinked}
                      linkAction={actions.linkObjectiveToBusinessModelInCycle}
                      unlinkAction={
                        actions.unlinkObjectiveFromBusinessModelInCycle
                      }
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
          </div>
        );
      }}
    />
  );
}
