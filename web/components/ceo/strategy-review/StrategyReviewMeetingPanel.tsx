"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  STRATEGY_REVIEW_CHAIN_THEMES,
  collectThemeItems,
  computeThemeOpenEnds,
  directionsLinkedToChallenge,
  isChallengeWithoutDirection,
  isProgramUnsupportedByCoverage,
  summarizeLifecycle,
  themeCounts,
  type ChainLifecycleBucket,
  type StrategyReviewChainHub,
  type StrategyReviewChainItem,
  type StrategyReviewChainThemeId,
} from "@/lib/strategy-review/pre-read-chain";
import {
  coverageForSubject,
  type StrategyReviewCoverageIndex,
} from "@/lib/strategy-review/execution-coverage";
import {
  countItemsWithFeedback,
  summarizeSubjectFeedback,
  type StrategyReviewFeedbackRowLike,
} from "@/lib/strategy-review/feedback-summary";
import { ConnectionEntryGraphic } from "@/components/ceo/strategy-review/StrategyReviewChainReviewPanel";
import {
  CoverageChips,
  LifecycleBadge,
  ProgramDetailsBlock,
  feedbackOptionButtonClass,
  feedbackRatingChipClass,
} from "@/components/ceo/strategy-review/strategy-review-item-meta";
import { useStrategyReviewFeedbackDirty } from "@/components/ceo/strategy-review/strategy-review-feedback-dirty";
import type { StrategyReviewParticipant } from "@/lib/strategy-review/participants";
import type { StrategyReviewMemberOption } from "@/lib/strategy-review/participants";
import {
  StrategyReviewDecisionEditMask,
  seedDecisionFieldsFromSource,
  type DecisionFieldValues,
  type DecisionObjectKind,
} from "@/components/ceo/strategy-review/StrategyReviewDecisionEditMask";

export type MeetingDecisionEntry = {
  decision: string;
  comment: string;
  /** Felder für Anpassen / Ersetzen (volle Maske) */
  fields?: DecisionFieldValues;
};

type SourceItem = {
  id: string;
  title?: string;
  description?: string;
  [key: string]: unknown;
};

type Props = {
  hubs: StrategyReviewChainHub[];
  strategyCycleObjectives?: StrategyReviewChainItem[];
  strategyCycleChallenges?: StrategyReviewChainItem[];
  executionCoverage?: StrategyReviewCoverageIndex | null;
  feedbackRows: StrategyReviewFeedbackRowLike[];
  participants: StrategyReviewParticipant[];
  memberOptions: StrategyReviewMemberOption[];
  /** Rohobjekte aus Pre-Read für Masken-Vorbelegung */
  challengeSources?: SourceItem[];
  directionSources?: SourceItem[];
  objectiveSources?: SourceItem[];
  decisions: Record<string, MeetingDecisionEntry>;
  setDecisions: Dispatch<SetStateAction<Record<string, MeetingDecisionEntry>>>;
  decisionProgress: { done: number; total: number };
  canWrite: boolean;
  pending: boolean;
  onSubmitDecisions: () => Promise<boolean>;
};

function decisionOptionsForTheme(
  themeId: StrategyReviewChainThemeId
): Array<{ value: string; label: string }> | null {
  if (themeId === "challenges") {
    return [
      { value: "keep", label: "Beibehalten" },
      { value: "adjust", label: "Anpassen" },
      { value: "replace", label: "Ersetzen" },
      { value: "inactivate", label: "Inaktivieren" },
    ];
  }
  if (themeId === "directions") {
    return [
      { value: "double_down", label: "Verstärken" },
      { value: "adjust", label: "Anpassen" },
      { value: "replace", label: "Ersetzen" },
      { value: "inactivate", label: "Inaktivieren" },
    ];
  }
  if (themeId === "objectives") {
    return [
      { value: "keep", label: "Beibehalten" },
      { value: "adjust", label: "Anpassen" },
      { value: "replace", label: "Ersetzen" },
      { value: "inactivate", label: "Inaktivieren" },
    ];
  }
  return null;
}

function decisionKindForTheme(themeId: StrategyReviewChainThemeId): DecisionObjectKind | null {
  if (themeId === "challenges") return "challenge";
  if (themeId === "directions") return "direction";
  if (themeId === "objectives") return "objective";
  return null;
}

function decisionKey(themeId: StrategyReviewChainThemeId, itemId: string): string | null {
  if (themeId === "challenges") return `challenge:${itemId}`;
  if (themeId === "directions") return `focus_area:${itemId}`;
  if (themeId === "objectives") return `objective:${itemId}`;
  return null;
}

export function StrategyReviewMeetingPanel({
  hubs,
  strategyCycleObjectives = [],
  strategyCycleChallenges = [],
  executionCoverage = null,
  feedbackRows,
  participants,
  memberOptions,
  challengeSources = [],
  directionSources = [],
  objectiveSources = [],
  decisions,
  setDecisions,
  decisionProgress,
  canWrite,
  pending,
  onSubmitDecisions,
}: Props) {
  const [themeId, setThemeId] = useState<StrategyReviewChainThemeId | null>(null);
  const { markDirty, clearDirty, registerSaveHandler } = useStrategyReviewFeedbackDirty();

  useEffect(() => {
    const save = async (): Promise<boolean> => {
      try {
        const ok = await onSubmitDecisions();
        if (ok) clearDirty();
        return ok;
      } catch {
        return false;
      }
    };
    registerSaveHandler(save);
    return () => registerSaveHandler(null);
  }, [onSubmitDecisions, clearDirty, registerSaveHandler]);

  const catalogs = useMemo(
    () => ({
      objectives: strategyCycleObjectives,
      challenges: strategyCycleChallenges,
    }),
    [strategyCycleObjectives, strategyCycleChallenges]
  );

  const sourceByKey = useMemo(() => {
    const map = new Map<string, SourceItem>();
    for (const c of challengeSources) map.set(`challenge:${c.id}`, c);
    for (const d of directionSources) map.set(`focus_area:${d.id}`, d);
    for (const o of objectiveSources) map.set(`objective:${o.id}`, o);
    return map;
  }, [challengeSources, directionSources, objectiveSources]);

  const nameByActorId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const o of memberOptions) map[o.membership_id] = o.display_name;
    for (const p of participants) map[p.membership_id] = p.display_name;
    return map;
  }, [memberOptions, participants]);

  const counts = useMemo(() => themeCounts(hubs, catalogs), [hubs, catalogs]);
  const openEnds = useMemo(
    () => computeThemeOpenEnds(hubs, catalogs, executionCoverage),
    [hubs, catalogs, executionCoverage]
  );
  const lifecycleByTheme = useMemo(() => {
    return {
      challenges: summarizeLifecycle(collectThemeItems(hubs, "challenges", catalogs)),
      directions: summarizeLifecycle(collectThemeItems(hubs, "directions", catalogs)),
      objectives: summarizeLifecycle(collectThemeItems(hubs, "objectives", catalogs)),
      programs: summarizeLifecycle(collectThemeItems(hubs, "programs", catalogs)),
    } satisfies Record<StrategyReviewChainThemeId, ChainLifecycleBucket[]>;
  }, [hubs, catalogs]);

  const feedbackCounts = useMemo(() => {
    const result = {
      challenges: 0,
      directions: 0,
      objectives: 0,
      programs: 0,
    } satisfies Record<StrategyReviewChainThemeId, number>;
    for (const t of STRATEGY_REVIEW_CHAIN_THEMES) {
      const themeItems = collectThemeItems(hubs, t.id, catalogs);
      result[t.id] = countItemsWithFeedback(themeItems, t.subjectType, feedbackRows);
    }
    return result;
  }, [hubs, catalogs, feedbackRows]);

  const theme = STRATEGY_REVIEW_CHAIN_THEMES.find((t) => t.id === themeId) ?? null;
  const items = useMemo(
    () => (themeId ? collectThemeItems(hubs, themeId, catalogs) : []),
    [hubs, themeId, catalogs]
  );
  const decisionOpts = themeId ? decisionOptionsForTheme(themeId) : null;

  if (hubs.length === 0) {
    return (
      <section id="strategy-review-step-meeting" className="brand-card space-y-3 p-6">
        <h2 className="text-lg font-semibold text-zinc-900">3. Meeting & Entscheidungen</h2>
        <p className="text-sm text-zinc-600">Keine Stoßrichtungen im Pre-Read verfügbar.</p>
      </section>
    );
  }

  return (
    <section id="strategy-review-step-meeting" className="brand-card space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">3. Meeting & Entscheidungen</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Dieselbe Kettenansicht wie in Vorab & Feedback. Pro Thema die Feedbacks aller Reviewer
          zusammenfassen und Entscheidungen treffen. Fortschritt: {decisionProgress.done} /{" "}
          {decisionProgress.total}.
        </p>
      </div>

      <ConnectionEntryGraphic
        selected={themeId}
        counts={counts}
        ratedCounts={feedbackCounts}
        openEnds={openEnds}
        lifecycleByTheme={lifecycleByTheme}
        onSelect={setThemeId}
      />

      {!theme ? (
        <p className="rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
          Oben ein Thema anklicken. Danach erscheinen die Punkte mit zusammengefasstem Feedback und
          Entscheidungsoptionen.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-zinc-900">{theme.label}</h3>
              <p className="text-sm text-zinc-600">{theme.hint}</p>
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
                const summary = summarizeSubjectFeedback(
                  feedbackRows,
                  theme.subjectType,
                  item.id,
                  nameByActorId
                );
                const dKey = decisionKey(theme.id, item.id);
                const d = dKey ? decisions[dKey] ?? { decision: "", comment: "" } : null;
                const description = item.description?.trim() || "";
                const coverage = coverageForSubject(
                  executionCoverage,
                  theme.subjectType,
                  item.id
                );
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
                                {linkedDirections.map((dir) => (
                                  <span
                                    key={dir.id}
                                    className="inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-900"
                                    title={dir.title}
                                  >
                                    {dir.title}
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
                        {summary.totalRatings === 0
                          ? "Kein Feedback"
                          : `${summary.totalRatings} Feedback${summary.totalRatings === 1 ? "" : "s"}`}
                      </span>
                    </div>

                    <div className="mt-3 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Feedback-Zusammenfassung
                      </p>
                      {summary.totalRatings === 0 ? (
                        <p className="mt-1 text-sm italic text-zinc-400">Noch keine Bewertungen.</p>
                      ) : (
                        <>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {summary.buckets.map((b) => (
                              <span
                                key={b.rating}
                                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${feedbackRatingChipClass(b.rating)}`}
                                title={b.reviewers.join(", ")}
                              >
                                {b.label} ×{b.count}
                              </span>
                            ))}
                          </div>
                          {summary.comments.length > 0 ? (
                            <ul className="mt-2 space-y-1.5">
                              {summary.comments.map((c, idx) => (
                                <li key={`${c.author}-${idx}`} className="text-xs text-zinc-700">
                                  <span className="font-medium text-zinc-900">{c.author}</span>
                                  <span className="text-zinc-400"> · {c.ratingLabel}: </span>
                                  <span className="whitespace-pre-wrap">{c.comment}</span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </>
                      )}
                    </div>

                    {dKey && d && decisionOpts ? (
                      <fieldset className="mt-3" disabled={!canWrite || pending}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          Entscheidung
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {decisionOpts.map((o) => {
                            const selected = d.decision === o.value;
                            const kind = decisionKindForTheme(theme.id);
                            return (
                              <button
                                key={o.value}
                                type="button"
                                disabled={!canWrite || pending}
                                className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${feedbackOptionButtonClass(
                                  o.value,
                                  selected
                                )}`}
                                onClick={() => {
                                  if (!kind) return;
                                  const needsFields =
                                    o.value === "adjust" || o.value === "replace";
                                  const seeded =
                                    needsFields && !d.fields
                                      ? seedDecisionFieldsFromSource(
                                          kind,
                                          sourceByKey.get(dKey),
                                          item.title,
                                          item.description?.trim() || ""
                                        )
                                      : d.fields;
                                  setDecisions((prev) => ({
                                    ...prev,
                                    [dKey]: {
                                      ...d,
                                      decision: o.value,
                                      fields: needsFields ? seeded : d.fields,
                                    },
                                  }));
                                  markDirty();
                                }}
                              >
                                {o.label}
                              </button>
                            );
                          })}
                        </div>
                        <textarea
                          rows={2}
                          value={d.comment}
                          disabled={!canWrite || pending}
                          onChange={(e) => {
                            setDecisions((prev) => ({
                              ...prev,
                              [dKey]: { ...d, comment: e.target.value },
                            }));
                            markDirty();
                          }}
                          placeholder="Begründung (Pflicht bei Anpassen, Ersetzen und Inaktivieren)"
                          className="mt-2 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                        />
                        {d.decision === "inactivate" ? (
                          <p className="mt-2 text-xs text-amber-900">
                            Das Element wird im Workflow inaktiviert und nicht in den nächsten Zyklus
                            übernommen.
                          </p>
                        ) : null}
                        {(d.decision === "adjust" || d.decision === "replace") &&
                        decisionKindForTheme(theme.id) ? (
                          <StrategyReviewDecisionEditMask
                            kind={decisionKindForTheme(theme.id)!}
                            mode={d.decision === "replace" ? "replace" : "adjust"}
                            values={
                              d.fields ??
                              seedDecisionFieldsFromSource(
                                decisionKindForTheme(theme.id)!,
                                sourceByKey.get(dKey),
                                item.title,
                                item.description?.trim() || ""
                              )
                            }
                            disabled={!canWrite || pending}
                            onChange={(fields) => {
                              setDecisions((prev) => ({
                                ...prev,
                                [dKey]: { ...d, fields },
                              }));
                              markDirty();
                            }}
                          />
                        ) : null}
                      </fieldset>
                    ) : theme.id === "programs" ? (
                      <p className="mt-3 text-xs text-zinc-500">
                        Programme: im Meeting nur Feedback-Zusammenfassung (keine Entscheidungsfelder).
                      </p>
                    ) : null}
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
