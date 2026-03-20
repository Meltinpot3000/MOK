"use client";

import { useMemo, useState, useTransition } from "react";
import type {
  ProgramMatrixCell,
  ProgramMatrixModel,
  ProgramMatrixRedundancyBand,
} from "@/lib/strategy-cycle/program-matrix";
import {
  createStrategyProgramInCycle,
  generateMatrixProgramProposalAction,
} from "@/app/(ceo)/strategy-cycle/actions";

function cellSurfaceClasses(cell: ProgramMatrixCell): string {
  if (cell.isGap) {
    let s = "border-2 border-red-500 bg-red-50/60 text-red-950 shadow-sm";
    if (cell.isLinked) s += " ring-2 ring-green-600 ring-offset-1";
    return s;
  }
  let base: string;
  if (cell.score >= 66) base = "border border-emerald-300 bg-emerald-50 text-emerald-900";
  else if (cell.score >= 40) base = "border border-amber-300 bg-amber-50 text-amber-900";
  else base = "border border-zinc-300 bg-zinc-100 text-zinc-800";
  /** Formal Challenge–Stossrichtung verknuepft (Gruen — zaehlt in Spalten-„Ueberlappung“). */
  if (cell.isLinked) base += " ring-2 ring-green-600 ring-offset-1";
  /** Hoechster Matrix-Score in dieser Zeile (Nur-Anzeige; kein formaler Link) — Blau, damit nicht mit Link-Gruen verwechselt wird */
  else if (cell.isTopInRow) base += " ring-2 ring-sky-600 ring-offset-1";
  return base;
}

function statusLabel(cell: ProgramMatrixCell): string {
  if (cell.statusTier === "gap") return "Gap";
  if (cell.statusTier === "strong") return "Stark";
  if (cell.statusTier === "medium") return "Mittel";
  return "Schwach";
}

function challengeColumnHeaderClasses(band: ProgramMatrixRedundancyBand): string {
  switch (band) {
    case "focus":
      return "border-emerald-300 bg-emerald-50 text-emerald-900";
    case "ok":
      return "border-amber-300 bg-amber-50 text-amber-900";
    case "alert":
      return "border-red-400 bg-red-50 text-red-950";
    default:
      return "border-zinc-200 bg-zinc-100 text-zinc-600";
  }
}

function redundancyBandCaption(band: ProgramMatrixRedundancyBand, n: number): string {
  if (band === "none") return "0 formale Link-Zuordnung(en)";
  if (band === "focus") return `${n} formal verknuepfte Richtung(en) — klarer Fokus`;
  if (band === "ok") return `${n} formal verknuepfte Richtung(en) — ok`;
  return `${n} formal verknuepfte Richtung(en) — starke Ueberlappung`;
}

type ProgramMappingMatrixProps = {
  model: ProgramMatrixModel;
  canWrite: boolean;
};

export function ProgramMappingMatrix({ model, canWrite }: ProgramMappingMatrixProps) {
  const [selected, setSelected] = useState<ProgramMatrixCell | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [chosenObjectiveIds, setChosenObjectiveIds] = useState<string[]>([]);
  const [aiNotes, setAiNotes] = useState<{ themes: string[]; impact: string; risks: string } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAiPending, startAiTransition] = useTransition();

  const openCell = (cell: ProgramMatrixCell) => {
    setSelected(cell);
    setTitle("");
    setDescription("");
    setChosenObjectiveIds(cell.linkedObjectives.map((o) => o.id));
    setAiNotes(null);
    setAiError(null);
  };

  const closePanel = () => {
    setSelected(null);
    setAiError(null);
  };

  const toggleObjective = (id: string) => {
    setChosenObjectiveIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const runAi = () => {
    if (!selected || !canWrite) return;
    setAiError(null);
    startAiTransition(async () => {
      const res = await generateMatrixProgramProposalAction({
        challengeId: selected.challengeId,
        directionId: selected.directionId,
        objectives: selected.linkedObjectives,
        cellScore: selected.score,
        scoreExplanation: selected.scoreExplanation,
      });
      if (!res.ok) {
        setAiError(res.error);
        return;
      }
      const p = res.proposal;
      setTitle(p.program_name);
      setDescription(p.program_description);
      const allowed = new Set(selected.linkedObjectives.map((o) => o.id));
      const fromAi = p.supported_objectives.filter((id) => allowed.has(id));
      setChosenObjectiveIds(fromAi.length > 0 ? fromAi : selected.linkedObjectives.map((o) => o.id));
      setAiNotes({
        themes: p.initiative_themes,
        impact: p.expected_impact,
        risks: p.risks,
      });
    });
  };

  const insights = model.insights;

  const isEmpty =
    model.challengeColumns.length === 0 || model.directionRows.length === 0;

  const headerHint = useMemo(
    () =>
      "Zeilen: Stossrichtungen (nach Σ Zell-Scores sortiert). Spaltenkopf: Anzahl formaler Links; Σ-Zeile = Summe der Zell-Scores (nicht Link-Anzahl). Gruener Ring = formal, blauer Ring = Top in Zeile.",
    []
  );

  return (
    <article className="brand-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-zinc-900">Programm-Matrix (Generator)</h3>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-900">
            Heat hoch
          </span>
          <span className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-amber-900">
            mittel
          </span>
          <span className="rounded border border-zinc-300 bg-zinc-100 px-2 py-1 text-zinc-800">niedrig</span>
          <span className="rounded border-2 border-red-500 bg-red-50/50 px-2 py-1 text-red-900">Gap</span>
          <span className="whitespace-nowrap rounded ring-2 ring-green-600 ring-offset-1 px-2 py-1 text-green-900">
            gruener Ring = formale Challenge–Stossrichtung-Verknuepfung
          </span>
          <span className="whitespace-nowrap rounded ring-2 ring-sky-600 ring-offset-1 px-2 py-1 text-sky-950">
            blauer Ring = Top-Score in der Zeile (kein formaler Link)
          </span>
          <span className="rounded border border-zinc-200 bg-zinc-100 px-2 py-1 text-zinc-600">
            Spalte grau = Challenge nicht adressiert
          </span>
          <span className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-900">
            Spalte hellgruen = 1–2 Richtungen
          </span>
          <span className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-amber-900">
            Spalte gelb = 3–4 Richtungen
          </span>
          <span className="rounded border border-red-400 bg-red-50 px-2 py-1 text-red-950">
            Spalte rot = 5+ Richtungen
          </span>
        </div>
      </div>
      <p className="mt-1 text-xs text-zinc-600">{headerHint}</p>

      {!isEmpty ? (
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-600">
          <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1">
            Abdeckung Herausforderungen: {insights.coveragePercent}% ({insights.addressedChallenges}/
            {insights.totalChallenges})
          </span>
          <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1">
            Matrix-Ueberlappung (5+ Stossrichtungen): {insights.matrixCriticalOverlapChallengeCount}/
            {insights.totalChallenges} Herausforderung(en)
          </span>
          <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1">
            Formale Mehrfach-Verknuepfung (Links): {insights.redundancyHighChallengeCount}
          </span>
          <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1">
            Objectives im Zyklus: {model.totalObjectives}
          </span>
        </div>
      ) : null}

      {isEmpty ? (
        <p className="mt-4 brand-surface p-3 text-sm text-zinc-600">
          Fuer die Matrix werden mindestens eine Herausforderung und eine strategische Stossrichtung benoetigt.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[920px] border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-semibold text-zinc-700">
                  Stossrichtung
                </th>
                {model.challengeColumns.map((col) => (
                  <th
                    key={col.challengeId}
                    className={`max-w-[140px] border px-2 py-2 text-left text-xs font-semibold ${challengeColumnHeaderClasses(col.redundancyBand)}`}
                  >
                    <div
                      className="line-clamp-3"
                      title={`${col.challengeTitle}\nID: ${col.challengeId}`}
                    >
                      {col.challengeTitle}
                    </div>
                    <div className="mt-0.5 text-[10px] font-normal opacity-90">
                      {redundancyBandCaption(col.redundancyBand, col.addressingDirectionsCount)}
                    </div>
                    <div className="mt-0.5 text-[10px] font-normal opacity-80">
                      Σ Zell-Scores: {col.columnScoreSum}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.directionRows.map((row) => {
                const objN = row.cells[0]?.linkedObjectives.length ?? 0;
                const objTotal = model.totalObjectives;
                return (
                <tr key={row.directionId}>
                  <td className="sticky left-0 z-10 border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800">
                    <div className="line-clamp-3 max-w-[200px]" title={row.directionTitle}>
                      {row.directionTitle}
                    </div>
                    <div className="text-[10px] font-normal text-zinc-500">Σ {row.rowScoreSum}</div>
                    <div className="mt-1 text-[10px] font-normal text-zinc-600">
                      Objectives:{" "}
                      <span className="font-medium text-zinc-800">
                        {objTotal > 0 ? `${objN} / ${objTotal}` : `${objN}`}
                      </span>
                      {objTotal > 0 ? ` (${Math.round((objN / objTotal) * 100)}% des Zyklus)` : null}
                    </div>
                  </td>
                  {row.cells.map((cell) => (
                    <td key={cell.challengeId} className="border border-zinc-200 p-1 align-top">
                      <button
                        type="button"
                        onClick={() => openCell(cell)}
                        className={`w-full rounded px-2 py-1.5 text-left text-xs transition hover:opacity-95 ${cellSurfaceClasses(cell)}`}
                      >
                        <div className="text-right">
                          <span className="text-base font-bold tabular-nums">{cell.score}</span>
                        </div>
                        <div className="mt-0.5 text-[10px] font-medium">{statusLabel(cell)}</div>
                      </button>
                    </td>
                  ))}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="matrix-panel-title"
          onClick={closePanel}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-zinc-100 px-4 py-3">
              <h4 id="matrix-panel-title" className="text-sm font-semibold text-zinc-900">
                Programm-Chance
              </h4>
              <p className="mt-1 text-xs text-zinc-600">
                Score <strong>{selected.score}</strong> · {statusLabel(selected)}
                {selected.isGap ? " · Keine verknuepften Objectives fuer diese Stossrichtung" : ""}
              </p>
            </div>
            <div className="space-y-3 px-4 py-3 text-xs">
              <div>
                <p className="font-medium text-zinc-800">Herausforderung</p>
                <p className="text-zinc-600">{selected.challengeTitle}</p>
              </div>
              <div>
                <p className="font-medium text-zinc-800">Stossrichtung</p>
                <p className="text-zinc-600">{selected.directionTitle}</p>
              </div>
              <div>
                <p className="font-medium text-zinc-800">Score-Erklaerung</p>
                <p className="text-zinc-600">{selected.scoreExplanation}</p>
              </div>
              <div>
                <p className="mb-1 font-medium text-zinc-800">Unterstuetzte Objectives (fuer Programm)</p>
                {selected.linkedObjectives.length === 0 ? (
                  <p className="text-zinc-500">Keine Objectives verknuepft — Programm kann trotzdem angelegt werden.</p>
                ) : (
                  <ul className="max-h-36 space-y-1 overflow-y-auto border border-zinc-100 rounded-md p-2">
                    {selected.linkedObjectives.map((o) => (
                      <li key={o.id}>
                        <label className="flex cursor-pointer items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={chosenObjectiveIds.includes(o.id)}
                            onChange={() => toggleObjective(o.id)}
                            disabled={!canWrite}
                          />
                          <span>{o.title}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {aiNotes ? (
                <div className="rounded-md border border-violet-200 bg-violet-50/50 p-2 text-[11px] text-zinc-700">
                  {aiNotes.impact ? (
                    <p>
                      <span className="font-semibold">Erwartete Wirkung: </span>
                      {aiNotes.impact}
                    </p>
                  ) : null}
                  {aiNotes.risks ? (
                    <p className="mt-1">
                      <span className="font-semibold">Risiken: </span>
                      {aiNotes.risks}
                    </p>
                  ) : null}
                  {aiNotes.themes.length > 0 ? (
                    <div className="mt-1">
                      <span className="font-semibold">Initiativ-Themen: </span>
                      <ul className="list-inside list-disc">
                        {aiNotes.themes.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {aiError ? <p className="text-xs text-red-700">{aiError}</p> : null}

              {canWrite ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={runAi}
                    disabled={isAiPending}
                    className="brand-btn px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    {isAiPending ? "KI arbeitet…" : "Programm-Vorschlag (KI)"}
                  </button>
                </div>
              ) : null}

              <form action={createStrategyProgramInCycle} className="space-y-2 border-t border-zinc-100 pt-3">
                <input type="hidden" name="strategic_direction_id" value={selected.directionId} />
                <input type="hidden" name="strategic_challenge_id" value={selected.challengeId} />
                <input type="hidden" name="program_origin" value="matrix" />
                <input type="hidden" name="matrix_cell_score" value={String(selected.score)} />
                <input type="hidden" name="supported_objective_ids" value={chosenObjectiveIds.join(",")} />
                <label className="block">
                  <span className="text-zinc-700">Programm-Titel</span>
                  <input
                    name="title"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                    disabled={!canWrite}
                  />
                </label>
                <label className="block">
                  <span className="text-zinc-700">Beschreibung</span>
                  <textarea
                    name="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="mt-0.5 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
                    disabled={!canWrite}
                  />
                </label>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="button" className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs" onClick={closePanel}>
                    Abbrechen
                  </button>
                  {canWrite ? (
                    <button type="submit" className="brand-btn px-3 py-1.5 text-xs">
                      Programm anlegen
                    </button>
                  ) : null}
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
