"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatChfAmount,
  parseInitiativeBudgetInput,
  remainingProgramBudget,
  validateInitiativeBudgetAgainstProgram,
  type InitiativeProgramOption,
} from "@/lib/strategy-cycle/initiative-program-budget";

const FORM_STATUSES = [
  "draft",
  "planned",
  "active",
  "at_risk",
  "on_hold",
  "completed",
  "archived",
] as const;

const STATUS_LABELS: Record<(typeof FORM_STATUSES)[number], string> = {
  draft: "Draft",
  planned: "Geplant",
  active: "Aktiv",
  at_risk: "Auffaellig",
  on_hold: "On Hold",
  completed: "Abgeschlossen",
  archived: "Archiviert",
};

export type InitiativeFormSelection = {
  id: string;
  title: string;
  program_id: string | null;
  status: string;
  priority: number;
  owner_membership_id: string | null;
  progress_percent: number;
  description: string | null;
  budget: number | null;
  start_date: string | null;
  end_date: string | null;
};

type InitiativeCreateFormProps = {
  canWrite: boolean;
  createAction: (formData: FormData) => void | Promise<void>;
  updateAction: (formData: FormData) => void | Promise<void>;
  programs: InitiativeProgramOption[];
  ownerOptions: Array<{ id: string; label: string }>;
  selectedInitiative: InitiativeFormSelection | null;
  onClearSelection: () => void;
  showClearButton?: boolean;
};

function statusOptionsFor(current: string): string[] {
  const base: string[] = [...FORM_STATUSES];
  if (current && !base.includes(current)) base.push(current);
  return base;
}

function labelForStatus(s: string): string {
  if (s in STATUS_LABELS) return STATUS_LABELS[s as (typeof FORM_STATUSES)[number]];
  return s;
}

export function InitiativeCreateForm({
  canWrite,
  createAction,
  updateAction,
  programs,
  ownerOptions,
  selectedInitiative,
  onClearSelection,
  showClearButton = true,
}: InitiativeCreateFormProps) {
  const [title, setTitle] = useState("");
  const [programId, setProgramId] = useState("");
  const [status, setStatus] = useState<string>("planned");
  const [priority, setPriority] = useState(3);
  const [ownerId, setOwnerId] = useState("");
  const [progressStr, setProgressStr] = useState("0");
  const [description, setDescription] = useState("");
  const [budgetStr, setBudgetStr] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);

  const isEdit = Boolean(selectedInitiative);

  useEffect(() => {
    setClientError(null);
    if (!selectedInitiative) {
      setTitle("");
      setProgramId("");
      setStatus("planned");
      setPriority(3);
      setOwnerId("");
      setProgressStr("0");
      setDescription("");
      setBudgetStr("");
      setStartDate("");
      setEndDate("");
      return;
    }
    setTitle(selectedInitiative.title);
    setProgramId(selectedInitiative.program_id ?? "");
    setStatus(selectedInitiative.status || "planned");
    setPriority(selectedInitiative.priority ?? 3);
    setOwnerId(selectedInitiative.owner_membership_id ?? "");
    setProgressStr(String(Math.round(selectedInitiative.progress_percent ?? 0)));
    setDescription(selectedInitiative.description ?? "");
    setBudgetStr(
      selectedInitiative.budget != null && Number.isFinite(selectedInitiative.budget)
        ? String(selectedInitiative.budget)
        : ""
    );
    setStartDate(selectedInitiative.start_date ?? "");
    setEndDate(selectedInitiative.end_date ?? "");
  }, [selectedInitiative]);

  const selectedProgram = useMemo(
    () => programs.find((p) => p.id === programId) ?? null,
    [programs, programId]
  );

  const programBudgetContext: Pick<InitiativeProgramOption, "budgetTotal" | "allocatedBudget"> | null =
    selectedProgram
      ? {
          budgetTotal: selectedProgram.budgetTotal,
          allocatedBudget: selectedProgram.allocatedBudget,
        }
      : null;

  const currentInitiativeBudget = selectedInitiative?.budget ?? 0;
  const remainingBudget = programBudgetContext
    ? remainingProgramBudget(programBudgetContext, currentInitiativeBudget)
    : null;

  const statusSelectOptions = useMemo(() => {
    if (!selectedInitiative) return [...FORM_STATUSES];
    return statusOptionsFor(selectedInitiative.status);
  }, [selectedInitiative]);

  const canSubmit = useMemo(() => title.trim().length > 0 && programId.length > 0, [title, programId]);

  const validate = (): string | null => {
    if (!title.trim()) return "Bitte einen Titel angeben.";
    if (!programId) return "Bitte ein Change-Programm wählen.";
    const p = Number(progressStr);
    if (!Number.isFinite(p) || p < 0 || p > 100) {
      return "Fortschritt muss eine Zahl zwischen 0 und 100 sein.";
    }
    if (priority < 1 || priority > 5) return "Priorität muss zwischen 1 und 5 liegen.";
    if (startDate && endDate && startDate > endDate) {
      return "Das Enddatum darf nicht vor dem Startdatum liegen.";
    }
    const requestedBudget = parseInitiativeBudgetInput(budgetStr);
    if (budgetStr.trim() && requestedBudget == null) {
      return "Budget muss eine gültige Zahl ≥ 0 sein.";
    }
    if (selectedProgram && requestedBudget != null) {
      const otherAllocated =
        selectedProgram.allocatedBudget -
        (isEdit && selectedInitiative?.program_id === programId ? currentInitiativeBudget : 0);
      return validateInitiativeBudgetAgainstProgram({
        programBudgetTotal: selectedProgram.budgetTotal,
        otherInitiativesAllocated: Math.max(0, otherAllocated),
        requestedBudget,
      });
    }
    return null;
  };

  const handleSave = async (formData: FormData) => {
    const err = validate();
    if (err) {
      setClientError(err);
      return;
    }
    setClientError(null);
    if (isEdit) await updateAction(formData);
    else await createAction(formData);
  };

  const progressNum = Math.min(100, Math.max(0, Math.round(Number(progressStr) || 0)));
  const parsedBudget = parseInitiativeBudgetInput(budgetStr);

  return (
    <form action={handleSave} className="mt-4 space-y-3">
      {isEdit ? <input type="hidden" name="initiative_id" value={selectedInitiative!.id} /> : null}

      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="program_id" value={programId} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="priority" value={String(priority)} />
      <input type="hidden" name="owner_membership_id" value={ownerId} />
      <input type="hidden" name="progress_percent" value={String(progressNum)} />
      <input type="hidden" name="description" value={description} />
      <input type="hidden" name="start_date" value={startDate} />
      <input type="hidden" name="end_date" value={endDate} />
      <input type="hidden" name="budget" value={parsedBudget != null ? String(parsedBudget) : ""} />

      {clientError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {clientError}
        </p>
      ) : null}

      <p className="rounded-md border border-sky-100 bg-sky-50/80 px-3 py-2 text-[11px] text-sky-950">
        Change-Initiativen hängen am Programm. OKR-Key Results und Jahresziele werden an anderer Stelle
        verknüpft (OKR-Workspace bzw. Change-Jahresziel).
      </p>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Titel</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Initiativentitel"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Change-Programm *</label>
        <p className="mb-1.5 text-[11px] text-zinc-500">
          Draft/planned Initiativen dürfen an Draft-, On-Hold- oder Active-Programmen hängen. Active Initiativen
          benötigen ein freigegebenes (active) Programm.
        </p>
        <select
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">Programm wählen</option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.title}
              {program.status && program.status !== "active" ? ` (${program.status})` : ""}
            </option>
          ))}
        </select>
      </div>

      {selectedProgram ? (
        <div className="rounded-md border border-zinc-200 bg-zinc-50/80 p-3 text-[11px] text-zinc-700">
          <p>
            Programm-Budget:{" "}
            <span className="font-medium tabular-nums">
              {formatChfAmount(selectedProgram.budgetTotal)}
            </span>
          </p>
          {selectedProgram.budgetTotal != null ? (
            <>
              <p className="mt-1">
                Bereits lokalisiert:{" "}
                <span className="tabular-nums">{formatChfAmount(selectedProgram.allocatedBudget)}</span>
              </p>
              <p className="mt-1">
                Verfügbar für diese Initiative:{" "}
                <span className="font-medium tabular-nums">{formatChfAmount(remainingBudget)}</span>
              </p>
            </>
          ) : (
            <p className="mt-1 text-amber-800">
              Kein Programm-Budget hinterlegt — Budget-Lokalisierung erst nach Festlegung am Programm möglich.
            </p>
          )}
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">
          Budget aus Programm lokalisieren (CHF)
        </label>
        <input
          type="number"
          min={0}
          step={1000}
          value={budgetStr}
          onChange={(e) => setBudgetStr(e.target.value)}
          disabled={!selectedProgram?.budgetTotal}
          placeholder={
            selectedProgram?.budgetTotal
              ? `max. ${formatChfAmount(remainingBudget)}`
              : "Zuerst Programm-Budget festlegen"
          }
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          {statusSelectOptions.map((s) => (
            <option key={s} value={s}>
              {labelForStatus(s)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Priorität (1–5)</label>
        <select
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "(höchste)" : n === 5 ? "(niedrigste)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Owner</label>
        <select
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">Kein Owner</option>
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
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700">Enddatum</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Fortschritt (%)</label>
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={progressStr}
          onChange={(e) => setProgressStr(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Beschreibung</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
        Initiative speichern
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
