"use client";

import { useMemo, useState } from "react";

type ChallengeCreateFormProps = {
  canWrite: boolean;
  action: (formData: FormData) => void | Promise<void>;
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.max(1, Math.min(5, Math.round(value)));
}

export function ChallengeCreateForm({ canWrite, action }: ChallengeCreateFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [impactScore, setImpactScore] = useState(3);
  const [urgencyScore, setUrgencyScore] = useState(3);
  const [scopeScore, setScopeScore] = useState(3);
  const [steuerbarkeitScore, setSteuerbarkeitScore] = useState(3);

  const canSubmit = useMemo(() => {
    return title.trim().length > 0 && description.trim().length > 0;
  }, [title, description]);

  return (
    <form action={action} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
      <label className="text-xs text-zinc-600 md:col-span-2">
        Titel
        <input
          name="title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Neue strategische Herausforderung"
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
          placeholder="Problemstatement und Kontext"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="text-xs text-zinc-600">
        Auswirkung (1–5)
        <input
          type="number"
          name="impact_score"
          required
          value={impactScore}
          min={1}
          max={5}
          onChange={(event) => setImpactScore(clampScore(Number(event.target.value)))}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="text-xs text-zinc-600">
        Dringlichkeit (1–5)
        <input
          type="number"
          name="urgency_score"
          required
          value={urgencyScore}
          min={1}
          max={5}
          onChange={(event) => setUrgencyScore(clampScore(Number(event.target.value)))}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="text-xs text-zinc-600">
        Umfang (1–5)
        <input
          type="number"
          name="scope_score"
          required
          value={scopeScore}
          min={1}
          max={5}
          onChange={(event) => setScopeScore(clampScore(Number(event.target.value)))}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="text-xs text-zinc-600">
        Steuerbarkeit (1–5)
        <input
          type="number"
          name="root_cause_score"
          required
          value={steuerbarkeitScore}
          min={1}
          max={5}
          onChange={(event) => setSteuerbarkeitScore(clampScore(Number(event.target.value)))}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </label>
      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={!canWrite || !canSubmit}
          className="brand-btn px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          Herausforderung speichern
        </button>
      </div>
    </form>
  );
}
