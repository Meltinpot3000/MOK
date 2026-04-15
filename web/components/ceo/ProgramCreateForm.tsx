"use client";

import { useEffect, useMemo, useState } from "react";

const PROGRAM_STATUSES = ["draft", "active", "on_hold", "closed"] as const;

const PROGRAM_STATUS_LABELS_UI: Record<(typeof PROGRAM_STATUSES)[number], string> = {
  draft: "Draft",
  active: "Aktiv",
  on_hold: "On Hold",
  closed: "Abgeschlossen",
};

export type ProgramFormSelection = {
  id: string;
  title: string;
  description: string | null;
  strategic_direction_id: string | null;
  status: string;
  owner_membership_id: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_total: number | null;
  initiative_active_count: number;
};

type ProgramCreateFormProps = {
  canWrite: boolean;
  createAction: (formData: FormData) => void | Promise<void>;
  updateAction: (formData: FormData) => void | Promise<void>;
  strategicDirections: Array<{ id: string; title: string }>;
  ownerOptions: Array<{ id: string; label: string }>;
  selectedProgram: ProgramFormSelection | null;
  onClearSelection: () => void;
  /** „Neu anlegen / Zuruecksetzen“ nur im linken Erfassen-Panel; in Tabellen-Zeile ausblenden. */
  showClearButton?: boolean;
};

function emptyFormState() {
  return {
    title: "",
    strategicDirectionId: "",
    status: "draft" as (typeof PROGRAM_STATUSES)[number],
    ownerMembershipId: "",
    startDate: "",
    endDate: "",
    budget: "",
    description: "",
  };
}

export function ProgramCreateForm({
  canWrite,
  createAction,
  updateAction,
  strategicDirections,
  ownerOptions,
  selectedProgram,
  onClearSelection,
  showClearButton = true,
}: ProgramCreateFormProps) {
  const [form, setForm] = useState(emptyFormState);
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    setClientError(null);
    if (!selectedProgram) {
      setForm(emptyFormState());
      return;
    }
    setForm({
      title: selectedProgram.title,
      strategicDirectionId: selectedProgram.strategic_direction_id ?? "",
      status: (PROGRAM_STATUSES.includes(selectedProgram.status as (typeof PROGRAM_STATUSES)[number])
        ? selectedProgram.status
        : "draft") as (typeof PROGRAM_STATUSES)[number],
      ownerMembershipId: selectedProgram.owner_membership_id ?? "",
      startDate: selectedProgram.start_date ?? "",
      endDate: selectedProgram.end_date ?? "",
      budget:
        selectedProgram.budget_total != null && Number(selectedProgram.budget_total) > 0
          ? String(selectedProgram.budget_total)
          : "",
      description: selectedProgram.description ?? "",
    });
  }, [selectedProgram]);

  const isEdit = Boolean(selectedProgram);

  const canSubmit = useMemo(() => {
    return (
      form.title.trim().length > 0 &&
      form.strategicDirectionId.length > 0 &&
      PROGRAM_STATUSES.includes(form.status)
    );
  }, [form.title, form.strategicDirectionId, form.status]);

  const validateBeforeSubmit = (): string | null => {
    if (!form.title.trim()) return "Bitte einen Titel angeben.";
    if (!form.strategicDirectionId) return "Bitte eine strategische Sto\u00DFrichtung waehlen.";
    if (!PROGRAM_STATUSES.includes(form.status)) return "Bitte einen Status waehlen.";
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      return "Das Enddatum darf nicht vor dem Startdatum liegen.";
    }
    if (form.status === "active") {
      const activeCount = selectedProgram?.initiative_active_count ?? 0;
      if (activeCount < 1) {
        return "Ein Programm kann erst auf Aktiv gesetzt werden, wenn mindestens eine zugeh\u00F6rige Initiative aktiv ist.";
      }
    }
    return null;
  };

  const handleSave = async (formData: FormData) => {
    const err = validateBeforeSubmit();
    if (err) {
      setClientError(err);
      return;
    }
    setClientError(null);
    if (isEdit) {
      await updateAction(formData);
    } else {
      await createAction(formData);
    }
  };

  return (
    <form action={handleSave} className="mt-4 space-y-3">
      {isEdit ? <input type="hidden" name="program_id" value={selectedProgram!.id} /> : null}

      <input type="hidden" name="title" value={form.title} />
      <input type="hidden" name="strategic_direction_id" value={form.strategicDirectionId} />
      <input type="hidden" name="status" value={form.status} />
      <input
        type="hidden"
        name="owner_membership_id"
        value={form.ownerMembershipId.trim()}
      />
      <input type="hidden" name="start_date" value={form.startDate} />
      <input type="hidden" name="end_date" value={form.endDate} />
      <input
        type="hidden"
        name="budget_total"
        value={form.budget.trim() === "" ? "0" : form.budget.trim()}
      />
      <input type="hidden" name="description" value={form.description} />

      {clientError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {clientError}
        </p>
      ) : null}

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Titel</label>
        <input
          value={form.title}
          onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
          placeholder="Programmtitel"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">
          
          Strategische Stoßrichtung
        </label>
        <p className="mb-1.5 text-[11px] text-zinc-500">
          
          Nur Stoßrichtungen mit Status «Aktiv» sind waehlbar. Andere Status zuerst im Bereich
          Strategische Stoßrichtungen auf Aktiv setzen.
        </p>
        <select
          value={form.strategicDirectionId}
          onChange={(e) => setForm((s) => ({ ...s, strategicDirectionId: e.target.value }))}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">Stoßrichtung waehlen</option>
          {strategicDirections.map((direction) => (
            <option key={direction.id} value={direction.id}>
              {direction.title}
            </option>
          ))}
        </select>
        {strategicDirections.length === 0 ? (
          <p className="mt-1.5 text-xs text-amber-800">
            
            Es gibt keine aktive Stoßrichtung in diesem Zyklus — zuerst eine Stoßrichtung auf Status
            Aktiv setzen.
          </p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Status</label>
        <select
          value={form.status}
          onChange={(e) =>
            setForm((s) => ({
              ...s,
              status: e.target.value as (typeof PROGRAM_STATUSES)[number],
            }))
          }
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          {PROGRAM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PROGRAM_STATUS_LABELS_UI[s]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Sponsor</label>
        <p className="mb-1 text-[11px] text-zinc-500">Nur Organisationsmitglieder mit Rolle Executive.</p>
        <select
          value={form.ownerMembershipId}
          onChange={(e) => setForm((s) => ({ ...s, ownerMembershipId: e.target.value }))}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">Kein Sponsor</option>
          {ownerOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700">Startdatum</label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((s) => ({ ...s, startDate: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700">Enddatum</label>
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => setForm((s) => ({ ...s, endDate: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Budget (optional)</label>
        <input
          type="number"
          value={form.budget}
          onChange={(e) => setForm((s) => ({ ...s, budget: e.target.value }))}
          min={0}
          step={1000}
          placeholder="0"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Beschreibung</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
          rows={4}
          placeholder="Kurzbeschreibung"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={!canWrite || !canSubmit}
        className="brand-btn w-full px-4 py-2 text-sm"
      >
        Programm speichern
      </button>

      {isEdit && showClearButton ? (
        <button
          type="button"
          onClick={() => {
            setClientError(null);
            onClearSelection();
          }}
          className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
        >
          
          Neu anlegen oder Zurücksetzen
        </button>
      ) : null}
    </form>
  );
}
