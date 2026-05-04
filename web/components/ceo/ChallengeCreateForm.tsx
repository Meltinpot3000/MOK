"use client";

import { useMemo, useState } from "react";
import { pillLinked, pillNeutral } from "./ExpandableTable";

type AnalysisEntryOption = {
  id: string;
  title: string;
  analysis_type: string;
};

type ChallengeCreateFormProps = {
  canWrite: boolean;
  action: (formData: FormData) => void | Promise<void>;
  /** Analyse-Einträge des Zyklus für optionale Verknüpfung bei Neuanlage */
  analysisEntries?: AnalysisEntryOption[];
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.max(1, Math.min(5, Math.round(value)));
}

function shortLabel(title: string, max = 42) {
  const t = title.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function ChallengeCreateForm({ canWrite, action, analysisEntries = [] }: ChallengeCreateFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [impactScore, setImpactScore] = useState(3);
  const [urgencyScore, setUrgencyScore] = useState(3);
  const [scopeScore, setScopeScore] = useState(3);
  const [steuerbarkeitScore, setSteuerbarkeitScore] = useState(3);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(() => new Set());

  const canSubmit = useMemo(() => {
    return title.trim().length > 0 && description.trim().length > 0;
  }, [title, description]);

  const toggleEntry = (id: string) => {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <form
      action={(fd) => {
        for (const id of selectedEntryIds) {
          fd.append("analysis_entry_id", id);
        }
        return action(fd);
      }}
      className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"
    >
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
      {analysisEntries.length > 0 ? (
        <div className="md:col-span-2 space-y-1.5">
          <p className="text-xs font-medium text-zinc-600">Analyse-Einträge verknüpfen (optional)</p>
          <p className="text-[11px] text-zinc-500">
            Pro Analyse-Eintrag nur eine Herausforderung pro Zyklus. Bereits vergebene Einträge sind ausgegraut.
          </p>
          <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50/50 p-2">
            {analysisEntries.map((entry) => {
              const selected = selectedEntryIds.has(entry.id);
              return (
                <button
                  key={entry.id}
                  type="button"
                  disabled={!canWrite}
                  onClick={() => toggleEntry(entry.id)}
                  className={`max-w-full rounded-full border px-2.5 py-1 text-left text-[11px] leading-snug ${
                    selected ? pillLinked("max-w-full") : pillNeutral("max-w-full")
                  }`}
                  title={`${entry.title} (${entry.analysis_type})`}
                >
                  <span className="font-medium text-zinc-900">{shortLabel(entry.title, 48)}</span>
                  <span className="ml-1 text-zinc-500">({entry.analysis_type})</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
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
