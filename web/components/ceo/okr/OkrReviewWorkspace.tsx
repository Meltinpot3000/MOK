"use client";

import { useMemo, useState, useTransition } from "react";
import type { OkrPlanningObjectiveRow } from "@/lib/okr/planning-data";
import {
  buildOkrReviewSummary,
  parseOkrReviewObjectiveSections,
  splitOkrReviewSummaryPreamble,
} from "@/lib/okr/okr-review-summary";
import { saveOkrReviewAction } from "@/app/(ceo)/okr-workspace/actions";

type OkrReviewWorkspaceProps = {
  cycleInstanceId: string;
  okrCycleId: string | null;
  okrCycleLabel: string;
  canWrite: boolean;
  objectives: OkrPlanningObjectiveRow[];
  initial: {
    summary: string | null;
    successes: string | null;
    problems: string | null;
    lessons_learned: string | null;
    next_actions: string | null;
  } | null;
};

export function OkrReviewWorkspace({
  cycleInstanceId,
  okrCycleId,
  okrCycleLabel,
  canWrite,
  objectives,
  initial,
}: OkrReviewWorkspaceProps) {
  const [pending, startTransition] = useTransition();
  const sectionMap = useMemo(
    () => parseOkrReviewObjectiveSections(initial?.summary ?? ""),
    [initial?.summary]
  );
  const preambleInit = useMemo(
    () => splitOkrReviewSummaryPreamble(initial?.summary ?? ""),
    [initial?.summary]
  );

  const [preamble, setPreamble] = useState(preambleInit);
  const [successes, setSuccesses] = useState(initial?.successes ?? "");
  const [problems, setProblems] = useState(initial?.problems ?? "");
  const [lessons, setLessons] = useState(initial?.lessons_learned ?? "");
  const [nextActions, setNextActions] = useState(initial?.next_actions ?? "");
  const [perObjective, setPerObjective] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const obj of objectives) {
      o[obj.id] = sectionMap.get(obj.id) ?? "";
    }
    return o;
  });

  if (!okrCycleId) {
    return <p className="brand-card p-6 text-sm text-zinc-600">Kein OKR-Zeitraum gewählt.</p>;
  }

  return (
    <div className="brand-card space-y-4 p-6">
      <header>
        <h2 className="text-lg font-semibold text-zinc-900">OKR Review</h2>
        <p className="text-sm text-zinc-600">Zeitraum: {okrCycleLabel}</p>
        {!initial ? (
          <p className="mt-2 text-sm text-zinc-500">Noch kein gespeicherter Review-Eintrag — Formular ausfüllen und speichern.</p>
        ) : null}
      </header>

      <label className="block text-xs text-zinc-600">
        Teilnehmer / Preamble (wird oben in <code className="text-[11px]">summary</code> gespeichert)
        <textarea
          value={preamble}
          onChange={(e) => setPreamble(e.target.value)}
          rows={2}
          disabled={!canWrite}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </label>

      <label className="block text-xs text-zinc-600">
        Erfolge
        <textarea
          value={successes}
          onChange={(e) => setSuccesses(e.target.value)}
          rows={3}
          disabled={!canWrite}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs text-zinc-600">
        Probleme
        <textarea
          value={problems}
          onChange={(e) => setProblems(e.target.value)}
          rows={3}
          disabled={!canWrite}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs text-zinc-600">
        Learnings
        <textarea
          value={lessons}
          onChange={(e) => setLessons(e.target.value)}
          rows={3}
          disabled={!canWrite}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs text-zinc-600">
        Nächste Schritte / Entscheidungen
        <textarea
          value={nextActions}
          onChange={(e) => setNextActions(e.target.value)}
          rows={3}
          disabled={!canWrite}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </label>

      <div className="space-y-3 border-t border-zinc-200 pt-4">
        <p className="text-sm font-medium text-zinc-800">OKR-Objective-Abschnitte (in summary als Markdown)</p>
        {objectives.length === 0 ? (
          <p className="text-sm text-zinc-600">Keine OKR-Objectives im Zeitraum.</p>
        ) : (
          objectives.map((obj) => (
            <div key={obj.id} className="rounded-lg border border-zinc-200 p-3">
              <p className="text-xs font-semibold text-zinc-800">{obj.title}</p>
              <textarea
                value={perObjective[obj.id] ?? ""}
                onChange={(e) => setPerObjective((prev) => ({ ...prev, [obj.id]: e.target.value }))}
                rows={4}
                disabled={!canWrite}
                placeholder="Notizen zu diesem OKR-Objective…"
                className="mt-2 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </div>
          ))
        )}
      </div>

      {canWrite ? (
        <button
          type="button"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          onClick={() => {
            startTransition(async () => {
              const summary = buildOkrReviewSummary({
                preamble,
                perObjective: objectives.map((o) => ({
                  id: o.id,
                  notes: perObjective[o.id] ?? "",
                })),
              });
              const r = await saveOkrReviewAction({
                cycleInstanceId,
                okrCycleId,
                summary,
                successes,
                problems,
                lessonsLearned: lessons,
                nextActions,
              });
              if ("error" in r && r.error) window.alert(r.error);
              else window.alert("Gespeichert.");
            });
          }}
        >
          Review speichern
        </button>
      ) : (
        <p className="text-sm text-zinc-600">Lesemodus — Speichern deaktiviert.</p>
      )}
    </div>
  );
}
