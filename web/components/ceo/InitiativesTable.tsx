"use client";

import { useMemo, useState } from "react";
import { ExpandableTable } from "./ExpandableTable";
import type { InitiativeKrLinkContext } from "@/lib/strategy-cycle/queries";

export type InitiativeRow = {
  id: string;
  title: string;
  status: string | null;
  priority: number | null;
  program_id: string | null;
  progress_percent: number | null;
  owner_membership_id: string | null;
  description: string | null;
  kr_link_contexts: InitiativeKrLinkContext[];
  annual_target_ids: string[];
  key_result_ids: string[];
  annual_target_titles: string[];
  legacy_linked_okrs: string[] | null;
  legacy_deliverables: string[] | null;
};

const STATUS_LABELS: Record<string, string> = {
  planned: "Geplant",
  active: "Aktiv",
  on_hold: "On Hold",
  completed: "Abgeschlossen",
  draft: "Entwurf",
  at_risk: "Auffaellig",
  archived: "Archiviert",
};

function statusPillClass(status: string | null): string {
  switch (status) {
    case "active":
      return "border-emerald-200/80 bg-emerald-50 text-emerald-900";
    case "completed":
    case "archived":
      return "border-zinc-200 bg-zinc-100 text-zinc-700";
    case "on_hold":
    case "at_risk":
      return "border-amber-200/80 bg-amber-50 text-amber-900";
    default:
      return "border-zinc-200 bg-white text-zinc-700";
  }
}

type InitiativesTableProps = {
  initiatives: InitiativeRow[];
  programTitleById: Record<string, string>;
  ownerLabelByMembershipId: Record<string, string>;
  selectedInitiativeId: string | null;
  onSelectInitiative: (id: string) => void;
};

export function InitiativesTable({
  initiatives,
  programTitleById,
  ownerLabelByMembershipId,
  selectedInitiativeId,
  onSelectInitiative,
}: InitiativesTableProps) {
  const [filterProgramId, setFilterProgramId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [searchTitle, setSearchTitle] = useState("");

  const programFilterOptions = useMemo(() => {
    const ids = [...new Set(initiatives.map((i) => i.program_id).filter(Boolean))] as string[];
    return ids
      .map((id) => ({ id, title: programTitleById[id] ?? id }))
      .sort((a, b) => a.title.localeCompare(b.title, "de"));
  }, [initiatives, programTitleById]);

  const filteredRows = useMemo(() => {
    const q = searchTitle.trim().toLowerCase();
    return initiatives.filter((i) => {
      if (filterProgramId && i.program_id !== filterProgramId) return false;
      if (filterStatus && (i.status ?? "") !== filterStatus) return false;
      if (filterPriority && String(i.priority ?? "") !== filterPriority) return false;
      if (q && !i.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [initiatives, filterProgramId, filterStatus, filterPriority, searchTitle]);

  const columns = [
    {
      id: "title",
      label: "Initiative",
      sortValue: (i: InitiativeRow) => i.title,
      render: (i: InitiativeRow) => <span className="font-semibold text-zinc-900">{i.title}</span>,
    },
    {
      id: "program",
      label: "Programm",
      sortValue: (i: InitiativeRow) =>
        i.program_id ? programTitleById[i.program_id] ?? "" : null,
      render: (i: InitiativeRow) => (
        <span className="text-xs text-zinc-700">
          {i.program_id ? programTitleById[i.program_id] ?? "n/a" : "–"}
        </span>
      ),
    },
    {
      id: "status",
      label: "Status",
      sortValue: (i: InitiativeRow) => i.status ?? null,
      render: (i: InitiativeRow) => {
        const s = i.status ?? "";
        const label = (STATUS_LABELS[s] ?? s) || "–";
        return (
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusPillClass(i.status)}`}
          >
            {label}
          </span>
        );
      },
    },
    {
      id: "progress",
      label: "Fortschritt",
      sortValue: (i: InitiativeRow) => i.progress_percent ?? 0,
      render: (i: InitiativeRow) => {
        const pct = Math.min(100, Math.max(0, Math.round(Number(i.progress_percent) || 0)));
        return (
          <div className="min-w-[5rem]">
            <div className="tabular-nums text-xs font-medium text-zinc-800">{pct}&nbsp;%</div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
              <div className="h-full rounded-full bg-zinc-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      id: "priority",
      label: "Prioritaet",
      sortValue: (i: InitiativeRow) => i.priority ?? null,
      render: (i: InitiativeRow) => (
        <span className="tabular-nums text-xs text-zinc-700">{i.priority ?? "–"}</span>
      ),
    },
    {
      id: "contributions",
      label: "Beitraege",
      sortValue: (i: InitiativeRow) => i.annual_target_ids.length + i.key_result_ids.length,
      render: (i: InitiativeRow) => {
        const j = i.annual_target_ids.length;
        const k = i.key_result_ids.length;
        const parts: string[] = [];
        parts.push(`${j} Jahresziel${j === 1 ? "" : "e"}`);
        parts.push(`${k} KR${k === 1 ? "" : "s"}`);
        return <span className="text-xs text-zinc-600">{parts.join(" · ")}</span>;
      },
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[140px] flex-1">
          <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Programm
          </label>
          <select
            value={filterProgramId}
            onChange={(e) => setFilterProgramId(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="">Alle</option>
            {programFilterOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[120px] flex-1">
          <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="">Alle</option>
            {Object.entries(STATUS_LABELS).map(([val, lab]) => (
              <option key={val} value={val}>
                {lab}
              </option>
            ))}
          </select>
        </div>
        <div className="w-24">
          <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Prio
          </label>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="">Alle</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[160px] flex-[2]">
          <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Suche Titel
          </label>
          <input
            value={searchTitle}
            onChange={(e) => setSearchTitle(e.target.value)}
            placeholder="…"
            className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-xs"
          />
        </div>
      </div>

      <ExpandableTable<InitiativeRow>
        columns={columns}
        rows={filteredRows}
        getRowId={(i) => i.id}
        expandLabel="Details"
        emptyMessage="Noch keine Initiativen erfasst."
        rowIdPrefix="initiative-"
        selectedRowId={selectedInitiativeId}
        onDataRowClick={(row) => onSelectInitiative(row.id)}
        renderExpandedContent={(initiative) => {
          const pct = Math.min(100, Math.max(0, Math.round(Number(initiative.progress_percent) || 0)));
          const owner =
            initiative.owner_membership_id != null
              ? ownerLabelByMembershipId[initiative.owner_membership_id] ?? "–"
              : "–";
          return (
            <div className="space-y-4 text-xs">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700">
                  Programm:{" "}
                  {initiative.program_id
                    ? programTitleById[initiative.program_id] ?? "n/a"
                    : "–"}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 font-medium ${statusPillClass(initiative.status)}`}
                >
                  {STATUS_LABELS[initiative.status ?? ""] ?? initiative.status ?? "–"}
                </span>
                <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700">
                  Prioritaet: {initiative.priority ?? "–"}
                </span>
                <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700">
                  Owner: {owner}
                </span>
                <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700">
                  Fortschritt: {pct}&nbsp;%
                </span>
              </div>

              <div>
                <p className="mb-1.5 font-semibold text-zinc-800">Verknuepfungen</p>
                <p className="mb-1 text-[11px] font-medium text-zinc-600">Jahresziele</p>
                {initiative.annual_target_titles.length === 0 ? (
                  <p className="text-zinc-500">Keine Jahresziele verknuepft.</p>
                ) : (
                  <ul className="list-inside list-disc space-y-0.5 text-zinc-700">
                    {initiative.annual_target_titles.map((t, idx) => (
                      <li key={`${initiative.id}-t-${idx}`}>{t}</li>
                    ))}
                  </ul>
                )}
                <p className="mb-1 mt-3 text-[11px] font-medium text-zinc-600">Key Results</p>
                {initiative.kr_link_contexts.length === 0 ? (
                  <p className="text-zinc-500">Keine Key Results verknuepft.</p>
                ) : (
                  <ul className="space-y-1.5 text-zinc-700">
                    {initiative.kr_link_contexts.map((c) => (
                      <li key={c.key_result_id}>
                        <span className="font-medium">{c.key_result_title}</span>
                        <span className="text-zinc-600"> — Objective: {c.objective_title}</span>
                        {c.okr_cycle_label ? (
                          <span className="text-zinc-500"> · {c.okr_cycle_label}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="mb-1.5 font-semibold text-zinc-800">Kontext</p>
                {initiative.kr_link_contexts.length === 0 ? (
                  <p className="text-zinc-500">Ohne KR-Verknuepfung kein OKR-Kontext.</p>
                ) : (
                  <ul className="space-y-1 text-zinc-600">
                    {initiative.kr_link_contexts.map((c) => (
                      <li key={`ctx-${c.key_result_id}`}>
                        <span className="font-medium text-zinc-800">{c.objective_title}</span>
                        {c.okr_cycle_label ? ` · ${c.okr_cycle_label}` : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {initiative.description ? (
                <p className="border-t border-zinc-200 pt-3 text-zinc-600">{initiative.description}</p>
              ) : null}

              {(initiative.legacy_linked_okrs?.length || initiative.legacy_deliverables?.length) ? (
                <details className="rounded border border-zinc-200 bg-zinc-50/80 p-2">
                  <summary className="cursor-pointer text-[11px] font-medium text-zinc-600">
                    Legacy-Daten (Admin)
                  </summary>
                  {initiative.legacy_linked_okrs && initiative.legacy_linked_okrs.length > 0 ? (
                    <p className="mt-2 text-[11px] text-zinc-500">
                      Linked OKRs (JSON): {initiative.legacy_linked_okrs.join(", ")}
                    </p>
                  ) : null}
                  {initiative.legacy_deliverables && initiative.legacy_deliverables.length > 0 ? (
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Deliverables: {initiative.legacy_deliverables.join(", ")}
                    </p>
                  ) : null}
                </details>
              ) : null}
            </div>
          );
        }}
      />
    </div>
  );
}
