"use client";

import { ExpandableTable } from "./ExpandableTable";

export type InitiativeRow = {
  id: string;
  title: string;
  status: string | null;
  priority: number | null;
  program_id: string | null;
  linked_okrs: string[] | null;
  deliverables: string[] | null;
};

type InitiativesTableProps = {
  initiatives: InitiativeRow[];
  programTitleById: Record<string, string>;
  annualTargets: Array<{ id: string; title: string }>;
  targetIdsByInitiative: Record<string, string[]>;
  canWrite: boolean;
  linkInitiativeToTargetPredecessor: (formData: FormData) => Promise<void>;
  unlinkInitiativeTargetPredecessor: (formData: FormData) => Promise<void>;
};

export function InitiativesTable({
  initiatives,
  programTitleById,
  annualTargets,
  targetIdsByInitiative,
  canWrite,
  linkInitiativeToTargetPredecessor,
  unlinkInitiativeTargetPredecessor,
}: InitiativesTableProps) {
  const columns = [
    {
      id: "title",
      label: "Titel",
      render: (i: InitiativeRow) => (
        <span className="font-medium text-zinc-900">{i.title}</span>
      ),
    },
    {
      id: "program",
      label: "Programm",
      defaultVisible: true,
      render: (i: InitiativeRow) =>
        i.program_id ? programTitleById[i.program_id] ?? "n/a" : "-",
    },
    {
      id: "priority",
      label: "Prioritaet",
      defaultVisible: true,
      render: (i: InitiativeRow) => String(i.priority ?? "-"),
    },
    {
      id: "status",
      label: "Status",
      defaultVisible: true,
      render: (i: InitiativeRow) => i.status ?? "-",
    },
    {
      id: "targets",
      label: "Verknuepfte Ziele",
      defaultVisible: true,
      render: (i: InitiativeRow) =>
        (targetIdsByInitiative[i.id] ?? []).length,
    },
  ];

  return (
    <ExpandableTable<InitiativeRow>
      columns={columns}
      rows={initiatives}
      getRowId={(i) => i.id}
      expandLabel="Details"
      emptyMessage="Keine Initiativen vorhanden."
      rowIdPrefix="initiative-"
      renderExpandedContent={(initiative) => {
        const linkedTargetIds = new Set(
          targetIdsByInitiative[initiative.id] ?? []
        );
        const linkedTargets = annualTargets.filter((t) =>
          linkedTargetIds.has(t.id)
        );

        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-zinc-900">
                {initiative.title}
              </span>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                  Programm:{" "}
                  {initiative.program_id
                    ? programTitleById[initiative.program_id] ?? "n/a"
                    : "-"}
                </span>
                <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                  Prioritaet: {initiative.priority ?? "-"}
                </span>
                <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
                  Status: {initiative.status ?? "-"}
                </span>
              </div>
            </div>
            {Array.isArray(initiative.linked_okrs) &&
            initiative.linked_okrs.length > 0 ? (
              <p className="text-xs text-zinc-600">
                OKRs: {initiative.linked_okrs.join(", ")}
              </p>
            ) : null}
            {Array.isArray(initiative.deliverables) &&
            initiative.deliverables.length > 0 ? (
              <p className="text-xs text-zinc-600">
                Deliverables: {initiative.deliverables.join(", ")}
              </p>
            ) : null}

            <div>
              <p className="mb-1 text-xs font-medium text-zinc-600">
                Vorgaenger-Ziel verknuepfen
              </p>
              <form
                action={linkInitiativeToTargetPredecessor}
                className="flex flex-wrap gap-2"
              >
                <input
                  type="hidden"
                  name="initiative_id"
                  value={initiative.id}
                />
                <select
                  name="annual_target_id"
                  defaultValue=""
                  className="min-w-[260px] rounded-md border border-zinc-300 px-2 py-1.5 text-xs"
                >
                  <option value="">Vorgaenger-Ziel verknuepfen</option>
                  {annualTargets.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.title}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!canWrite}
                  className="brand-btn px-3 py-1.5 text-xs"
                >
                  Verknuepfen
                </button>
              </form>
            </div>

            <div className="flex flex-wrap gap-2">
              {linkedTargets.map((target) => (
                <form
                  key={`${initiative.id}-${target.id}`}
                  action={unlinkInitiativeTargetPredecessor}
                  className="inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700"
                >
                  <input
                    type="hidden"
                    name="initiative_id"
                    value={initiative.id}
                  />
                  <input
                    type="hidden"
                    name="annual_target_id"
                    value={target.id}
                  />
                  <span>{target.title}</span>
                  <button
                    type="submit"
                    disabled={!canWrite}
                    className="text-red-700"
                  >
                    x
                  </button>
                </form>
              ))}
            </div>
          </div>
        );
      }}
    />
  );
}
