"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExpandableTable, type ColumnDef } from "@/components/ceo/ExpandableTable";
import {
  TableFilterBar,
  TableFilterSearch,
  TableFilterSelect,
} from "@/components/table/TableFilterBar";
import { matchesTableTitleSearch } from "@/lib/table/filter-utils";
import {
  createAnnualTarget,
  deleteAnnualTarget,
  improveAnnualTargetWithSentinelAction,
  sendAnnualTargetForSignature,
  transitionAnnualTargetLifecycle,
  updateAnnualTarget,
} from "@/app/(ceo)/annual-targets/actions";
import type {
  AnnualTargetPlanningRow,
  AnnualTargetWorkspaceContext,
  ProgressCalculationMode,
} from "@/lib/annual-targets/types";
import {
  ANNUAL_TARGET_TYPES,
  ANNUAL_TARGET_TYPE_LABELS_DE,
  LIFECYCLE_STATUS_LABELS_DE,
  PROGRESS_CALCULATION_MODES,
  PROGRESS_CALCULATION_MODE_LABELS_DE,
  PROGRESS_CALCULATION_MODE_HINTS_DE,
  ANNUAL_TARGET_DERIVATION_NOTE_LABEL_DE,
  ANNUAL_TARGET_DERIVATION_NOTE_HINT_DE,
  ANNUAL_TARGET_BASELINE_LABEL_DE,
  ANNUAL_TARGET_BASELINE_HINT_DE,
  ANNUAL_TARGET_CURRENT_MEASURE_LABEL_DE,
  ANNUAL_TARGET_CURRENT_MEASURE_HINT_DE,
  ANNUAL_TARGET_LIFECYCLE_STATUSES,
} from "@/lib/annual-targets/types";
import {
  availableLifecycleActions,
  LIFECYCLE_ACTION_LABELS_DE,
  type LifecycleAction,
} from "@/lib/annual-targets/lifecycle";
import { smartDimensionMark } from "@/lib/annual-targets/smart-check";
import {
  classifyAnnualTargetExecutionMode,
  PROGRAM_STATUSES_FOR_PLANNING,
} from "@/lib/change-run/change-run-model";
import {
  SMART_DIMENSION_KEYS,
  SMART_DIMENSION_LABELS_DE,
} from "@/lib/annual-targets/types";
import { AnnualTargetSentinelPanel } from "@/components/ceo/annual-targets/AnnualTargetSentinelPanel";

const INPUT =
  "mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500";
const LABEL = "text-xs font-medium text-zinc-600";

type Props = {
  tab: "mine" | "team";
  rows: AnnualTargetPlanningRow[];
  context: AnnualTargetWorkspaceContext;
  canWrite: boolean;
  defaultTargetYear: number;
  editTargetId: string | null;
};

export function AnnualTargetsPlanningWorkspace({
  tab,
  rows,
  context,
  canWrite,
  defaultTargetYear,
  editTargetId,
}: Props) {
  const [searchTitle, setSearchTitle] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterOwnerMembershipId, setFilterOwnerMembershipId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(editTargetId);
  const editRow = rows.find((r) => r.id === editingId) ?? null;

  const ownerFilterOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const row of rows) {
      if (row.owner_membership_id) {
        byId.set(row.owner_membership_id, row.ownerDisplayName);
      }
    }
    return [...byId.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], "de"))
      .map(([value, label]) => ({ value, label }));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterOwnerMembershipId && r.owner_membership_id !== filterOwnerMembershipId) {
        return false;
      }
      if (!searchTitle.trim()) return true;
      if (matchesTableTitleSearch(r.title, searchTitle)) return true;
      if (matchesTableTitleSearch(r.directionTitle, searchTitle)) return true;
      if (matchesTableTitleSearch(r.ownerDisplayName, searchTitle)) return true;
      return false;
    });
  }, [rows, searchTitle, filterStatus, filterOwnerMembershipId]);

  const columns: ColumnDef<AnnualTargetPlanningRow>[] = [
    { id: "title", label: "Jahresziel", render: (r) => r.title, sortValue: (r) => r.title },
    { id: "year", label: "Zieljahr", render: (r) => r.target_year ?? "—", sortValue: (r) => r.target_year ?? 0 },
    { id: "owner", label: "Owner", render: (r) => r.ownerDisplayName },
    { id: "direction", label: "Stoßrichtung", render: (r) => r.directionTitle },
    { id: "objective", label: "Strategisches Ziel", render: (r) => r.strategicObjectiveTitle ?? "—" },
    { id: "program", label: "Programm", render: (r) => r.programTitle ?? (r.strategy_program_id ? "—" : "Run") },
    {
      id: "type",
      label: "Typ",
      render: (r) => ANNUAL_TARGET_TYPE_LABELS_DE[r.annual_target_type] ?? r.annual_target_type,
    },
    ...SMART_DIMENSION_KEYS.map((key) => ({
      id: `smart_${key}`,
      label:
        key === "specific"
          ? "S"
          : key === "measurable"
            ? "M"
            : key === "achievable"
              ? "A"
              : key === "relevant"
                ? "R"
                : "T",
      render: (r: AnnualTargetPlanningRow) => (
        <span
          className={
            r.smart_check?.[key] === true
              ? "font-medium text-emerald-700"
              : r.smart_check?.[key] === false
                ? "text-zinc-400"
                : "text-zinc-300"
          }
          title={SMART_DIMENSION_LABELS_DE[key]}
        >
          {smartDimensionMark(r.smart_check?.[key])}
        </span>
      ),
    })),
    { id: "progress", label: "Fortschritt", render: (r) => `${r.progress_percent}%` },
    { id: "okr", label: "OKR-Alignment", render: (r) => r.okrAlignmentLabel },
    {
      id: "status",
      label: "Status",
      render: (r) => LIFECYCLE_STATUS_LABELS_DE[r.status] ?? r.status,
    },
    {
      id: "actions",
      label: "Aktionen",
      render: (r) => (
        <button
          type="button"
          className="text-xs text-blue-700 hover:underline"
          onClick={() => setEditingId(r.id)}
        >
          Bearbeiten
        </button>
      ),
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,760px)_minmax(0,1fr)]">
      <article className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Jahresziel anlegen</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Commitment-Objekt aus Strategieelementen — nicht aus OKRs abgeleitet.
        </p>
        {canWrite ? (
          <AnnualTargetForm
            key={editRow ? `edit-${editRow.id}` : "create"}
            context={context}
            tab={tab}
            defaultTargetYear={defaultTargetYear}
            editRow={editRow}
            onCancelEdit={() => setEditingId(null)}
          />
        ) : (
          <p className="mt-4 text-sm text-zinc-500">Keine Schreibberechtigung.</p>
        )}
      </article>

      <article className="brand-card p-6">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Jahresziel-Übersicht</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            SMART-Spalten (S/M/A/R/T): ✓ erfüllt nach letzter Sentinel-Ausarbeitung, — offen
          </p>
        </div>
        <div className="mt-4">
          <TableFilterBar>
            <TableFilterSelect
              label="Status"
              value={filterStatus}
              onChange={setFilterStatus}
              options={ANNUAL_TARGET_LIFECYCLE_STATUSES.map((s) => ({
                value: s,
                label: LIFECYCLE_STATUS_LABELS_DE[s] ?? s,
              }))}
            />
            <TableFilterSelect
              label="Owner"
              value={filterOwnerMembershipId}
              onChange={setFilterOwnerMembershipId}
              className="min-w-[140px] flex-1"
              options={ownerFilterOptions}
            />
            <TableFilterSearch
              value={searchTitle}
              onChange={setSearchTitle}
              label="Suche"
              placeholder="Titel, Stoßrichtung oder Owner…"
            />
          </TableFilterBar>
        </div>
        <div className="mt-4">
          <ExpandableTable
            columns={columns}
            rows={filtered}
            getRowId={(r) => r.id}
            emptyMessage={
              rows.length === 0
                ? "Keine Jahresziele in dieser Ansicht."
                : "Keine Treffer für die gewählten Filter."
            }
            renderExpandedContent={(r) => (
              <AnnualTargetDetailPanel row={r} context={context} canWrite={canWrite} tab={tab} />
            )}
          />
        </div>
      </article>
    </section>
  );
}

function AnnualTargetForm({
  context,
  tab,
  defaultTargetYear,
  editRow,
  onCancelEdit,
}: {
  context: AnnualTargetWorkspaceContext;
  tab: "mine" | "team";
  defaultTargetYear: number;
  editRow: AnnualTargetPlanningRow | null;
  onCancelEdit: () => void;
}) {
  const action = editRow ? updateAnnualTarget : createAnnualTarget;
  const ownerId = editRow?.owner_membership_id ?? context.defaultOwnerMembershipId;
  const showOwnerPick = context.canPickOwner && tab === "team";
  const [progressMode, setProgressMode] = useState<ProgressCalculationMode>(
    editRow?.progress_calculation_mode ?? "manual"
  );
  const [programId, setProgramId] = useState(editRow?.strategy_program_id ?? "");
  const executionMode = classifyAnnualTargetExecutionMode(programId || null);
  const progressModeOptions = useMemo(() => {
    if (executionMode === "run") {
      return PROGRESS_CALCULATION_MODES.filter((m) => m !== "key_result_based");
    }
    return PROGRESS_CALCULATION_MODES;
  }, [executionMode]);
  const selectablePrograms = useMemo(
    () =>
      context.programs.filter((p) =>
        (PROGRAM_STATUSES_FOR_PLANNING as readonly string[]).includes(p.status ?? "draft")
      ),
    [context.programs]
  );

  return (
    <form id="annual-target-form" action={action} className="mt-4 space-y-3">
      <input type="hidden" name="return_tab" value={tab} />
      {editRow ? <input type="hidden" name="target_id" value={editRow.id} /> : null}
      <div>
        <label className={LABEL}>Titel *</label>
        <input name="title" required defaultValue={editRow?.title ?? ""} className={INPUT} />
      </div>
      <div>
        <label className={LABEL}>Zieljahr *</label>
        <input
          name="target_year"
          type="number"
          required
          defaultValue={editRow?.target_year ?? defaultTargetYear}
          className={INPUT}
        />
      </div>
      <div>
        <label className={LABEL}>Ziel-Owner *</label>
        {showOwnerPick ? (
          <select name="owner_membership_id" required defaultValue={ownerId} className={INPUT}>
            {context.ownerOptions.map((o) => (
              <option key={o.membershipId} value={o.membershipId}>
                {o.fullName}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input type="hidden" name="owner_membership_id" value={ownerId} />
            <p className="mt-1 text-sm text-zinc-700">
              {context.ownerOptions.find((o) => o.membershipId === ownerId)?.fullName ?? "Sie"}
            </p>
          </>
        )}
      </div>
      <div>
        <label className={LABEL}>Stoßrichtung *</label>
        <select
          name="strategic_direction_id"
          required
          defaultValue={editRow?.strategic_direction_id ?? ""}
          className={INPUT}
        >
          <option value="">— wählen —</option>
          {context.directions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={LABEL}>Beschreibung *</label>
        <textarea
          name="description"
          rows={3}
          defaultValue={editRow?.description ?? ""}
          className={INPUT}
        />
      </div>
      <div>
        <label className={LABEL}>Messlogik / Zielwert *</label>
        <textarea
          name="measurement_logic"
          rows={2}
          defaultValue={editRow?.measurement_logic ?? ""}
          className={INPUT}
        />
      </div>
      <div>
        <label className={LABEL}>Fortschritt %</label>
        <input
          name="progress_percent"
          type="number"
          min={0}
          max={100}
          step={0.1}
          defaultValue={editRow?.progress_percent ?? 0}
          className={INPUT}
        />
      </div>
      <div>
        <label className={LABEL}>Lifecycle-Status</label>
        <select name="status" defaultValue={editRow?.status ?? "draft"} className={INPUT}>
          {ANNUAL_TARGET_LIFECYCLE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LIFECYCLE_STATUS_LABELS_DE[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={LABEL}>Jahresziel-Typ</label>
        <select
          name="annual_target_type"
          defaultValue={editRow?.annual_target_type ?? "strategic_commitment"}
          className={INPUT}
        >
          {ANNUAL_TARGET_TYPES.map((t) => (
            <option key={t} value={t}>
              {ANNUAL_TARGET_TYPE_LABELS_DE[t]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={LABEL}>Fortschrittsmodus</label>
        <select
          name="progress_calculation_mode"
          value={progressMode}
          onChange={(e) => setProgressMode(e.target.value as ProgressCalculationMode)}
          className={INPUT}
        >
          {progressModeOptions.map((m) => (
            <option key={m} value={m}>
              {PROGRESS_CALCULATION_MODE_LABELS_DE[m]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-500">{PROGRESS_CALCULATION_MODE_HINTS_DE[progressMode]}</p>
      </div>
      <div>
        <label className={LABEL}>Strategisches Ziel (empfohlen)</label>
        <select
          name="strategic_objective_id"
          defaultValue={editRow?.strategicObjectiveId ?? ""}
          className={INPUT}
        >
          <option value="">— keins —</option>
          {context.strategicObjectives.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={LABEL}>
          {executionMode === "change" ? "Change-Programm *" : "Programm (leer = Run-Jahresziel)"}
        </label>
        <select
          name="strategy_program_id"
          value={programId}
          onChange={(e) => {
            setProgramId(e.target.value);
            if (!e.target.value && progressMode === "key_result_based") {
              setProgressMode("manual");
            }
          }}
          className={INPUT}
        >
          <option value="">— Run (kein Programm) —</option>
          {selectablePrograms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
              {p.status && p.status !== "active" ? ` (${p.status})` : ""}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-500">
          {executionMode === "change"
            ? "Change-Jahresziel: Programm Pflicht. OKR-Verknüpfung erst nach Freigabe (active) von Programm und Jahresziel."
            : "Run-Jahresziel: stabile Betriebsziele ohne Programm, ohne OKR und ohne Initiativen."}
        </p>
      </div>
      <div>
        <label className={LABEL}>{ANNUAL_TARGET_DERIVATION_NOTE_LABEL_DE}</label>
        <textarea
          name="derivation_note"
          rows={2}
          defaultValue={editRow?.derivation_note ?? ""}
          className={INPUT}
        />
        <p className="mt-1 text-xs text-zinc-500">{ANNUAL_TARGET_DERIVATION_NOTE_HINT_DE}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={LABEL}>{ANNUAL_TARGET_BASELINE_LABEL_DE}</label>
          <input
            name="baseline"
            type="number"
            step="0.01"
            defaultValue={editRow?.baseline ?? ""}
            className={INPUT}
          />
          <p className="mt-1 text-xs text-zinc-500">{ANNUAL_TARGET_BASELINE_HINT_DE}</p>
        </div>
        <div>
          <label className={LABEL}>{ANNUAL_TARGET_CURRENT_MEASURE_LABEL_DE}</label>
          <input
            name="current_measure"
            type="number"
            step="0.01"
            defaultValue={editRow?.current_measure ?? ""}
            className={INPUT}
          />
          <p className="mt-1 text-xs text-zinc-500">{ANNUAL_TARGET_CURRENT_MEASURE_HINT_DE}</p>
        </div>
      </div>
      <div>
        <label className={LABEL}>Bonusgewichtung</label>
        <input
          name="bonus_weight"
          type="number"
          step="0.01"
          defaultValue={editRow?.bonus_weight ?? ""}
          className={INPUT}
        />
      </div>

      <AnnualTargetSentinelPanel
        directions={context.directions}
        programs={context.programs}
        strategicObjectives={context.strategicObjectives}
        initialSmartCheckJson={
          editRow?.smart_check ? JSON.stringify(editRow.smart_check) : ""
        }
        initialAiAssisted={editRow?.ai_assisted ? "1" : "0"}
        improveAction={improveAnnualTargetWithSentinelAction}
      />

      <div className="flex flex-wrap gap-2 pt-2">
        <button type="submit" className="brand-btn px-4 py-2 text-sm">
          {editRow ? "Speichern" : "Als Entwurf speichern"}
        </button>
        {editRow ? (
          <button type="button" className="brand-btn-secondary px-4 py-2 text-sm" onClick={onCancelEdit}>
            Abbrechen
          </button>
        ) : null}
      </div>
    </form>
  );
}

function AnnualTargetDetailPanel({
  row,
  context,
  canWrite,
  tab,
}: {
  row: AnnualTargetPlanningRow;
  context: AnnualTargetWorkspaceContext;
  canWrite: boolean;
  tab: "mine" | "team";
}) {
  const actions = availableLifecycleActions(
    row.status,
    context.orgSignatureSettings,
    row.signature_status
  );

  return (
    <div className="space-y-3 text-sm text-zinc-700">
      <p>{row.description || "Keine Beschreibung."}</p>
      <p>
        <span className="font-medium">Messlogik:</span> {row.measurement_logic || "—"}
      </p>
      <p>
        <span className="font-medium">Signaturstatus:</span> {row.signature_status}
      </p>
      <section className="rounded-md border border-zinc-200 p-3">
        <h4 className="font-semibold text-zinc-900">Freigabe &amp; Signatur</h4>
        <p className="mt-1 text-xs text-zinc-500">
          Lifecycle: {LIFECYCLE_STATUS_LABELS_DE[row.status] ?? row.status}
        </p>
        {canWrite && actions.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {actions.map((action) => (
              <LifecycleActionButton key={action} targetId={row.id} action={action} tab={tab} />
            ))}
          </div>
        ) : null}
        {canWrite && row.status === "approved" && context.orgSignatureSettings.requireSignature ? (
          <form action={sendAnnualTargetForSignature} className="mt-2">
            <input type="hidden" name="target_id" value={row.id} />
            <button type="submit" className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-white">
              Zur Signatur senden
            </button>
          </form>
        ) : null}
      </section>
      {row.status === "draft" && canWrite ? (
        <form action={deleteAnnualTarget}>
          <input type="hidden" name="target_id" value={row.id} />
          <button type="submit" className="text-xs text-red-700 hover:underline">
            Entwurf löschen
          </button>
        </form>
      ) : null}
    </div>
  );
}

function LifecycleActionButton({
  targetId,
  action,
  tab,
}: {
  targetId: string;
  action: LifecycleAction;
  tab: "mine" | "team";
}) {
  return (
    <form action={transitionAnnualTargetLifecycle}>
      <input type="hidden" name="target_id" value={targetId} />
      <input type="hidden" name="lifecycle_action" value={action} />
      <input type="hidden" name="return_tab" value={tab} />
      <button type="submit" className="rounded-md bg-zinc-100 px-2 py-1 text-xs hover:bg-zinc-200">
        {LIFECYCLE_ACTION_LABELS_DE[action]}
      </button>
    </form>
  );
}
