"use client";

import { useMemo, useState } from "react";
import { ProgramCreateForm, type ProgramFormSelection } from "@/components/ceo/ProgramCreateForm";
import { ExpandableTable } from "./ExpandableTable";
import {
  deriveProgramOverviewHealth,
  programOverviewHealthLabelDe,
  type ProgramOverviewHealth,
} from "@/lib/strategy-cycle/program-overview-health";

const PROGRAM_STATUSES = ["draft", "active", "on_hold", "closed"] as const;

const PROGRAM_STATUS_LABELS_UI: Record<(typeof PROGRAM_STATUSES)[number], string> = {
  draft: "Draft",
  active: "Aktiv",
  on_hold: "On Hold",
  closed: "Abgeschlossen",
};

function statusPillClass(status: string): string {
  switch (status) {
    case "active":
      return "border-emerald-200/80 bg-emerald-50 text-emerald-900";
    case "on_hold":
      return "border-amber-200/80 bg-amber-50 text-amber-900";
    case "closed":
      return "border-zinc-200 bg-zinc-100 text-zinc-700";
    default:
      return "border-zinc-200 bg-white text-zinc-700";
  }
}

function healthDotClass(health: ProgramOverviewHealth): string {
  switch (health) {
    case "green":
      return "bg-emerald-500";
    case "yellow":
      return "bg-amber-400";
    case "red":
      return "bg-red-500";
    default:
      return "bg-zinc-400";
  }
}

function formatDeDateOnly(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatProgramPeriodDe(start: string | null, end: string | null): string {
  const a = start ? formatDeDateOnly(start) : "";
  const b = end ? formatDeDateOnly(end) : "";
  if (a && b) return `${a} – ${b}`;
  if (a) return `ab ${a}`;
  if (b) return `bis ${b}`;
  return "–";
}

function formatChf(value: number | null): string {
  if (value == null) return "–";
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

const INITIATIVE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  planned: "Geplant",
  active: "Aktiv",
  at_risk: "Auffaellig",
  on_hold: "On Hold",
  completed: "Abgeschlossen",
  archived: "Archiviert",
};

export type ProgramInitiativeRow = {
  id: string;
  title: string;
  status: string | null;
  priority: number | null;
  progress_percent: number | null;
};

export type ProgramRow = {
  id: string;
  title: string;
  description: string | null;
  strategic_direction_id: string | null;
  owner_membership_id: string | null;
  budget_total: number | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  initiative_count: number;
  initiative_active_count: number;
  initiative_done_count: number;
  progress_percent_from_initiatives: number;
};

function programRowToSelection(p: ProgramRow): ProgramFormSelection {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    strategic_direction_id: p.strategic_direction_id,
    status: p.status,
    owner_membership_id: p.owner_membership_id,
    start_date: p.start_date,
    end_date: p.end_date,
    budget_total: p.budget_total,
    initiative_active_count: p.initiative_active_count,
  };
}

/** Sponsoren-Dropdown: Executives; bei Altbestand zusaetzlich aktueller Sponsor (ohne Executive), bis umgestellt. */
function sponsorSelectOptionsForProgram(
  program: ProgramRow,
  executiveOptions: Array<{ id: string; label: string }>,
  labelByMembershipId: Record<string, string>
): Array<{ id: string; label: string }> {
  const mid = program.owner_membership_id;
  if (!mid || executiveOptions.some((o) => o.id === mid)) return executiveOptions;
  return [
    ...executiveOptions,
    {
      id: mid,
      label: `${labelByMembershipId[mid] ?? mid} (ohne Executive-Rolle)`,
    },
  ];
}

function strategicDirectionsForProgramRow(
  program: ProgramRow,
  active: Array<{ id: string; title: string }>,
  all: Array<{ id: string; title: string }>
): Array<{ id: string; title: string }> {
  const sel = program.strategic_direction_id;
  if (!sel || active.some((d) => d.id === sel)) return active;
  const extra = all.find((d) => d.id === sel);
  return extra ? [...active, extra] : active;
}

type ProgramsTableProps = {
  programs: ProgramRow[];
  directionTitleById: Record<string, string>;
  ownerLabelByMembershipId: Record<string, string>;
  initiativesByProgramId: Record<string, ProgramInitiativeRow[]>;
  canWrite: boolean;
  createProgramAction: (formData: FormData) => void | Promise<void>;
  updateProgramAction: (formData: FormData) => void | Promise<void>;
  strategicDirectionsForPrograms: Array<{ id: string; title: string }>;
  strategicDirectionsAll: Array<{ id: string; title: string }>;
  ownerOptions: Array<{ id: string; label: string }>;
};

export function ProgramsTable({
  programs,
  directionTitleById,
  ownerLabelByMembershipId,
  initiativesByProgramId,
  canWrite,
  createProgramAction,
  updateProgramAction,
  strategicDirectionsForPrograms,
  strategicDirectionsAll,
  ownerOptions,
}: ProgramsTableProps) {
  const [filterStatus, setFilterStatus] = useState("");
  const [filterOwnerMembershipId, setFilterOwnerMembershipId] = useState("");
  const [searchTitle, setSearchTitle] = useState("");

  const ownerFilterOptions = useMemo(() => {
    const ids = [
      ...new Set(programs.map((p) => p.owner_membership_id).filter(Boolean)),
    ] as string[];
    return ids
      .map((id) => ({ id, label: ownerLabelByMembershipId[id] ?? id }))
      .sort((a, b) => a.label.localeCompare(b.label, "de"));
  }, [programs, ownerLabelByMembershipId]);

  const filteredPrograms = useMemo(() => {
    const q = searchTitle.trim().toLowerCase();
    return programs.filter((p) => {
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterOwnerMembershipId && p.owner_membership_id !== filterOwnerMembershipId) return false;
      if (q && !p.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [programs, filterStatus, filterOwnerMembershipId, searchTitle]);

  const columns = [
    {
      id: "title",
      label: "Programm",
      sortValue: (p: ProgramRow) => p.title,
      render: (p: ProgramRow) => <span className="font-semibold text-zinc-900">{p.title}</span>,
    },
    {
      id: "status",
      label: "Status",
      sortValue: (p: ProgramRow) => p.status,
      render: (p: ProgramRow) => {
        const label =
          PROGRAM_STATUS_LABELS_UI[p.status as (typeof PROGRAM_STATUSES)[number]] ?? p.status;
        return (
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusPillClass(p.status)}`}
          >
            {label}
          </span>
        );
      },
    },
    {
      id: "progress",
      label: "Fortschritt",
      defaultVisible: true,
      sortValue: (p: ProgramRow) => p.progress_percent_from_initiatives,
      render: (p: ProgramRow) => {
        const pct = Math.round(Number(p.progress_percent_from_initiatives) || 0);
        const health = deriveProgramOverviewHealth({
          initiativeActiveCount: p.initiative_active_count,
          progressPercent: p.progress_percent_from_initiatives,
        });
        const clamped = Math.min(100, Math.max(0, pct));
        return (
          <div className="flex min-w-[7rem] items-start gap-2">
            <span
              className="mt-0.5 shrink-0"
              title={programOverviewHealthLabelDe(health)}
            >
              <span className={`block h-2 w-2 rounded-full ${healthDotClass(health)}`} />
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
      id: "initiatives",
      label: "Initiativen",
      sortValue: (p: ProgramRow) => p.initiative_count,
      render: (p: ProgramRow) => {
        const parts = [`${p.initiative_count} gesamt`];
        if (p.initiative_active_count > 0) {
          parts.push(`${p.initiative_active_count} aktiv`);
        }
        if (p.initiative_done_count > 0) {
          parts.push(`${p.initiative_done_count} abgeschlossen`);
        }
        return <span className="text-xs text-zinc-600">{parts.join(" · ")}</span>;
      },
    },
    {
      id: "owner",
      label: "Sponsor",
      sortValue: (p: ProgramRow) =>
        p.owner_membership_id ? ownerLabelByMembershipId[p.owner_membership_id] ?? null : null,
      render: (p: ProgramRow) => (
        <span className="text-xs text-zinc-700">
          {p.owner_membership_id
            ? ownerLabelByMembershipId[p.owner_membership_id] ?? "–"
            : "–"}
        </span>
      ),
    },
    {
      id: "period",
      label: "Zeitraum",
      sortValue: (p: ProgramRow) => p.start_date ?? p.end_date ?? "",
      render: (p: ProgramRow) => (
        <span className="text-xs text-zinc-600">{formatProgramPeriodDe(p.start_date, p.end_date)}</span>
      ),
    },
    {
      id: "budget_total",
      label: "Budget",
      defaultVisible: false,
      sortValue: (p: ProgramRow) => p.budget_total ?? null,
      render: (p: ProgramRow) => (
        <span className="tabular-nums text-xs text-zinc-700">{formatChf(p.budget_total)}</span>
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
            {PROGRAM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROGRAM_STATUS_LABELS_UI[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[140px] flex-1">
          <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Sponsor
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

      <ExpandableTable<ProgramRow>
      columns={columns}
      rows={filteredPrograms}
      getRowId={(p) => p.id}
      expandLabel="Details"
      emptyMessage="Noch keine Programme erfasst."
      renderExpandedContent={(program) => {
        const inits = initiativesByProgramId[program.id] ?? [];
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-zinc-900">{program.title}</span>
            </div>
            <ProgramCreateForm
              key={program.id}
              canWrite={canWrite}
              createAction={createProgramAction}
              updateAction={updateProgramAction}
              strategicDirections={strategicDirectionsForProgramRow(
                program,
                strategicDirectionsForPrograms,
                strategicDirectionsAll
              )}
              ownerOptions={sponsorSelectOptionsForProgram(
                program,
                ownerOptions,
                ownerLabelByMembershipId
              )}
              selectedProgram={programRowToSelection(program)}
              onClearSelection={() => {}}
              showClearButton={false}
            />

            <div>
              <p className="mb-2 text-xs font-semibold text-zinc-800">Zugehoerige Initiativen</p>
              {inits.length === 0 ? (
                <p className="text-xs text-zinc-500">Keine Initiativen verknüpft.</p>
              ) : (
                <div className="overflow-x-auto rounded border border-zinc-200">
                  <table className="min-w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-50 text-left text-zinc-700">
                        <th className="border-b border-zinc-200 px-2 py-1.5 font-medium">
                          Initiative
                        </th>
                        <th className="border-b border-zinc-200 px-2 py-1.5 font-medium">Status</th>
                        <th className="border-b border-zinc-200 px-2 py-1.5 font-medium">
                          Fortschritt
                        </th>
                        <th className="border-b border-zinc-200 px-2 py-1.5 font-medium">
                          
                          Priorität
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {inits.map((i) => (
                        <tr key={i.id} className="border-b border-zinc-100 bg-white last:border-0">
                          <td className="px-2 py-1.5 font-medium text-zinc-900">{i.title}</td>
                          <td className="px-2 py-1.5 text-zinc-600">
                            {i.status
                              ? INITIATIVE_STATUS_LABEL[i.status] ?? i.status
                              : "–"}
                          </td>
                          <td className="px-2 py-1.5 tabular-nums text-zinc-600">
                            {i.progress_percent != null ? `${Math.round(Number(i.progress_percent))} %` : "–"}
                          </td>
                          <td className="px-2 py-1.5 tabular-nums text-zinc-600">
                            {i.priority ?? "–"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      }}
    />
    </div>
  );
}
