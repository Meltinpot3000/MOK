"use client";

import { useMemo, useState } from "react";

type ChallengeRow = {
  id: string;
  title: string;
  /** Kurztext aus der Datenbank (strategic_challenges.description). */
  description: string | null;
  score: number;
  raw: Record<string, unknown>;
  linkedDirections: Array<{
    id: string;
    title: string;
    contributionLevel: string | null;
    raw: Record<string, unknown>;
  }>;
  linkedAnalysisEntries: Array<{
    id: string;
    title: string;
    analysisType: string | null;
    raw: Record<string, unknown>;
  }>;
};

type DirectionRow = {
  id: string;
  title: string;
  /** Kurztext aus der Datenbank (strategic_directions.description). */
  description: string | null;
  priority: number;
  raw: Record<string, unknown>;
  linkedChallenges: Array<{
    id: string;
    title: string;
    score: number;
    contributionLevel: string | null;
    raw: Record<string, unknown>;
  }>;
};

type Props = {
  topChallenges: ChallengeRow[];
  topDirections: DirectionRow[];
  uncoveredChallenges: ChallengeRow[];
};

type SelectedItem =
  | { kind: "challenge"; rank: number; item: ChallengeRow }
  | { kind: "direction"; rank: number; item: DirectionRow }
  | { kind: "uncovered"; rank: number; item: ChallengeRow };

function primaryDescription(item: ChallengeRow | DirectionRow): string | null {
  if (item.description?.trim()) return item.description.trim();
  const raw = item.raw;
  const d = raw.description;
  return typeof d === "string" && d.trim() ? d.trim() : null;
}

function DashboardTopListModal({
  selected,
  onClose,
}: {
  selected: SelectedItem;
  onClose: () => void;
}) {
  const desc = primaryDescription(selected.item);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/45 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Detailansicht"
        className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">
              {selected.kind === "direction"
                ? `Top Direction #${selected.rank}`
                : selected.kind === "challenge"
                  ? `Top Challenge #${selected.rank}`
                  : `Unadressierte Challenge #${selected.rank}`}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-zinc-900">{selected.item.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
          >
            Schließen
          </button>
        </div>
        {desc ? (
          <div className="mt-3 max-h-[40vh] overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Beschreibung</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">{desc}</p>
          </div>
        ) : null}
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          {selected.kind === "direction" ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-800">
                <span className="font-semibold">Priorität:</span> {selected.item.priority.toFixed(2)}
              </p>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Verknüpfte Challenges ({selected.item.linkedChallenges.length})
                </p>
                {selected.item.linkedChallenges.length === 0 ? (
                  <p className="mt-1 text-sm text-zinc-700">Keine direkten Challenge-Verknüpfungen.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {selected.item.linkedChallenges.map((challenge) => (
                      <li key={challenge.id} className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm">
                        <p className="font-medium text-zinc-900">{challenge.title}</p>
                        <p className="text-xs text-zinc-600">
                          Score {challenge.score.toFixed(2)}
                          {challenge.contributionLevel ? ` · Beitrag ${challenge.contributionLevel}` : ""}
                        </p>
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-zinc-600">Rohdaten Challenge</summary>
                          <pre className="mt-1 max-h-48 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-2 text-[11px] text-zinc-700">
                            {JSON.stringify(challenge.raw, null, 2)}
                          </pre>
                        </details>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <details>
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Vollständiger Datensatz Stoßrichtung
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded border border-zinc-200 bg-white p-2 text-[11px] text-zinc-700">
                  {JSON.stringify(selected.item.raw, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-zinc-800">
                <span className="font-semibold">Challenge-Score:</span> {selected.item.score.toFixed(2)}
              </p>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Verknüpfte Stoßrichtungen ({selected.item.linkedDirections.length})
                </p>
                {selected.item.linkedDirections.length === 0 ? (
                  <p className="mt-1 text-sm text-zinc-700">Keine verknüpften Stoßrichtungen.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {selected.item.linkedDirections.map((direction) => (
                      <li key={direction.id} className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm">
                        <p className="font-medium text-zinc-900">{direction.title}</p>
                        <p className="text-xs text-zinc-600">
                          {direction.contributionLevel ? `Beitrag ${direction.contributionLevel}` : "Beitrag n/a"}
                        </p>
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-zinc-600">Rohdaten Stoßrichtung</summary>
                          <pre className="mt-1 max-h-48 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-2 text-[11px] text-zinc-700">
                            {JSON.stringify(direction.raw, null, 2)}
                          </pre>
                        </details>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Verknüpfte Analysis-Einträge ({selected.item.linkedAnalysisEntries.length})
                </p>
                {selected.item.linkedAnalysisEntries.length === 0 ? (
                  <p className="mt-1 text-sm text-zinc-700">Keine verknüpften Analysis-Einträge.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {selected.item.linkedAnalysisEntries.map((entry) => (
                      <li key={entry.id} className="rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm">
                        <p className="font-medium text-zinc-900">{entry.title}</p>
                        <p className="text-xs text-zinc-600">Typ: {entry.analysisType ?? "n/a"}</p>
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-zinc-600">Rohdaten Analysis-Eintrag</summary>
                          <pre className="mt-1 max-h-48 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-2 text-[11px] text-zinc-700">
                            {JSON.stringify(entry.raw, null, 2)}
                          </pre>
                        </details>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <details>
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Vollständiger Datensatz Challenge
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded border border-zinc-200 bg-white p-2 text-[11px] text-zinc-700">
                  {JSON.stringify(selected.item.raw, null, 2)}
                </pre>
              </details>
            </div>
          )}
          {selected.kind === "uncovered" ? (
            <p className="mt-2 text-xs text-zinc-600">
              Diese Challenge hat aktuell keine Stoßrichtungs-Verknüpfung.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function DashboardTopLists({ topChallenges, topDirections, uncoveredChallenges }: Props) {
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const uncoveredTopFive = useMemo(() => uncoveredChallenges.slice(0, 5), [uncoveredChallenges]);
  const buttonClassName =
    "w-full rounded-lg border border-[#1a5c67]/40 bg-[#1a5c67]/12 px-2.5 py-1.5 text-left transition-colors hover:bg-[#1a5c67]/18 hover:border-[#1a5c67]/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a5c67]";

  return (
    <>
      <section className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <article className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-100 px-3 py-2 sm:px-4 sm:py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Top 5 Challenges</h2>
            <p className="text-[11px] text-zinc-500">Nach Challenge-Score sortiert</p>
          </div>
          <ul className="space-y-1.5 p-2 sm:p-3">
            {topChallenges.map((challenge, idx) => (
              <li key={challenge.id}>
                <button
                  type="button"
                  onClick={() => setSelected({ kind: "challenge", rank: idx + 1, item: challenge })}
                  className={buttonClassName}
                >
                  <p className="text-sm font-medium text-zinc-900">{challenge.title}</p>
                  <p className="text-xs text-zinc-700">
                    Score {challenge.score.toFixed(2)} · {challenge.linkedDirections.length} Stoßrichtungen ·{" "}
                    {challenge.linkedAnalysisEntries.length} Analysis-Einträge
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </article>

        <article className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-100 px-3 py-2 sm:px-4 sm:py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Top 5 Directions</h2>
            <p className="text-[11px] text-zinc-500">Nach Priorität sortiert</p>
          </div>
          <ul className="space-y-1.5 p-2 sm:p-3">
            {topDirections.map((direction, idx) => (
              <li key={direction.id}>
                <button
                  type="button"
                  onClick={() => setSelected({ kind: "direction", rank: idx + 1, item: direction })}
                  className={buttonClassName}
                >
                  <p className="text-sm font-medium text-zinc-900">{direction.title}</p>
                  <p className="text-xs text-zinc-700">
                    Priorität {direction.priority.toFixed(2)} · {direction.linkedChallenges.length} verknüpfte Challenges
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </article>

        <article className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-100 px-3 py-2 sm:px-4 sm:py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Unadressierte Challenges</h2>
            <p className="text-[11px] text-zinc-500">Ohne Stoßrichtungs-Verknüpfung</p>
          </div>
          <ul className="space-y-1.5 p-2 sm:p-3">
            {uncoveredTopFive.length === 0 ? (
              <li className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-2.5 py-1.5 text-sm text-emerald-800">
                Alle Challenges sind adressiert.
              </li>
            ) : (
              uncoveredTopFive.map((challenge, idx) => (
                <li key={challenge.id}>
                  <button
                    type="button"
                    onClick={() => setSelected({ kind: "uncovered", rank: idx + 1, item: challenge })}
                    className={`${buttonClassName} text-sm text-zinc-900`}
                  >
                    {challenge.title}
                  </button>
                </li>
              ))
            )}
          </ul>
        </article>
      </section>

      {selected ? <DashboardTopListModal selected={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}
