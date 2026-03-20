"use client";

import { ExpandableTable } from "./ExpandableTable";

export type ProgramRow = {
  id: string;
  title: string;
  description: string | null;
  strategic_direction_id: string | null;
  budget: number | null;
  timeline: string | null;
};

type ProgramsTableProps = {
  programs: ProgramRow[];
  directionTitleById: Record<string, string>;
};

export function ProgramsTable({ programs, directionTitleById }: ProgramsTableProps) {
  const columns = [
    {
      id: "title",
      label: "Titel",
      render: (p: ProgramRow) => (
        <span className="font-medium text-zinc-900">{p.title}</span>
      ),
    },
    {
      id: "direction",
      label: "Stossrichtung",
      defaultVisible: true,
      render: (p: ProgramRow) =>
        p.strategic_direction_id
          ? directionTitleById[p.strategic_direction_id] ?? "n/a"
          : "-",
    },
    {
      id: "timeline",
      label: "Timeline",
      defaultVisible: true,
      render: (p: ProgramRow) => p.timeline ?? "-",
    },
    {
      id: "budget",
      label: "Budget",
      defaultVisible: false,
      render: (p: ProgramRow) =>
        p.budget != null ? Number(p.budget).toLocaleString("de-CH") : "-",
    },
  ];

  return (
    <ExpandableTable<ProgramRow>
      columns={columns}
      rows={programs}
      getRowId={(p) => p.id}
      expandLabel="Details"
      emptyMessage="Keine Programme vorhanden."
      renderExpandedContent={(program) => (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-zinc-900">
              {program.title}
            </span>
          </div>
          {program.description ? (
            <p className="text-xs text-zinc-600">{program.description}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 text-xs text-zinc-600">
            {program.strategic_direction_id ? (
              <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1">
                Stossrichtung:{" "}
                {directionTitleById[program.strategic_direction_id] ?? "n/a"}
              </span>
            ) : null}
            {program.timeline ? (
              <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1">
                Timeline: {program.timeline}
              </span>
            ) : null}
            {program.budget != null ? (
              <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1">
                Budget: {Number(program.budget).toLocaleString("de-CH")}
              </span>
            ) : null}
          </div>
        </div>
      )}
    />
  );
}
