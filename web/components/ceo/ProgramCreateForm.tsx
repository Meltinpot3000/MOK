"use client";

import { useMemo, useState } from "react";

type ProgramCreateFormProps = {
  canWrite: boolean;
  action: (formData: FormData) => void | Promise<void>;
  strategicDirections: Array<{ id: string; title: string }>;
};

export function ProgramCreateForm({
  canWrite,
  action,
  strategicDirections,
}: ProgramCreateFormProps) {
  const [title, setTitle] = useState("");
  const [strategicDirectionId, setStrategicDirectionId] = useState("");

  const canSubmit = useMemo(() => {
    return title.trim().length > 0 && strategicDirectionId.length > 0;
  }, [title, strategicDirectionId]);

  return (
    <form action={action} className="mt-4 space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Titel</label>
        <input
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Neues Programm"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">
          Strategische Stossrichtung
        </label>
        <select
          name="strategic_direction_id"
          required
          value={strategicDirectionId}
          onChange={(e) => setStrategicDirectionId(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">Stossrichtung waehlen</option>
          {strategicDirections.map((direction) => (
            <option key={direction.id} value={direction.id}>
              {direction.title}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Timeline</label>
        <input
          name="timeline"
          placeholder="z.B. 2026-2028"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Budget</label>
        <input
          type="number"
          name="budget"
          defaultValue={0}
          min={0}
          step={1000}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Beschreibung</label>
        <textarea
          name="description"
          rows={3}
          placeholder="Programm-Beschreibung"
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
    </form>
  );
}
