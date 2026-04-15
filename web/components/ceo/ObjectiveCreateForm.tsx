"use client";

import { useMemo, useState } from "react";

type ObjectiveCreateFormProps = {
  canWrite: boolean;
  action: (formData: FormData) => void | Promise<void>;
};

function clampImportance(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.max(1, Math.min(5, Math.round(value)));
}

export function ObjectiveCreateForm({ canWrite, action }: ObjectiveCreateFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeHorizon, setTimeHorizon] = useState("");
  const [importance, setImportance] = useState(3);

  const canSubmit = useMemo(() => {
    const hasRequiredText =
      title.trim().length > 0 && description.trim().length > 0 && timeHorizon.trim().length > 0;
    const validImportance = importance >= 1 && importance <= 5;
    return hasRequiredText && validImportance;
  }, [title, description, timeHorizon, importance]);

  return (
    <form action={action} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
      <label className="text-xs text-zinc-600 md:col-span-2">
        Titel
        <input
          name="title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Neues Ziel"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="text-xs text-zinc-600 md:col-span-2">
        Beschreibung
        <textarea
          name="description"
          required
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Zielzustand (kein Aktionsplan)"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="text-xs text-zinc-600">
        Zeithorizont
        <input
          name="time_horizon"
          required
          value={timeHorizon}
          onChange={(event) => setTimeHorizon(event.target.value)}
          placeholder="Zeithorizont (z.B. 2027-2030)"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="text-xs text-zinc-600">
        Gewicht (1–5)
        <input
          type="number"
          name="importance_score"
          required
          value={importance}
          min={1}
          max={5}
          onChange={(event) => setImportance(clampImportance(Number(event.target.value)))}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="text-xs text-zinc-600">
        Status
        <select
          name="status"
          defaultValue="draft"
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        >
          <option value="draft">draft</option>
          <option value="active">active</option>
          <option value="at_risk">at_risk</option>
          <option value="completed">completed</option>
          <option value="archived">archived</option>
        </select>
      </label>
      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={!canWrite || !canSubmit}
          className="brand-btn px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          Ziel speichern
        </button>
      </div>
    </form>
  );
}
