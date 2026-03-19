"use client";

import { EntityPillButton } from "./EntityPillButton";
import { ExpandableTable, pillLinked, pillNeutral } from "./ExpandableTable";

type Direction = {
  id: string;
  title: string;
  description: string | null;
  priority: number | null;
  status: string | null;
  grouping: string | null;
  relevance_level: number | null;
  risk_level: number | null;
  strategic_value_score: number | null;
  capability_fit_score: number | null;
  feasibility_score: number | null;
  direction_score: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type StrategicDirectionsTableProps = {
  directions: Direction[];
  challenges: Array<{ id: string; title: string }>;
  clusters: Array<{ id: string; label: string }>;
  objectives: Array<{ id: string; title: string }>;
  clusterObjectiveRelations: Array<{
    id: string;
    cluster_id: string;
    objective_id: string;
    gap_score: number | null;
  }>;
  industries: Array<{ id: string; name: string }>;
  businessModels: Array<{ id: string; name: string }>;
  programsByDirectionId: Record<string, Array<{ id: string; title: string }>>;
  challengeIdsByDirection: Record<string, string[]>;
  clusterIdsByDirection: Record<string, string[]>;
  objectiveIdsByDirection: Record<string, string[]>;
  gapRelationIdsByDirection: Record<string, string[]>;
  industryIdsByDirection: Record<string, string[]>;
  businessModelIdsByDirection: Record<string, string[]>;
  directionCoverageById: Record<string, { linked: number; total: number; percent: number }>;
  clusterById: Record<string, { label: string }>;
  objectiveById: Record<string, { title: string }>;
  canWrite: boolean;
  actions: {
    updateStrategicDirectionAssessment: (formData: FormData) => Promise<void>;
    deleteStrategicDirectionInCycle: (formData: FormData) => Promise<void>;
    linkDirectionToChallengePredecessor: (formData: FormData) => Promise<void>;
    unlinkDirectionChallengePredecessor: (formData: FormData) => Promise<void>;
    linkDirectionToClusterInCycle: (formData: FormData) => Promise<void>;
    unlinkDirectionFromClusterInCycle: (formData: FormData) => Promise<void>;
    linkDirectionToObjectiveInCycle: (formData: FormData) => Promise<void>;
    unlinkDirectionFromObjectiveInCycle: (formData: FormData) => Promise<void>;
    linkDirectionToGapInCycle: (formData: FormData) => Promise<void>;
    unlinkDirectionFromGapInCycle: (formData: FormData) => Promise<void>;
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
  clusters,
  objectives,
  clusterObjectiveRelations,
  industries,
  businessModels,
  programsByDirectionId,
  challengeIdsByDirection,
  clusterIdsByDirection,
  objectiveIdsByDirection,
  gapRelationIdsByDirection,
  industryIdsByDirection,
  businessModelIdsByDirection,
  directionCoverageById,
  clusterById,
  objectiveById,
  canWrite,
  actions,
}: StrategicDirectionsTableProps) {
  const columns = [
    {
      id: "title",
      label: "Titel",
      render: (d: Direction) => (
        <span className="font-medium text-zinc-900">{d.title}</span>
      ),
    },
    {
      id: "priority",
      label: "Prioritaet",
      defaultVisible: true,
      render: (d: Direction) => String(d.priority ?? "-"),
    },
    {
      id: "status",
      label: "Status",
      defaultVisible: false,
      render: (d: Direction) => d.status ?? "-",
    },
    {
      id: "grouping",
      label: "Gruppierung",
      defaultVisible: false,
      render: (d: Direction) => d.grouping ?? "-",
    },
    {
      id: "direction_score",
      label: "Direction Score",
      defaultVisible: true,
      render: (d: Direction) =>
        d.direction_score != null
          ? Number(d.direction_score).toFixed(2)
          : "-",
    },
    {
      id: "coverage",
      label: "Abdeckung",
      defaultVisible: true,
      render: (d: Direction) => {
        const cov = directionCoverageById[d.id];
        if (!cov) return "-";
        return `${cov.percent}% (${cov.linked}/${cov.total})`;
      },
    },
    {
      id: "strategic_value",
      label: "Strategic Value",
      defaultVisible: false,
      render: (d: Direction) => String(d.strategic_value_score ?? "-"),
    },
    {
      id: "capability_fit",
      label: "Capability Fit",
      defaultVisible: false,
      render: (d: Direction) => String(d.capability_fit_score ?? "-"),
    },
    {
      id: "feasibility",
      label: "Feasibility",
      defaultVisible: false,
      render: (d: Direction) => String(d.feasibility_score ?? "-"),
    },
    {
      id: "risk",
      label: "Risk",
      defaultVisible: false,
      render: (d: Direction) => String(d.risk_level ?? "-"),
    },
    {
      id: "challenges",
      label: "Herausforderungen",
      defaultVisible: true,
      render: (d: Direction) => {
        const ids = challengeIdsByDirection[d.id] ?? [];
        const linked = challenges.filter((c) => ids.includes(c.id));
        if (linked.length === 0) return <span className="text-zinc-400">-</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {linked.slice(0, 3).map((c) => (
              <span
                key={c.id}
                className={`${pillLinked()} max-w-[140px] truncate`}
                title={c.title}
              >
                {c.title}
              </span>
            ))}
            {linked.length > 3 && (
              <span className={pillLinked()}>+{linked.length - 3}</span>
            )}
          </div>
        );
      },
    },
    {
      id: "industries",
      label: "Industrien",
      defaultVisible: true,
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
        const linkedClusterIds = new Set(
          clusterIdsByDirection[direction.id] ?? []
        );
        const linkedObjectiveIds = new Set(
          objectiveIdsByDirection[direction.id] ?? []
        );
        const linkedGapIds = new Set(
          gapRelationIdsByDirection[direction.id] ?? []
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-zinc-900">
                {direction.title}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                  Abdeckung {coverage.percent}% ({coverage.linked}/
                  {coverage.total || 0})
                </span>
                <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  Direction Score:{" "}
                  {Number(direction.direction_score ?? 0).toFixed(2)}
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
            </div>
            {direction.description ? (
              <p className="text-xs text-zinc-600">{direction.description}</p>
            ) : null}

            <form
              action={actions.updateStrategicDirectionAssessment}
              className="flex flex-wrap items-end gap-2"
            >
              <input
                type="hidden"
                name="strategic_direction_id"
                value={direction.id}
              />
              <label className="text-xs text-zinc-600">
                Titel
                <input
                  name="title"
                  defaultValue={direction.title}
                  required
                  className="ml-2 w-72 rounded border border-zinc-300 px-2 py-1 text-xs"
                />
              </label>
              <label className="block text-xs text-zinc-600">
                Beschreibung
                <textarea
                  name="description"
                  defaultValue={direction.description ?? ""}
                  rows={4}
                  className="mt-1 block w-full min-w-[320px] max-w-2xl rounded border border-zinc-300 px-2 py-1.5 text-xs"
                />
              </label>
              <label className="text-xs text-zinc-600">
                Strategic
                <input
                  type="number"
                  name="strategic_value_score"
                  defaultValue={direction.strategic_value_score ?? 3}
                  min={1}
                  max={5}
                  className="ml-2 w-16 rounded border border-zinc-300 px-2 py-1 text-xs"
                />
              </label>
              <label className="text-xs text-zinc-600">
                Capability
                <input
                  type="number"
                  name="capability_fit_score"
                  defaultValue={direction.capability_fit_score ?? 3}
                  min={1}
                  max={5}
                  className="ml-2 w-16 rounded border border-zinc-300 px-2 py-1 text-xs"
                />
              </label>
              <label className="text-xs text-zinc-600">
                Feasibility
                <input
                  type="number"
                  name="feasibility_score"
                  defaultValue={direction.feasibility_score ?? 3}
                  min={1}
                  max={5}
                  className="ml-2 w-16 rounded border border-zinc-300 px-2 py-1 text-xs"
                />
              </label>
              <label className="text-xs text-zinc-600">
                Risk
                <input
                  type="number"
                  name="risk_score"
                  defaultValue={direction.risk_level ?? 3}
                  min={1}
                  max={5}
                  className="ml-2 w-16 rounded border border-zinc-300 px-2 py-1 text-xs"
                />
              </label>
              <button
                type="submit"
                disabled={!canWrite}
                className="brand-btn px-3 py-1.5 text-xs"
              >
                Bewertung speichern
              </button>
            </form>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PillSection title="Herausforderungen (Vorgaenger)">
                {challenges.map((challenge) => {
                  const isLinked = linkedChallengeIds.has(challenge.id);
                  return (
                    <EntityPillButton
                      key={challenge.id}
                      entityKey="strategic_direction_id"
                      entityValue={direction.id}
                      extraFields={{ strategic_challenge_id: challenge.id }}
                      isLinked={isLinked}
                      linkAction={actions.linkDirectionToChallengePredecessor}
                      unlinkAction={actions.unlinkDirectionChallengePredecessor}
                      canWrite={canWrite}
                      title={challenge.title}
                      linkedClassName={pillLinked()}
                      unlinkedClassName={pillNeutral()}
                    >
                      {challenge.title}
                    </EntityPillButton>
                  );
                })}
              </PillSection>

              <PillSection title="Cluster">
                {clusters.map((cluster) => {
                  const isLinked = linkedClusterIds.has(cluster.id);
                  return (
                    <EntityPillButton
                      key={cluster.id}
                      entityKey="strategic_direction_id"
                      entityValue={direction.id}
                      extraFields={{ cluster_id: cluster.id }}
                      isLinked={isLinked}
                      linkAction={actions.linkDirectionToClusterInCycle}
                      unlinkAction={actions.unlinkDirectionFromClusterInCycle}
                      canWrite={canWrite}
                      title={cluster.label}
                      linkedClassName={pillLinked()}
                      unlinkedClassName={pillNeutral()}
                    >
                      {cluster.label}
                    </EntityPillButton>
                  );
                })}
              </PillSection>

              <PillSection title="Objectives">
                {objectives.map((objective) => {
                  const isLinked = linkedObjectiveIds.has(objective.id);
                  return (
                    <EntityPillButton
                      key={objective.id}
                      entityKey="strategic_direction_id"
                      entityValue={direction.id}
                      extraFields={{ objective_id: objective.id }}
                      isLinked={isLinked}
                      linkAction={actions.linkDirectionToObjectiveInCycle}
                      unlinkAction={actions.unlinkDirectionFromObjectiveInCycle}
                      canWrite={canWrite}
                      title={objective.title}
                      linkedClassName={pillLinked()}
                      unlinkedClassName={pillNeutral()}
                    >
                      {objective.title}
                    </EntityPillButton>
                  );
                })}
              </PillSection>

              <PillSection title="Gaps (Cluster → Objective)">
                {clusterObjectiveRelations.map((relation) => {
                  const cluster = clusterById[relation.cluster_id];
                  const objective = objectiveById[relation.objective_id];
                  const label = `${cluster?.label ?? relation.cluster_id} → ${objective?.title ?? relation.objective_id} (${Number(relation.gap_score ?? 0).toFixed(2)})`;
                  const isLinked = linkedGapIds.has(relation.id);
                  return (
                    <EntityPillButton
                      key={relation.id}
                      entityKey="strategic_direction_id"
                      entityValue={direction.id}
                      extraFields={{ cluster_objective_relation_id: relation.id }}
                      isLinked={isLinked}
                      linkAction={actions.linkDirectionToGapInCycle}
                      unlinkAction={actions.unlinkDirectionFromGapInCycle}
                      canWrite={canWrite}
                      title={label}
                      linkedClassName={pillLinked()}
                      unlinkedClassName={pillNeutral()}
                    >
                      <span className="max-w-[180px] truncate">{label}</span>
                    </EntityPillButton>
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
