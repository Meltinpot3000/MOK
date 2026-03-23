"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import type { StrategyReviewRow } from "@/lib/strategy-review/types";
import {
  ensureStrategyReviewAction,
  recordStrategyReviewAnnouncementAction,
  prepareStrategyReviewAction,
  submitStakeholderFeedbackAction,
  forceReviewReadyAction,
  startStrategyReviewMeetingAction,
  saveStrategyReviewDecisionsAction,
  releaseStrategyReviewAction,
  computeReviewReadinessAction,
} from "@/app/(ceo)/okr/strategy-review-actions";

type PreItem = { id: string; title?: string; description?: string; [key: string]: unknown };

function asItems(v: unknown): PreItem[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => x && typeof x === "object" && typeof (x as PreItem).id === "string") as PreItem[];
}

type DecisionEntry = {
  decision: string;
  comment: string;
  proposedTitle?: string;
  proposedDescription?: string;
  replacementTitle?: string;
  replacementDescription?: string;
};

type Props = {
  cycleInstanceId: string;
  cycleLabel: string;
  cycleStart: string;
  cycleEnd: string;
  review: StrategyReviewRow | null;
  membershipId: string;
  canWrite: boolean;
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
  feedbackRows,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<StrategyReviewRow | null>(initialReview);
  const [releaseResult, setReleaseResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    setReview(initialReview);
  }, [initialReview]);

  const [forceReason, setForceReason] = useState("");
  const [showForce, setShowForce] = useState(false);

  const pre = review?.pre_read_payload ?? {};
  const challenges = useMemo(() => asItems(pre.challenges), [pre]);
  const focusAreas = useMemo(() => asItems(pre.focus_areas), [pre]);
  const objectives = useMemo(() => asItems(pre.objectives), [pre]);

  const [feedbackDraft, setFeedbackDraft] = useState<Record<string, { rating: string; comment: string }>>(() => {
    const m: Record<string, { rating: string; comment: string }> = {};
    const add = (prefix: string, id: string) => {
      m[`${prefix}:${id}`] = { rating: "", comment: "" };
    };
    for (const c of challenges) add("challenge", c.id);
    for (const f of focusAreas) add("focus_area", f.id);
    for (const o of objectives) add("objective", o.id);
    return m;
  });

  const [decisions, setDecisions] = useState<Record<string, DecisionEntry>>(() => {
    const m: Record<string, DecisionEntry> = {};
    const add = (prefix: string, id: string) => {
      m[`${prefix}:${id}`] = { decision: "", comment: "" };
    };
    for (const c of challenges) add("challenge", c.id);
    for (const f of focusAreas) add("focus_area", f.id);
    for (const o of objectives) add("objective", o.id);
    return m;
  });

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const run = useCallback(
    (fn: () => Promise<void>) => {
      setError(null);
      startTransition(async () => {
        try {
          await fn();
          refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Fehler");
        }
      });
    },
    [refresh]
  );

  const decisionProgress = useMemo(() => {
    const keys = Object.keys(decisions);
    const done = keys.filter((k) => {
      const d = decisions[k];
      if (!d.decision) return false;
      if ((k.startsWith("challenge:") && (d.decision === "adjust" || d.decision === "replace")) && !d.comment.trim()) {
        return false;
      }
      if (k.startsWith("challenge:") && d.decision === "adjust" && !d.proposedTitle?.trim() && !d.proposedDescription?.trim()) {
        return false;
      }
      if (k.startsWith("challenge:") && d.decision === "replace" && (!d.replacementTitle?.trim() || !d.replacementDescription?.trim())) {
        return false;
      }
      if (k.startsWith("focus_area:") && (d.decision === "adjust" || d.decision === "stop") && !d.comment.trim()) return false;
      if (k.startsWith("focus_area:") && d.decision === "adjust" && !d.proposedTitle?.trim() && !d.proposedDescription?.trim()) {
        return false;
      }
      if (k.startsWith("objective:") && (d.decision === "change" || d.decision === "remove") && !d.comment.trim()) return false;
      if (k.startsWith("objective:") && d.decision === "change" && !d.proposedTitle?.trim() && !d.proposedDescription?.trim()) {
        return false;
      }
      return true;
    });
    return { done: done.length, total: keys.length };
  }, [decisions]);

  const submitFeedback = () => {
    if (!review) return;
    const entries: Array<{
      subject_type: string;
      subject_id: string;
      rating: string | null;
      comment: string | null;
    }> = [];
    for (const [key, v] of Object.entries(feedbackDraft)) {
      const [st, id] = key.split(":");
      if (!v.rating) continue;
      entries.push({
        subject_type: st,
        subject_id: id,
        rating: v.rating,
        comment: v.comment.trim() || null,
      });
    }
    if (entries.length === 0) {
      setError("Mindestens eine Bewertung auswählen.");
      return;
    }
    run(async () => {
      await submitStakeholderFeedbackAction(review.id, membershipId, entries);
    });
  };

  const buildDecisionPayload = () => {
    const out: Record<string, unknown> = { challenges: [], focus_areas: [], objectives: [] };
    for (const c of challenges) {
      const d = decisions[`challenge:${c.id}`];
      if (!d?.decision) continue;
      const row: Record<string, unknown> = { id: c.id, decision: d.decision, comment: d.comment || null };
      if (d.decision === "adjust") {
        row.proposed_changes = {
          title: d.proposedTitle ?? "",
          description: d.proposedDescription ?? "",
        };
      }
      if (d.decision === "replace") {
        row.replacement = {
          title: d.replacementTitle ?? "",
          description: d.replacementDescription ?? "",
        };
      }
      (out.challenges as unknown[]).push(row);
    }
    for (const f of focusAreas) {
      const d = decisions[`focus_area:${f.id}`];
      if (!d?.decision) continue;
      const row: Record<string, unknown> = { id: f.id, decision: d.decision, comment: d.comment || null };
      if (d.decision === "adjust") {
        row.proposed_changes = {
          title: d.proposedTitle ?? "",
          description: d.proposedDescription ?? "",
        };
      }
      (out.focus_areas as unknown[]).push(row);
    }
    for (const o of objectives) {
      const d = decisions[`objective:${o.id}`];
      if (!d?.decision) continue;
      const row: Record<string, unknown> = { id: o.id, decision: d.decision, comment: d.comment || null };
      if (d.decision === "change") {
        row.proposed_changes = {
          title: d.proposedTitle ?? "",
          description: d.proposedDescription ?? "",
        };
      }
      (out.objectives as unknown[]).push(row);
    }
    return out;
  };

  const submitDecisions = () => {
    if (!review) return;
    if (decisionProgress.done < decisionProgress.total) {
      setError(`Entscheidungen unvollständig (${decisionProgress.done}/${decisionProgress.total}).`);
      return;
    }
    const payload = buildDecisionPayload();
    run(async () => {
      await saveStrategyReviewDecisionsAction(review.id, payload);
    });
  };

  const stepIndex = useMemo(() => {
    if (!review) return 0;
    const p = review.procedure_status;
    if (p === "released" || p === "cancelled") return 4;
    if (p === "decision_captured") return 3;
    if (p === "review_in_progress") return 2;
    if (p === "pre_read_open" || p === "ready_for_review") return 1;
    return 0;
  }, [review]);

  const steps = ["Ankündigung", "Pre-Read & Feedback", "Meeting", "Release", "Abschluss"];

  if (!review) {
    return (
      <div className="brand-card space-y-4 p-6">
        <p className="text-sm text-zinc-600">Noch kein Strategy-Review-Datensatz für diese Instanz.</p>
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
            Strategy Review anlegen
          </button>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2 text-xs text-zinc-500">
        {steps.map((s, i) => (
          <span
            key={s}
            className={`rounded-full px-2 py-1 ${i === stepIndex ? "bg-zinc-900 text-white" : "bg-zinc-100"}`}
          >
            {i + 1}. {s}
          </span>
        ))}
      </nav>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <header className="brand-card p-6">
        <h1 className="text-xl font-semibold text-zinc-900">Strategy Review</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Zyklus: {cycleLabel} ({cycleStart} – {cycleEnd})
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Status: <strong>{review.procedure_status}</strong> · Readiness:{" "}
          <strong>{review.readiness_status}</strong>
          {review.override_forced ? " · Override aktiv" : ""}
        </p>
      </header>

      {/* Step 0 — Announcement */}
      {(review.procedure_status === "not_started" || review.procedure_status === "announcement_sent") && (
        <section className="brand-card space-y-4 p-6">
          <h2 className="text-lg font-semibold text-zinc-900">1. Ankündigung</h2>
          <p className="text-sm text-zinc-600">
            Offizieller Start des Strategy Reviews. Anschließend wird der Pre-Read-Payload aufgebaut (Herausforderungen,
            Stoßrichtungen, Ziele).
          </p>
          <ul className="list-inside list-disc text-sm text-zinc-600">
            <li>Geplanter Reviewzeitraum: bis {cycleEnd}</li>
            <li>Lead Time: {review.review_lead_time_days} Tage vor Periodenende</li>
          </ul>
          {review.procedure_status === "not_started" && canWrite ? (
            <button
              type="button"
              disabled={pending}
              className="rounded-md bg-amber-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() =>
                run(async () => {
                  await recordStrategyReviewAnnouncementAction(review.id, {
                    channel: "app",
                    note: "Announcement über Strategy Review Procedure",
                  });
                })
              }
            >
              Announcement senden
            </button>
          ) : null}
          {review.procedure_status === "announcement_sent" && canWrite ? (
            <button
              type="button"
              disabled={pending}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() =>
                run(async () => {
                  await prepareStrategyReviewAction(review.id);
                })
              }
            >
              Pre-Read aufbereiten
            </button>
          ) : null}
        </section>
      )}

      {/* Step 1 — Pre-read & feedback */}
      {(review.procedure_status === "pre_read_open" || review.procedure_status === "ready_for_review") && (
        <>
          <section className="brand-card space-y-4 p-6">
            <h2 className="text-lg font-semibold text-zinc-900">2. Pre-Read</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <CardList title="Herausforderungen" items={challenges} />
              <CardList title="Stoßrichtungen" items={focusAreas} />
            </div>
            <CardList title="Objectives" items={objectives} dense />
          </section>

          <section className="brand-card space-y-4 p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Stakeholder-Feedback</h2>
            <p className="text-sm text-zinc-600">Pro Thema eine Bewertung; Kommentar bei Bedarf.</p>
            <FeedbackBlock
              title="Herausforderungen"
              prefix="challenge"
              items={challenges}
              options={[
                { v: "improved", l: "verbessert" },
                { v: "unchanged", l: "gleich" },
                { v: "worsened", l: "verschlechtert" },
              ]}
              draft={feedbackDraft}
              setDraft={setFeedbackDraft}
              disabled={!canWrite}
            />
            <FeedbackBlock
              title="Stoßrichtungen"
              prefix="focus_area"
              items={focusAreas}
              options={[
                { v: "high_impact", l: "hohe Wirkung" },
                { v: "medium_impact", l: "mittlere Wirkung" },
                { v: "low_impact", l: "geringe Wirkung" },
                { v: "negative_impact", l: "negative Wirkung" },
              ]}
              draft={feedbackDraft}
              setDraft={setFeedbackDraft}
              disabled={!canWrite}
            />
            <FeedbackBlock
              title="Objectives"
              prefix="objective"
              items={objectives}
              options={[
                { v: "keep", l: "beibehalten" },
                { v: "sharpen", l: "schärfen" },
                { v: "questionable", l: "fraglich" },
              ]}
              draft={feedbackDraft}
              setDraft={setFeedbackDraft}
              disabled={!canWrite}
            />
            {canWrite ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  onClick={submitFeedback}
                >
                  Feedback speichern
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-800 disabled:opacity-50"
                  onClick={() => run(async () => computeReviewReadinessAction(review.id))}
                >
                  Readiness neu berechnen
                </button>
              </div>
            ) : null}
          </section>

          <section className="brand-card space-y-3 p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Readiness</h2>
            <p className="text-sm text-zinc-600">
              Status: <strong>{review.readiness_status}</strong> — es liegt{" "}
              <strong>{feedbackRows.length}</strong> Feedback-Einträge vor.
            </p>
            {canWrite ? (
              <>
                <button
                  type="button"
                  className="text-sm text-amber-800 underline"
                  onClick={() => setShowForce((s) => !s)}
                >
                  Review forciert freigeben (mit Begründung)
                </button>
                {showForce ? (
                  <div className="flex max-w-lg flex-col gap-2">
                    <textarea
                      value={forceReason}
                      onChange={(e) => setForceReason(e.target.value)}
                      rows={3}
                      className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                      placeholder="Pflichtbegründung für Audit …"
                    />
                    <button
                      type="button"
                      disabled={pending || forceReason.trim().length < 3}
                      className="w-fit rounded-md bg-amber-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      onClick={() =>
                        run(async () => {
                          await forceReviewReadyAction(review.id, forceReason);
                          setForceReason("");
                          setShowForce(false);
                        })
                      }
                    >
                      Override setzen
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
            {(() => {
              const canStartNormal =
                review.readiness_status === "ready" && review.procedure_status === "ready_for_review";
              const canStartOverride =
                review.override_forced &&
                (review.procedure_status === "pre_read_open" || review.procedure_status === "ready_for_review");
              const canStart = canStartNormal || canStartOverride;
              return review.procedure_status === "ready_for_review" ||
                review.readiness_status === "ready" ||
                review.override_forced ? (
                <button
                  type="button"
                  disabled={pending || !canStart}
                  className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  onClick={() =>
                    run(async () => {
                      await startStrategyReviewMeetingAction(review.id);
                    })
                  }
                >
                  Review-Meeting starten
                </button>
              ) : (
                <p className="text-sm text-zinc-500">
                  Meeting starten, wenn Readiness „ready“ und Status „ready_for_review“ ist, oder bei Override in
                  Pre-Read.
                </p>
              );
            })()}
          </section>
        </>
      )}

      {/* Step 2 — Meeting / decisions */}
      {review.procedure_status === "review_in_progress" && (
        <section className="brand-card space-y-4 p-6">
          <h2 className="text-lg font-semibold text-zinc-900">3. Meeting & Entscheidungen</h2>
          <p className="text-sm text-zinc-600">
            Fortschritt: {decisionProgress.done} / {decisionProgress.total} Entscheidungen mit Pflichtfeldern.
          </p>
          <DecisionBlock
            title="Herausforderungen"
            prefix="challenge"
            items={challenges}
            kind="challenge"
            decisions={decisions}
            setDecisions={setDecisions}
            disabled={!canWrite}
          />
          <DecisionBlock
            title="Stoßrichtungen"
            prefix="focus_area"
            items={focusAreas}
            kind="focus"
            decisions={decisions}
            setDecisions={setDecisions}
            disabled={!canWrite}
          />
          <DecisionBlock
            title="Objectives"
            prefix="objective"
            items={objectives}
            kind="objective"
            decisions={decisions}
            setDecisions={setDecisions}
            disabled={!canWrite}
          />
          {canWrite ? (
            <button
              type="button"
              disabled={pending || decisionProgress.done < decisionProgress.total}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={submitDecisions}
            >
              Entscheidungen erfassen
            </button>
          ) : null}
        </section>
      )}

      {/* Step 3 — Release */}
      {review.procedure_status === "decision_captured" && (
        <section className="brand-card space-y-4 p-6">
          <h2 className="text-lg font-semibold text-zinc-900">4. Report & Release</h2>
          <p className="text-sm text-zinc-600">
            Vorschau der erfassten Entscheidungen. Release schreibt in die <strong>nächste materialisierte</strong>{" "}
            <code className="text-xs">cycle_instance</code> (Kalenderfolge) und führt Analyse-Carry-Forward aus.
          </p>
          <pre className="max-h-64 overflow-auto rounded-md bg-zinc-50 p-3 text-xs text-zinc-800">
            {JSON.stringify(review.decision_payload, null, 2)}
          </pre>
          {review.override_forced ? (
            <p className="text-sm text-amber-800">Hinweis: Review wurde mit Override gestartet — {review.override_reason}</p>
          ) : null}
          {canWrite ? (
            <button
              type="button"
              disabled={pending}
              className="rounded-md bg-emerald-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() =>
                run(async () => {
                  const res = await releaseStrategyReviewAction(review.id);
                  setReleaseResult(res);
                })
              }
            >
              Nächsten Zyklus freigeben
            </button>
          ) : null}
        </section>
      )}

      {(review.procedure_status === "released" || releaseResult) && (
        <section className="brand-card space-y-4 p-6">
          <h2 className="text-lg font-semibold text-emerald-900">Review freigegeben</h2>
          <p className="text-sm text-zinc-600">
            Ziel-Instanz:{" "}
            <code className="text-xs">{String((releaseResult ?? review.release_summary)?.to_cycle_instance_id ?? review.released_to_cycle_instance_id ?? "—")}</code>
          </p>
          <pre className="max-h-80 overflow-auto rounded-md bg-zinc-50 p-3 text-xs text-zinc-800">
            {JSON.stringify(releaseResult ?? review.release_summary, null, 2)}
          </pre>
        </section>
      )}

    </div>
  );
}

function CardList({ title, items, dense }: { title: string; items: PreItem[]; dense?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      <ul className={`mt-2 space-y-2 ${dense ? "text-xs" : "text-sm"} text-zinc-700`}>
        {items.length === 0 ? <li className="text-zinc-400">Keine Einträge</li> : null}
        {items.map((c) => (
          <li key={c.id} className="rounded-md bg-zinc-50 px-2 py-1">
            <span className="font-medium">{c.title ?? c.id}</span>
            {c.description ? <p className="mt-0.5 text-zinc-500">{String(c.description).slice(0, 200)}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeedbackBlock({
  title,
  prefix,
  items,
  options,
  draft,
  setDraft,
  disabled,
}: {
  title: string;
  prefix: string;
  items: PreItem[];
  options: { v: string; l: string }[];
  draft: Record<string, { rating: string; comment: string }>;
  setDraft: Dispatch<SetStateAction<Record<string, { rating: string; comment: string }>>>;
  disabled: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
      <div className="space-y-3">
        {items.map((it) => {
          const key = `${prefix}:${it.id}`;
          const row = draft[key] ?? { rating: "", comment: "" };
          return (
            <div key={key} className="rounded-md border border-zinc-200 p-3">
              <p className="text-sm font-medium text-zinc-900">{it.title ?? it.id}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {options.map((o) => (
                  <label key={o.v} className="flex items-center gap-1 text-xs text-zinc-700">
                    <input
                      type="radio"
                      name={`fb-${key}`}
                      checked={row.rating === o.v}
                      disabled={disabled}
                      onChange={() =>
                        setDraft((d) => ({
                          ...d,
                          [key]: { ...row, rating: o.v },
                        }))
                      }
                    />
                    {o.l}
                  </label>
                ))}
              </div>
              <input
                type="text"
                value={row.comment}
                disabled={disabled}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    [key]: { ...row, comment: e.target.value },
                  }))
                }
                placeholder="Kommentar (optional)"
                className="mt-2 w-full rounded border border-zinc-200 px-2 py-1 text-xs"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DecisionBlock({
  title,
  prefix,
  items,
  kind,
  decisions,
  setDecisions,
  disabled,
}: {
  title: string;
  prefix: string;
  items: PreItem[];
  kind: "challenge" | "focus" | "objective";
  decisions: Record<string, DecisionEntry>;
  setDecisions: Dispatch<SetStateAction<Record<string, DecisionEntry>>>;
  disabled: boolean;
}) {
  if (items.length === 0) return null;

  const opts =
    kind === "challenge"
      ? [
          { v: "keep", l: "Keep" },
          { v: "adjust", l: "Adjust" },
          { v: "replace", l: "Replace" },
        ]
      : kind === "focus"
        ? [
            { v: "double_down", l: "Double down" },
            { v: "adjust", l: "Adjust" },
            { v: "stop", l: "Stop" },
          ]
        : [
            { v: "keep", l: "Keep" },
            { v: "change", l: "Change" },
            { v: "remove", l: "Remove" },
          ];

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      {items.map((it) => {
        const key = `${prefix}:${it.id}`;
        const d = decisions[key] ?? { decision: "", comment: "" };
        const set = (patch: Partial<DecisionEntry>) =>
          setDecisions((prev) => ({
            ...prev,
            [key]: { ...d, ...patch },
          }));

        return (
          <div key={key} className="border-t border-zinc-100 pt-3 first:border-t-0 first:pt-0">
            <p className="text-sm font-medium text-zinc-800">{it.title ?? it.id}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {opts.map((o) => (
                <label key={o.v} className="flex items-center gap-1 text-xs">
                  <input
                    type="radio"
                    name={`dec-${key}`}
                    checked={d.decision === o.v}
                    disabled={disabled}
                    onChange={() => set({ decision: o.v })}
                  />
                  {o.l}
                </label>
              ))}
            </div>
            <textarea
              value={d.comment}
              disabled={disabled}
              onChange={(e) => set({ comment: e.target.value })}
              placeholder="Begründung (Pflicht bei Stop/Remove/Adjust/Change/Replace je nach Regel)"
              rows={2}
              className="mt-2 w-full rounded border border-zinc-200 px-2 py-1 text-xs"
            />
            {(kind === "challenge" && d.decision === "adjust") || (kind === "focus" && d.decision === "adjust") ? (
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <input
                  className="rounded border border-zinc-200 px-2 py-1 text-xs"
                  placeholder="Neuer Titel"
                  value={d.proposedTitle ?? ""}
                  disabled={disabled}
                  onChange={(e) => set({ proposedTitle: e.target.value })}
                />
                <input
                  className="rounded border border-zinc-200 px-2 py-1 text-xs"
                  placeholder="Neue Beschreibung"
                  value={d.proposedDescription ?? ""}
                  disabled={disabled}
                  onChange={(e) => set({ proposedDescription: e.target.value })}
                />
              </div>
            ) : null}
            {kind === "challenge" && d.decision === "replace" ? (
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <input
                  className="rounded border border-zinc-200 px-2 py-1 text-xs"
                  placeholder="Ersatz-Titel"
                  value={d.replacementTitle ?? ""}
                  disabled={disabled}
                  onChange={(e) => set({ replacementTitle: e.target.value })}
                />
                <input
                  className="rounded border border-zinc-200 px-2 py-1 text-xs"
                  placeholder="Ersatz-Beschreibung"
                  value={d.replacementDescription ?? ""}
                  disabled={disabled}
                  onChange={(e) => set({ replacementDescription: e.target.value })}
                />
              </div>
            ) : null}
            {kind === "objective" && d.decision === "change" ? (
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <input
                  className="rounded border border-zinc-200 px-2 py-1 text-xs"
                  placeholder="Angepasster Titel"
                  value={d.proposedTitle ?? ""}
                  disabled={disabled}
                  onChange={(e) => set({ proposedTitle: e.target.value })}
                />
                <input
                  className="rounded border border-zinc-200 px-2 py-1 text-xs"
                  placeholder="Angepasste Beschreibung"
                  value={d.proposedDescription ?? ""}
                  disabled={disabled}
                  onChange={(e) => set({ proposedDescription: e.target.value })}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
