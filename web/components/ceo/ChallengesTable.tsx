"use client";

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
};

type ChallengesTableProps = {
  challenges: Challenge[];
  industries: Array<{ id: string; name: string }>;
  businessModels: Array<{ id: string; name: string }>;
  industryIdsByChallenge: Record<string, string[]>;
  businessModelIdsByChallenge: Record<string, string[]>;
  directionCountByChallengeId: Record<string, number>;
  canWrite: boolean;
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

export function ChallengesTable({
  challenges,
  industries,
  businessModels,
  industryIdsByChallenge,
  businessModelIdsByChallenge,
  directionCountByChallengeId,
  canWrite,
  actions,
}: ChallengesTableProps) {
  const columns = [
    {
      id: "title",
      label: "Titel",
      render: (c: Challenge) => (
        <span className="font-medium text-zinc-900">{c.title}</span>
      ),
    },
    {
      id: "challenge_score",
      label: "Challenge-Score",
      defaultVisible: true,
      render: (c: Challenge) =>
        c.challenge_score != null
          ? Number(c.challenge_score).toFixed(2)
          : "-",
    },
    {
      id: "directions",
      label: "Verknüpfte Stossrichtungen",
      defaultVisible: true,
      render: (c: Challenge) =>
        directionCountByChallengeId[c.id] ?? 0,
    },
    {
      id: "impact",
      label: "Auswirkung",
      defaultVisible: false,
      render: (c: Challenge) => String(c.impact_score ?? "-"),
    },
    {
      id: "urgency",
      label: "Dringlichkeit",
      defaultVisible: false,
      render: (c: Challenge) => String(c.urgency_score ?? "-"),
    },
    {
      id: "industries",
      label: "Industrien",
      defaultVisible: true,
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
      label: "Geschaeftsmodelle",
      defaultVisible: true,
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
    <ExpandableTable<Challenge>
      columns={columns}
      rows={challenges}
      getRowId={(c) => c.id}
      expandLabel="Details"
      emptyMessage="Keine strategischen Herausforderungen vorhanden."
      renderExpandedContent={(challenge) => {
        const linkedIndustryIds = new Set(
          industryIdsByChallenge[challenge.id] ?? []
        );
        const linkedBusinessModelIds = new Set(
          businessModelIdsByChallenge[challenge.id] ?? []
        );

        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-zinc-900">
                {challenge.title}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                  Verknüpfte Stossrichtungen:{" "}
                  {directionCountByChallengeId[challenge.id] ?? 0}
                </span>
                <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  Challenge-Score:{" "}
                  {Number(challenge.challenge_score ?? 0).toFixed(2)}
                </span>
                <form
                  action={actions.deleteStrategicChallengeInCycle}
                  className="inline"
                >
                  <input
                    type="hidden"
                    name="strategic_challenge_id"
                    value={challenge.id}
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
            {challenge.description ? (
              <p className="text-xs text-zinc-600">{challenge.description}</p>
            ) : null}

            <form
              action={actions.updateStrategicChallengeAssessment}
              className="flex flex-wrap items-end gap-2"
            >
              <input
                type="hidden"
                name="strategic_challenge_id"
                value={challenge.id}
              />
              <label className="block text-xs text-zinc-600">
                Beschreibung
                <textarea
                  name="description"
                  defaultValue={challenge.description ?? ""}
                  rows={4}
                  className="mt-1 block w-full min-w-[320px] max-w-2xl rounded border border-zinc-300 px-2 py-1.5 text-xs"
                />
              </label>
              <label className="text-xs text-zinc-600">
                Auswirkung (1–5)
                <input
                  type="number"
                  name="impact_score"
                  defaultValue={challenge.impact_score ?? 3}
                  min={1}
                  max={5}
                  className="ml-2 w-16 rounded border border-zinc-300 px-2 py-1 text-xs"
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
                  className="ml-2 w-16 rounded border border-zinc-300 px-2 py-1 text-xs"
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
                  className="ml-2 w-16 rounded border border-zinc-300 px-2 py-1 text-xs"
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
              <PillSection title="Industrien">
                {industries.map((industry) => {
                  const isLinked = linkedIndustryIds.has(industry.id);
                  return (
                    <EntityPillButton
                      key={industry.id}
                      entityKey="strategic_challenge_id"
                      entityValue={challenge.id}
                      extraFields={{ industry_id: industry.id }}
                      isLinked={isLinked}
                      linkAction={
                        actions.linkStrategicChallengeToIndustryInCycle
                      }
                      unlinkAction={
                        actions.unlinkStrategicChallengeFromIndustryInCycle
                      }
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
                      entityKey="strategic_challenge_id"
                      entityValue={challenge.id}
                      extraFields={{ business_model_id: model.id }}
                      isLinked={isLinked}
                      linkAction={
                        actions.linkStrategicChallengeToBusinessModelInCycle
                      }
                      unlinkAction={
                        actions.unlinkStrategicChallengeFromBusinessModelInCycle
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
