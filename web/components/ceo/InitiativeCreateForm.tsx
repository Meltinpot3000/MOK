"use client";

import { useMemo, useState } from "react";

type InitiativeCreateFormProps = {
  canWrite: boolean;
  action: (formData: FormData) => void | Promise<void>;
  programs: Array<{ id: string; title: string }>;
};

export function InitiativeCreateForm({
  canWrite,
  action,
  programs,
}: InitiativeCreateFormProps) {
  const [title, setTitle] = useState("");
  const [programId, setProgramId] = useState("");

  const canSubmit = useMemo(() => {
    return title.trim().length > 0 && programId.length > 0;
  }, [title, programId]);

  return (
    <form action={action} className="mt-4 space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Titel</label>
        <input
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Neue Initiative"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Programm</label>
        <select
          name="program_id"
          required
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
        <label className="mb-1 block text-xs font-medium text-zinc-700">Prioritaet</label>
        <input
          type="number"
          name="priority"
          defaultValue={3}
          min={1}
          max={5}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Linked OKRs (CSV)</label>
        <input
          name="linked_okrs"
          placeholder="optional"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-700">Deliverables (CSV)</label>
        <input
          name="deliverables"
          placeholder="optional"
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
    </form>
  );
}
