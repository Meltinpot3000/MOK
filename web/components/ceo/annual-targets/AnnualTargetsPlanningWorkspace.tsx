"use client";

import { useMemo, useState } from "react";
import { ExpandableTable, type ColumnDef } from "@/components/ceo/ExpandableTable";
import {
  TableFilterBar,
  TableFilterSearch,
  TableFilterSelect,
} from "@/components/table/TableFilterBar";
import { matchesTableTitleSearch } from "@/lib/table/filter-utils";
import {
  acceptAnnualTargetProposalField,
  deleteAnnualTarget,
  dismissAnnualTargetSmartProposal,
  saveAnnualTargetDraftWithSentinelReview,
  sendAnnualTargetForSignature,
  transitionAnnualTargetLifecycle,
} from "@/app/(ceo)/annual-targets/actions";
import type {
  AnnualTargetPlanningRow,
  AnnualTargetProposalField,
  AnnualTargetWorkspaceContext,
} from "@/lib/annual-targets/types";
import {
  LIFECYCLE_STATUS_LABELS_DE,
  ANNUAL_TARGET_LIFECYCLE_STATUSES,
  SMART_DIMENSION_KEYS,
  SMART_DIMENSION_LABELS_DE,
} from "@/lib/annual-targets/types";
import {
  availableLifecycleActions,
  LIFECYCLE_ACTION_LABELS_DE,
  type LifecycleAction,
} from "@/lib/annual-targets/lifecycle";
import { proposalHasPendingField, smartDimensionMark } from "@/lib/annual-targets/smart-check";
import { OKR_CONTRIBUTION_TIER_META } from "@/lib/strategy-cycle/coverage-level";
import { formulationTierLabelDe } from "@/lib/okr/okr-contribution-direction-labels";
import {
  classifyAnnualTargetExecutionMode,
  PROGRAM_STATUSES_FOR_PLANNING,
  type AnnualTargetExecutionMode,
} from "@/lib/change-run/change-run-model";
import {
  AnnualTargetSentinelPanel,
  SmartFormulationFields,
} from "@/components/ceo/annual-targets/AnnualTargetSentinelPanel";

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
      if (matchesTableTitleSearch(r.programTitle ?? "", searchTitle)) return true;
      return false;
    });
  }, [rows, searchTitle, filterStatus, filterOwnerMembershipId]);

  const columns: ColumnDef<AnnualTargetPlanningRow>[] = [
    { id: "title", label: "Jahresziel", render: (r) => r.title, sortValue: (r) => r.title },
    { id: "year", label: "Zieljahr", render: (r) => r.target_year ?? "—", sortValue: (r) => r.target_year ?? 0 },
    { id: "owner", label: "Owner", render: (r) => r.ownerDisplayName },
    {
      id: "mode",
      label: "Modus",
      render: (r) =>
        classifyAnnualTargetExecutionMode(r.strategy_program_id) === "change" ? "Change" : "Run",
    },
    { id: "direction", label: "Stoßrichtung", render: (r) => r.directionTitle },
    {
      id: "program",
      label: "Programm",
      render: (r) => r.programTitle ?? (r.strategy_program_id ? "—" : "—"),
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
      render: (r: AnnualTargetPlanningRow) => {
        const check = r.smart_proposal?.smart_check?.[key] ?? r.smart_check?.[key];
        const hasProposal = proposalHasPendingField(r.smart_proposal, key);
        return (
          <span
            className={
              check === true
                ? "font-medium text-emerald-700"
                : check === false
                  ? "text-zinc-400"
                  : "text-zinc-300"
            }
            title={
              hasProposal
                ? `${SMART_DIMENSION_LABELS_DE[key]} · Sentinel-Vorschlag offen`
                : SMART_DIMENSION_LABELS_DE[key]
            }
          >
            {smartDimensionMark(check)}
            {hasProposal ? <span className="ml-0.5 text-[9px] text-amber-700">+</span> : null}
          </span>
        );
      },
    })),
    {
      id: "fit",
      label: "Anker-Fit",
      render: (r) => {
        const fit = r.anchor_fit;
        if (!fit) return <span className="text-zinc-300">·</span>;
        const meta = OKR_CONTRIBUTION_TIER_META[fit.overall_level];
        return (
          <span className="text-xs" title={fit.reason}>
            {meta.emoji} {meta.labelDe}
            <span className="block text-[10px] text-zinc-500">Vorschlag</span>
          </span>
        );
      },
    },
    {
      id: "status",
      label: "Status",
      render: (r) => (
        <span>
          {LIFECYCLE_STATUS_LABELS_DE[r.status] ?? r.status}
          {r.smart_proposal ? (
            <span className="mt-0.5 block text-[10px] text-amber-700">Sentinel-Vorschlag</span>
          ) : null}
        </span>
      ),
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
          Run-Ziele hängen an einer Stoßrichtung, Change-Ziele an einem Programm — formuliert nach
          SMART.
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
            SMART-Spalten: ✓ nach Sentinel; «+» = offener Vorschlag. Anker-Fit analog OKR-Einstufung.
            Details und «Vorschlag übernehmen» in der aufgeklappten Zeile.
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
              placeholder="Titel, Stoßrichtung, Programm oder Owner…"
            />
          </TableFilterBar>
        </div>
        <div className="mt-4">
          <ExpandableTable
            columns={columns}
            rows={filtered}
            getRowId={(r) => r.id}
            initialExpandedIds={editTargetId ? [editTargetId] : undefined}
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
  const ownerId = editRow?.owner_membership_id ?? context.defaultOwnerMembershipId;
  const showOwnerPick = context.canPickOwner && tab === "team";

  const initialMode: AnnualTargetExecutionMode = editRow
    ? classifyAnnualTargetExecutionMode(editRow.strategy_program_id)
    : "run";
  const [executionMode, setExecutionMode] = useState<AnnualTargetExecutionMode>(initialMode);
  const [directionId, setDirectionId] = useState(editRow?.strategic_direction_id ?? "");
  const [programId, setProgramId] = useState(editRow?.strategy_program_id ?? "");

  const selectablePrograms = useMemo(
    () =>
      context.programs.filter((p) =>
        (PROGRAM_STATUSES_FOR_PLANNING as readonly string[]).includes(p.status ?? "draft")
      ),
    [context.programs]
  );

  const resolvedDirectionId =
    executionMode === "change"
      ? selectablePrograms.find((p) => p.id === programId)?.strategic_direction_id ??
        directionId
      : directionId;

  const switchMode = (mode: AnnualTargetExecutionMode) => {
    setExecutionMode(mode);
    if (mode === "run") {
      setProgramId("");
    } else {
      setDirectionId("");
    }
  };

  return (
    <form id="annual-target-form" className="mt-4 space-y-3" onSubmit={(e) => e.preventDefault()}>
      <input type="hidden" name="return_tab" value={tab} />
      <input type="hidden" name="execution_mode" value={executionMode} />
      <input type="hidden" name="progress_calculation_mode" value="manual" />
      <input type="hidden" name="annual_target_type" value="strategic_commitment" />
      {editRow ? <input type="hidden" name="target_id" value={editRow.id} /> : null}

      <div>
        <p className={LABEL}>Zieltyp *</p>
        <div
          className="mt-1 inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1"
          role="tablist"
          aria-label="Run oder Change"
        >
          <button
            type="button"
            role="tab"
            aria-selected={executionMode === "run"}
            onClick={() => switchMode("run")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              executionMode === "run"
                ? "bg-teal-700 text-white shadow-sm"
                : "text-zinc-600 hover:bg-zinc-200/60"
            }`}
          >
            Run-Ziel
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={executionMode === "change"}
            onClick={() => switchMode("change")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              executionMode === "change"
                ? "bg-teal-700 text-white shadow-sm"
                : "text-zinc-600 hover:bg-zinc-200/60"
            }`}
          >
            Change-Ziel
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {executionMode === "run"
            ? "Stabiles Betriebsziel, verknüpft mit einer Stoßrichtung."
            : "Veränderungsziel, verknüpft mit einem Programm (Stoßrichtung folgt aus dem Programm)."}
        </p>
      </div>

      {executionMode === "run" ? (
        <div>
          <label className={LABEL}>Stoßrichtung *</label>
          <select
            name="strategic_direction_id"
            required
            value={directionId}
            onChange={(e) => setDirectionId(e.target.value)}
            className={INPUT}
          >
            <option value="">— wählen —</option>
            {context.directions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
          <input type="hidden" name="strategy_program_id" value="" />
        </div>
      ) : (
        <div>
          <label className={LABEL}>Programm *</label>
          <select
            name="strategy_program_id"
            required
            value={programId}
            onChange={(e) => {
              const next = e.target.value;
              setProgramId(next);
              const prog = selectablePrograms.find((p) => p.id === next);
              setDirectionId(prog?.strategic_direction_id ?? "");
            }}
            className={INPUT}
          >
            <option value="">— Programm wählen —</option>
            {selectablePrograms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
                {p.status && p.status !== "active" ? ` (${p.status})` : ""}
              </option>
            ))}
          </select>
          <input type="hidden" name="strategic_direction_id" value={resolvedDirectionId ?? ""} />
          {programId && !resolvedDirectionId ? (
            <p className="mt-1 text-xs text-amber-700">
              Das gewählte Programm hat keine Stoßrichtung — bitte zuerst am Programm hinterlegen.
            </p>
          ) : null}
        </div>
      )}

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

      <SmartFormulationFields initial={editRow?.smart_formulation ?? null} />

      {editRow ? (
        <div>
          <label className={LABEL}>Status</label>
          <select name="status" defaultValue={editRow.status} className={INPUT}>
            {ANNUAL_TARGET_LIFECYCLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {LIFECYCLE_STATUS_LABELS_DE[s]}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="status" value="draft" />
      )}

      <AnnualTargetSentinelPanel
        directions={context.directions}
        programs={context.programs}
        saveAction={saveAnnualTargetDraftWithSentinelReview}
        submitLabel={
          editRow ? "Speichern inkl. Sentinel-Review" : "Entwurf speichern inkl. Sentinel-Review"
        }
      />

      {editRow ? (
        <button type="button" className="brand-btn-secondary px-4 py-2 text-sm" onClick={onCancelEdit}>
          Abbrechen
        </button>
      ) : null}
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
  const formulation = row.smart_formulation;
  const proposal = row.smart_proposal;
  const fit = row.anchor_fit;

  return (
    <div className="space-y-3 text-sm text-zinc-700">
      {fit ? (
        <section className="rounded-md border border-violet-100 bg-violet-50/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Anker-Fit</p>
          <p className="mt-1 text-[11px] font-semibold text-zinc-800">
            {fit.anchor_type === "strategy_program" ? "Programm" : "Stoßrichtung"} ·{" "}
            {fit.anchor_title || "—"}
          </p>
          <dl className="mt-2 grid gap-1.5 text-[11px] sm:grid-cols-3">
            <div>
              <dt className="font-medium text-zinc-600">Alignment</dt>
              <dd className="text-zinc-900">
                {OKR_CONTRIBUTION_TIER_META[fit.alignment_level].emoji}{" "}
                {OKR_CONTRIBUTION_TIER_META[fit.alignment_level].labelDe}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">Formulierung</dt>
              <dd className="text-zinc-900">{formulationTierLabelDe(fit.formulation_level)}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-600">Gesamt</dt>
              <dd className="font-semibold text-zinc-900">
                {OKR_CONTRIBUTION_TIER_META[fit.overall_level].emoji}{" "}
                {OKR_CONTRIBUTION_TIER_META[fit.overall_level].labelDe}
              </dd>
            </div>
          </dl>
          {fit.reason ? (
            <p className="mt-2 text-[11px] leading-snug text-zinc-600">{fit.reason}</p>
          ) : null}
          {fit.improvement_hint ? (
            <p className="mt-1.5 text-[11px] leading-snug text-amber-900">
              <span className="font-medium">Verbesserung:</span> {fit.improvement_hint}
            </p>
          ) : null}
        </section>
      ) : null}

      {proposal ? (
        <section className="rounded-md border border-amber-200 bg-amber-50/50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              Sentinel-Vorschläge
            </p>
            {canWrite ? (
              <form action={dismissAnnualTargetSmartProposal}>
                <input type="hidden" name="target_id" value={row.id} />
                <input type="hidden" name="return_tab" value={tab} />
                <button type="submit" className="text-[11px] text-zinc-600 hover:underline">
                  Vorschläge verwerfen
                </button>
              </form>
            ) : null}
          </div>
          {proposal.improvement_notes.length > 0 ? (
            <ul className="mt-2 list-disc pl-4 text-[11px] text-zinc-600">
              {proposal.improvement_notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 space-y-2">
            {proposalHasPendingField(proposal, "title") ? (
              <ProposalFieldRow
                targetId={row.id}
                tab={tab}
                field="title"
                label="Titel"
                currentValue={row.title}
                proposedValue={proposal.title}
                canWrite={canWrite}
              />
            ) : null}
            {SMART_DIMENSION_KEYS.map((key) =>
              proposalHasPendingField(proposal, key) ? (
                <ProposalFieldRow
                  key={key}
                  targetId={row.id}
                  tab={tab}
                  field={key}
                  label={SMART_DIMENSION_LABELS_DE[key]}
                  currentValue={formulation?.[key] ?? ""}
                  proposedValue={proposal.formulation[key]}
                  canWrite={canWrite}
                />
              ) : null
            )}
          </div>
        </section>
      ) : null}

      {formulation ? (
        <dl className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Aktuelle Formulierung
          </p>
          {SMART_DIMENSION_KEYS.map((key) =>
            formulation[key] ? (
              <div key={key}>
                <dt className="font-medium text-zinc-900">{SMART_DIMENSION_LABELS_DE[key]}</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-zinc-700">{formulation[key]}</dd>
              </div>
            ) : null
          )}
        </dl>
      ) : (
        <>
          <p>{row.description || "Keine Beschreibung."}</p>
          <p>
            <span className="font-medium">Messlogik:</span> {row.measurement_logic || "—"}
          </p>
        </>
      )}
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

function ProposalFieldRow({
  targetId,
  tab,
  field,
  label,
  currentValue,
  proposedValue,
  canWrite,
}: {
  targetId: string;
  tab: "mine" | "team";
  field: AnnualTargetProposalField;
  label: string;
  currentValue: string;
  proposedValue: string;
  canWrite: boolean;
}) {
  return (
    <div className="rounded border border-amber-100 bg-white p-2 text-[11px]">
      <p className="font-medium text-zinc-800">{label}</p>
      {currentValue.trim() ? (
        <p className="mt-1 text-zinc-500">
          <span className="font-medium text-zinc-600">Aktuell:</span> {currentValue}
        </p>
      ) : null}
      <p className="mt-1 whitespace-pre-wrap text-zinc-800">
        <span className="font-medium text-amber-800">Vorschlag:</span> {proposedValue}
      </p>
      {canWrite ? (
        <form action={acceptAnnualTargetProposalField} className="mt-2">
          <input type="hidden" name="target_id" value={targetId} />
          <input type="hidden" name="return_tab" value={tab} />
          <input type="hidden" name="proposal_field" value={field} />
          <button
            type="submit"
            className="rounded-md bg-amber-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-amber-800"
          >
            Vorschlag übernehmen
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
