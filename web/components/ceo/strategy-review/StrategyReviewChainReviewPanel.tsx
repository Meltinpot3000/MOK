"use client";

import { Component, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
import {
  STRATEGY_REVIEW_CHAIN_THEMES,
  collectThemeItems,
  computeThemeOpenEnds,
  isChallengeWithoutDirection,
  directionsLinkedToChallenge,
  isProgramUnsupportedByCoverage,
  strategyReviewDirectionFeedbackLabel,
  summarizeLifecycle,
  themeCounts,
  type ChainLifecycleBucket,
  type ChainOpenEndStat,
  type StrategyReviewChainHub,
  type StrategyReviewChainItem,
  type StrategyReviewChainThemeId,
} from "@/lib/strategy-review/pre-read-chain";
import {
  coverageForSubject,
  type StrategyReviewCoverageIndex,
} from "@/lib/strategy-review/execution-coverage";
import { useStrategyReviewFeedbackDirty } from "@/components/ceo/strategy-review/strategy-review-feedback-dirty";
import {
  CoverageChips,
  LifecycleBadge,
  ProgramDetailsBlock,
  feedbackOptionButtonClass,
} from "@/components/ceo/strategy-review/strategy-review-item-meta";
import { srDebug } from "@/lib/strategy-review/sr-debug";

type FeedbackDraft = Record<string, { rating: string; comment: string }>;

export type StrategyReviewFeedbackSubmitEntry = {
  subject_type: string;
  subject_id: string;
  rating: string | null;
  comment: string | null;
};

type Props = {
  hubs: StrategyReviewChainHub[];
  /** Alle Ziele aus dem L1-Strategiezyklus (nicht nur verknüpfte). */
  strategyCycleObjectives?: StrategyReviewChainItem[];
  /** Alle Herausforderungen aus dem Pre-Read (inkl. ohne Stoßrichtung). */
  strategyCycleChallenges?: StrategyReviewChainItem[];
  executionCoverage?: StrategyReviewCoverageIndex | null;
  existingFeedbackByKey: Record<string, { rating: string | null; comment: string }>;
  canWrite: boolean;
  onSubmit: (entries: StrategyReviewFeedbackSubmitEntry[]) => Promise<void>;
  pending: boolean;
};

function feedbackDraftEntry(
  key: string,
  draft: FeedbackDraft,
  existing: Record<string, { rating: string | null; comment: string }>
): { rating: string; comment: string } {
  return (
    draft[key] ?? {
      rating: existing[key]?.rating ?? "",
      comment: existing[key]?.comment ?? "",
    }
  );
}

class StrategyReviewFeedbackErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    srDebug(
      "error-boundary",
      error.message,
      `${error.stack ?? ""}\n---\n${info.componentStack ?? ""}`
    );
  }

  render() {
    if (this.state.error) {
      return (
        <section className="brand-card space-y-3 border-red-300 p-6">
          <h2 className="text-lg font-semibold text-red-800">2. Vorab & Feedback — Fehler</h2>
          <p className="text-sm text-red-700">{this.state.error.message}</p>
          <pre className="max-h-48 overflow-auto rounded bg-red-50 p-2 text-[11px] text-red-900">
            {this.state.error.stack}
          </pre>
          <button
            type="button"
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm"
            onClick={() => this.setState({ error: null })}
          >
            Erneut versuchen
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}

function ArrowRight({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-8 shrink-0 text-zinc-400 ${className}`}
      viewBox="0 0 32 16"
      fill="none"
      aria-hidden
    >
      <path d="M2 8h24" stroke="currentColor" strokeWidth="1.5" />
      <path d="M20 3l7 5-7 5" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function ArrowDown({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`h-8 w-4 shrink-0 text-zinc-400 ${className}`}
      viewBox="0 0 16 32"
      fill="none"
      aria-hidden
    >
      <path d="M8 2v24" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 20l5 7 5-7" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function LifecycleMini({ buckets, active }: { buckets: ChainLifecycleBucket[]; active: boolean }) {
  if (buckets.length === 0) {
    return <p className={`text-[9px] ${active ? "text-zinc-400" : "text-zinc-400"}`}>Lifecycle: —</p>;
  }
  const top = buckets.slice(0, 2);
  return (
    <p className={`mt-1 line-clamp-2 text-[9px] leading-snug ${active ? "text-zinc-300" : "text-zinc-500"}`}>
      {top.map((b) => `${b.count} ${b.label}`).join(" · ")}
      {buckets.length > 2 ? " · …" : ""}
    </p>
  );
}

function OpenEndBadge({
  openEnd,
  active,
}: {
  openEnd: ChainOpenEndStat | null;
  active: boolean;
}) {
  if (!openEnd || openEnd.count <= 0) return null;
  return (
    <span
      className={`mt-1.5 inline-flex max-w-full items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold leading-tight ${
        active
          ? "border-amber-300/40 bg-amber-400/20 text-amber-100"
          : "border-amber-200 bg-amber-50 text-amber-900"
      }`}
      title={openEnd.fullLabel}
    >
      <span className="mr-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
      <span className="truncate">
        {openEnd.count} {openEnd.shortLabel}
      </span>
    </span>
  );
}

export function ConnectionEntryGraphic({
  selected,
  counts,
  ratedCounts,
  openEnds,
  lifecycleByTheme,
  onSelect,
}: {
  selected: StrategyReviewChainThemeId | null;
  counts: Record<StrategyReviewChainThemeId, number>;
  ratedCounts: Record<StrategyReviewChainThemeId, number>;
  openEnds: Record<StrategyReviewChainThemeId, ChainOpenEndStat | null>;
  lifecycleByTheme: Record<StrategyReviewChainThemeId, ChainLifecycleBucket[]>;
  onSelect: (id: StrategyReviewChainThemeId) => void;
}) {
  const node = (id: StrategyReviewChainThemeId, label: string) => {
    const active = selected === id;
    const done = counts[id] > 0 && ratedCounts[id] >= counts[id];
    return (
      <button
        type="button"
        onClick={() => onSelect(id)}
        className={`relative z-10 flex min-h-[7.5rem] min-w-[8.5rem] max-w-[10rem] flex-col items-center rounded-2xl border px-2.5 py-2.5 text-center shadow-sm transition ${
          active
            ? "border-zinc-900 bg-zinc-900 text-white"
            : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400"
        }`}
      >
        <span className="block text-[10px] font-bold uppercase tracking-[0.12em] opacity-70">
          {label}
        </span>
        <span className="mt-1 block text-lg font-semibold tabular-nums">{counts[id]}</span>
        <span className={`text-[10px] ${active ? "text-zinc-300" : "text-zinc-500"}`}>
          {done ? "bewertet" : `${ratedCounts[id]}/${counts[id]} bewertet`}
        </span>
        {id !== "challenges" ? (
          <LifecycleMini buckets={lifecycleByTheme[id]} active={active} />
        ) : null}
        <OpenEndBadge openEnd={openEnds[id]} active={active} />
      </button>
    );
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white px-3 py-5 sm:px-4">
      <p className="mb-3 text-center text-xs font-medium text-zinc-500">
        Hierarchie der Strategie-Kette — Pfeile zeigen die Wirkrichtung
      </p>

      {/* Desktop / tablet: klare Pfeil-Hierarchie */}
      <div className="mx-auto hidden max-w-3xl flex-col items-center sm:flex">
        <div className="flex items-start justify-center gap-2">
          {node("objectives", "Ziele")}
        </div>
        <div className="flex flex-col items-center py-1">
          <ArrowDown />
          <span className="text-[9px] font-medium uppercase tracking-wide text-zinc-400">
            Zielbezug
          </span>
        </div>
        <div className="flex w-full items-center justify-center gap-1 px-2">
          {node("challenges", "Handlungsbedarf")}
          <div className="flex flex-col items-center px-1">
            <ArrowRight />
            <span className="text-[9px] text-zinc-400">Begründung</span>
          </div>
          {node("directions", "Stoßrichtungen")}
          <div className="flex flex-col items-center px-1">
            <ArrowRight />
            <span className="text-[9px] text-zinc-400">Change</span>
          </div>
          {node("programs", "Programme")}
        </div>
      </div>

      {/* Mobile: gestapelt mit Abwärtspfeilen */}
      <div className="flex flex-col items-center gap-1 sm:hidden">
        {node("objectives", "Ziele")}
        <ArrowDown />
        {node("challenges", "Handlungsbedarf")}
        <ArrowDown />
        {node("directions", "Stoßrichtungen")}
        <ArrowDown />
        {node("programs", "Programme")}
      </div>

      <p className="mt-3 text-center text-[10px] text-zinc-500">
        Gelbe Markierung = lose Enden (fehlende Verbindung in der Kette)
      </p>
    </div>
  );
}

export function StrategyReviewChainReviewPanel(props: Props) {
  return (
    <StrategyReviewFeedbackErrorBoundary>
      <StrategyReviewChainReviewPanelInner {...props} />
    </StrategyReviewFeedbackErrorBoundary>
  );
}

function buildFeedbackEntries(draft: FeedbackDraft): StrategyReviewFeedbackSubmitEntry[] {
  const entries: StrategyReviewFeedbackSubmitEntry[] = [];
  for (const [entryKey, v] of Object.entries(draft)) {
    if (!v.rating) continue;
    const sep = entryKey.indexOf(":");
    if (sep < 0) continue;
    const subject_type = entryKey.slice(0, sep);
    const subject_id = entryKey.slice(sep + 1);
    if (!["challenge", "focus_area", "objective", "program"].includes(subject_type)) {
      continue;
    }
    entries.push({
      subject_type,
      subject_id,
      rating: v.rating,
      comment: v.comment.trim() || null,
    });
  }
  return entries;
}

function StrategyReviewChainReviewPanelInner({
  hubs,
  strategyCycleObjectives = [],
  strategyCycleChallenges = [],
  executionCoverage = null,
  existingFeedbackByKey,
  canWrite,
  onSubmit,
  pending,
}: Props) {
  const [themeId, setThemeId] = useState<StrategyReviewChainThemeId | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState<FeedbackDraft>({});
  const { markDirty, clearDirty, registerSaveHandler } = useStrategyReviewFeedbackDirty();

  useEffect(() => {
    const save = async (): Promise<boolean> => {
      const entries = buildFeedbackEntries(feedbackDraft);
      if (entries.length === 0) return false;
      try {
        await onSubmit(entries);
        clearDirty();
        return true;
      } catch {
        return false;
      }
    };
    registerSaveHandler(save);
    return () => registerSaveHandler(null);
  }, [feedbackDraft, onSubmit, clearDirty, registerSaveHandler]);

  useEffect(() => {
    srDebug("panel-mount", "ChainReviewPanel mounted", {
      hubs: hubs.length,
      objectives: strategyCycleObjectives.length,
      challenges: strategyCycleChallenges.length,
      hasCoverage: Boolean(executionCoverage),
      existingFeedback: Object.keys(existingFeedbackByKey).length,
    });
    const onWinError = (event: ErrorEvent) => {
      srDebug(
        "window-error",
        `${event.message} @ ${event.filename}:${event.lineno}:${event.colno}`,
        event.error instanceof Error ? event.error.stack : undefined
      );
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      srDebug(
        "unhandled-rejection",
        reason instanceof Error ? reason.message : String(reason),
        reason instanceof Error ? reason.stack : reason
      );
    };
    window.addEventListener("error", onWinError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onWinError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
    // nur einmal beim Mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const catalogs = useMemo(
    () => ({
      objectives: strategyCycleObjectives,
      challenges: strategyCycleChallenges,
    }),
    [strategyCycleObjectives, strategyCycleChallenges]
  );
  const counts = useMemo(() => themeCounts(hubs, catalogs), [hubs, catalogs]);
  const openEnds = useMemo(
    () => computeThemeOpenEnds(hubs, catalogs, executionCoverage),
    [hubs, catalogs, executionCoverage]
  );
  const lifecycleByTheme = useMemo(() => {
    const result = {
      challenges: summarizeLifecycle(collectThemeItems(hubs, "challenges", catalogs)),
      directions: summarizeLifecycle(collectThemeItems(hubs, "directions", catalogs)),
      objectives: summarizeLifecycle(collectThemeItems(hubs, "objectives", catalogs)),
      programs: summarizeLifecycle(collectThemeItems(hubs, "programs", catalogs)),
    } satisfies Record<StrategyReviewChainThemeId, ChainLifecycleBucket[]>;
    return result;
  }, [hubs, catalogs]);

  const theme = STRATEGY_REVIEW_CHAIN_THEMES.find((t) => t.id === themeId) ?? null;
  const items = useMemo(
    () => (themeId ? collectThemeItems(hubs, themeId, catalogs) : []),
    [hubs, themeId, catalogs]
  );

  const ratedCounts = useMemo(() => {
    const result: Record<StrategyReviewChainThemeId, number> = {
      challenges: 0,
      directions: 0,
      objectives: 0,
      programs: 0,
    };
    for (const t of STRATEGY_REVIEW_CHAIN_THEMES) {
      const list = collectThemeItems(hubs, t.id, catalogs);
      result[t.id] = list.filter((item) => {
        const key = `${t.subjectType}:${item.id}`;
        const rating =
          feedbackDraft[key]?.rating || existingFeedbackByKey[key]?.rating;
        return Boolean(rating);
      }).length;
    }
    return result;
  }, [hubs, catalogs, feedbackDraft, existingFeedbackByKey]);

  useEffect(() => {
    srDebug("draft-changed", "feedbackDraft updated", {
      keys: Object.keys(feedbackDraft),
      draft: feedbackDraft,
      themeId,
      items: items.length,
      ratedCounts,
    });
  }, [feedbackDraft, themeId, items.length, ratedCounts]);

  if (hubs.length === 0) {
    return (
      <section className="brand-card space-y-3 p-6">
        <h2 className="text-lg font-semibold text-zinc-900">2. Vorab & Feedback</h2>
        <p className="text-sm text-zinc-600">
          Keine Stoßrichtungen im Pre-Read. Bitte Vorab-Unterlagen erneut aufbereiten.
        </p>
      </section>
    );
  }

  return (
    <section id="strategy-review-step-preread" className="brand-card space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">2. Vorab & Feedback</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Formelle Kettenprüfung: Handlungsbedarf → Stoßrichtung ← Ziele, Stoßrichtung → Programme.
          Ziele stammen aus dem übergeordneten Strategiezyklus. Wählen Sie ein Thema in der
          Verbindungsansicht.
        </p>
      </div>

      <ConnectionEntryGraphic
        selected={themeId}
        counts={counts}
        ratedCounts={ratedCounts}
        openEnds={openEnds}
        lifecycleByTheme={lifecycleByTheme}
        onSelect={(id) => {
          srDebug("theme-select", `theme=${id}`, { previous: themeId });
          setThemeId(id);
        }}
      />

      {!theme ? (
        <p className="rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
          Oben ein Thema anklicken. Danach erscheinen nur die Punkte dieses Themas zur Bewertung.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-zinc-900">{theme.label}</h3>
              <p className="text-sm text-zinc-600">{theme.hint}</p>
              {openEnds[theme.id] ? (
                <p className="mt-1 text-sm font-medium text-amber-800">{openEnds[theme.id]?.fullLabel}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="text-xs font-medium text-zinc-600 underline"
              onClick={() => setThemeId(null)}
            >
              Liste schliessen
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-zinc-500">Keine Einträge in diesem Thema.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => {
                const key = `${theme.subjectType}:${item.id}`;
                const draft = feedbackDraftEntry(key, feedbackDraft, existingFeedbackByKey);
                const coverage = coverageForSubject(
                  executionCoverage,
                  theme.subjectType,
                  item.id
                );
                const description = item.description?.trim() || "";
                const programUnsupported =
                  theme.subjectType === "program" &&
                  isProgramUnsupportedByCoverage(executionCoverage, item.id);
                const challengeUnlinked =
                  theme.subjectType === "challenge" &&
                  isChallengeWithoutDirection(hubs, item.id);
                const linkedDirections =
                  theme.subjectType === "challenge"
                    ? directionsLinkedToChallenge(hubs, item.id)
                    : [];
                const showOpenEndBadge = programUnsupported || challengeUnlinked;
                return (
                  <li
                    key={item.id}
                    className={`rounded-lg border bg-white p-3 ${
                      showOpenEndBadge
                        ? "border-amber-300 ring-1 ring-amber-100"
                        : "border-zinc-200"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-zinc-900">{item.title}</p>
                          {theme.subjectType !== "challenge" ? (
                            <LifecycleBadge item={item} />
                          ) : null}
                          {programUnsupported ? (
                            <span
                              className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900"
                              title="Programm ohne Jahresziele und ohne Initiativen"
                            >
                              Nicht unterstützt
                            </span>
                          ) : null}
                          {challengeUnlinked ? (
                            <span
                              className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900"
                              title="Handlungsbedarf ohne verknüpfte Stoßrichtung"
                            >
                              Ohne Stoßrichtung
                            </span>
                          ) : null}
                        </div>
                        <p
                          className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed ${
                            description ? "text-zinc-700" : "italic text-zinc-400"
                          }`}
                        >
                          {description || "Keine Beschreibung hinterlegt."}
                        </p>
                        {theme.subjectType === "challenge" ? (
                          <div className="mt-2" aria-label="Verknüpfte Stoßrichtungen">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                              Stoßrichtungen
                            </p>
                            {linkedDirections.length > 0 ? (
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {linkedDirections.map((d) => (
                                  <span
                                    key={d.id}
                                    className="inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-900"
                                    title={d.title}
                                  >
                                    {d.title}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-1 text-[11px] italic text-zinc-400">
                                Keine Stoßrichtung verknüpft.
                              </p>
                            )}
                          </div>
                        ) : null}
                        <CoverageChips coverage={coverage} subjectType={theme.subjectType} />
                        {theme.id === "programs" ? <ProgramDetailsBlock item={item} /> : null}
                      </div>
                      <span className="shrink-0 text-[10px] text-zinc-500">
                        {strategyReviewDirectionFeedbackLabel(
                          draft.rating || existingFeedbackByKey[key]?.rating
                        )}
                      </span>
                    </div>
                    <fieldset className="mt-3" disabled={!canWrite || pending}>
                      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Bewertung">
                        {theme.options.map((o) => {
                          const selected = draft.rating === o.code;
                          return (
                            <button
                              key={o.code}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              disabled={!canWrite || pending}
                              className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${feedbackOptionButtonClass(
                                o.code,
                                selected
                              )}`}
                              onClick={() => {
                                const rating = o.code;
                                const scrollBefore = {
                                  x: window.scrollX,
                                  y: window.scrollY,
                                };
                                srDebug("rating-click", "rating selected", {
                                  key,
                                  rating,
                                  themeId: theme.id,
                                  itemId: item.id,
                                  title: item.title,
                                  scrollBefore,
                                });
                                setFeedbackDraft((prev) => {
                                  const prevEntry = feedbackDraftEntry(
                                    key,
                                    prev,
                                    existingFeedbackByKey
                                  );
                                  return {
                                    ...prev,
                                    [key]: { ...prevEntry, rating },
                                  };
                                });
                                markDirty();
                                // Fokus-/Scroll-Sprung durch versteckte Radios vermeiden
                                requestAnimationFrame(() => {
                                  srDebug("rating-click", "after paint scroll", {
                                    x: window.scrollX,
                                    y: window.scrollY,
                                    scrollBefore,
                                  });
                                });
                              }}
                            >
                              {o.label}
                            </button>
                          );
                        })}
                      </div>
                      <textarea
                        rows={2}
                        value={draft.comment}
                        onChange={(e) => {
                          const comment = e.target.value;
                          setFeedbackDraft((prev) => {
                            const prevEntry = feedbackDraftEntry(
                              key,
                              prev,
                              existingFeedbackByKey
                            );
                            return {
                              ...prev,
                              [key]: { ...prevEntry, comment },
                            };
                          });
                          markDirty();
                        }}
                        placeholder="Kommentar (optional)"
                        className="mt-2 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                      />
                    </fieldset>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
