"use client";

import { useEffect, useMemo, useState } from "react";
import type { InitiativeKrLinkContext, PipKeyResultOption } from "@/lib/strategy-cycle/queries";

const FORM_STATUSES = ["planned", "active", "on_hold", "completed"] as const;

const STATUS_LABELS: Record<(typeof FORM_STATUSES)[number], string> = {
  planned: "Geplant",
  active: "Aktiv",
  on_hold: "On Hold",
  completed: "Abgeschlossen",
};

const EXTRA_STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  at_risk: "Auffaellig",
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
  annualTargetIds: string[];
  keyResultIds: string[];
};

type InitiativeCreateFormProps = {
  canWrite: boolean;
  createAction: (formData: FormData) => void | Promise<void>;
  updateAction: (formData: FormData) => void | Promise<void>;
  programs: Array<{ id: string; title: string }>;
  ownerOptions: Array<{ id: string; label: string }>;
  annualTargets: Array<{ id: string; title: string }>;
  keyResultOptions: PipKeyResultOption[];
  selectedInitiative: InitiativeFormSelection | null;
  targetTitleById: Record<string, string>;
  krContextsByKrId: Record<string, InitiativeKrLinkContext>;
  onClearSelection: () => void;
};

function statusOptionsFor(current: string): string[] {
  const base: string[] = [...FORM_STATUSES];
  if (current && !base.includes(current)) {
    base.push(current);
  }
  return base;
}

function labelForStatus(s: string): string {
  if (s in STATUS_LABELS) return STATUS_LABELS[s as (typeof FORM_STATUSES)[number]];
  return EXTRA_STATUS_LABELS[s] ?? s;
}

export function InitiativeCreateForm({
  canWrite,
  createAction,
  updateAction,
  programs,
  ownerOptions,
  annualTargets,
  keyResultOptions,
  selectedInitiative,
  targetTitleById,
  krContextsByKrId,
  onClearSelection,
}: InitiativeCreateFormProps) {
  const [title, setTitle] = useState("");
  const [programId, setProgramId] = useState("");
  const [status, setStatus] = useState<string>("planned");
  const [priority, setPriority] = useState(3);
  const [ownerId, setOwnerId] = useState("");
  const [progressStr, setProgressStr] = useState("0");
  const [description, setDescription] = useState("");
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [krIds, setKrIds] = useState<string[]>([]);
  const [pickTarget, setPickTarget] = useState("");
  const [pickKr, setPickKr] = useState("");
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
      setTargetIds([]);
      setKrIds([]);
      setPickTarget("");
      setPickKr("");
      return;
    }
    setTitle(selectedInitiative.title);
    setProgramId(selectedInitiative.program_id ?? "");
    setStatus(selectedInitiative.status || "planned");
    setPriority(selectedInitiative.priority ?? 3);
    setOwnerId(selectedInitiative.owner_membership_id ?? "");
    setProgressStr(String(Math.round(selectedInitiative.progress_percent ?? 0)));
    setDescription(selectedInitiative.description ?? "");
    setTargetIds([...selectedInitiative.annualTargetIds]);
    setKrIds([...selectedInitiative.keyResultIds]);
  }, [selectedInitiative]);

  const statusSelectOptions = useMemo(() => {
    if (!selectedInitiative) return [...FORM_STATUSES];
    return statusOptionsFor(selectedInitiative.status);
  }, [selectedInitiative]);

  const canSubmit = useMemo(() => {
    return title.trim().length > 0 && programId.length > 0;
  }, [title, programId]);

  const validate = (): string | null => {
    if (!title.trim()) return "Bitte einen Titel angeben.";
    if (!programId) return "Bitte ein Programm waehlen.";
    const p = Number(progressStr);
    if (!Number.isFinite(p) || p < 0 || p > 100) {
      return "Fortschritt muss eine Zahl zwischen 0 und 100 sein.";
    }
    if (priority < 1 || priority > 5) return "Prioritaet muss zwischen 1 und 5 liegen.";
    return null;
  };

  const handleSave = async (formData: FormData) => {
    const err = validate();
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

  const progressNum = Math.min(100, Math.max(0, Math.round(Number(progressStr) || 0)));

  const addTarget = () => {
    if (!pickTarget || targetIds.includes(pickTarget)) return;
    setTargetIds((s) => [...s, pickTarget]);
    setPickTarget("");
  };

  const removeTarget = (id: string) => setTargetIds((s) => s.filter((x) => x !== id));

  const addKr = () => {
    if (!pickKr || krIds.includes(pickKr)) return;
    setKrIds((s) => [...s, pickKr]);
    setPickKr("");
  };

  const removeKr = (id: string) => setKrIds((s) => s.filter((x) => x !== id));

  return (
    <form action={handleSave} className="mt-4 space-y-3">
      {isEdit ? <input type="hidden" name="initiative_id" value={selectedInitiative!.id} /> : null}

      {clientError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {clientError}
        </p>
      ) : null}

      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="program_id" value={programId} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="priority" value={String(priority)} />
      <input type="hidden" name="owner_membership_id" value={ownerId} />
      <input type="hidden" name="progress_percent" value={String(progressNum)} />
      <input type="hidden" name="description" value={description} />
      {targetIds.map((id) => (
        <input key={id} type="hidden" name="annual_target_id" value={id} />
      ))}
      {krIds.map((id) => (
        <input key={id} type="hidden" name="key_result_id" value={id} />
      ))}

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
        <label className="mb-1 block text-xs font-medium text-zinc-700">Programm</label>
        <select
          value={programId}
          onChange={(e) => setProgramId(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">Programm waehlen</option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.title}
            </option>
          ))}
        </select>
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
        <label className="mb-1 block text-xs font-medium text-zinc-700">Prioritaet (1–5)</label>
        <select
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value))}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "(hoechste)" : n === 5 ? "(niedrigste)" : ""}
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
          rows={3}
          placeholder="Kurzbeschreibung"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-md border border-zinc-200 bg-zinc-50/50 p-3">
        <p className="mb-2 text-xs font-semibold text-zinc-800">Jahresziele verknuepfen</p>
        <div className="flex flex-wrap gap-2">
          <select
            value={pickTarget}
            onChange={(e) => setPickTarget(e.target.value)}
            className="min-w-[200px] flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="">Jahresziel waehlen</option>
            {annualTargets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addTarget}
            disabled={!pickTarget}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs hover:bg-zinc-50 disabled:opacity-50"
          >
            Hinzufuegen
          </button>
        </div>
        {targetIds.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {targetIds.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] text-zinc-700"
              >
                {targetTitleById[id] ?? id}
                <button
                  type="button"
                  className="text-red-600 hover:underline"
                  onClick={() => removeTarget(id)}
                >
                  x
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-zinc-500">Noch keine Jahresziele verknuepft.</p>
        )}
      </div>

      <div className="rounded-md border border-zinc-200 bg-zinc-50/50 p-3">
        <p className="mb-2 text-xs font-semibold text-zinc-800">Key Results verknuepfen</p>
        <div className="flex flex-wrap gap-2">
          <select
            value={pickKr}
            onChange={(e) => setPickKr(e.target.value)}
            className="min-w-[200px] flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="">Key Result waehlen</option>
            {keyResultOptions.map((kr) => (
              <option key={kr.id} value={kr.id}>
                {kr.objective_title}: {kr.title}
                {kr.okr_cycle_label ? ` — ${kr.okr_cycle_label}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addKr}
            disabled={!pickKr}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs hover:bg-zinc-50 disabled:opacity-50"
          >
            Hinzufuegen
          </button>
        </div>
        {krIds.length > 0 ? (
          <div className="mt-2 flex flex-col gap-1.5">
            {krIds.map((id) => {
              const ctx = krContextsByKrId[id];
              const opt = keyResultOptions.find((k) => k.id === id);
              const line = ctx
                ? `${ctx.key_result_title} · ${ctx.objective_title}`
                : opt
                  ? `${opt.title} · ${opt.objective_title}`
                  : id;
              return (
                <div
                  key={id}
                  className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[11px] text-zinc-700"
                >
                  <span>{line}</span>
                  <button type="button" className="shrink-0 text-red-600" onClick={() => removeKr(id)}>
                    x
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-zinc-500">Noch keine Key Results verknuepft.</p>
        )}
      </div>

      <button
        type="submit"
        disabled={!canWrite || !canSubmit}
        className="brand-btn w-full px-4 py-2 text-sm"
      >
        Initiative speichern
      </button>

      {isEdit ? (
        <button
          type="button"
          onClick={() => {
            setClientError(null);
            onClearSelection();
          }}
          className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
        >
          Neu anlegen oder Zuruecksetzen
        </button>
      ) : null}
    </form>
  );
}
