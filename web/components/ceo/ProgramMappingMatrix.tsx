"use client";

import { useMemo, useState } from "react";
import type {
  ProgramMatrixCell,
  ProgramMatrixModel,
  ProgramMatrixObjectiveCell,
  ProgramMatrixRedundancyBand,
} from "@/lib/strategy-cycle/program-matrix";
import {
  linkDirectionToChallengePredecessor,
  unlinkDirectionChallengePredecessor,
  linkDirectionToObjectiveInCycle,
  unlinkDirectionFromObjectiveInCycle,
} from "@/app/(ceo)/strategy-cycle/actions";
import { CoverageStrengthPillButton } from "@/components/ceo/CoverageStrengthPillButton";

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

/** Anzeige: Abdeckung Herausforderung–Stossrichtung (0,5 / 1 / 2). Ohne formalen Link leer. */
function challengeSupportDisplayLabel(cell: ProgramMatrixCell): string {
  if (!cell.isLinked) return "";
  const w = cell.contributionWeight;
  if (Math.abs(w - 2) < 0.001) return "Stark";
  if (Math.abs(w - 0.5) < 0.001) return "Schwach";
  return "Mittel";
}

function objectiveSupportDisplayLabel(cell: ProgramMatrixObjectiveCell): string {
  if (!cell.isLinked) return "";
  const w = cell.contributionWeight;
  if (Math.abs(w - 2) < 0.001) return "Stark";
  if (Math.abs(w - 0.5) < 0.001) return "Schwach";
  return "Mittel";
}

function objectiveCellSurfaceClasses(cell: ProgramMatrixObjectiveCell): string {
  let base: string;
  if (cell.score >= 66) base = "border border-violet-300 bg-violet-50 text-violet-950";
  else if (cell.score >= 40) base = "border border-indigo-200 bg-indigo-50/80 text-indigo-950";
  else base = "border border-zinc-300 bg-zinc-50 text-zinc-800";
  if (cell.isLinked) base += " ring-2 ring-green-600 ring-offset-1";
  else if (cell.isTopInRow) base += " ring-2 ring-sky-600 ring-offset-1";
  return base;
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

/** Kurztext nur fuer Herausforderungs-Spaltenkoepfe. */
function challengeColumnOverlapShortLabel(band: ProgramMatrixRedundancyBand): string {
  if (band === "none") return "";
  if (band === "focus") return "klarer Fokus";
  if (band === "ok") return "ok";
  return "starke Überlappung";
}

const hfObjGapCellClass =
  "w-3 min-w-[12px] border-0 border-b-0 border-t border-zinc-200 bg-white p-0";

type MatrixColHeaderProps = {
  title: string;
  id: string;
  columnScoreSum: number;
  redundancyBand: ProgramMatrixRedundancyBand;
  addressingDirectionsCount: number;
};

function MatrixColumnGroupHeaderTh(p: MatrixColHeaderProps) {
  const overlapShort = challengeColumnOverlapShortLabel(p.redundancyBand);
  const nDir = p.addressingDirectionsCount;
  const dirWord = nDir === 1 ? "Stossrichtung" : "Stossrichtungen";
  const shell = `min-h-[8.5rem] min-w-[120px] max-w-[min(22rem,32vw)] border p-0 align-top text-left text-xs font-semibold ${challengeColumnHeaderClasses(p.redundancyBand)}`;
  return (
    <th className={shell}>
      <div className="flex min-h-[8.5rem] flex-col justify-between gap-2 px-2 py-2">
        <div className="min-w-0">
          <div
            className="line-clamp-4 break-words leading-snug"
            title={`${p.title}\n(ID: ${p.id})`}
          >
            {p.title}
          </div>
          <p className="mt-1.5 text-[10px] font-medium leading-snug opacity-95">
            {overlapShort ? <span className="break-words">{overlapShort} </span> : null}
            <span className="whitespace-nowrap">
              ({nDir} {dirWord})
            </span>
          </p>
        </div>
        <div className="shrink-0 text-right text-base font-bold tabular-nums leading-none text-zinc-900">
          Σ&nbsp;{p.columnScoreSum}
        </div>
      </div>
    </th>
  );
}

function challengeGroupRowStats(row: { cells: ProgramMatrixCell[] }) {
  const scoreSum = row.cells.reduce((s, c) => s + c.score, 0);
  const linkedCount = row.cells.filter((c) => c.isLinked).length;
  const total = row.cells.length;
  return { scoreSum, linkedCount, total };
}

function objectiveGroupRowStats(row: { objectiveCells: ProgramMatrixObjectiveCell[] }) {
  const scoreSum = row.objectiveCells.reduce((s, c) => s + c.score, 0);
  const linkedCount = row.objectiveCells.filter((c) => c.isLinked).length;
  const total = row.objectiveCells.length;
  return { scoreSum, linkedCount, total };
}

/** Anzahl adressierter Spalten: unter 3 gruen, unter 5 gelb, sonst rot (Fokus vs. Ueberlappung). */
function addressedCountToneClass(addressedCount: number): string {
  if (addressedCount < 3) return "text-emerald-700";
  if (addressedCount < 5) return "text-amber-700";
  return "text-red-700";
}

type ProgramMappingMatrixProps = {
  model: ProgramMatrixModel;
  canWrite: boolean;
};

export function ProgramMappingMatrix({ model, canWrite }: ProgramMappingMatrixProps) {
  const [challengesExpanded, setChallengesExpanded] = useState(true);
  const [objectivesExpanded, setObjectivesExpanded] = useState(true);

  const challengeGroupMatrixTotals = useMemo(() => {
    let scoreSum = 0;
    let linkedCount = 0;
    for (const row of model.directionRows) {
      for (const c of row.cells) {
        scoreSum += c.score;
        if (c.isLinked) linkedCount += 1;
      }
    }
    return { scoreSum, linkedCount };
  }, [model.directionRows]);

  const objectiveGroupMatrixTotals = useMemo(() => {
    let scoreSum = 0;
    let linkedCount = 0;
    for (const row of model.directionRows) {
      for (const c of row.objectiveCells) {
        scoreSum += c.score;
        if (c.isLinked) linkedCount += 1;
      }
    }
    return { scoreSum, linkedCount };
  }, [model.directionRows]);

  const nChallengeCols = model.challengeColumns.length;
  const nObjectiveCols = model.objectiveColumns.length;
  const showHfObjGap = nChallengeCols > 0 && nObjectiveCols > 0;

  const insights = model.insights;

  const isEmpty =
    model.directionRows.length === 0 ||
    (model.challengeColumns.length === 0 && model.objectiveColumns.length === 0);

  const headerHint = useMemo(
    () =>
      "Zeilen: Stossrichtungen (nach Σ aller Zell-Scores). Zelle anklicken: Abdeckung 🌱/⚡/🔥 setzen oder Abwaehlen. Score passt sich nach Speichern an. Gruppenzeile oben: ± mit Strich ueber alle Spalten der Gruppe. Gruener Ring = formale Verknuepfung.",
    []
  );

  return (
    <article className="brand-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-zinc-900">Programm-Matrix</h3>
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
            gruener Ring = formale Verknuepfung (Challenge oder Objective)
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
          <span className="rounded border border-violet-200 bg-violet-50 px-2 py-1 text-violet-950">
            violett = Objective-Spalten (rechts, ÷3-Gewichtung)
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
          Fuer die Matrix werden mindestens eine strategische Stossrichtung sowie mindestens eine Herausforderung oder ein Objective im Zyklus benoetigt.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[1100px] border-collapse">
            <thead>
              <tr className="h-9">
                <th className="sticky left-0 z-30 border border-b-0 border-zinc-200 bg-zinc-50 p-0" />
                {nChallengeCols > 0 ? (
                  <th
                    colSpan={challengesExpanded ? nChallengeCols : 1}
                    className="border-x border-t border-zinc-200 border-b-0 bg-zinc-50 p-0 align-bottom"
                  >
                    <div className="flex min-h-[28px] items-center gap-1.5 px-2 pb-1 pt-1">
                      <button
                        type="button"
                        onClick={() => setChallengesExpanded((v) => !v)}
                        className="shrink-0 rounded border border-slate-400 bg-white px-2 py-0.5 text-xs font-semibold leading-none text-slate-800 tabular-nums hover:bg-slate-50"
                        title={
                          challengesExpanded
                            ? "Herausforderungen in Sammelspalte zusammenfassen"
                            : `${nChallengeCols} Einzelspalten anzeigen`
                        }
                        aria-expanded={challengesExpanded}
                      >
                        {challengesExpanded ? "−" : "+"}
                      </button>
                      <div className="h-0.5 min-w-[6px] flex-1 rounded-full bg-slate-400" aria-hidden />
                      <span className="shrink-0 whitespace-nowrap rounded bg-zinc-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-700">
                        Herausforderungen
                      </span>
                      <div className="h-0.5 min-w-[6px] flex-1 rounded-full bg-slate-400" aria-hidden />
                    </div>
                  </th>
                ) : null}
                {showHfObjGap ? <th className={hfObjGapCellClass} aria-hidden /> : null}
                {nObjectiveCols > 0 ? (
                  <th
                    colSpan={objectivesExpanded ? nObjectiveCols : 1}
                    className="border-x border-t border-violet-200 border-b-0 bg-violet-50/80 p-0 align-bottom"
                  >
                    <div className="flex min-h-[28px] items-center gap-1.5 px-2 pb-1 pt-1">
                      <button
                        type="button"
                        onClick={() => setObjectivesExpanded((v) => !v)}
                        className="shrink-0 rounded border border-violet-400 bg-white px-2 py-0.5 text-xs font-semibold leading-none text-violet-900 tabular-nums hover:bg-violet-100/80"
                        title={
                          objectivesExpanded
                            ? "Objectives in Sammelspalte zusammenfassen"
                            : `${nObjectiveCols} Einzelspalten anzeigen`
                        }
                        aria-expanded={objectivesExpanded}
                      >
                        {objectivesExpanded ? "−" : "+"}
                      </button>
                      <div className="h-0.5 min-w-[6px] flex-1 rounded-full bg-violet-400" aria-hidden />
                      <span className="shrink-0 whitespace-nowrap rounded bg-violet-50/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-900">
                        Objectives
                      </span>
                      <div className="h-0.5 min-w-[6px] flex-1 rounded-full bg-violet-400" aria-hidden />
                    </div>
                  </th>
                ) : null}
              </tr>
              <tr>
                <th className="sticky left-0 z-20 border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-semibold text-zinc-700">
                  Stossrichtung
                </th>
                {nChallengeCols > 0 ? (
                  challengesExpanded ? (
                    model.challengeColumns.map((col) => (
                      <MatrixColumnGroupHeaderTh
                        key={col.challengeId}
                        id={col.challengeId}
                        title={col.challengeTitle}
                        columnScoreSum={col.columnScoreSum}
                        redundancyBand={col.redundancyBand}
                        addressingDirectionsCount={col.addressingDirectionsCount}
                      />
                    ))
                  ) : (
                    <th className="max-w-[120px] border border-slate-300 bg-slate-100 px-2 py-2 text-left text-xs font-semibold text-slate-900">
                      <span className="leading-tight">Herausforderungen (Sammel)</span>
                      <div className="mt-1 text-[10px] font-normal text-slate-700">
                        Σ Punkte (Matrix): {challengeGroupMatrixTotals.scoreSum}
                      </div>
                      <div className="mt-0.5 text-[10px] font-normal text-slate-600">
                        Verknuepfungen: {challengeGroupMatrixTotals.linkedCount}
                      </div>
                      <div className="mt-0.5 text-[9px] font-normal text-slate-500">
                        {nChallengeCols} Elemente gruppiert
                      </div>
                    </th>
                  )
                ) : null}
                {showHfObjGap ? <th className={hfObjGapCellClass} aria-hidden /> : null}
                {nObjectiveCols > 0 ? (
                  objectivesExpanded ? (
                    model.objectiveColumns.map((col) => (
                      <MatrixColumnGroupHeaderTh
                        key={col.objectiveId}
                        id={col.objectiveId}
                        title={col.objectiveTitle}
                        columnScoreSum={col.columnScoreSum}
                        redundancyBand={col.redundancyBand}
                        addressingDirectionsCount={col.addressingDirectionsCount}
                      />
                    ))
                  ) : (
                    <th className="max-w-[120px] border border-violet-300 bg-violet-100/90 px-2 py-2 text-left text-xs font-semibold text-violet-950">
                      <span className="leading-tight">Objectives (Sammel)</span>
                      <div className="mt-1 text-[10px] font-normal text-violet-900">
                        Σ Punkte (Matrix): {objectiveGroupMatrixTotals.scoreSum}
                      </div>
                      <div className="mt-0.5 text-[10px] font-normal text-violet-800">
                        Verknuepfungen: {objectiveGroupMatrixTotals.linkedCount}
                      </div>
                      <div className="mt-0.5 text-[9px] font-normal text-violet-700/90">
                        {nObjectiveCols} Elemente gruppiert
                      </div>
                    </th>
                  )
                ) : null}
              </tr>
            </thead>
            <tbody>
              {model.directionRows.map((row) => {
                const challengeStats = challengeGroupRowStats(row);
                const objectiveStats = objectiveGroupRowStats(row);
                return (
                  <tr key={row.directionId}>
                    <td className="sticky left-0 z-10 border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-800">
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="text-base font-bold tabular-nums text-zinc-900">
                          Σ&nbsp;{row.rowScoreSum}
                        </span>
                        <div className="line-clamp-3 max-w-[200px]" title={row.directionTitle}>
                          {row.directionTitle}
                        </div>
                        {(nChallengeCols > 0 || nObjectiveCols > 0) ? (
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[10px] font-semibold leading-tight">
                            {nChallengeCols > 0 ? (
                              <span className={addressedCountToneClass(challengeStats.linkedCount)}>
                                HF {challengeStats.linkedCount}/{challengeStats.total}
                              </span>
                            ) : null}
                            {nChallengeCols > 0 && nObjectiveCols > 0 ? (
                              <span className="font-normal text-zinc-400" aria-hidden>
                                ·
                              </span>
                            ) : null}
                            {nObjectiveCols > 0 ? (
                              <span className={addressedCountToneClass(objectiveStats.linkedCount)}>
                                Obj {objectiveStats.linkedCount}/{objectiveStats.total}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    {nChallengeCols > 0 ? (
                      challengesExpanded ? (
                        row.cells.map((cell) => (
                          <td key={cell.challengeId} className="border border-zinc-200 p-1 align-top">
                            <CoverageStrengthPillButton
                              entityKey="strategic_direction_id"
                              entityValue={cell.directionId}
                              extraFields={{ strategic_challenge_id: cell.challengeId }}
                              isLinked={cell.isLinked}
                              contributionLevel={cell.contributionLevel}
                              linkAction={linkDirectionToChallengePredecessor}
                              unlinkAction={unlinkDirectionChallengePredecessor}
                              canWrite={canWrite}
                              title={`${cell.challengeTitle} × ${cell.directionTitle}`}
                              linkedClassName={`rounded px-2 py-1.5 text-left text-xs transition hover:opacity-95 ${cellSurfaceClasses(cell)}`}
                              unlinkedClassName={`rounded px-2 py-1.5 text-left text-xs transition hover:opacity-95 ${cellSurfaceClasses({ ...cell, isLinked: false })}`}
                              unlinkInPickerOnly
                              detachPicker
                              fullWidth
                            >
                              <div className="flex w-full flex-col items-end gap-0.5">
                                <span className="text-base font-bold tabular-nums">{cell.score}</span>
                                <span className="min-h-[14px] text-[10px] font-medium text-zinc-600">
                                  {challengeSupportDisplayLabel(cell) || "—"}
                                </span>
                              </div>
                            </CoverageStrengthPillButton>
                          </td>
                        ))
                      ) : (
                        <td className="border border-slate-300 bg-slate-50 p-2 align-top">
                          <div className="text-right">
                            <span className="text-base font-bold tabular-nums text-slate-900">
                              {challengeStats.scoreSum}
                            </span>
                          </div>
                          <div className="mt-1 text-[10px] font-medium text-slate-700">
                            Unterstuetzer: {challengeStats.linkedCount} / {challengeStats.total}
                          </div>
                          <div className="mt-0.5 text-[9px] text-slate-500">formal verknuepft / Spalten</div>
                        </td>
                      )
                    ) : null}
                    {showHfObjGap ? <td className={hfObjGapCellClass} aria-hidden /> : null}
                    {nObjectiveCols > 0 ? (
                      objectivesExpanded ? (
                        row.objectiveCells.map((cell) => (
                          <td key={cell.objectiveId} className="border border-violet-100 bg-violet-50/20 p-1 align-top">
                            <CoverageStrengthPillButton
                              entityKey="strategic_direction_id"
                              entityValue={cell.directionId}
                              extraFields={{ objective_id: cell.objectiveId }}
                              isLinked={cell.isLinked}
                              contributionLevel={cell.contributionLevel}
                              linkAction={linkDirectionToObjectiveInCycle}
                              unlinkAction={unlinkDirectionFromObjectiveInCycle}
                              canWrite={canWrite}
                              title={`${cell.objectiveTitle} × ${cell.directionTitle}`}
                              linkedClassName={`rounded px-2 py-1.5 text-left text-xs transition hover:opacity-95 ${objectiveCellSurfaceClasses(cell)}`}
                              unlinkedClassName={`rounded px-2 py-1.5 text-left text-xs transition hover:opacity-95 ${objectiveCellSurfaceClasses({ ...cell, isLinked: false })}`}
                              unlinkInPickerOnly
                              detachPicker
                              fullWidth
                            >
                              <div className="flex w-full flex-col items-end gap-0.5">
                                <span className="text-base font-bold tabular-nums">{cell.score}</span>
                                <span className="min-h-[14px] text-[10px] font-medium text-violet-900/90">
                                  {objectiveSupportDisplayLabel(cell) || "—"}
                                </span>
                              </div>
                            </CoverageStrengthPillButton>
                          </td>
                        ))
                      ) : (
                        <td className="border border-violet-200 bg-violet-50/60 p-2 align-top">
                          <div className="text-right">
                            <span className="text-base font-bold tabular-nums text-violet-950">
                              {objectiveStats.scoreSum}
                            </span>
                          </div>
                          <div className="mt-1 text-[10px] font-medium text-violet-900">
                            Unterstuetzer: {objectiveStats.linkedCount} / {objectiveStats.total}
                          </div>
                          <div className="mt-0.5 text-[9px] text-violet-700/90">formal verknuepft / Spalten</div>
                        </td>
                      )
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
