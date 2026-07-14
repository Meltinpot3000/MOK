"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { StrategyReviewRow } from "@/lib/strategy-review/types";
import {
  ensureStrategyReviewAction,
  recordStrategyReviewAnnouncementAction,
  prepareStrategyReviewAction,
  submitStakeholderFeedbackAction,
  startStrategyReviewMeetingAction,
  saveStrategyReviewDecisionsAction,
  saveStrategyReviewMeetingNotesAction,
  releaseStrategyReviewAction,
  computeReviewReadinessAction,
  devSetStrategyReviewPhaseAction,
  type StrategyReviewDevPhase,
} from "@/app/(ceo)/okr/strategy-review-actions";
import {
  procedureStatusLabelDe,
  readinessStatusLabelDe,
} from "@/lib/review/review-cycle-pulse";
import { StrategyReviewParticipantsPanel } from "@/components/ceo/strategy-review/StrategyReviewParticipantsPanel";
import {
  StrategyReviewChainReviewPanel,
  type StrategyReviewFeedbackSubmitEntry,
} from "@/components/ceo/strategy-review/StrategyReviewChainReviewPanel";
import { StrategyReviewMeetingPanel } from "@/components/ceo/strategy-review/StrategyReviewMeetingPanel";
import { StrategyReviewActionFlyIn } from "@/components/ceo/strategy-review/StrategyReviewActionFlyIn";
import {
  StrategyReviewFeedbackDirtyProvider,
  useStrategyReviewFeedbackDirty,
} from "@/components/ceo/strategy-review/strategy-review-feedback-dirty";
import type {
  StrategyReviewMemberOption,
  StrategyReviewParticipant,
} from "@/lib/strategy-review/participants";
import { strategyReviewParticipantRoleLabel } from "@/lib/strategy-review/participants";
import type { StrategyReviewProcedureStartGate } from "@/lib/strategy-review/procedure-start-gate";
import type { StrategyReviewChainHub, StrategyReviewChainItem } from "@/lib/strategy-review/pre-read-chain";
import type { StrategyReviewCoverageIndex } from "@/lib/strategy-review/execution-coverage";
import { computeReviewerFeedbackProgress } from "@/lib/strategy-review/reviewer-feedback-progress";
import { summarizeStrategyReviewDecisions } from "@/lib/strategy-review/decision-summary";
import {
  seedDecisionFieldsFromSource,
  type DecisionFieldValues,
  type DecisionObjectKind,
} from "@/components/ceo/strategy-review/StrategyReviewDecisionEditMask";

const EMPTY_PRE: Record<string, unknown> = {};

const PROCEDURE_STEPS = [
  { label: "Ankündigung", sectionId: "strategy-review-step-announcement" },
  { label: "Vorab & Feedback", sectionId: "strategy-review-step-preread" },
  { label: "Meeting", sectionId: "strategy-review-step-meeting" },
  { label: "Freigabe", sectionId: "strategy-review-step-release" },
  { label: "Abschluss", sectionId: "strategy-review-step-done" },
] as const;

type PreItem = { id: string; title?: string; description?: string; [key: string]: unknown };

function asItems(v: unknown): PreItem[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => x && typeof x === "object" && typeof (x as PreItem).id === "string") as PreItem[];
}

type DecisionEntry = {
  decision: string;
  comment: string;
  fields?: DecisionFieldValues;
};

type ExistingFeedbackEntry = {
  rating: string | null;
  comment: string;
};

function emptyDecisionMap(
  challenges: PreItem[],
  focusAreas: PreItem[],
  objectives: PreItem[]
): Record<string, DecisionEntry> {
  const m: Record<string, DecisionEntry> = {};
  const add = (prefix: string, id: string) => {
    m[`${prefix}:${id}`] = { decision: "", comment: "" };
  };
  const isArchived = (it: PreItem) => {
    const raw = String(it.identity_lifecycle_state ?? it.lifecycle_state ?? it.status ?? "")
      .trim()
      .toLowerCase();
    return raw === "archived" || raw === "retired";
  };
  for (const c of challenges) {
    if (!isArchived(c)) add("challenge", c.id);
  }
  for (const f of focusAreas) {
    if (!isArchived(f)) add("focus_area", f.id);
  }
  for (const o of objectives) {
    if (!isArchived(o)) add("objective", o.id);
  }
  return m;
}

function hydrateDecisionsFromPayload(
  base: Record<string, DecisionEntry>,
  payload: Record<string, unknown> | null | undefined,
  sources: {
    challenges: PreItem[];
    focusAreas: PreItem[];
    objectives: PreItem[];
  }
): Record<string, DecisionEntry> {
  if (!payload || typeof payload !== "object") return base;
  const next = { ...base };

  const applyList = (
    listKey: "challenges" | "focus_areas" | "objectives",
    prefix: "challenge" | "focus_area" | "objective",
    kind: DecisionObjectKind,
    sourceItems: PreItem[]
  ) => {
    const rows = payload[listKey];
    if (!Array.isArray(rows)) return;
    for (const raw of rows) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id : null;
      if (!id) continue;
      const key = `${prefix}:${id}`;
      if (!(key in next)) continue;
      let decision = typeof row.decision === "string" ? row.decision : "";
      if (prefix === "objective" && decision === "change") decision = "adjust";
      const comment = typeof row.comment === "string" ? row.comment : "";
      const changes =
        row.proposed_changes && typeof row.proposed_changes === "object"
          ? (row.proposed_changes as Record<string, unknown>)
          : row.replacement && typeof row.replacement === "object"
            ? (row.replacement as Record<string, unknown>)
            : null;
      const source = sourceItems.find((s) => s.id === id) ?? {};
      const fields =
        decision === "adjust" || decision === "replace" || decision === "change"
          ? seedDecisionFieldsFromSource(
              kind,
              changes ?? (source as Record<string, unknown>),
              String(source.title ?? ""),
              String(source.description ?? "")
            )
          : undefined;
      next[key] = { decision, comment, fields };
    }
  };

  applyList("challenges", "challenge", "challenge", sources.challenges);
  applyList("focus_areas", "focus_area", "direction", sources.focusAreas);
  applyList("objectives", "objective", "objective", sources.objectives);
  return next;
}

type Props = {
  cycleInstanceId: string;
  cycleLabel: string;
  cycleStart: string;
  cycleEnd: string;
  review: StrategyReviewRow | null;
  membershipId: string;
  canWrite: boolean;
  canModerate?: boolean;
  /** Darf Review-Leitung zuweisen (strategy_review.lead_assign). */
  canAssignLead?: boolean;
  procedureStartGate?: StrategyReviewProcedureStartGate | null;
  /** Wenn gesetzt, entfällt die doppelte Überschrift (Seite liefert Titel + Reiter). */
  hidePageHeader?: boolean;
  /** Dev-Phasen-Switcher nur für freigeschaltete Entwickler. */
  showDevTools?: boolean;
  participants?: StrategyReviewParticipant[];
  memberOptions?: StrategyReviewMemberOption[];
  chainHubs?: StrategyReviewChainHub[];
  strategyCycleObjectives?: StrategyReviewChainItem[];
  strategyCycleChallenges?: StrategyReviewChainItem[];
  executionCoverage?: StrategyReviewCoverageIndex | null;
  feedbackRows: Array<{
    id: string;
    subject_type: string;
    subject_id: string;
    actor_id: string;
    rating: string | null;
    comment: string | null;
    created_at: string;
  }>;
};

export function StrategyReviewProcedureShell({
  cycleInstanceId,
  cycleLabel,
  cycleStart,
  cycleEnd,
  review: initialReview,
  membershipId,
  canWrite,
  canModerate = false,
  canAssignLead = false,
  procedureStartGate = null,
  hidePageHeader = false,
  showDevTools = false,
  participants = [],
  memberOptions = [],
  chainHubs = [],
  strategyCycleObjectives = [],
  strategyCycleChallenges = [],
  executionCoverage = null,
  feedbackRows,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const review = initialReview;
  const [releaseResult, setReleaseResult] = useState<Record<string, unknown> | null>(null);

  const pre = review?.pre_read_payload ?? EMPTY_PRE;
  const challenges = useMemo(
    () => asItems(pre.challenges),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- an Review-Payload gebunden
    [review?.id, review?.pre_read_payload]
  );
  const focusAreas = useMemo(
    () => asItems(pre.focus_areas),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [review?.id, review?.pre_read_payload]
  );
  const objectives = useMemo(
    () => asItems(pre.objectives),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [review?.id, review?.pre_read_payload]
  );

  const existingFeedbackByKey = useMemo(() => {
    const map: Record<string, ExistingFeedbackEntry> = {};
    for (const row of feedbackRows) {
      if (row.actor_id !== membershipId) continue;
      const key = `${row.subject_type}:${row.subject_id}`;
      if (key in map) continue;
      const rating = row.rating?.trim() || null;
      const comment = row.comment?.trim() || "";
      if (!rating && !comment) continue;
      map[key] = { rating, comment };
    }
    return map;
  }, [feedbackRows, membershipId]);

  const reviewerProgress = useMemo(
    () =>
      computeReviewerFeedbackProgress({
        hubs: chainHubs,
        catalogs: {
          objectives: strategyCycleObjectives,
          challenges: strategyCycleChallenges,
        },
        participants,
        feedbackRows,
        roleLabel: strategyReviewParticipantRoleLabel,
      }),
    [chainHubs, strategyCycleObjectives, strategyCycleChallenges, participants, feedbackRows]
  );

  const [decisions, setDecisions] = useState<Record<string, DecisionEntry>>(() =>
    hydrateDecisionsFromPayload(
      emptyDecisionMap(challenges, focusAreas, objectives),
      initialReview?.decision_payload ?? null,
      { challenges, focusAreas, objectives }
    )
  );

  const [meetingNotes, setMeetingNotes] = useState(
    () => initialReview?.meeting_notes ?? ""
  );

  const isReviewLead = useMemo(
    () =>
      participants.some(
        (p) => p.membership_id === membershipId && p.review_role === "lead"
      ),
    [participants, membershipId]
  );

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const run = useCallback(
    (fn: () => Promise<void>) => {
      setError(null);
      return new Promise<void>((resolve, reject) => {
        startTransition(async () => {
          try {
            await fn();
            refresh();
            resolve();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Fehler");
            reject(e);
          }
        });
      });
    },
    [refresh]
  );

  const decisionProgress = useMemo(() => {
    const keys = Object.keys(decisions);
    const done = keys.filter((k) => {
      const d = decisions[k];
      if (!d.decision) return false;
      const needsComment =
        d.decision === "adjust" ||
        d.decision === "replace" ||
        d.decision === "inactivate" ||
        d.decision === "stop" ||
        d.decision === "remove" ||
        d.decision === "change";
      if (needsComment && !d.comment.trim()) return false;
      if (
        (d.decision === "adjust" || d.decision === "replace" || d.decision === "change") &&
        !d.fields?.title?.trim()
      ) {
        return false;
      }
      return true;
    });
    return { done: done.length, total: keys.length };
  }, [decisions]);

  const fieldsToProposed = (fields: DecisionEntry["fields"]) => {
    if (!fields) return {};
    const out: Record<string, unknown> = {
      title: fields.title ?? "",
      description: fields.description ?? "",
    };
    for (const key of [
      "impact_score",
      "urgency_score",
      "scope_score",
      "root_cause_score",
      "priority",
      "grouping",
      "strategic_value_score",
      "capability_fit_score",
      "feasibility_score",
      "risk_score",
      "time_horizon",
      "importance_score",
    ] as const) {
      const v = fields[key];
      if (v !== undefined && v !== "") out[key] = v;
    }
    return out;
  };

  const submitFeedback = useCallback(
    (entries: StrategyReviewFeedbackSubmitEntry[]) => {
      if (!review) return Promise.reject(new Error("Kein Review"));
      if (entries.length === 0) {
        setError("Mindestens einen Punkt bewerten.");
        return Promise.reject(new Error("Mindestens einen Punkt bewerten."));
      }
      return run(async () => {
        await submitStakeholderFeedbackAction(review.id, membershipId, entries);
        await computeReviewReadinessAction(review.id);
      });
    },
    [review, membershipId, run]
  );

  const stepIndex = useMemo(() => {
    if (!review) return 0;
    const p = review.procedure_status;
    if (p === "released" || p === "cancelled") return 4;
    if (p === "decision_captured") return 3;
    if (p === "review_in_progress") return 2;
    if (p === "pre_read_open" || p === "ready_for_review") return 1;
    return 0;
  }, [review]);

  const goToStep = useCallback((index: number) => {
    if (index > stepIndex) return;
    const sectionId = PROCEDURE_STEPS[index]?.sectionId;
    if (!sectionId) return;
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("ring-2", "ring-indigo-300");
      window.setTimeout(() => el.classList.remove("ring-2", "ring-indigo-300"), 1200);
    }
  }, [stepIndex]);

  const buildDecisionPayload = () => {
    const out: Record<string, unknown> = { challenges: [], focus_areas: [], objectives: [] };
    for (const c of challenges) {
      const d = decisions[`challenge:${c.id}`];
      if (!d?.decision) continue;
      const row: Record<string, unknown> = { id: c.id, decision: d.decision, comment: d.comment || null };
      if (d.decision === "adjust") row.proposed_changes = fieldsToProposed(d.fields);
      if (d.decision === "replace") row.replacement = fieldsToProposed(d.fields);
      (out.challenges as unknown[]).push(row);
    }
    for (const f of focusAreas) {
      const d = decisions[`focus_area:${f.id}`];
      if (!d?.decision) continue;
      const row: Record<string, unknown> = { id: f.id, decision: d.decision, comment: d.comment || null };
      if (d.decision === "adjust") row.proposed_changes = fieldsToProposed(d.fields);
      if (d.decision === "replace") row.replacement = fieldsToProposed(d.fields);
      (out.focus_areas as unknown[]).push(row);
    }
    for (const o of objectives) {
      const d = decisions[`objective:${o.id}`];
      if (!d?.decision) continue;
      // Apply kennt bei Objectives weiterhin «change» für Anpassen
      const decision =
        d.decision === "adjust" ? "change" : d.decision === "inactivate" ? "inactivate" : d.decision;
      const row: Record<string, unknown> = { id: o.id, decision, comment: d.comment || null };
      if (decision === "change") {
        row.proposed_changes = fieldsToProposed(d.fields);
      }
      if (decision === "replace") row.replacement = fieldsToProposed(d.fields);
      (out.objectives as unknown[]).push(row);
    }
    return out;
  };

  const submitDecisions = useCallback(async (): Promise<boolean> => {
    if (!review) return false;
    if (decisionProgress.done < decisionProgress.total) {
      setError(`Entscheidungen unvollständig (${decisionProgress.done}/${decisionProgress.total}).`);
      return false;
    }
    const payload = buildDecisionPayload();
    try {
      await run(async () => {
        await saveStrategyReviewDecisionsAction(review.id, payload);
      });
      return true;
    } catch {
      return false;
    }
  }, [review, decisionProgress, run, challenges, focusAreas, objectives, decisions]);

  const saveMeetingNotes = useCallback(async () => {
    if (!review) return;
    await saveStrategyReviewMeetingNotesAction(review.id, meetingNotes);
  }, [review, meetingNotes]);

  const persistMeetingNotes = useCallback(
    async (serialized: string) => {
      if (!review) return;
      setMeetingNotes(serialized);
      await saveStrategyReviewMeetingNotesAction(review.id, serialized);
    },
    [review]
  );

  const actorDisplayName = useMemo(() => {
    const fromParticipant = participants.find((p) => p.membership_id === membershipId)?.display_name;
    if (fromParticipant?.trim()) return fromParticipant.trim();
    const fromOptions = memberOptions.find((m) => m.membership_id === membershipId)?.display_name;
    if (fromOptions?.trim()) return fromOptions.trim();
    return "Ich";
  }, [participants, memberOptions, membershipId]);

  const showActionFlyIn =
    review?.procedure_status === "pre_read_open" ||
    review?.procedure_status === "ready_for_review" ||
    review?.procedure_status === "review_in_progress";
  const flyInMode =
    review?.procedure_status === "review_in_progress" ? "meeting" : "feedback";
  const canSaveFromFlyIn = canWrite || isReviewLead || canModerate;

  if (!review) {
    return (
      <div className="brand-card space-y-4 p-6">
        <p className="text-sm text-zinc-600">Noch kein Strategie-Review-Datensatz für diesen Zyklus.</p>
        {canWrite ? (
          <button
            type="button"
            disabled={pending}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() =>
              run(async () => {
                await ensureStrategyReviewAction(cycleInstanceId);
              })
            }
          >
            Strategie-Review anlegen
          </button>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <StrategyReviewFeedbackDirtyProvider>
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2 text-xs text-zinc-500">
        {PROCEDURE_STEPS.map((s, i) => {
          const reachable = i <= stepIndex;
          const active = i === stepIndex;
          return (
            <button
              key={s.label}
              type="button"
              disabled={!reachable}
              onClick={() => goToStep(i)}
              className={`rounded-full px-2 py-1 ${
                active
                  ? "bg-zinc-900 text-white"
                  : reachable
                    ? "bg-zinc-100 text-zinc-800 hover:bg-zinc-200"
                    : "cursor-not-allowed bg-zinc-50 text-zinc-400"
              }`}
            >
              {i + 1}. {s.label}
            </button>
          );
        })}
      </nav>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      {showDevTools ? (
        <StrategyReviewDevPhasePanel
          currentStatus={review.procedure_status}
          pending={pending}
          onJump={(phase) =>
            void run(async () => {
              await devSetStrategyReviewPhaseAction(review.id, phase);
            })
          }
        />
      ) : null}

      {hidePageHeader ? (
        <div className="brand-card px-6 py-3">
          <p className="text-xs text-zinc-600">
            Status: <strong>{procedureStatusLabelDe(review.procedure_status)}</strong> · Bereitschaft:{" "}
            <strong>{readinessStatusLabelDe(review.readiness_status)}</strong>
          </p>
        </div>
      ) : (
        <header className="brand-card p-6">
          <h1 className="text-xl font-semibold text-zinc-900">Strategie-Review</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Zyklus: {cycleLabel} ({cycleStart} – {cycleEnd})
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Status: <strong>{procedureStatusLabelDe(review.procedure_status)}</strong> · Bereitschaft:{" "}
            <strong>{readinessStatusLabelDe(review.readiness_status)}</strong>
          </p>
        </header>
      )}

      {/* Beteiligte & Rollen nur in Phase 1 (Ankündigung) */}
      {(review.procedure_status === "not_started" ||
        review.procedure_status === "announcement_sent") && (
        <StrategyReviewParticipantsPanel
          reviewId={review.id}
          participants={participants}
          memberOptions={memberOptions}
          canWrite={canModerate || canAssignLead}
        />
      )}

      {/* Step 0 — Announcement */}
      {(review.procedure_status === "not_started" || review.procedure_status === "announcement_sent") && (
        <section id="strategy-review-step-announcement" className="brand-card space-y-4 p-6">
          <h2 className="text-lg font-semibold text-zinc-900">1. Ankündigung</h2>
          <p className="text-sm text-zinc-600">
            Offizieller Start des Strategie-Reviews. Anschließend werden die Vorab-Unterlagen aufgebaut
            (Herausforderungen, Stoßrichtungen, Ziele).
          </p>
          <ul className="list-inside list-disc text-sm text-zinc-600">
            <li>Geplanter Reviewzeitraum: bis {cycleEnd}</li>
            <li>Vorlaufzeit: {review.review_lead_time_days} Tage vor Periodenende</li>
            {procedureStartGate?.daysToEnd != null ? (
              <li>
                Noch {procedureStartGate.daysToEnd} Tage bis Periodenende
                {procedureStartGate.inLeadWindow
                  ? " · Lead-Fenster offen"
                  : " · Lead-Fenster noch nicht offen"}
              </li>
            ) : null}
          </ul>
          {procedureStartGate?.blockReason ? (
            <p
              className={`rounded-md border px-3 py-2 text-sm ${
                procedureStartGate.canStart
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700"
              }`}
            >
              {procedureStartGate.blockReason}
            </p>
          ) : null}
          {review.procedure_status === "not_started" ? (
            <button
              type="button"
              disabled={pending || !procedureStartGate?.canStart}
              className="rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() =>
                run(async () => {
                  await recordStrategyReviewAnnouncementAction(review.id, {
                    channel: "app",
                    note: "Ankündigung über Strategie-Review-Verfahren",
                  });
                })
              }
            >
              Ankündigung senden
              {!procedureStartGate?.inLeadWindow && procedureStartGate?.canModerate
                ? " (Override)"
                : ""}
            </button>
          ) : null}
          {review.procedure_status === "announcement_sent" ? (
            <button
              type="button"
              disabled={pending || !procedureStartGate?.canStart}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() =>
                run(async () => {
                  await prepareStrategyReviewAction(review.id);
                })
              }
            >
              Vorab-Unterlagen aufbereiten
              {!procedureStartGate?.inLeadWindow && procedureStartGate?.canModerate
                ? " (Override)"
                : ""}
            </button>
          ) : null}
        </section>
      )}

      {/* Step 1 — Pre-read & feedback (stoßrichtungszentrierte Kette) */}
      {(review.procedure_status === "pre_read_open" || review.procedure_status === "ready_for_review") && (
        <>
          <StrategyReviewChainReviewPanel
            hubs={chainHubs}
            strategyCycleObjectives={strategyCycleObjectives}
            strategyCycleChallenges={strategyCycleChallenges}
            executionCoverage={executionCoverage}
            existingFeedbackByKey={existingFeedbackByKey}
            canWrite={canWrite}
            onSubmit={submitFeedback}
            pending={pending}
          />

          <section className="brand-card space-y-3 p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Bereitschaft</h2>
            <p className="text-sm text-zinc-600">
              Status: <strong>{readinessStatusLabelDe(review.readiness_status)}</strong>
            </p>
            {reviewerProgress.length > 0 ? (
              <ul className="space-y-2" aria-label="Fortschritt je Reviewer">
                {reviewerProgress.map((r) => (
                  <li
                    key={r.membershipId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900">{r.displayName}</p>
                      <p className="text-xs text-zinc-500">
                        {r.roleLabel} · {r.ratedCount}/{r.totalCount} Elemente
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-200"
                        aria-hidden
                      >
                        <div
                          className={`h-full rounded-full ${
                            r.percent >= 100
                              ? "bg-emerald-600"
                              : r.percent > 0
                                ? "bg-amber-500"
                                : "bg-zinc-300"
                          }`}
                          style={{ width: `${r.percent}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-sm font-semibold tabular-nums text-zinc-800">
                        {r.percent}%
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">
                Noch keine Reviewer eingeladen. Fortschritt erscheint nach Einladung und Feedback.
              </p>
            )}
            {(review.procedure_status === "pre_read_open" ||
              review.procedure_status === "ready_for_review") && (
              <div className="space-y-2 pt-1">
                {isReviewLead ? (
                  <>
                    <GuardedStartMeetingButton
                      disabled={pending}
                      onStart={() =>
                        void run(async () => {
                          await startStrategyReviewMeetingAction(review.id);
                        })
                      }
                    />
                    {review.readiness_status !== "ready" ? (
                      <p className="text-xs text-zinc-500">
                        Feedback ist noch nicht vollständig — das Meeting kann trotzdem gestartet
                        werden.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-xs text-zinc-500">
                    Nur die Review-Leitung kann das Meeting starten.
                  </p>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {/* Step 2 — Meeting / decisions */}
      {review.procedure_status === "review_in_progress" && (
        <StrategyReviewMeetingPanel
          hubs={chainHubs}
          strategyCycleObjectives={strategyCycleObjectives}
          strategyCycleChallenges={strategyCycleChallenges}
          executionCoverage={executionCoverage}
          feedbackRows={feedbackRows}
          participants={participants}
          memberOptions={memberOptions}
          challengeSources={challenges}
          directionSources={focusAreas}
          objectiveSources={objectives}
          decisions={decisions}
          setDecisions={setDecisions}
          decisionProgress={decisionProgress}
          canWrite={canWrite}
          pending={pending}
          onSubmitDecisions={submitDecisions}
        />
      )}

      {/* Step 3 — Release */}
      {review.procedure_status === "decision_captured" && (
        <section id="strategy-review-step-release" className="brand-card space-y-4 p-6">
          <h2 className="text-lg font-semibold text-zinc-900">4. Bericht & Freigabe</h2>

          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
            <p className="font-semibold text-sky-900">Was passiert bei der Bestätigung?</p>
            <ul className="mt-2 list-inside list-disc space-y-1.5 text-sky-950/90">
              <li>
                Die im Meeting getroffenen Entscheidungen (beibehalten, anpassen, ersetzen,
                inaktivieren) werden festgeschrieben.
              </li>
              <li>
                Der beschlossene Stand wird in den <strong>nächsten Strategiezyklus</strong>{" "}
                übernommen — also in die bereits im Kalender vorgesehene Folgeperiode.
              </li>
              <li>
                Analyse- und Kontextinformationen aus dem aktuellen Zyklus werden ebenfalls in die
                Folgeperiode übertragen, damit Sie dort weiterarbeiten können.
              </li>
              <li>
                Der <strong>Kalenderstichtag</strong> (Ende dieses Reviewzyklus: {cycleEnd}) bleibt
                unverändert. Das Meeting oder diese Bestätigung verschieben das Zyklusende nicht.
              </li>
              <li>
                Danach ist dieses Strategie-Review abgeschlossen; weitere Änderungen gehören in den
                nächsten Zyklus.
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Entscheidungen im Überblick</h3>
            {(() => {
              const lines = summarizeStrategyReviewDecisions(review.decision_payload, {
                challenges,
                focusAreas,
                objectives,
              });
              if (lines.length === 0) {
                return (
                  <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                    Es sind noch keine Entscheidungen erfasst. Bitte in Phase 3 Entscheidungen setzen
                    und speichern.
                  </p>
                );
              }
              return (
                <ul className="mt-2 divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
                  {lines.map((line, idx) => (
                    <li key={`${line.kindLabel}-${idx}`} className="px-3 py-2.5 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium text-zinc-900">
                          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            {line.kindLabel}
                          </span>
                          <span className="mt-0.5 block">{line.title}</span>
                        </p>
                        <span className="shrink-0 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-semibold text-zinc-800">
                          {line.decisionLabel}
                        </span>
                      </div>
                      {line.comment ? (
                        <p className="mt-1 text-xs text-zinc-600 whitespace-pre-wrap">{line.comment}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>

          {canWrite ? (
            <button
              type="button"
              disabled={pending}
              className="rounded-md bg-emerald-800 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() =>
                run(async () => {
                  const res = await releaseStrategyReviewAction(review.id);
                  setReleaseResult(res);
                })
              }
            >
              Änderungen bestätigen und Review abschliessen
            </button>
          ) : null}
        </section>
      )}

      {(review.procedure_status === "released" || releaseResult) && (
        <section id="strategy-review-step-done" className="brand-card space-y-4 p-6">
          <h2 className="text-lg font-semibold text-emerald-900">Review abgeschlossen</h2>
          <p className="text-sm text-zinc-600">
            Die Entscheidungen sind festgeschrieben und der Stand wurde in die Folgeperiode
            übernommen. Das Kalenderende dieses Zyklus ({cycleEnd}) bleibt unverändert.
          </p>
        </section>
      )}

      {showActionFlyIn ? (
        <StrategyReviewActionFlyIn
          mode={flyInMode}
          notes={meetingNotes}
          onNotesChange={setMeetingNotes}
          onPersistNotes={
            isReviewLead || canModerate ? persistMeetingNotes : undefined
          }
          canSave={canSaveFromFlyIn}
          canEditNotes={isReviewLead || canModerate}
          pending={pending}
          actorMembershipId={membershipId}
          actorDisplayName={actorDisplayName}
          beforeSave={
            flyInMode === "meeting" && (isReviewLead || canModerate)
              ? async () => {
                  await saveMeetingNotes();
                }
              : undefined
          }
        />
      ) : null}

    </div>
    </StrategyReviewFeedbackDirtyProvider>
  );
}

function StrategyReviewDevPhasePanel({
  currentStatus,
  pending,
  onJump,
}: {
  currentStatus: string;
  pending: boolean;
  onJump: (phase: StrategyReviewDevPhase) => void;
}) {
  const phases: Array<{
    phase: StrategyReviewDevPhase;
    label: string;
    active: boolean;
  }> = [
    {
      phase: "announcement",
      label: "1 · Ankündigung",
      active: currentStatus === "not_started" || currentStatus === "announcement_sent",
    },
    {
      phase: "pre_read",
      label: "2 · Vorab & Feedback",
      active: currentStatus === "pre_read_open" || currentStatus === "ready_for_review",
    },
    {
      phase: "meeting",
      label: "3 · Meeting",
      active: currentStatus === "review_in_progress",
    },
    {
      phase: "release",
      label: "4 · Freigabe",
      active: currentStatus === "decision_captured",
    },
  ];

  return (
    <div className="rounded-md border border-dashed border-violet-300 bg-violet-50 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-900">
        Dev · Phasen wechseln
      </p>
      <p className="mt-1 text-[11px] text-violet-800">
        Nur Entwicklung: Verfahrensstatus springen (ohne Lead-/Berechtigungsprüfung).
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {phases.map((p) => (
          <button
            key={p.phase}
            type="button"
            disabled={pending || p.active}
            className={`rounded-md border px-2.5 py-1.5 text-xs font-medium disabled:opacity-50 ${
              p.active
                ? "border-violet-700 bg-violet-700 text-white"
                : "border-violet-300 bg-white text-violet-950 hover:bg-violet-100"
            }`}
            onClick={() => onJump(p.phase)}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function GuardedStartMeetingButton({
  disabled,
  onStart,
}: {
  disabled: boolean;
  onStart: () => void;
}) {
  const { requestNavigation } = useStrategyReviewFeedbackDirty();
  return (
    <button
      type="button"
      disabled={disabled}
      className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      onClick={() => requestNavigation(onStart)}
    >
      Review-Meeting starten
    </button>
  );
}
