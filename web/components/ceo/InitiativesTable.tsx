"use client";

import { useMemo, useState } from "react";
import { InitiativeCreateForm, type InitiativeFormSelection } from "@/components/ceo/InitiativeCreateForm";
import type { InitiativeKrLinkContext, PipKeyResultOption } from "@/lib/strategy-cycle/queries";
import { ExpandableTable } from "./ExpandableTable";

export type InitiativeRow = {
  id: string;
  title: string;
  status: string | null;
  priority: number | null;
  program_id: string | null;
  progress_percent: number | null;
  owner_membership_id: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  kr_link_contexts: InitiativeKrLinkContext[];
  annual_target_ids: string[];
  key_result_ids: string[];
  annual_target_titles: string[];
  legacy_linked_okrs: string[] | null;
  legacy_deliverables: string[] | null;
};

/** Gleiche Bezeichner wie in der Programm-Tabelle (PIPs UX konsistent). */
const INITIATIVE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  planned: "Geplant",
  active: "Aktiv",
  at_risk: "Auffaellig",
  on_hold: "On Hold",
  completed: "Abgeschlossen",
  archived: "Archiviert",
};

const INITIATIVE_STATUS_FILTER_ORDER = [
  "draft",
  "planned",
  "active",
  "at_risk",
  "on_hold",
  "completed",
  "archived",
] as const;

function formatDeDateOnly(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatInitiativePeriodDe(start: string | null, end: string | null): string {
  const a = start ? formatDeDateOnly(start) : "";
  const b = end ? formatDeDateOnly(end) : "";
  if (a && b) return `${a} – ${b}`;
  if (a) return `ab ${a}`;
  if (b) return `bis ${b}`;
  return "–";
}

function initiativeProgressDotClass(status: string | null): string {
  switch (status) {
    case "active":
      return "bg-emerald-500";
    case "at_risk":
    case "on_hold":
      return "bg-amber-400";
    case "completed":
      return "bg-zinc-400";
    default:
      return "bg-zinc-400";
  }
}

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

function initiativeRowToSelection(row: InitiativeRow): InitiativeFormSelection {
  return {
    id: row.id,
    title: row.title,
    program_id: row.program_id,
    status: row.status ?? "planned",
    priority: row.priority ?? 3,
    owner_membership_id: row.owner_membership_id,
    progress_percent: row.progress_percent ?? 0,
    description: row.description,
    annualTargetIds: row.annual_target_ids,
    keyResultIds: row.key_result_ids,
    start_date: row.start_date,
    end_date: row.end_date,
  };
}

function programsForInitiativeRow(
  row: InitiativeRow,
  open: Array<{ id: string; title: string }>,
  all: Array<{ id: string; title: string; status: string }>
): Array<{ id: string; title: string }> {
  const pid = row.program_id;
  const base = open;
  if (!pid || base.some((p) => p.id === pid)) return base;
  const extra = all.find((p) => p.id === pid);
  if (!extra) return base;
  return [
    ...base,
    {
      id: extra.id,
      title: `${extra.title} (Programm: ${extra.status === "closed" ? "Abgeschlossen" : extra.status})`,
    },
  ];
}

function keyResultOptionsForInitiativeRow(
  base: PipKeyResultOption[],
  row: InitiativeRow
): PipKeyResultOption[] {
  const byId = new Map(base.map((k) => [k.id, k] as const));
  for (const c of row.kr_link_contexts) {
    if (byId.has(c.key_result_id)) continue;
    byId.set(c.key_result_id, {
      id: c.key_result_id,
      title: c.key_result_title,
      objective_id: c.objective_id,
      objective_title: c.objective_title,
      okr_cycle_label: c.okr_cycle_label,
    });
  }
  return [...byId.values()].sort((a, b) => {
    const ot = a.objective_title.localeCompare(b.objective_title, "de");
    if (ot !== 0) return ot;
    return a.title.localeCompare(b.title, "de");
  });
}

function krContextsRecord(row: InitiativeRow): Record<string, InitiativeKrLinkContext> {
  const m: Record<string, InitiativeKrLinkContext> = {};
  for (const c of row.kr_link_contexts) {
    m[c.key_result_id] = c;
  }
  return m;
}

type InitiativesTableProps = {
  initiatives: InitiativeRow[];
  programTitleById: Record<string, string>;
  ownerLabelByMembershipId: Record<string, string>;
  canWrite: boolean;
  createInitiativeAction: (formData: FormData) => void | Promise<void>;
  updateInitiativeAction: (formData: FormData) => void | Promise<void>;
  programsOpenForInitiatives: Array<{ id: string; title: string }>;
  programsAll: Array<{ id: string; title: string; status: string }>;
  ownerOptions: Array<{ id: string; label: string }>;
  annualTargets: Array<{ id: string; title: string }>;
  keyResultOptions: PipKeyResultOption[];
};

export function InitiativesTable({
  initiatives,
  programTitleById,
  ownerLabelByMembershipId,
  canWrite,
  createInitiativeAction,
  updateInitiativeAction,
  programsOpenForInitiatives,
  programsAll,
  ownerOptions,
  annualTargets,
  keyResultOptions,
}: InitiativesTableProps) {
  const targetTitleById = useMemo(
    () => Object.fromEntries(annualTargets.map((t) => [t.id, t.title])),
    [annualTargets]
  );

  const [filterProgramId, setFilterProgramId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterOwnerMembershipId, setFilterOwnerMembershipId] = useState("");
  const [searchTitle, setSearchTitle] = useState("");

  const programFilterOptions = useMemo(() => {
    const ids = [...new Set(initiatives.map((i) => i.program_id).filter(Boolean))] as string[];
    return ids
      .map((id) => ({ id, title: programTitleById[id] ?? id }))
      .sort((a, b) => a.title.localeCompare(b.title, "de"));
  }, [initiatives, programTitleById]);

  const ownerFilterOptions = useMemo(() => {
    const ids = [...new Set(initiatives.map((i) => i.owner_membership_id).filter(Boolean))] as string[];
    return ids
      .map((id) => ({ id, label: ownerLabelByMembershipId[id] ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label, "de"));
  }, [initiatives, ownerLabelByMembershipId]);

  const filteredRows = useMemo(() => {
    const q = searchTitle.trim().toLowerCase();
    return initiatives.filter((i) => {
      if (filterProgramId && i.program_id !== filterProgramId) return false;
      if (filterStatus && (i.status ?? "") !== filterStatus) return false;
      if (filterOwnerMembershipId && i.owner_membership_id !== filterOwnerMembershipId) return false;
      if (q && !i.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [initiatives, filterProgramId, filterStatus, filterOwnerMembershipId, searchTitle]);

  const columns = [
    {
      id: "title",
      label: "Initiative",
      sortValue: (i: InitiativeRow) => i.title,
      render: (i: InitiativeRow) => <span className="font-semibold text-zinc-900">{i.title}</span>,
    },
    {
      id: "status",
      label: "Status",
      sortValue: (i: InitiativeRow) => i.status ?? null,
      render: (i: InitiativeRow) => {
        const s = i.status ?? "";
        const label = (INITIATIVE_STATUS_LABEL[s] ?? s) || "–";
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
        const clamped = Math.min(100, Math.max(0, pct));
        return (
          <div className="flex min-w-[7rem] items-start gap-2">
            <span className="mt-0.5 shrink-0" title="Statusbezogener Fortschrittshinweis">
              <span
                className={`block h-2 w-2 rounded-full ${initiativeProgressDotClass(i.status)}`}
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="tabular-nums text-xs font-medium text-zinc-800">{pct}&nbsp;%</div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                <div
                  className="h-full rounded-full bg-zinc-500"
                  style={{ width: `${clamped}%` }}
                />
              </div>
            </div>
          </div>
        );
      },
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
    {
      id: "owner",
      label: "Owner",
      sortValue: (i: InitiativeRow) =>
        i.owner_membership_id ? ownerLabelByMembershipId[i.owner_membership_id] ?? "" : null,
      render: (i: InitiativeRow) => (
        <span className="text-xs text-zinc-700">
          {i.owner_membership_id
            ? ownerLabelByMembershipId[i.owner_membership_id] ?? "–"
            : "–"}
        </span>
      ),
    },
    {
      id: "period",
      label: "Zeitraum",
      sortValue: (i: InitiativeRow) => i.start_date ?? i.end_date ?? "",
      render: (i: InitiativeRow) => (
        <span className="text-xs text-zinc-600">
          {formatInitiativePeriodDe(i.start_date, i.end_date)}
        </span>
      ),
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
      id: "priority",
      label: "Priorit\u00E4t",
      defaultVisible: false,
      sortValue: (i: InitiativeRow) => i.priority ?? null,
      render: (i: InitiativeRow) => (
        <span className="tabular-nums text-xs text-zinc-700">{i.priority ?? "–"}</span>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
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
            {INITIATIVE_STATUS_FILTER_ORDER.map((s) => (
              <option key={s} value={s}>
                {INITIATIVE_STATUS_LABEL[s] ?? s}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[140px] flex-1">
          <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Owner
          </label>
          <select
            value={filterOwnerMembershipId}
            onChange={(e) => setFilterOwnerMembershipId(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="">Alle</option>
            {ownerFilterOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
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
        renderExpandedContent={(initiative) => (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-zinc-900">{initiative.title}</span>
            </div>
            <InitiativeCreateForm
              key={initiative.id}
              canWrite={canWrite}
              createAction={createInitiativeAction}
              updateAction={updateInitiativeAction}
              programs={programsForInitiativeRow(
                initiative,
                programsOpenForInitiatives,
                programsAll
              )}
              ownerOptions={ownerOptions}
              annualTargets={annualTargets}
              keyResultOptions={keyResultOptionsForInitiativeRow(keyResultOptions, initiative)}
              selectedInitiative={initiativeRowToSelection(initiative)}
              targetTitleById={targetTitleById}
              krContextsByKrId={krContextsRecord(initiative)}
              onClearSelection={() => {}}
              showClearButton={false}
            />
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
        )}
      />
    </div>
  );
}
